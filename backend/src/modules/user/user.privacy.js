// What a user document is allowed to reveal, and to whom.
//
// Every field the API sends reaches the browser's network tab, so "the UI
// doesn't render it" is not privacy — the only thing that keeps a field private
// is not selecting it. Routes used to hand out whole user documents behind a
// blacklist (`.select("-password -otp ...")`), which silently leaks every field
// added to the schema afterwards: that is how exact home coordinates, email
// addresses, phone numbers, dates of birth and Stripe customer ids ended up in
// the browse and profile responses.
//
// So the policy here is a whitelist, in three tiers:
//
//   SECRET   — never leaves the server for anyone, not even the account owner.
//              Enforced a second time by the schema's toJSON transform.
//   PRIVATE  — the owner (and an Admin acting through the admin console) may
//              see it; another member never may.
//   PUBLIC   — what one member may learn about another.
//
// Anything new on the user schema is private by default: it has to be added to
// PUBLIC_USER_FIELDS on purpose before it can reach another member.

/* ─────────────────────────────── field tiers ─────────────────────────────── */

// Credentials and one-time secrets. Serving these to anybody — including the
// account owner, who gains nothing from seeing their own bcrypt hash — turns a
// single XSS or a shared screen into account takeover.
export const SECRET_USER_FIELDS = [
  "password",
  "otp",
  "otpExpiry",
  "resetPasswordToken",
  "resetPasswordExpires",
];

// Admin-only fields. Not credentials, so they are not SECRET, but the account
// owner must not see them either — which makes them the one tier the
// exclusion-based SELF_USER_SELECT cannot express on its own.
//
// These are the moderator's own words about a user: why they were blocked, why
// they were flagged as suspicious. Handing someone the sentence "reported twice
// for pressuring caregivers about rates" tells them they were reported, roughly
// when, and by how many people — which in a two-sided marketplace with a small
// local user base identifies the reporter. The user gets the generic
// deactivation email; the reasoning stays in the console.
export const INTERNAL_USER_FIELDS = [
  "moderationReason",
  "suspiciousReason",
  "suspiciousFlaggedAt",
];

// Personal data the owner is entitled to and nobody else is. Contact details
// are the ones that matter most: the whole point of routing conversations
// through in-app chat is that a member can't harvest 2,000 email addresses and
// phone numbers by paging through the browse endpoint.
export const PRIVATE_USER_FIELDS = [
  "email",
  "phoneNo",
  "dob",
  "registeredVia",
  "sheetId",
  "hasSubmittedSheetResponse",
  "stripeId",
  "subscriptionId",
  "subscriptionStatus",
  "notifications",
  "favourite",
  "status",
  "lastLogin",
  "reengagementSentAt",
  "profileReminderSentAt",
  "matchRequestsSent",
  "referralCode",
  "referredBy",
  "referralCreditedAt",
  "referralCount",
  "referralMatchingUntil",
  "referralRewardSeenCount",
  "termsAcceptedAt",
  "termsAcceptedVersion",
  "loginCount",
  "activeDays",
  "suspendedUntil",
  "suspendedAt",
  "profileDeletedAt",
  "deletedAt",
];

// Everything one member may learn about another. This is the marketplace
// profile: who they are, what care they want or offer, roughly where they are,
// and what other members have said about them.
//
// `location` is here as a top-level key for object whitelisting, but the value
// that ships is never the stored subdocument — it goes through publicLocation()
// below, and the database is never asked for the coordinates in the first place
// (see PUBLIC_LOCATION_PATHS).
export const PUBLIC_USER_FIELDS = [
  "_id",
  "name",
  "imageUrl",
  "type",
  "age",
  "gender",
  "aboutMe",
  "goal",
  "services",
  "noOfChildren",
  "additionalInfo",
  "reviews",
  "verified",
  "premium",
  "online",
  "ActiveAt",
  "zipCode",
  "location",
  "createdAt",
  "nannyProfileCompleted",
  "shareSetupCompleted",
  "onboarding",
];

// The location subpaths a projection may name — every part of the address
// EXCEPT `coordinates`.
//
// This has to be spelled out subpath by subpath. Projecting the parent path
// (`select("location")` → `{ location: 1 }`) tells MongoDB to return the whole
// subdocument, and a schema-level `select: false` on a child does NOT override
// an explicitly included parent: the coordinates come back anyway. Naming the
// children is what actually keeps them in the database.
export const PUBLIC_LOCATION_PATHS = [
  "location.type",
  "location.city",
  "location.neighborhood",
  "location.format_location",
  "location.distance",
];

// Projection string for .select() and .populate(). Using this rather than a
// "-password -otp" exclusion means a field added to the schema tomorrow is
// private until someone deliberately lists it above.
export const PUBLIC_USER_SELECT = [
  ...PUBLIC_USER_FIELDS.filter((field) => field !== "location"),
  ...PUBLIC_LOCATION_PATHS,
].join(" ");

// The subset a chat sidebar, a notification or a review byline needs: an
// identity and a presence dot, nothing else. Cheaper than the full public
// projection and narrower, so use it wherever only a name and avatar render.
export const USER_IDENTITY_FIELDS = [
  "_id",
  "name",
  "imageUrl",
  "type",
  "online",
  "ActiveAt",
];

export const USER_IDENTITY_SELECT = USER_IDENTITY_FIELDS.join(" ");

// The owner's own projection: everything except the credentials and the
// moderator's private notes. Written as an exclusion on purpose — the owner is
// entitled to their whole record, so a new schema field should appear on their
// own settings screen automatically.
//
// The admin console does NOT use this. It names the columns it wants, because
// an admin needs the internal fields this one removes and does not need the
// hundred-odd others.
export const SELF_USER_SELECT = [...SECRET_USER_FIELDS, ...INTERNAL_USER_FIELDS]
  .map((f) => `-${f}`)
  .join(" ");

/* ──────────────────────────────── helpers ───────────────────────────────── */

// A populated path can also be an unpopulated ObjectId, a Buffer, or null.
// Those pass through untouched — there's nothing to redact in an id.
const isPlainish = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof value.toHexString !== "function" &&
  !Buffer.isBuffer(value) &&
  !(value instanceof Date);

const asObject = (value) =>
  typeof value?.toObject === "function" ? value.toObject() : value;

/* ─────────────────────────────── location ───────────────────────────────── */

// Google formats an address as "<street>, <city>, <state zip>, <country>", so
// everything before the last three components is the doorstep. Members are told
// a city and a state; nobody is told a street.
//
// The last three are kept rather than a rebuilt "City, ST" string because every
// screen in the app derives its label by slicing the tail of this value
// (`split(",").slice(-3, -1)`), and those keep rendering exactly what they
// render today once the street is gone.
export const coarseAddress = (formatted) => {
  if (typeof formatted !== "string") return null;
  const parts = formatted
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return (parts.length > 3 ? parts.slice(-3) : parts).join(", ");
};

// The location one member may see of another: an area, never a point.
//
// `coordinates` is the field that matters here. It is the exact lat/lng of a
// home, in a product whose users are largely women, children and the people who
// care for them — publishing it to anyone who can open devtools is the single
// worst leak in the API. It never appears in the output of this function.
export const publicLocation = (location) => {
  const src = asObject(location);
  if (!isPlainish(src)) return null;

  const area = {
    city: src.city ?? null,
    neighborhood: src.neighborhood ?? null,
    format_location: coarseAddress(src.format_location),
  };

  // `distance` is a derived "3.2 mi away" label some list endpoints attach. It
  // describes a gap, not a place, so it's safe to carry through.
  if (src.distance !== undefined) area.distance = src.distance;

  return area;
};

/* ────────────────────────────── serializers ─────────────────────────────── */

// Reviews embed the reviewer as `userId`, which routes populate. Redact it the
// same way, so a review byline can't become a back door to the reviewer's
// contact details.
const publicReview = (review) => {
  const src = asObject(review);
  if (!isPlainish(src)) return review;
  if (!isPlainish(src.userId)) return src;
  return { ...src, userId: toUserIdentity(src.userId) };
};

// A name and an avatar. What a chat header, a comment or a notification needs.
export const toUserIdentity = (user) => {
  const src = asObject(user);
  if (!isPlainish(src)) return user;

  const out = {};
  for (const field of USER_IDENTITY_FIELDS) {
    if (src[field] !== undefined) out[field] = src[field];
  }
  return out;
};

// The full marketplace profile, whitelisted and with the location coarsened.
// Safe to call on a mongoose document, a .lean() object, or a populated path.
export const toPublicUser = (user) => {
  const src = asObject(user);
  if (!isPlainish(src)) return user;

  const out = {};
  for (const field of PUBLIC_USER_FIELDS) {
    if (src[field] !== undefined) out[field] = src[field];
  }

  if (out.location !== undefined) out.location = publicLocation(out.location);
  if (Array.isArray(out.reviews)) out.reviews = out.reviews.map(publicReview);

  return out;
};

// Same, for a list.
export const toPublicUsers = (users) =>
  Array.isArray(users) ? users.map(toPublicUser) : [];

// Redact the `user`-shaped property of a wrapper document (a job post, a nanny
// share, a booking) without disturbing the rest of it.
export const withPublicUser = (doc, key = "user") => {
  const src = asObject(doc);
  if (!isPlainish(src)) return doc;
  if (src[key] === undefined) return src;
  return { ...src, [key]: toPublicUser(src[key]) };
};

export const withPublicUsers = (docs, key = "user") =>
  Array.isArray(docs) ? docs.map((doc) => withPublicUser(doc, key)) : [];

// The owner's own record. Only the credentials come out; everything else is
// theirs to see. Use this for /login, /refreshToken and profile-edit responses.
export const toSelfUser = (user) => {
  const src = asObject(user);
  if (!isPlainish(src)) return user;

  const out = { ...src };
  for (const field of SECRET_USER_FIELDS) delete out[field];
  return out;
};
