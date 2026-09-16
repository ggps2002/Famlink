import { HttpService } from "@shared/api/HttpService";

/**
 * The caller's referral code, their referred friends, and dismissing the reward
 * modal.
 *
 * `me` also refreshes `referralMatchingUntil` on the auth user, which the match
 * gate reads — a caregiver whose friend signed up an hour ago stays locked out
 * until something calls this.
 */
export class ReferralService extends HttpService {
  me() {
    return this.get("/referral/me");
  }

  friends() {
    return this.get("/referral/friends");
  }

  markRewardSeen(body) {
    return this.post("/referral/seen-reward", body);
  }
}

export const referralService = new ReferralService();
export default referralService;
