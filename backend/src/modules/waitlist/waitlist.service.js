import { BaseService } from "../../core/http/BaseService.js";
import { TooManyRequestsError, ValidationError } from "../../core/errors/index.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class WaitlistService extends BaseService {
  /**
   * Capture a visitor and send them the confirmation.
   *
   * @returns {Promise<{ sent: boolean }>} `sent: false` when they were already
   *   confirmed recently — reported as success either way, since from the
   *   visitor's side nothing went wrong.
   */
  async confirm({ email, name, city, userType, location, notifyConsent, details, ip }) {
    const address = String(email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      throw new ValidationError("A valid email address is required.");
    }

    // Recorded BEFORE the throttle check, and the ordering is load-bearing: the
    // throttle exists to stop a second confirmation EMAIL, not a second
    // capture. A visitor who submits twice, or retries after a network blip,
    // must still end up on the list. recordWaitlistEntry is an idempotent
    // upsert keyed on the address, so doing it every time costs nothing, and
    // losing someone because their first submit was throttled would be silent.
    this.recordWaitlistEntry({
      email: address,
      name,
      userType,
      location: location || (city ? { city } : null),
      source: "waitlist-form",
      // The form's "tell me when you launch here" checkbox. Only an explicit
      // true is consent.
      notifyConsent: notifyConsent === true,
      // What they answered on the way in — already collected for the Google
      // Sheet; keeping it here is what lets the console filter the waitlist by
      // answer instead of only by city.
      details,
    }).catch(() => {});

    const claim = this.throttle.claim({ key: address, ip });

    if (claim === "ip-limited") {
      throw new TooManyRequestsError("Too many waitlist requests. Try again later.");
    }
    if (claim === "already-sent") {
      return { sent: false, message: "Confirmation already sent." };
    }

    try {
      await this.emailService.sendWaitlistConfirmationEmail(address, name, city);
    } catch (error) {
      this.throttle.release(address);
      throw error;
    }

    return { sent: true, message: "Waitlist confirmation sent." };
  }
}

export default WaitlistService;
