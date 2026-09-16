// What may be written to disk about the signed-in member.
//
// ── The problem ──────────────────────────────────────────────────────────────
//
// `persist:auth` held the entire user document the login response returned —
// 3.3 KB, 55 fields — in localStorage, readable by any script running on the
// page and surviving until the browser is cleared. (It held both tokens too;
// those are gone entirely now — see the whitelist in @app/store.) Among the
// fields:
//
//   email, zipCode, location      contact and whereabouts
//   stripeId, subscriptionId      financial identifiers
//   moderationReason,             the moderator's own words about this account.
//   suspiciousReason,             The backend's privacy module is explicit that
//   suspiciousFlaggedAt           the OWNER must never see these — "the user
//                                 gets the generic deactivation email; the
//                                 reasoning stays in the console" — and they
//                                 were reaching the browser and being persisted
//                                 anyway, because SELF_USER_SELECT is
//                                 exclusion-based and cannot express that tier.
//
// None of it is needed to render a page on reload, and all of it is one XSS or
// one shared machine away from being read.
//
// ── The approach, and why it is a deny-list ──────────────────────────────────
//
// A strict allow-list of four fields (name, imageUrl, type, premium) is the
// stronger shape and is where this should end up. It is closer than it was —
// every reload now re-fetches the user from the server, because the access
// token is no longer persisted and `restoreSession` has to go and get one — but
// that fetch is a round trip, and the app renders against this object while it
// is in flight. Dropping `_id`, `onboarding` or `nannyProfileCompleted` today
// still breaks routing, match gating and chat for that window; it is now
// milliseconds rather than two hours, which makes the remaining step a
// question of gating the first render on the restore rather than of session
// architecture.
//
// So this removes precisely the classes the specification prohibits — PII,
// financial identifiers, and internal moderation notes — and keeps the
// operational flags the app reads on boot. See SECURITY.md.
//
// Note this is a defence in depth, not the fix: the real repair is for the
// server to stop sending the internal tier at all. This stops it being written
// to disk regardless of what the API returns, including fields added later.

import { createTransform } from "redux-persist";

/**
 * Fields never written to disk.
 *
 * Grouped by why, because the reasons expire at different times: the PII group
 * is a standing rule, while the moderation group should ideally disappear from
 * the response itself.
 */
export const NEVER_PERSIST_USER_FIELDS = [
  // Contact details and whereabouts.
  "email",
  "phoneNo",
  "dob",
  "zipCode",
  "location",

  // Financial identifiers. Not secrets on their own — they are customer
  // references, not card data — but they name this person inside Stripe and
  // have no business sitting in a browser.
  "stripeId",
  "subscriptionId",

  // Internal moderation. The owner is not supposed to have these at all.
  "moderationReason",
  "suspiciousReason",
  "suspiciousFlaggedAt",

  // Account lifecycle detail that only the console acts on.
  "status",
  "suspendedUntil",
  "suspendedAt",
  "profileDeletedAt",
  "deletedAt",

  // Credential-adjacent. Should never be serialised anyway; listed so that a
  // future change to the API projection cannot quietly reintroduce them.
  "otp",
  "otpExpiry",
  "otpAttempts",
  "password",
  "resetPasswordToken",
  "resetPasswordExpires",

  // Bulky and re-fetched on demand — no reason to spend the quota on them.
  "reviews",
  "additionalInfo",
];

const FORBIDDEN = new Set(NEVER_PERSIST_USER_FIELDS);

/** The user object as it is allowed to reach disk. */
export const scrubUserForStorage = (user) => {
  if (!user || typeof user !== "object") return user;

  const safe = {};
  for (const [key, value] of Object.entries(user)) {
    if (!FORBIDDEN.has(key)) safe[key] = value;
  }
  return safe;
};

/**
 * Applied on the way OUT to storage only.
 *
 * The inbound direction is left alone deliberately: a profile already on disk
 * from before this shipped still contains the old fields, and rehydrating it
 * through the same filter is what removes them on the next write. Scrubbing
 * inbound as well would work too, but doing it on write means the stored copy
 * is corrected rather than merely hidden.
 */
export const authPersistTransform = createTransform(
  (inboundState, key) => (key === "user" ? scrubUserForStorage(inboundState) : inboundState),
  (outboundState) => outboundState,
  { whitelist: ["user"] }
);

/**
 * Session fields that may be written to disk, but never read back off it.
 *
 * @see discardStoredTokens
 */
const NEVER_REHYDRATED_KEYS = [
  "accessToken",
  "refreshToken",
  "accessTokenExpiry",
  "refreshTokenExpiry",
];

/**
 * Nothing in localStorage may become a credential in this store.
 *
 * ── Why the whitelist is not enough ──────────────────────────────────────────
 *
 * redux-persist applies `whitelist` in `createPersistoid` — on the way OUT, when
 * deciding what to write. `persistReducer` does not consult it on the way back
 * in, so a key that is no longer whitelisted is still rehydrated for as long as
 * an older copy of the blob contains it. Dropping the tokens from the whitelist
 * therefore stops them being written and does nothing about the ones already
 * sitting in every existing member's browser.
 *
 * Without this, the first load after the cookie migration would have restored
 * the old `accessToken` from disk — and, because `restoreSession` skips when a
 * token is already in hand, the app would have run on it with no cookie behind
 * it and signed the member out mid-session up to two hours later, instead of
 * once and cleanly at the start.
 *
 * ── Why it stays after the migration ─────────────────────────────────────────
 *
 * Once the blob has been rewritten these keys are not in it and this is a no-op.
 * It is kept because the invariant is worth enforcing rather than remembering:
 * the store's session fields come from the server, and a value read off disk can
 * never be one of them again.
 */
export const discardStoredTokens = createTransform(
  (inboundState) => inboundState,
  // `null` rather than leaving the stored value: it matches the slice's initial
  // state, so a rehydrated session looks exactly like a cold start — which is
  // what sends `restoreSession` to the server for a real one.
  () => null,
  { whitelist: NEVER_REHYDRATED_KEYS }
);

export default authPersistTransform;
