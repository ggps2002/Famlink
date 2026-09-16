import { BaseService } from "../../core/http/BaseService.js";
import { parseOnboardingAnswers } from "../waitlist/waitlist.util.js";

/**
 * How a sheet's Source column maps to a member type.
 *
 * Unrecognised sources are left alone rather than guessed — a wrong type here
 * puts a caregiver in the families column permanently.
 */
const SOURCE_USER_TYPE = [
  [/caregiver/i, "Nanny"],
  [/family|parent/i, "Parents"],
  // The standalone waitlist page asks about children — it is a family form.
  [/waitlist\s*page/i, "Parents"],
];

const BACKFILL_LIMIT = 50000;

/**
 * Reconstructing the waitlist from data that predates it.
 *
 * The capture hooks only run for people who complete onboarding from now on,
 * which would leave the screen empty on the day it shipped despite the platform
 * already holding the records.
 *
 * Everything here is idempotent. `recordWaitlistEntry` upserts on email, and
 * the sheet pass only ever fills fields that are empty — so re-running produces
 * the same table rather than duplicating it.
 */
export class WaitlistBackfillService extends BaseService {
  /**
   * Recover intake answers, and the family/caregiver split, from the sheet.
   *
   * Both caregiver questionnaires built their "Label: value | …" summary,
   * posted it to the sheet, then called the confirmation WITHOUT it. So every
   * caregiver showed a dash in "What they asked for", and landed as userType
   * "unknown" because the same call omitted that too. The forms now send both —
   * but the answers people already gave exist nowhere on our side, and only the
   * sheet still has them.
   *
   * Deliberately narrow, because this reconstructs a record from a source the
   * platform does not own:
   *
   *   • Answers are written ONLY to rows that have none. A row captured
   *     properly is never overwritten by a sheet row that may be older or
   *     hand-edited.
   *   • userType is set ONLY where it is currently unknown, and only from a
   *     Source column we recognise.
   *   • Nothing else is touched — not the name, not the location, not consent.
   *     The sheet's location is free text and the row's is resolved against the
   *     launch radius, so preferring the sheet would be a downgrade.
   *
   * Never throws for missing configuration: sheet reading is optional, and a
   * backfill that already moved real records must not report failure because an
   * add-on step could not run.
   */
  async recoverAnswersFromSheet() {
    if (!this.sheetsConfigured()) {
      return { ran: false, reason: "Google Sheets reading isn't set up." };
    }

    const { headers, rows } = await this.fetchSheet("waitlist");

    const emailColumn = this.findEmailColumn(headers);
    const detailsColumn =
      headers.find((header) => /^details$/i.test(String(header).trim())) ||
      headers.find((header) => /detail/i.test(String(header)));
    const sourceColumn = headers.find((header) => /^source$/i.test(String(header).trim()));

    if (!emailColumn || !detailsColumn) {
      return {
        ran: false,
        reason: `The waitlist sheet has no ${!emailColumn ? "email" : "Details"} column.`,
      };
    }

    const operations = [];

    for (const row of rows) {
      const email = this.normalizeEmail(row[emailColumn]);
      if (!email) continue;

      const raw = String(row[detailsColumn] || "").trim();
      const answers = parseOnboardingAnswers(raw);

      if (answers.length) {
        operations.push({
          updateOne: {
            // `answers.0` missing is the exact test for "this row has no
            // answers", and it keeps re-runs inert.
            filter: { email, "onboarding.answers.0": { $exists: false } },
            update: {
              $set: { onboarding: { raw: raw.slice(0, 4000), answers }, updatedAt: new Date() },
            },
          },
        });
      }

      const sourceValue = sourceColumn ? String(row[sourceColumn] || "") : "";
      const mapped = SOURCE_USER_TYPE.find(([pattern]) => pattern.test(sourceValue))?.[1];

      if (mapped) {
        operations.push({
          updateOne: {
            filter: { email, userType: { $in: [null, "unknown"] } },
            update: { $set: { userType: mapped, updatedAt: new Date() } },
          },
        });
      }
    }

    // Before/after, because "12 rows updated" does not answer the question an
    // admin actually has — whether any dashes are left in the table.
    const missingBefore = await this.waitlistRepository.count({
      "onboarding.answers.0": { $exists: false },
    });

    if (!operations.length) {
      return {
        ran: true,
        sheetRows: rows.length,
        updatesApplied: 0,
        missingBefore,
        missingAfter: missingBefore,
      };
    }

    const result = await this.waitlistRepository.bulkWrite(operations, { ordered: false });

    const missingAfter = await this.waitlistRepository.count({
      "onboarding.answers.0": { $exists: false },
    });

    return {
      ran: true,
      sheetRows: rows.length,
      updatesApplied: result.modifiedCount || 0,
      // Split by kind: bulkWrite reports one total, and "12 modified" hides
      // whether it put back answers or resolved a user type.
      answersOffered: operations.filter((op) => op.updateOne.update.$set.onboarding).length,
      typesOffered: operations.filter((op) => op.updateOne.update.$set.userType).length,
      missingBefore,
      missingAfter,
    };
  }

  /**
   * Record, as provenance, that the waitlist-form signups did ask to be told.
   *
   * This no longer changes who may be emailed — consent is resolved elsewhere,
   * and a row with no account is a Yes there whether or not this has run. What
   * it fixes is the RECORD: both waitlist flows end in a button reading "Join
   * Waitlist" or "Notify me when you're here", above copy promising to email at
   * launch. That IS an explicit request and is worth having on file as one.
   *
   * ── What it deliberately does NOT touch ────────────────────────────────
   *   • Onboarding leads. Those are captured silently part-way through a
   *     questionnaire; nobody saw a waitlist prompt, so there is no request to
   *     record. The console shows them as consented by default, which is a
   *     different and more honest claim.
   *   • Anyone with `unsubscribedAt` set. Withdrawal outranks every other
   *     signal; re-consenting someone who opted out is the one thing this must
   *     never do.
   *   • Rows already true — the update is scoped to false ones, so re-running
   *     changes nothing.
   */
  async backfillConsent({ body = {} }) {
    const { confirm = false, sources } = body;

    // Only the sources where a person actively asked. Overridable so an admin
    // can widen it deliberately, never by accident.
    const targetSources =
      Array.isArray(sources) && sources.length ? sources.map(String) : ["waitlist-form"];

    const filter = {
      source: { $in: targetSources },
      notifyConsent: { $ne: true },
      unsubscribedAt: null,
    };

    // What is out there right now, by source, so the numbers can be checked
    // against the data rather than taken on trust — and so a source value
    // nobody remembered shows up instead of being silently skipped.
    const breakdown = await this.waitlistRepository.aggregate([
      { $match: { notifyConsent: { $ne: true }, unsubscribedAt: null } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const eligible = await this.waitlistRepository.count(filter);

    if (confirm !== true) {
      return {
        dryRun: true,
        message:
          `${eligible} waitlist ${eligible === 1 ? "row" : "rows"} would be marked as consented. ` +
          "Nothing has changed — send confirm: true to apply.",
        data: {
          dryRun: true,
          eligible,
          sources: targetSources,
          withoutConsentBySource: breakdown.map((row) => ({
            source: row._id || "(none)",
            count: row.count,
            included: targetSources.includes(row._id),
          })),
        },
      };
    }

    const result = await this.waitlistRepository.updateMany(filter, {
      $set: { notifyConsent: true, updatedAt: new Date() },
    });

    return {
      dryRun: false,
      eligible,
      sources: targetSources,
      modified: result.modifiedCount,
      message:
        `${result.modifiedCount} ${result.modifiedCount === 1 ? "person is" : "people are"} ` +
        "now marked as consented and will be included in launch emails.",
      data: { dryRun: false, modified: result.modifiedCount, sources: targetSources },
    };
  }

  /**
   * Populate the waitlist from the two collections that predate it: registered
   * members who completed onboarding, and onboarding leads who never did.
   */
  async backfillAll() {
    const [users, leads] = await Promise.all([
      this.userRepository.find(
        { status: { $ne: "Deleted" }, type: { $in: ["Parents", "Nanny"] } },
        {
          select: "name email type location createdAt onboarding notifications zipCode",
          limit: BACKFILL_LIMIT,
          lean: true,
        }
      ),
      this.onboardingLeadRepository.find({}, { limit: BACKFILL_LIMIT, lean: true }),
    ]);

    let usersAdded = 0;
    for (const user of users) {
      const added = await this.recordWaitlistEntry({
        email: user.email,
        name: user.name,
        userType: user.type,
        // recordWaitlistEntry keeps only the coarse parts and drops the
        // coordinates, which is what makes this safe to copy into a collection
        // the console reads back.
        location: { ...user.location, zip: user.zipCode },
        source: "backfill",
        // A launch announcement is marketing, so it rides on the newsletter
        // opt-in — the one consent on file that covers this kind of mail.
        notifyConsent: user.notifications?.email?.newsletter !== false,
        userId: user._id,
        onboardingCompletedAt: user.createdAt,
      });
      if (added) usersAdded += 1;
    }

    let leadsAdded = 0;
    for (const lead of leads) {
      const added = await this.recordWaitlistEntry({
        email: lead.email,
        name: lead.name,
        userType: lead.source === "family-match" ? "Parents" : "Nanny",
        location: lead.location,
        source: lead.source || "backfill",
        // A lead never saw a consent checkbox, so nothing is recorded as having
        // been asked. That is provenance, not permission: with no account and
        // no unsubscribe on file they still resolve to consented.
        notifyConsent: false,
        details: lead.details,
        onboardingCompletedAt: lead.createdAt,
      });
      if (added) leadsAdded += 1;
    }

    // Last, so it fills gaps in rows the two passes above already created
    // rather than racing them. Failure is reported, not thrown: everything
    // above has been written and is worth keeping.
    let sheetRecovery;
    try {
      sheetRecovery = await this.recoverAnswersFromSheet();
    } catch (error) {
      console.error("admin/waitlist sheet recovery failed:", error?.message || error);
      sheetRecovery = { ran: false, reason: error?.message || "Could not read the sheet." };
    }

    return {
      usersProcessed: users.length,
      usersAdded,
      leadsProcessed: leads.length,
      leadsAdded,
      waitlistTotal: await this.waitlistRepository.count({}),
      sheetRecovery,
      note:
        "Onboarding leads are listed as consented by default — they have no account and have not " +
        "unsubscribed. Nothing records them as having asked, because they were never shown a " +
        "consent checkbox.",
    };
  }
}

export default WaitlistBackfillService;
