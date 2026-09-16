// How a user document is shaped for each audience that reads one.
//
// These are transcriptions, not redesigns. Every key and every fallback below
// is what the pre-refactor routes emitted, because the admin console and the
// browse screens parse these objects field by field. Where two endpoints
// disagreed about the same value — and they do, see `avgRating` — the
// disagreement is preserved and labelled rather than quietly harmonised.
//
// Privacy is not enforced here. It is enforced by the projection the repository
// used to fetch the document (see user.privacy.js); a presenter that receives a
// full record would happily print it. Read a presenter as "what shape", never
// as "what is allowed".

/* ──────────────────────────────── pagination ────────────────────────────── */

/**
 * The pager envelope the list screens read.
 *
 * Deliberately not BaseRepository.paginate's shape: that one names the page
 * size `pageSize` and adds `hasMore`, and these endpoints' callers destructure
 * `limit`. `totalPages` is a plain `Math.ceil`, so an empty result reports 0
 * pages rather than 1 — which is what the existing "no results" branches test.
 */
export const toPagination = ({ totalRecords, page, limit }) => ({
  totalRecords,
  totalPages: Math.ceil(totalRecords / limit),
  currentPage: page,
  limit,
});

/** `?page=2&limit=10`, with the same defaults every list route used. */
export const parsePaging = (query = {}, { defaultLimit = 10 } = {}) => {
  const limit = parseInt(query.limit, 10) || defaultLimit;
  const page = parseInt(query.page, 10) || 1;
  return { page, limit, skip: (page - 1) * limit };
};

/* ───────────────────────────────── helpers ──────────────────────────────── */

/** "Sam Ortiz Reyes" → { firstName: "Sam", lastName: "Ortiz Reyes" }. */
export const splitName = (name) => {
  const [firstName = "", ...rest] = String(name ?? "").split(" ");
  return { firstName, lastName: rest.join(" ") };
};

/**
 * City and state, pulled out of Google's formatted address by position.
 *
 * The address is "<street>, <city>, <state zip>, <country>", so city and state
 * are the third- and second-from-last components. Counting from the end is what
 * makes it survive an address with no street line.
 */
export const splitCityState = (formatLocation) => {
  const parts = String(formatLocation ?? "").split(", ");
  return {
    city: parts[parts.length - 3] || "",
    state: parts[parts.length - 2] || "",
  };
};

export const averageRating = (reviews) =>
  Array.isArray(reviews) && reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

/** The value a profile page shows under the name. Rounded to one decimal. */
export const displayRating = (reviews) =>
  Array.isArray(reviews) && reviews.length > 0 ? averageRating(reviews).toFixed(1) : 0;

const infoValue = (additionalInfo, key) =>
  Array.isArray(additionalInfo)
    ? additionalInfo.find((info) => info.key === key)?.value
    : undefined;

/* ──────────────────────────── the admin console ─────────────────────────── */

/**
 * One row of the console's user table.
 *
 * `hourlyRate: undefined` is kept because the console's TypeScript row type
 * declares it; dropping the key would be a silent contract change even though
 * JSON omits it either way.
 *
 * The caller supplies `bio` and `rating` because the three endpoints that build
 * this row disagree:
 *
 *   /userData/families — bio is `aboutMe`; rating rounded to one decimal.
 *   /userData/nannies  — bio is the `jobDescription` answer; rating unrounded.
 *   /edit/admin/user   — bio is `jobDescription`; rating unrounded.
 *
 * Preserved as-is. A family and a nanny genuinely showing a different number of
 * decimals in the same table is a UI bug, but it is an existing one, and fixing
 * it inside a move is how a refactor stops being reviewable.
 */
export const toAdminUserRow = (user, { role, bio, rating }) => {
  const { firstName, lastName } = splitName(user.name);
  const { city, state } = splitCityState(user.location?.format_location);

  return {
    id: user._id,
    // The console shows a handle it never stored. Everything before the @ is
    // what it has always displayed.
    username: user.email.split("@")[0],
    email: user.email,
    firstName,
    lastName,
    role,
    profileImage: user.imageUrl || null,
    phone: user.phoneNo || "",
    city,
    state,
    hourlyRate: undefined,
    bio,
    avgRating: rating,
    totalReviews: user.reviews?.length || 0,
    isVerifiedEmail: user.verified?.emailVer || false,
    // Stored as the string "true", not a boolean — an older schema that was
    // never migrated. Comparing loosely here would make the string "false"
    // truthy, so the comparison stays exact.
    isVerifiedID: user.verified?.nationalIDVer === "true",
    isActive: user.status === "Active",
    createdAt: user.createdAt,
  };
};

export const toAdminFamilyRow = (family) => ({
  ...toAdminUserRow(family, {
    role: "Parents",
    bio: family.aboutMe || "",
    rating: parseFloat(averageRating(family.reviews).toFixed(1)),
  }),
  online: family.online,
});

export const toAdminNannyRow = (nanny) => ({
  ...toAdminUserRow(nanny, {
    role: "Nanny",
    // Optional-chained. The pre-refactor code read `.value` off the result of
    // `.find(...)` directly, so a nanny who never answered the job-description
    // question threw a TypeError and took the whole page down with a 500. The
    // page now renders with an empty bio for that row.
    bio: infoValue(nanny.additionalInfo, "jobDescription") || "",
    rating: averageRating(nanny.reviews),
  }),
  additionalInfo: nanny.additionalInfo,
  online: nanny.online,
  premium: nanny.premium,
  ActiveAt: nanny.ActiveAt,
  dob: nanny.dob,
});

/** The row returned after an admin edits someone. Role comes from the record. */
export const toAdminEditedRow = (user) =>
  toAdminUserRow(user, {
    role: user.type,
    bio: infoValue(user.additionalInfo, "jobDescription") || "",
    rating: averageRating(user.reviews),
  });

/** A leaderboard entry on the console dashboard. */
export const toTopUserRow = (user) => {
  const { firstName, lastName } = splitName(user.name);

  return {
    id: user._id,
    firstName,
    lastName,
    profileImage: user.imageUrl,
    avgRating: user.avgRating || 0,
    reviewCount: user.reviewCount || 0,
  };
};
