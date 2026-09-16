import { BaseService } from "../../core/http/BaseService.js";
import { ValidationError } from "../../core/errors/index.js";

/**
 * Every email category the footer link switches off.
 *
 * One link, both categories — someone clicking Unsubscribe means all of it, not
 * just the category the email they happened to be reading belongs to.
 */
const ALL_OFF = {
  platformUpdates: false,
  newsletter: false,
};

/**
 * Opting out of email.
 *
 * The subtlety is that an address can be on our list in three different places,
 * and which ones to stamp depends on whether it has an account:
 *
 *   * A member has `notifications.email.*` flags — the ones the Settings screen
 *     writes — and switching those off is the whole opt-out.
 *   * An address with no account (someone who answered the intake questions and
 *     never signed up) has no such flags. Their opt-out has to be recorded on
 *     the lead and on the waitlist row instead, or clicking Unsubscribe on the
 *     only email they have ever had from us would silently do nothing.
 *
 * The waitlist row is stamped ONLY when there is no account. A member's flags
 * already say no, so stamping the waitlist as well would leave a permanent
 * override — and a member who later switched the newsletter back on would still
 * be excluded, with nothing on the Settings screen to explain why.
 */
export class UnsubscribeService extends BaseService {
  /**
   * Act on a signed unsubscribe link.
   *
   * The HMAC in the link is the credential; there is no session. Reports
   * success whether or not the address has an account, so this cannot be used
   * to discover which addresses are members.
   */
  async unsubscribe({ email, token }) {
    if (!email || !token) {
      throw new ValidationError("This unsubscribe link is incomplete.");
    }

    if (!this.verifyUnsubscribe(email, token)) {
      throw new ValidationError("This unsubscribe link is invalid.");
    }

    const user = await this.userRepository.findOne({ email });

    if (user) {
      user.notifications = user.notifications || {};
      user.notifications.email = { ...ALL_OFF };
      user.markModified("notifications.email");
      await user.save();
    }

    await this.#recordLeadOptOut({ email, hasAccount: Boolean(user) });
  }

  async #recordLeadOptOut({ email, hasAccount }) {
    const address = String(email).trim().toLowerCase();
    const now = new Date();

    try {
      await Promise.all([
        this.onboardingLeadRepository.updateMany(
          { email: address, unsubscribedAt: null },
          { $set: { unsubscribedAt: now } }
        ),
        ...(hasAccount
          ? []
          : [
              this.waitlistRepository.updateMany(
                { email: address, unsubscribedAt: null },
                { $set: { unsubscribedAt: now, updatedAt: now } }
              ),
            ]),
      ]);
    } catch (error) {
      // The member-side opt-out already succeeded (or there was no member).
      // A lead-bookkeeping failure must not turn that into a failed unsubscribe.
      console.error("[unsubscribe] lead opt-out failed:", error?.message || error);
    }
  }

  /**
   * Email a signed one-click link.
   *
   * For someone who opened /unsubscribe without a token — e.g. from a
   * campaign-app send, where the link cannot carry our HMAC. We mail the signed
   * link rather than unsubscribing on the spot, so nobody can unsubscribe an
   * address they do not control.
   *
   * Returns silently for an unknown address; the controller answers identically
   * either way.
   */
  async requestLink(email) {
    if (!email) throw new ValidationError("Email is required.");

    const user = await this.userRepository.findOne({ email });
    if (!user) return;

    const url = `${this.appUrl}/unsubscribe?email=${encodeURIComponent(
      user.email
    )}&token=${this.signUnsubscribe(user.email)}`;

    this.emailService.sendEmail(
      user.email,
      "Confirm your FamLink unsubscribe",
      this.templates.confirmUnsubscribe(url)
    );
  }
}

export default UnsubscribeService;
