import { BaseService } from "../../core/http/BaseService.js";
import { UnauthorizedError } from "../../core/errors/index.js";
import {
  ensureReferralCode,
  hasActiveReferralMatching,
  daysOfMatchingLeft,
  referralLinkFor,
  isReferralGatedCaregiver,
} from "./referral.util.js";

/**
 * The "Refer a friend" surface.
 *
 * The distinction running through all of it: a friend who signed up is not the
 * same as a friend who paid out. The payout happens when they finish a profile,
 * so `referralCount` and `pendingCount` are genuinely different numbers, and
 * the referrer is shown both — quietly listing a name that earned nothing would
 * be the dishonest version.
 */
export class ReferralService extends BaseService {
  /** Everything the referral screen needs, in one read. */
  async summaryFor(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Access denied");

    // Mints a code on first read, so accounts created before referrals shipped
    // get one the moment they open the screen.
    const code = await ensureReferralCode(user);

    // hasFamily lives on the profile, not the user, and drives whether this
    // account is gated at all. A caregiver with no profile yet reads as
    // ungated — the match endpoint blocks them on nannyProfileCompleted before
    // referrals ever come into it.
    const profile = await this.profileRepository.findByUserId(user._id, {
      select: "hasFamily",
      lean: true,
    });

    // Signed up but not yet credited. referralCount only counts the ones that
    // finished a profile.
    const pendingCount = await this.userRepository.count({
      referredBy: user._id,
      referralCreditedAt: null,
    });

    // Rewards earned since the user last dismissed the celebratory popup.
    const unseenReferralRewards = Math.max(
      0,
      (user.referralCount || 0) - (user.referralRewardSeenCount || 0)
    );

    return {
      code,
      link: referralLinkFor(code),
      referralCount: user.referralCount || 0,
      pendingCount,
      matchingUntil: user.referralMatchingUntil || null,
      hasActiveMatching: hasActiveReferralMatching(user),
      daysLeft: daysOfMatchingLeft(user),
      // True when this user is on the referral model rather than a
      // subscription — the UI branches its paywall copy on this.
      isReferralGated: isReferralGatedCaregiver(user, profile),
      freeMatchUsed: (user.matchRequestsSent || 0) > 0,
      unseenReferralRewards,
    };
  }

  /**
   * The friends who joined through this user's link.
   *
   * Self-scoped by construction: a referrer only ever sees people they
   * personally referred, and only the fields needed to render a row.
   */
  async friendsOf(userId) {
    const friends = await this.userRepository.find(
      { referredBy: userId },
      {
        select: "name imageUrl createdAt referralCreditedAt",
        sort: { createdAt: -1 },
        limit: 50,
        lean: true,
      }
    );

    return friends.map(({ referralCreditedAt, ...friend }) => ({
      ...friend,
      credited: Boolean(referralCreditedAt),
      creditedAt: referralCreditedAt || null,
    }));
  }

  /**
   * Mark earned rewards as seen so the one-time popup does not fire again.
   * Idempotent — setting seen = count is safe to repeat.
   */
  async acknowledgeRewards(userId) {
    const user = await this.userRepository.findById(userId, { select: "referralCount" });
    if (!user) throw new UnauthorizedError("Access denied");

    // Catch the seen count up to whatever has been earned so far. A reward that
    // lands between this read and write stays unseen — the right call, since it
    // means a genuinely new month still gets celebrated.
    const seen = user.referralCount || 0;
    await this.userRepository.updateById(userId, { $set: { referralRewardSeenCount: seen } });

    return { referralRewardSeenCount: seen };
  }
}

export default ReferralService;
