import { BaseService } from "../../core/http/BaseService.js";
import { ValidationError } from "../../core/errors/index.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The intake funnels a lead can arrive from. Anything else falls back. */
const ONBOARDING_SOURCES = new Set(["family-match", "caregiver-job", "caregiver-share"]);

/**
 * The catalog of downloadable lead magnets.
 *
 * Server-side so we only ever mail a link for a resource we recognise, and the
 * email names it correctly. A slug the client invents gets a 400 rather than a
 * link to nowhere.
 */
export const RESOURCES = {
  "nanny-share-agreement": {
    title: "Nanny Share Agreement Template",
    path: "/nanny-share-resources/nanny-share-agreement",
  },
  "payroll-tax-guide": {
    title: "Nanny Share Payroll & Tax Guide",
    path: "/nanny-share-resources/payroll-tax-guide",
  },
};

/**
 * Everyone who gave us their details before having an account.
 *
 * Three flows, all public, all pre-account:
 *   * an inbound lead from an external source, forwarded to Slack;
 *   * a resource download, which mails a link;
 *   * a half-finished signup, recorded so the nudge job can find it later.
 */
export class LeadService extends BaseService {
  static #normaliseEmail(email) {
    const address = String(email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      throw new ValidationError("A valid email address is required.");
    }
    return address;
  }

  /* ───────────────────────── inbound external leads ──────────────────────── */

  /** Record a lead from an external source and alert the team in Slack. */
  async createInboundLead(payload) {
    const lead = await this.leadRepository.create(payload);

    // Fire-and-forget: the lead is saved, and a Slack outage must not turn a
    // captured lead into a 500 for whoever sent it.
    Promise.resolve(this.sendLeadToSlack(lead)).catch((error) =>
      console.error("[lead] slack notification failed:", error)
    );

    return lead;
  }

  /* ──────────────────────────── resource magnets ─────────────────────────── */

  /**
   * Capture a download request and mail the link.
   *
   * The download URL is ALWAYS returned. The email is a courtesy copy, not the
   * gate — the visitor gave us their details, so they get their resource even
   * if the save failed or the send was throttled.
   */
  async captureResourceLead({ email, name, neighborhood, careTimeline, resource, ip }) {
    const address = LeadService.#normaliseEmail(email);

    const meta = RESOURCES[resource];
    if (!meta) throw new ValidationError("Unknown resource requested.");

    const downloadUrl = `${this.appUrl}${meta.path}`;

    // A database failure must not block the download the visitor was promised.
    try {
      await this.resourceLeadRepository.create({
        email: address,
        name: String(name || "").trim(),
        neighborhood: String(neighborhood || "").trim(),
        careTimeline: String(careTimeline || "").trim(),
        resource,
      });
    } catch (error) {
      console.error("[lead] resource lead save failed:", error);
    }

    // Keyed on the pair, not the address: one person legitimately wants both
    // the agreement template and the tax guide.
    const key = `${address}|${resource}`;

    if (this.resourceThrottle.claim({ key, ip }) === "allowed") {
      try {
        await this.emailService.sendResourceDownloadEmail(address, name, {
          resourceTitle: meta.title,
          downloadUrl,
        });
      } catch (error) {
        this.resourceThrottle.release(key);
        console.error("[lead] resource download email failed:", error);
      }
    }

    return { message: "Your resource is ready.", resource, downloadUrl };
  }

  /* ─────────────────────── abandoned onboarding leads ────────────────────── */

  /**
   * Keep only the fields we know, and only when they look like what they claim.
   *
   * The body arrives from a public form, so a location is accepted as a shape,
   * never as "whatever the client sent" spread into the document.
   */
  static #cleanLocation(raw) {
    if (!raw || typeof raw !== "object") return undefined;

    const coords = Array.isArray(raw.coordinates) ? raw.coordinates.map(Number).slice(0, 2) : [];
    const hasCoords = coords.length === 2 && coords.every(Number.isFinite);

    const location = {
      format_location: String(raw.format_location || "").trim(),
      city: String(raw.city || "").trim(),
      neighborhood: String(raw.neighborhood || "").trim(),
      zip: String(raw.zip || "").trim(),
    };

    if (hasCoords) {
      // "Point" matters: without it the doc is not a GeoJSON point.
      location.type = "Point";
      location.coordinates = coords;
    }

    // A location with nothing printable and nothing to search on is not worth
    // storing — it would only produce an email with no city and no cards.
    const usable =
      hasCoords || location.city || location.neighborhood || location.format_location;
    return usable ? location : undefined;
  }

  /**
   * Record a half-finished signup so the nudge job can find it hours later.
   *
   * One row per address: a visitor who submits twice is the same lead, and
   * re-submitting must not earn them a second nudge. The upsert refreshes their
   * answers and resume link but never re-arms `nudgeSentAt`, and `createdAt`
   * stays at the first attempt so the send window is measured from when they
   * actually dropped off.
   */
  async captureOnboardingLead({ email, name, source, sheetId, location, details }) {
    const address = LeadService.#normaliseEmail(email);

    const set = {
      name: String(name || "").trim(),
      source: ONBOARDING_SOURCES.has(source) ? source : "family-match",
      sheetId: String(sheetId || "").trim(),
      details: String(details || "").trim(),
    };

    const cleaned = LeadService.#cleanLocation(location);
    if (cleaned) set.location = cleaned;

    try {
      await this.onboardingLeadRepository.updateMany(
        { email: address },
        {
          $set: set,
          $setOnInsert: { email: address, createdAt: new Date(), nudgeSentAt: null },
        },
        { upsert: true }
      );
    } catch (error) {
      // A duplicate-key race (two submits landing at once) means the row this
      // call wanted already exists — the desired end state, not an error the
      // visitor should ever hear about.
      if (error?.code !== 11000) throw error;
    }

    // Mirror onto the waitlist record the admin console reads.
    //
    // Two collections rather than one because they answer different questions
    // and have different privacy rules: the lead keeps exact coordinates and is
    // never serialised to a client, while the waitlist keeps only a city and is
    // read back by the console.
    //
    // NOT opted in: this funnel shows no consent checkbox, so the person
    // appears on the waitlist but the launch-email action will skip them.
    this.recordWaitlistEntry({
      email: address,
      name: set.name,
      userType: set.source === "family-match" ? "Parents" : "Nanny",
      location: cleaned || null,
      source: set.source,
      notifyConsent: false,
      details,
    }).catch(() => {});
  }

  /**
   * Called from the signup path: the address now has an account, so it must
   * never be nudged.
   *
   * Stamping `nudgeSentAt` retires the lead through the same field the cron
   * already filters on, so there is only one condition to get right. Never
   * throws — this runs inside registration, and a bookkeeping failure must not
   * fail someone's signup. The cron re-checks against the users collection
   * anyway, so a missed call costs nothing.
   */
  async retireOnboardingLead(email) {
    const address = String(email || "").trim().toLowerCase();
    if (!address) return;

    try {
      await this.onboardingLeadRepository.updateMany(
        { email: address, nudgeSentAt: null },
        { $set: { nudgeSentAt: new Date() } }
      );
    } catch (error) {
      console.error("[lead] retireOnboardingLead failed:", error?.message || error);
    }
  }
}

export default LeadService;
