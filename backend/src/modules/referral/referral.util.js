import crypto from "node:crypto";
import User from "../user/user.model.js";
import { resolvePublicBaseUrl } from "../../shared/utils/publicUrl.js";

// Caregiver referral rules.
//
// Caregivers — Nanny accounts whose profile has hasFamily === false — have no
// subscription. They get one free match request, and after that they keep
// matching by referring a friend: every friend who signs up with their code and
// completes a profile grants one calendar month. Refer someone each month and
// matching never lapses.
//
// The reward deliberately lands on profile completion rather than registration.
// Paying out at signup would make the whole scheme farmable with throwaway
// email addresses, and would reward referrals that bring no one real onto the
// platform. A referral therefore has two states — pending (signed up, profile
// unfinished) and credited (referralCreditedAt set on the referred user).

// A referral link is handed to someone else, so it resolves through the same
// public-origin filter as share links (publicUrl.js) rather than following
// FRONTEND_URL to localhost.
const CLIENT_URL = resolvePublicBaseUrl("Referral links");

// Ambiguous glyphs are omitted (no 0/O, 1/I/L) — these codes get read off a
// phone screen and typed by hand.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const CODE_PREFIX = "FAM";

// "FAM7K2QX". crypto over Math.random so codes aren't predictable from one
// another — a guessable code lets someone farm months off a stranger's link.
const generateReferralCode = () => {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return CODE_PREFIX + code;
};

// Allocate a code that no other user holds. The unique index is the real
// arbiter — findOne alone would race two concurrent signups onto one code — so
// this retries on the duplicate-key error rather than trusting the lookup.
export const assignReferralCode = async (userId, { attempts = 5 } = {}) => {
  for (let i = 0; i < attempts; i++) {
    const code = generateReferralCode();
    try {
      const updated = await User.findOneAndUpdate(
        { _id: userId, referralCode: { $in: [null, ""] } },
        // The creation timestamp goes in the SAME $set as the code, not a
        // follow-up write: it is the start of the referral funnel the console
        // reports on, and a code whose birth date depends on a second update
        // landing is a code that sometimes has no birth date. The loser of a
        // race fails the filter and so cannot overwrite the winner's.
        { $set: { referralCode: code, referralCodeCreatedAt: new Date() } },
        { new: true }
      );
      // No match means the user already had a code (another request beat us to
      // it, or this is a re-run) — read it back rather than overwriting, since
      // a changed code would break links the user has already shared.
      if (!updated) {
        const existing = await User.findById(userId).select("referralCode").lean();
        return existing?.referralCode || null;
      }
      return updated.referralCode;
    } catch (err) {
      if (err?.code === 11000) continue; // collision — draw again
      throw err;
    }
  }
  console.error(`Could not allocate a referral code for ${userId} in ${attempts} attempts`);
  return null;
};

// Backfill for accounts created before referrals shipped: returns the existing
// code untouched, or mints one on first use.
export const ensureReferralCode = async (user) => {
  if (user?.referralCode) return user.referralCode;
  return assignReferralCode(user._id);
};

// True while the user's earned months still cover them.
export const hasActiveReferralMatching = (user) =>
  Boolean(user?.referralMatchingUntil) &&
  new Date(user.referralMatchingUntil).getTime() > Date.now();

// One calendar month past `from` — not 30 days, so a month earned on the 3rd
// always expires on the 3rd.
const addOneMonth = (from) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
};

// Grant the referrer one month. Months stack: crediting someone who still has
// time left extends their existing expiry instead of resetting it, so referring
// three friends in one week buys three months.
export const creditReferralMonth = async (referrerId) => {
  const referrer = await User.findById(referrerId).select(
    "referralMatchingUntil referralCount"
  );
  if (!referrer) return null;

  const current = referrer.referralMatchingUntil;
  const base =
    current && new Date(current).getTime() > Date.now() ? new Date(current) : new Date();

  return User.findByIdAndUpdate(
    referrerId,
    {
      $set: { referralMatchingUntil: addOneMonth(base) },
      $inc: { referralCount: 1 },
    },
    { new: true }
  );
};

// Pay out the referrer now that `userId` has finished their profile — the point
// at which a referral becomes real. Returns the referrer document when a month
// was granted, or null when there was nothing to do.
//
// Safe to call on every profile save. Profile completion goes through an upsert
// the user can re-trigger at will, so the credit is claimed by atomically
// stamping referralCreditedAt: the update only matches while that field is
// still null, and whichever concurrent call wins the claim is the only one that
// pays. Everyone else falls through to null.
export const creditReferrerForProfileCompletion = async (userId) => {
  const claimed = await User.findOneAndUpdate(
    {
      _id: userId,
      referredBy: { $ne: null },
      referralCreditedAt: null,
    },
    { $set: { referralCreditedAt: new Date() } },
    { new: true }
  );

  // No claim: this user wasn't referred, or their referral already paid out.
  if (!claimed) return null;

  const referrer = await creditReferralMonth(claimed.referredBy);

  // The referrer was deleted between signup and profile completion. The claim
  // stays stamped — there's no one left to pay, and re-running would only churn.
  if (!referrer) return null;

  return { referrer, referred: claimed };
};

// Look up the owner of a code. Case- and whitespace-insensitive: codes travel
// through text messages and get retyped in whatever case the sender feels like.
export const findReferrerByCode = async (code) => {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  return User.findOne({ referralCode: normalized });
};

// The link a user shares. `?ref=` is read by the frontend on landing and
// replayed into the eventual /auth/register call.
export const referralLinkFor = (code) =>
  code ? `${CLIENT_URL}/?ref=${encodeURIComponent(code)}` : null;

// Whole days of matching left, rounded up — "3 days left" should stay "3" until
// it genuinely becomes 2. Zero when lapsed.
export const daysOfMatchingLeft = (user) => {
  if (!hasActiveReferralMatching(user)) return 0;
  const ms = new Date(user.referralMatchingUntil).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

// hasFamily is stored as a boolean or the string "true"/"false" depending on
// how the profile was saved (FormData submissions stringify it). Normalise
// before comparing, or a stringy "false" reads as "has a family" and the
// caregiver is wrongly put on the subscription paywall.
const hasFamilyTrue = (profile) =>
  profile?.hasFamily === true || profile?.hasFamily === "true";

// Does the referral gate apply to this account at all? Only caregivers looking
// for a share position — families pay, and nannies who already have a family
// are on the subscription paywall. Requires a loaded profile whose hasFamily is
// known and not true.
export const isReferralGatedCaregiver = (user, profile) =>
  user?.type === "Nanny" &&
  profile != null &&
  profile.hasFamily !== undefined &&
  profile.hasFamily !== null &&
  !hasFamilyTrue(profile);

// Fields a client may never set on itself. /auth/register spreads req.body
// straight into the new user, so without this a caregiver could sign up with
// referralMatchingUntil set to the year 3000 and never hit the gate.
export const REFERRAL_PROTECTED_FIELDS = [
  "referralCode",
  "referredBy",
  "referralCount",
  "referralMatchingUntil",
  // Pre-setting this would only sabotage the setter's own referrer rather than
  // profit anyone, but the payout guard has no business being client-writable.
  "referralCreditedAt",
];
