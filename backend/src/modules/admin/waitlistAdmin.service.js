import { BaseService } from "../../core/http/BaseService.js";
import { ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta, parseSort, escapeRegex, searchTerm } from "./admin.middleware.js";
import { toCsvDocument } from "./csv.js";
import { emailConsentStages } from "../waitlist/waitlist.util.js";
import { isInsideLaunchRadius } from "../../shared/utils/serviceArea.js";
import { sanitizeHtml, htmlToText } from "../../shared/utils/sanitizeHtml.js";

/**
 * The default announcement says "FamLink just launched near you" — true
 * everywhere, specific nowhere. Opening one city at a time only pays off if the
 * message can name the neighbourhoods and speak to what those families asked
 * for, so each city gets its own draft.
 */
export const DEFAULT_SUBJECTS = {
  member: "FamLink is now live in your area 🎉",
  guest: "FamLink just launched near you — come join 🎉",
};

/** Capped because the export builds the whole body in memory. */
const EXPORT_LIMIT = 50000;

/** Anchored, so filtering to "Oakland" does not also pull in "North Oakland". */
const exactCity = (city) => new RegExp(`^${escapeRegex(city)}$`, "i");

/** Strip tags rather than escape them — these render inside a fixed structure. */
const plainText = (value, max) =>
  String(value || "").replace(/<[^>]*>/g, "").trim().slice(0, max);

/**
 * Reading and shaping the waitlist, and composing the per-city launch email.
 *
 * Sending lives in waitlistCampaign.service.js — the split is deliberate, since
 * everything here is safe to call and everything there mails real strangers.
 */
export class WaitlistAdminService extends BaseService {
  async list({ query = {} }) {
    const paging = parsePaging(query);
    const filter = {};

    const {
      search, city, region, userType, consent, radius, notified, converted,
      answerLabel, answerValue,
    } = query;

    if (search) {
      const term = searchTerm(search);
      filter.$or = [
        { name: term },
        { email: term },
        { "location.city": term },
        { "location.zip": term },
      ];
    }

    // Anchored, because this same filter is what the launch-email action is
    // scoped by — a substring match would mail the wrong neighbourhood.
    if (city) filter["location.city"] = exactCity(city);
    if (region) filter["location.region"] = new RegExp(escapeRegex(region), "i");
    if (userType === "Parents" || userType === "Nanny") filter.userType = userType;

    if (radius === "inside") filter.insideLaunchRadius = true;
    if (radius === "outside") filter.insideLaunchRadius = { $ne: true };

    if (notified === "true") filter.launchNotifiedAt = { $ne: null };
    if (notified === "false") filter.launchNotifiedAt = null;

    if (converted === "true") filter.userId = { $ne: null };
    if (converted === "false") filter.userId = null;

    // Filter by what somebody answered on the way in. `$elemMatch` rather than
    // two dotted paths, which would match a row whose label came from one
    // answer and value from another.
    if (answerLabel) {
      const match = { label: exactCity(String(answerLabel)) };
      if (answerValue) {
        // Substring, not anchored: "Children" holds "2 years, 5 years", so
        // asking for "5 years" has to match inside the list.
        match.value = new RegExp(escapeRegex(String(answerValue)), "i");
      }
      filter["onboarding.answers"] = { $elemMatch: match };
    }

    // NOT part of the filter: consent is resolved against the account behind
    // the row, so it can only be applied after the lookup stages have run.
    const consentMatch =
      consent === "true" ? { notifyConsent: true }
        : consent === "false" ? { notifyConsent: false }
          : null;

    const sort = parseSort(
      query.sort,
      ["onboardingCompletedAt", "createdAt", "name", "email"],
      { onboardingCompletedAt: -1 }
    );

    // Sorted before the join so the index on the sort key still does the work;
    // the lookup then runs over rows already in order.
    const base = [{ $match: filter }, { $sort: sort }, ...emailConsentStages()];
    const staged = consentMatch ? [...base, { $match: consentMatch }] : base;

    const [entries, totalRecords] = await Promise.all([
      this.waitlistRepository.aggregate([
        ...staged,
        { $skip: paging.skip },
        { $limit: paging.limit },
      ]),
      // Only the consent filter needs the join to be counted; every other
      // filter is a plain field, so the cheap count still applies.
      consentMatch
        ? this.waitlistRepository
            .aggregate([...staged, { $count: "total" }])
            .then((rows) => rows[0]?.total || 0)
        : this.waitlistRepository.count(filter),
    ]);

    return {
      data: entries.map((entry) => ({
        ...entry,
        // The stored flag answers "were they inside when they signed up"; this
        // answers "are they inside now". They differ exactly when the radius
        // has expanded since — the moment the launch email exists to handle —
        // so both are surfaced rather than one silently overwriting the other.
        insideLaunchRadiusNow: isInsideLaunchRadius(entry.location),
      })),
      pagination: pagingMeta(totalRecords, paging),
    };
  }

  /** Where demand actually is — the table that decides which city opens next. */
  cities() {
    return this.waitlistRepository
      .aggregate([
        { $match: { "location.city": { $nin: [null, ""] } } },
        // `consented` counts the resolved answer, not the stored flag, so this
        // table and the per-person one cannot disagree about how many people in
        // a city may be emailed.
        ...emailConsentStages(),
        {
          $group: {
            _id: { $toLower: "$location.city" },
            city: { $first: "$location.city" },
            region: { $first: "$location.region" },
            total: { $sum: 1 },
            families: { $sum: { $cond: [{ $eq: ["$userType", "Parents"] }, 1, 0] } },
            caregivers: { $sum: { $cond: [{ $eq: ["$userType", "Nanny"] }, 1, 0] } },
            consented: { $sum: { $cond: ["$notifyConsent", 1, 0] } },
            notified: { $sum: { $cond: [{ $ne: ["$launchNotifiedAt", null] }, 1, 0] } },
            // Counted directly rather than as (consented − notified): someone
            // emailed who has since opted out is in `notified` but no longer in
            // `consented`, and subtracting would quietly shrink the number of
            // people the button is about to mail.
            pending: {
              $sum: {
                $cond: [
                  { $and: ["$notifyConsent", { $eq: ["$launchNotifiedAt", null] }] },
                  1,
                  0,
                ],
              },
            },
            converted: { $sum: { $cond: [{ $ne: ["$userId", null] }, 1, 0] } },
            insideRadius: { $sum: { $cond: ["$insideLaunchRadius", 1, 0] } },
            latestSignup: { $max: "$onboardingCompletedAt" },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 200 },
      ])
      .then((cities) =>
        cities.map((city) => ({
          ...city,
          // What the "notify this city" button will actually send, named here
          // rather than left for the frontend to derive.
          pendingNotification: city.pending,
        }))
      );
  }

  /** The CSV an admin downloads. Escaped against formula injection — see csv.js. */
  async export({ query = {} }) {
    const filter = {};
    const { city, userType, consent, radius } = query;

    if (city) filter["location.city"] = exactCity(city);
    if (userType === "Parents" || userType === "Nanny") filter.userType = userType;
    if (radius === "inside") filter.insideLaunchRadius = true;
    if (radius === "outside") filter.insideLaunchRadius = { $ne: true };

    const entries = await this.waitlistRepository.aggregate([
      { $match: filter },
      { $sort: { onboardingCompletedAt: -1 } },
      // Resolved consent, exactly as the table shows it — an export that
      // disagreed with the screen it came from would be worse than none.
      ...emailConsentStages(),
      ...(consent === "true" ? [{ $match: { notifyConsent: true } }] : []),
      ...(consent === "false" ? [{ $match: { notifyConsent: false } }] : []),
      { $limit: EXPORT_LIMIT },
    ]);

    const headers = [
      "Name", "Email", "User Type", "City", "Region", "Zip",
      "Inside Launch Radius", "Email Consent", "Subscribed To", "Onboarding Completed",
      "Launch Notified", "Has Account", "Source",
    ];

    const day = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

    const rows = entries.map((entry) => [
      entry.name,
      entry.email,
      entry.userType,
      entry.location?.city,
      entry.location?.region,
      entry.location?.zip,
      entry.insideLaunchRadius ? "Yes" : "No",
      entry.notifyConsent ? "Yes" : "No",
      this.#subscribedTo(entry),
      day(entry.onboardingCompletedAt),
      day(entry.launchNotifiedAt),
      entry.userId ? "Yes" : "No",
      entry.source,
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    const label = city ? String(city).replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "all";

    return {
      csv: toCsvDocument(headers, rows),
      filename: `waitlist-${label}-${stamp}.csv`,
      exported: entries.length,
      filters: { city, userType, consent, radius },
    };
  }

  /**
   * Which of the two categories the consent covers.
   *
   * A row with no account has no categories to be subscribed to — it says so
   * rather than going blank or saying "None", which would read as an opt-out
   * they never made.
   */
  #subscribedTo(entry) {
    if (!entry.emailPrefs) return "No account";

    const on = [
      entry.emailPrefs.platformUpdates && "Platform Updates",
      entry.emailPrefs.newsletter && "Newsletter",
    ].filter(Boolean);

    return on.length ? on.join(" + ") : "None";
  }

  /**
   * Every intake question that has been answered, with its distinct values and
   * how many people gave each.
   *
   * Built from the data rather than a hardcoded question list, because the
   * intake forms have changed over time and a fixed list would silently hide
   * every answer to a question added afterwards.
   */
  async answers({ city: rawCity } = {}) {
    const city = String(rawCity || "").trim();
    const match = { "onboarding.answers.0": { $exists: true } };
    if (city) match["location.city"] = exactCity(city);

    const facets = await this.waitlistRepository.aggregate([
      { $match: match },
      { $unwind: "$onboarding.answers" },
      {
        $group: {
          _id: { label: "$onboarding.answers.label", value: "$onboarding.answers.value" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.label",
          total: { $sum: "$count" },
          values: { $push: { value: "$_id.value", count: "$count" } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 30 },
    ]);

    return facets.map((facet) => ({
      label: facet._id,
      total: facet.total,
      // Capped per question: "Children" is close to unique per person, and a
      // dropdown of four hundred single-use values is not a filter. The most
      // common ones are the ones that reveal a pattern.
      values: facet.values.sort((a, b) => b.count - a.count).slice(0, 40),
      distinctValues: facet.values.length,
    }));
  }

  /* ══════════════════════════ the per-city draft ═══════════════════════════ */

  #requireCity(raw) {
    const city = String(raw || "").trim();
    if (!city) throw new ValidationError("A city is required.");
    return city;
  }

  async readDraft(rawCity) {
    const city = this.#requireCity(rawCity);

    const draft = await this.launchEmailRepository.findOne(
      { city: city.toLowerCase() },
      { populate: { path: "updatedBy", select: "name email" }, lean: true }
    );

    return {
      city,
      hasDraft: Boolean(draft),
      subject: draft?.subject || DEFAULT_SUBJECTS.guest,
      bodyHtml: draft?.bodyHtml || "",
      heroEyebrow: draft?.heroEyebrow || "",
      heroHeadline: draft?.heroHeadline || "",
      heroSub: draft?.heroSub || "",
      ctaLabel: draft?.ctaLabel || "",
      ctaNote: draft?.ctaNote || "",
      updatedAt: draft?.updatedAt || null,
      updatedBy: draft?.updatedBy || null,
      defaultSubjects: DEFAULT_SUBJECTS,
    };
  }

  /**
   * Save a draft.
   *
   * Separate from sending on purpose: composing an announcement to several
   * hundred strangers should be something you can do, close, and come back to —
   * not something that only exists while a dialog is open.
   */
  async saveDraft({ body = {}, adminId }) {
    const city = this.#requireCity(body.city);

    // The same allow-list as the legal documents. This is admin-authored HTML
    // that lands in strangers' inboxes, so it gets the same treatment as
    // anything else an admin writes for other people to read.
    const bodyHtml = sanitizeHtml(body.bodyHtml || "");
    if (body.bodyHtml && !htmlToText(bodyHtml).trim()) {
      throw new ValidationError(
        "After sanitising, the body was empty. Check for unsupported markup."
      );
    }

    const draft = await this.launchEmailRepository.upsertForCity(city.toLowerCase(), {
      $set: {
        cityLabel: city,
        subject: String(body.subject || "").trim().slice(0, 200),
        bodyHtml,
        heroEyebrow: plainText(body.heroEyebrow, 80),
        heroHeadline: plainText(body.heroHeadline, 160),
        heroSub: plainText(body.heroSub, 240),
        ctaLabel: plainText(body.ctaLabel, 60),
        ctaNote: plainText(body.ctaNote, 120),
        updatedBy: adminId,
        updatedAt: new Date(),
      },
      $setOnInsert: { city: city.toLowerCase(), createdAt: new Date() },
    });

    return { city, draft };
  }

  /**
   * The whole email as a recipient sees it, without sending or saving.
   *
   * Sanitises first, so what is previewed is what would be STORED — not what
   * the admin typed. Previewing the raw draft would show markup the save step
   * is about to strip, which is the one way a preview can actively mislead.
   */
  preview(body = {}) {
    const { bodyHtml, hasAccount = false, name, editable = false } = body;
    const clean = sanitizeHtml(bodyHtml || "");

    return {
      html: this.renderLaunchEmailPreview({
        bodyHtml: clean,
        hasAccount: hasAccount === true,
        name: String(name || "Ada").slice(0, 60),
        editable: editable === true,
        hero: {
          heroEyebrow: body.heroEyebrow,
          heroHeadline: body.heroHeadline,
          heroSub: body.heroSub,
          ctaLabel: body.ctaLabel,
          ctaNote: body.ctaNote,
        },
      }),
      // A visible signal that markup was dropped, rather than the admin
      // noticing a missing paragraph after the send.
      modified: Boolean(bodyHtml) && clean !== String(bodyHtml).trim(),
      usingStockCopy: !clean,
    };
  }

  async deleteDraft(rawCity) {
    const city = this.#requireCity(rawCity);
    await this.launchEmailRepository.deleteOne({ city: city.toLowerCase() });
    return city;
  }
}

export default WaitlistAdminService;
