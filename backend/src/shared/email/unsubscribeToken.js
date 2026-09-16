import crypto from "node:crypto";

// One-click unsubscribe must work without a login (CAN-SPAM), so the emailed
// link carries an HMAC of the recipient's address instead of requiring a
// session. Nothing is persisted — the signature is simply recomputed and
// compared when the link is opened.
//
// Shared by src/shared/email/email.js (builds the link) and src/modules/unsubscribe/unsubscribe.module.js
// (verifies it).
const SECRET =
  process.env.UNSUBSCRIBE_SECRET ||
  process.env.JWT_SECRET ||
  "famlink-unsubscribe-secret";

export const signUnsubscribe = (email) =>
  crypto
    .createHmac("sha256", SECRET)
    .update(String(email).trim().toLowerCase())
    .digest("hex");

export const verifyUnsubscribe = (email, token) => {
  const expected = signUnsubscribe(email);
  const given = Buffer.from(String(token || ""), "utf8");
  const want = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, so guard first.
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(given, want);
};
