import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { ConflictError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import { escapeRegex } from "./admin.middleware.js";
import { emailConsentStages, resolveEmailConsent } from "../waitlist/waitlist.util.js";

/** Between sends. The provider throttles bursts. */
const SEND_GAP_MS = 400;

/** Awareness copy exists per city; sending it elsewhere would name the wrong place. */
const AWARENESS_CITIES = new Set(["oakland"]);

const AWARENESS_LIMIT = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether a draft has any authored content at all.
 *
 * Checked across every field rather than just `bodyHtml`, because an admin who
 * only changed the headline still expects their version to go out.
 */
export const hasDraftContent = (draft) =>
  Boolean(
    draft?.bodyHtml ||
      draft?.heroHeadline ||
      draft?.heroEyebrow ||
      draft?.heroSub ||
      draft?.ctaLabel ||
      draft?.ctaNote
  );

/**
 * Sending to the waitlist, and reconstructing it from data that predates it.
 *
 * ── The two-key rule ──────────────────────────────────────────────────────
 * The bulk sends are the most dangerous buttons in the console: they mail real
 * strangers and cannot be recalled. Both require `dryRun: false` AND
 * `confirm: true` — two independent flags, so a single mistyped field cannot
 * trigger a send — and both default to a dry run that returns exactly who
 * WOULD be mailed.
 *
 * Recipients are only ever people who consented, have not unsubscribed since,
 * and have not already been told. That makes re-running safe by construction
 * rather than by the admin remembering who they already mailed.
 */
export class WaitlistCampaignService extends BaseService {
  #isDryRun({ dryRun = true, confirm = false }) {
    return dryRun !== false || confirm !== true;
  }

  /**
   * Send serially, stamping only the addresses that actually got one.
   *
   * A failed send stays pending so the next run retries it, instead of being
   * silently written off.
   */
  async #sendEach(recipients, send) {
    const notified = [];
    let failed = 0;

    for (const recipient of recipients) {
      try {
        await send(recipient);
        notified.push(recipient._id);
      } catch (error) {
        failed += 1;
        console.error(`Email to ${recipient.email} failed:`, error?.message || error);
      }
      await sleep(SEND_GAP_MS);
    }

    return { notified, failed };
  }

  /** The launch announcement, for one city. */
  async notifyCity({ body = {}, adminId }) {
    const city = String(body.city || "").trim();
    if (!city) {
      throw new ValidationError(
        "A city is required. Sending to the entire waitlist at once is not supported."
      );
    }

    const recipients = await this.pendingLaunchRecipients(city);
    const draft = await this.launchEmailRepository.findOne(
      { city: city.toLowerCase() },
      { lean: true }
    );

    if (this.#isDryRun(body)) {
      return {
        dryRun: true,
        message: `${recipients.length} people would be emailed. Re-send with dryRun:false and confirm:true to go ahead.`,
        data: {
          count: recipients.length,
          // Which email they would get — the thing an admin most needs to
          // confirm before firing.
          usingDraft: hasDraftContent(draft),
          subject: draft?.subject || null,
          preview: recipients.slice(0, 25).map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
            userType: recipient.userType,
            hasAccount: Boolean(recipient.userId),
          })),
        },
      };
    }

    if (!recipients.length) {
      return {
        dryRun: false,
        message: "Nobody in that city is waiting to be notified.",
        data: { sent: 0, failed: 0 },
      };
    }

    const campaign = `launch:${city.toLowerCase()}`;

    const { notified, failed } = await this.#sendEach(recipients, (recipient) =>
      this.#sendLaunch({ recipient, draft, campaign, adminId })
    );

    if (notified.length) {
      await this.waitlistRepository.updateMany(
        { _id: { $in: notified } },
        { $set: { launchNotifiedAt: new Date() } }
      );
    }

    return {
      dryRun: false,
      city,
      campaign,
      usingDraft: hasDraftContent(draft),
      subject: draft?.subject || null,
      message: `Launch notification sent to ${notified.length} of ${recipients.length}.`,
      data: { sent: notified.length, failed, total: recipients.length, campaign },
    };
  }

  /**
   * One launch email.
   *
   * Members who already registered get the "your area is now open" copy;
   * everyone else gets "come and join". Sending the wrong one asks a
   * long-standing member to sign up again — which is why the city's draft
   * replaces the body but never the shell carrying that distinction.
   */
  #sendLaunch({ recipient, draft, campaign, adminId }) {
    const hasAccount = Boolean(recipient.userId);

    if (hasDraftContent(draft)) {
      return this.sendCustomLaunchEmail(recipient.email, recipient.name, {
        subject: draft.subject || undefined,
        bodyHtml: draft.bodyHtml,
        hero: draft,
        hasAccount,
        campaign,
        triggeredBy: adminId,
      });
    }

    return this.sendPlatformLaunchEmail(recipient.email, recipient.name, {
      hasAccount,
      campaign,
      triggeredBy: adminId,
    });
  }

  /**
   * The top-of-funnel awareness campaign.
   *
   * ── Why a button and not a cron ─────────────────────────────────────────
   * Every other email in the system answers "this person did X" or "this person
   * has been quiet for N days". This one answers "we have decided to push this
   * city" — a judgement call with a date attached, not a condition that becomes
   * true on its own. A cron firing it would mean the campaign runs itself on a
   * schedule nobody chose.
   */
  async sendAwareness({ body = {}, adminId }) {
    const city = String(body.city || "").trim();
    if (!city) throw new ValidationError("A city is required.");

    if (!AWARENESS_CITIES.has(city.toLowerCase())) {
      // Refused rather than sent quietly: the template names Oakland eight
      // times and links to /nanny-share/oakland, so handing it another city
      // would tell people about a place they do not live.
      throw new ValidationError(
        `There is no awareness email written for ${city}. The copy in ` +
          `09_oakland_awareness.html is specific to Oakland — sending it ` +
          `anywhere else would tell people about a city they don't live in.`
      );
    }

    // Consented (resolved, so a member's own settings are honoured), not
    // unsubscribed, not already sent this campaign — and no account, because
    // the email introduces the concept of a nanny share to someone who has
    // never used one. A member already knows.
    const recipients = await this.waitlistRepository.aggregate([
      {
        $match: {
          "location.city": new RegExp(`^${escapeRegex(city)}$`, "i"),
          unsubscribedAt: null,
          awarenessNotifiedAt: null,
          userId: null,
        },
      },
      ...emailConsentStages(),
      { $match: { notifyConsent: true } },
      { $project: { email: 1, name: 1, userType: 1 } },
      { $limit: AWARENESS_LIMIT },
    ]);

    if (this.#isDryRun(body)) {
      return {
        dryRun: true,
        message: `${recipients.length} people would get the ${city} awareness email. Re-send with dryRun:false and confirm:true to go ahead.`,
        data: {
          count: recipients.length,
          preview: recipients.slice(0, 25).map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
            userType: recipient.userType,
          })),
        },
      };
    }

    if (!recipients.length) {
      return {
        dryRun: false,
        message: "Nobody in that city is waiting for this campaign.",
        data: { sent: 0, failed: 0 },
      };
    }

    const campaign = `awareness:${city.toLowerCase()}`;

    const { notified, failed } = await this.#sendEach(recipients, (recipient) =>
      this.sendOaklandAwarenessEmail(recipient.email, { campaign, triggeredBy: adminId })
    );

    if (notified.length) {
      await this.waitlistRepository.updateMany(
        { _id: { $in: notified } },
        { $set: { awarenessNotifiedAt: new Date() } }
      );
    }

    return {
      dryRun: false,
      city,
      campaign,
      message: `Awareness email sent to ${notified.length} of ${recipients.length}.`,
      data: { sent: notified.length, failed, total: recipients.length, campaign },
    };
  }

  /**
   * Send the launch announcement to a single person.
   *
   * The city-wide action is all-or-nothing, which is wrong for the cases that
   * actually come up: somebody replied asking to be told, a send failed for one
   * address, a city is being opened to a handful of people first.
   *
   * The same three guarantees as the bulk send, checked per person rather than
   * assumed. `resend: true` is the deliberate override, because "email this
   * person again" is a real request and quietly refusing it is worse than
   * letting an admin repeat themselves on purpose.
   */
  async notifyOne({ id, body = {}, adminId }) {
    if (!mongoose.isValidObjectId(id)) throw new ValidationError("Invalid id");

    const { confirm = false, resend = false } = body;

    const entry = await this.waitlistRepository.findById(id, { lean: true });
    if (!entry) throw new NotFoundError("Not on the waitlist");

    // Withdrawal first, so the refusal names the actual reason. Resolving
    // consent would also catch this, but it can only report "not consented",
    // which is less useful to tell an admin.
    if (entry.unsubscribedAt) {
      throw new ValidationError(`${entry.email} has unsubscribed. They cannot be emailed.`);
    }

    const account = entry.userId
      ? await this.userRepository.findById(entry.userId, {
          select: "notifications.email status",
          lean: true,
        })
      : null;

    const { notifyConsent } = resolveEmailConsent(entry, account);

    // With opt-out consent this is reachable only two ways, and both are a
    // deliberate act — so the message names which one.
    if (!notifyConsent) {
      throw new ValidationError(
        account?.status === "Deleted"
          ? `${entry.email} belongs to a deleted account and cannot be emailed.`
          : `${entry.email} has turned off every FamLink email in their settings.`
      );
    }

    if (entry.launchNotifiedAt && resend !== true) {
      throw new ConflictError(
        `${entry.email} was already told on ${new Date(entry.launchNotifiedAt).toDateString()}. Send again with resend:true if that is intended.`,
        { code: "ALREADY_NOTIFIED" }
      );
    }

    const city = entry.location?.city || "";
    const draft = city
      ? await this.launchEmailRepository.findOne({ city: city.toLowerCase() }, { lean: true })
      : null;

    if (confirm !== true) {
      return {
        dryRun: true,
        message: `Would email ${entry.email}. Send again with confirm:true to go ahead.`,
        data: {
          dryRun: true,
          email: entry.email,
          name: entry.name,
          city,
          hasAccount: Boolean(entry.userId),
          usingDraft: hasDraftContent(draft),
          alreadyNotified: Boolean(entry.launchNotifiedAt),
        },
      };
    }

    const campaign = `launch:${(city || "individual").toLowerCase()}`;
    await this.#sendLaunch({ recipient: entry, draft, campaign, adminId });

    await this.waitlistRepository.updateById(entry._id, {
      $set: { launchNotifiedAt: new Date() },
    });

    return {
      dryRun: false,
      entry,
      city,
      usingDraft: hasDraftContent(draft),
      resend: resend === true,
      message: `Sent to ${entry.email}.`,
      data: { sent: 1, email: entry.email },
    };
  }
}

export default WaitlistCampaignService;
