// The derived columns the console's user table shows.
//
// All computed on read rather than stored: they stay correct without a nightly
// job and cannot drift from the fields they are derived from. Pure functions
// over a lean user document, so the thresholds below are readable and testable
// on their own.

import { subscriptionTier, referralSummary } from "../billing/subscriptionTier.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * What the user table selects.
 *
 * Named explicitly rather than excluded, for the reason user.privacy.js gives
 * at length: an exclusion list silently ships every field added to the schema
 * afterwards, and this response is the one that carries email addresses and
 * phone numbers for every member at once.
 *
 * `location.coordinates` is absent. An admin has no screen that plots homes,
 * and the console is a browser tab like any other — the exact address of every
 * family on the platform should not be sitting in its network log.
 */
export const ADMIN_LIST_FIELDS = [
  "_id", "name", "email", "type", "status", "createdAt",
  "location.city", "location.neighborhood", "location.format_location",
  "zipCode", "premium", "subscriptionStatus", "subscriptionId",
  "lastLogin", "loginCount", "activeDays", "ActiveAt", "online",
  "onboarding", "nannyProfileCompleted", "shareSetupCompleted",
  "termsAcceptedAt", "termsAcceptedVersion",
  "suspendedUntil", "suspendedAt", "moderationReason",
  "profileDeletedAt", "deletedAt",
  "suspiciousFlaggedAt", "suspiciousReason",
  "imageUrl", "verified", "phoneNo", "referralCode", "referralCount",
  "referralMatchingUntil",
  // Which of the two email categories this account still takes. Both default to
  // on at signup, so the interesting value is an explicit false — the console is
  // where "why did this member stop hearing from us?" gets answered.
  "notifications.email",
].join(" ");

/**
 * Logins per week since the account was created.
 *
 * The floor of one week stops a three-day-old account with two logins reporting
 * an absurd rate.
 */
export const activityFrequency = (user) => {
  const created = user.createdAt ? new Date(user.createdAt).getTime() : null;
  if (!created) return null;

  const weeks = Math.max(1, (Date.now() - created) / WEEK_MS);
  return Math.round(((user.loginCount || 0) / weeks) * 10) / 10;
};

/**
 * The engagement label the table renders.
 *
 * Based on `lastLogin`, which is refreshed on token refresh as well as sign-in
 * — so it stays fresh for anyone actually using the app and only goes stale
 * once they genuinely stop.
 *
 * "unknown" is a real answer, not a fallback: `lastLogin` is null for every
 * account predating the field, and showing those as "inactive" would put
 * long-standing members at the top of a churn list they do not belong on.
 */
export const activityStatus = (user) => {
  if (!user.lastLogin) return "unknown";

  const days = (Date.now() - new Date(user.lastLogin).getTime()) / DAY_MS;
  if (days <= 7) return "active";
  if (days <= 30) return "recent";
  if (days <= 90) return "lapsed";
  return "inactive";
};

/**
 * Both email categories as definite booleans.
 *
 * The stored field is absent for anyone who signed up before it existed.
 * Absent means subscribed — the same as the schema default and the same rule
 * every send path uses (`$ne: false`). Resolving it here rather than in the
 * console keeps the two from disagreeing about what a missing flag means.
 */
export const emailPrefs = (user) => ({
  platformUpdates: user.notifications?.email?.platformUpdates !== false,
  newsletter: user.notifications?.email?.newsletter !== false,
});

/** The completion buckets the table filters on. */
export const COMPLETION_BUCKETS = {
  complete: (percent) => percent >= 100,
  almost: (percent) => percent >= 75 && percent < 100,
  partial: (percent) => percent >= 40 && percent < 75,
  "barely-started": (percent) => percent < 40,
};

/** A user row with every derived column attached. */
export const decorate = (user, completeness = null) => ({
  ...user,
  emailPrefs: emailPrefs(user),
  subscriptionTier: subscriptionTier(user),
  // How a "Referral" account earned its benefits, and when they run out. The
  // expiry is the point of the label — a tier with no date is just a word.
  ...referralSummary(user),
  activityFrequency: activityFrequency(user),
  activityStatus: activityStatus(user),
  profileCompletion: completeness,
});
