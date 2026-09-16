/**
 * The user object returned alongside a token pair.
 *
 * This is the single most security-relevant projection in the codebase: it is
 * what a member receives about themselves at sign-in, and it was previously
 * built by destructuring a handful of names off `toJSON()` in four separate
 * places. Those four lists were not identical — the Google login branch omitted
 * `password` from its destructure entirely, and only avoided returning the hash
 * because Google accounts happen not to have one.
 *
 * Written as a deny-list rather than an allow-list to preserve behaviour
 * exactly: the response carries whatever else is on the document, and switching
 * to an allow-list would silently drop fields the frontend reads.
 */
const HIDDEN_FIELDS = ["password", "online", "ActiveAt", "otp", "otpExpiry"];

/** Mean review score to one decimal, or 0 when there are no reviews. */
export const averageRatingOf = (reviews = []) => {
  if (!reviews.length) return 0;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return (total / reviews.length).toFixed(1);
};

/** A user document as the account's owner receives it. */
export const toAuthUser = (userDoc) => {
  const source = typeof userDoc?.toJSON === "function" ? userDoc.toJSON() : { ...userDoc };

  for (const field of HIDDEN_FIELDS) delete source[field];

  source.averageRating = averageRatingOf(userDoc?.reviews ?? []);
  return source;
};

/** The full sign-in response: the member plus their new token pair. */
export const toSessionPayload = (userDoc, tokens) => ({
  user: toAuthUser(userDoc),
  ...tokens,
});
