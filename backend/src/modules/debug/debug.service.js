import { BaseService } from "../../core/http/BaseService.js";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../core/errors/index.js";
import config from "../../config/index.js";

/** The referral-relevant slice of a user record, for the inspector. */
const referralView = (user) =>
  user && {
    id: String(user._id),
    name: user.name,
    email: user.email,
    type: user.type,
    nannyProfileCompleted: user.nannyProfileCompleted,
    matchRequestsSent: user.matchRequestsSent,
    referralCode: user.referralCode || null,
    referredBy: user.referredBy ? String(user.referredBy) : null,
    referralCreditedAt: user.referralCreditedAt || null,
    referralCount: user.referralCount || 0,
    referralMatchingUntil: user.referralMatchingUntil || null,
    hasActiveMatching:
      Boolean(user.referralMatchingUntil) &&
      new Date(user.referralMatchingUntil).getTime() > Date.now(),
  };

/**
 * Operator tooling. Not part of the product.
 *
 * These endpoints read other people's accounts, so the access rule is enforced
 * here rather than only in middleware: outside production anyone may use them,
 * in production the caller must be an Admin. Keeping the rule in the service
 * means a change to how the routes are mounted cannot accidentally open them.
 */
export class DebugService extends BaseService {
  async #requireOperator(requesterId) {
    const requester = requesterId
      ? await this.userRepository.findById(requesterId, { lean: true })
      : null;

    if (!config.isProduction) return requester;
    if (requester?.type !== "Admin") throw new ForbiddenError("Not available");

    return requester;
  }

  /**
   * The whole referral chain for one account.
   *
   * Answers the question a "my referral didn't pay out" report actually poses,
   * which is one of two things: the friend was never linked to a referrer, or
   * they were linked and never credited. The response separates them.
   */
  async inspectReferral({ requesterId, email, code }) {
    await this.#requireOperator(requesterId);

    const query = email
      ? { email: String(email).trim() }
      : code
        ? { referralCode: String(code).trim().toUpperCase() }
        : { _id: requesterId };

    const account = await this.userRepository.findOne(query, { lean: true });
    if (!account) throw new NotFoundError("No account matched");

    const referrer = account.referredBy
      ? await this.userRepository.findById(account.referredBy, { lean: true })
      : null;

    const referred = await this.userRepository.find(
      { referredBy: account._id },
      {
        select: "name email nannyProfileCompleted referralCreditedAt createdAt",
        sort: { createdAt: -1 },
        lean: true,
      }
    );

    return {
      account: referralView(account),
      referredBy: referralView(referrer),
      referredByStatus: account.referredBy
        ? account.referralCreditedAt
          ? "linked & credited"
          : "linked, NOT yet credited"
        : "not linked to any referrer",
      referredFriends: referred.map((friend) => ({
        name: friend.name,
        email: friend.email,
        nannyProfileCompleted: friend.nannyProfileCompleted,
        credited: Boolean(friend.referralCreditedAt),
        creditedAt: friend.referralCreditedAt || null,
      })),
    };
  }

  /**
   * Run the payout for a friend who was linked but never credited — for
   * instance because their profile save predates the fix that made crediting
   * reliable.
   *
   * Idempotent: the underlying claim is atomic, so a friend who was already
   * credited cannot pay their referrer twice.
   */
  async recreditReferral({ requesterId, email }) {
    await this.#requireOperator(requesterId);

    const address = String(email || "").trim();
    if (!address) throw new ValidationError("email is required");

    const friend = await this.userRepository.findOne({ email: address }, { lean: true });
    if (!friend) throw new NotFoundError("No account with that email");

    if (!friend.referredBy) {
      throw new ValidationError(
        "This account was never linked to a referrer, so there's nothing to credit",
        { details: { hint: "referredBy is null — the referral code didn't reach signup" } }
      );
    }

    const result = await this.creditReferrer(friend._id);
    if (!result) {
      return { credited: false, message: "Already credited (or nothing to do) — no change made" };
    }

    const { referrer, referred } = result;
    this.sendReferralRewardEmail(referrer.email, referrer.name, {
      friendName: referred.name,
      monthsEarned: referrer.referralCount,
      matchingUntil: referrer.referralMatchingUntil,
    }).catch((error) => console.error("recredit email failed:", error));

    return {
      credited: true,
      referrer: referralView(referrer),
      friend: { name: referred.name, email: referred.email },
    };
  }

  /**
   * Queue a real welcome email, to check the composition and delivery path.
   *
   * Since delivery moved to the dispatcher this no longer returns an SMTP
   * result, because at this point there isn't one — it returns the queue
   * receipt. The check it performs is still the useful one (the template
   * renders, the row is written, the dispatcher picks it up); the outcome is
   * read from the email log or the queue row a few seconds later rather than
   * from this response.
   *
   * Admin-only in every environment, unlike the two above: this one sends mail
   * to an address of the caller's choosing, so it stays shut even in dev.
   */
  async sendTestEmail({ requesterId, to, name }) {
    const requester = await this.userRepository.findById(requesterId);
    if (!requester) throw new UnauthorizedError("Access denied");
    if (requester.type !== "Admin") throw new ForbiddenError("Admin access required");

    const recipient = String(to || requester.email || "").trim();
    if (!recipient) throw new ValidationError("No recipient email available");

    const receipt = await this.sendWelcomeEmail(
      recipient,
      name || requester.name || "there",
      requester,
      // Every invocation must actually send; this endpoint exists to be run
      // repeatedly while someone is diagnosing the mail path.
      { dedupe: false }
    );

    return {
      ok: true,
      message: receipt?.deduped
        ? `A welcome email for ${recipient} was already queued — not duplicated.`
        : `Test email queued for ${recipient}; the dispatcher will send it within seconds.`,
      queueId: receipt?.id || null,
      queued: Boolean(receipt?.queued),
      deduped: Boolean(receipt?.deduped),
    };
  }
}

export default DebugService;
