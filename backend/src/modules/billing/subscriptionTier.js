// What plan an account is actually on.
//
// One function, used by both /admin/users and /admin/subscriptions, because a
// member reading "Free" on one screen and "Referral" on the other is a support
// ticket about a bug that doesn't exist.
//
// ── Why "Referral" is a tier and not a footnote ───────────────────────────
//
// Caregivers have no subscription. They get one free match request, and after
// that they keep matching by referring a friend: each friend who signs up and
// completes a profile grants one calendar month, stamped on
// `referralMatchingUntil` (see src/modules/referral/referral.util.js).
//
// So an active referrer pays nothing AND is not on the free plan — they hold a
// paid-tier benefit that a free account does not have. Labelling them "Free"
// tells an admin the opposite of the truth: it reads as "this person has no
// benefits", when in fact they have earned benefits that expire on a date, and
// that date is the single most useful thing to know about the account. It is
// also what makes "why did this caregiver stop matching?" answerable at a
// glance instead of by reading the referral collection.

/**
 * Whether a Stripe subscription status entitles the member to Plus.
 *
 * The one rule, in one place, because two things now write `premium`: the
 * webhook (the authority, and the only writer of revenue) and the
 * confirm-checkout endpoint the member's browser calls on its way back from
 * Stripe. They must agree, and they must agree with what an admin sees.
 */
export const grantsPremium = (status) => status === "active" || status === "trialing";

export const referralActive = (user, now = new Date()) =>
  Boolean(user?.referralMatchingUntil) && new Date(user.referralMatchingUntil) > now;

/**
 * The tier label shown in the console.
 *
 * Paid states win over referral: someone who both pays and refers is a paying
 * subscriber, and their billing state is what an admin needs to see. Referral
 * only decides what an otherwise-unpaid account is called.
 *
 * Reads `premium` and `subscriptionStatus` together because they disagree — a
 * cancelled subscription leaves `premium` true until the period ends, and a
 * past-due one is neither free nor reliably paying.
 */
export const subscriptionTier = (user, now = new Date()) => {
  const status = (user?.subscriptionStatus || "").toLowerCase();

  if (status === "active" || status === "trialing") return "FamLink Plus";
  if (status === "past_due" || status === "unpaid") return "Plus (payment failed)";

  if (status === "canceled" || status === "cancelled") {
    if (user?.premium) return "Plus (ending)";
    return referralActive(user, now) ? "Referral" : "Free";
  }

  if (user?.premium) return "FamLink Plus";
  return referralActive(user, now) ? "Referral" : "Free";
};

/**
 * The referral facts a row needs to explain itself: how the benefit was earned
 * and when it runs out.
 *
 * `until` is returned even once it has passed, because "expired three days ago"
 * is the answer to a caregiver asking why matching stopped — dropping it the
 * moment it lapses throws away the explanation exactly when it is needed.
 */
export const referralSummary = (user, now = new Date()) => ({
  referralFreeUntil: user?.referralMatchingUntil || null,
  referralActive: referralActive(user, now),
  referralCount: user?.referralCount || 0,
});
