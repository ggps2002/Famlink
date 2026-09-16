// Shared-profile attribution.
//
// Someone lands on /share/<token>, decides the opportunity looks right, and hits
// the CTA. Signing up takes several screens — pick a role, answer a
// questionnaire, register, finish a profile — and by the end the share that
// brought them here has scrolled entirely out of the flow. Dropping them on the
// general dashboard at that point means asking them to go find it again, which
// is exactly the moment the loop breaks.
//
// So the token is parked here on arrival and replayed once their profile is
// complete, to send them straight back to the profile they came for. Same shape
// as Config/referral.js, and deliberately so — one mechanism, two payloads.

const STORAGE_KEY = "famlink.sharedProfileToken";

// 30 days, matching the referral window. Long enough to survive "I'll finish
// this tonight", short enough that a token picked up two months ago doesn't
// hijack an unrelated signup.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// base64url, as minted in backend/Services/utils/shareProfile.js. Anything else
// is ignored rather than stored — a junk value would only cost a round trip.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;

// localStorage throws outright in Safari private mode and wherever the user has
// blocked site data. Attribution is never worth breaking a page load over, so
// every access here is best-effort.
const safeRead = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWrite = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the visit is simply not attributed */
  }
};

const safeRemove = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
};

// Remember a token. Called on the share page itself and again from any `?share=`
// parameter, since the CTA carries it forward through the signup flow.
export const rememberSharedProfile = (token) => {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  // Last share wins: someone who opens a second opportunity is most plausibly
  // acting on that one.
  safeWrite(STORAGE_KEY, JSON.stringify({ token, savedAt: Date.now() }));
  return token;
};

// Pull ?share= off the current URL and remember it. Called on every navigation
// because the parameter rides along through the whole onboarding flow, not just
// the first page.
export const captureSharedProfileFromUrl = (search = window.location.search) => {
  const raw = new URLSearchParams(search).get("share");
  return raw ? rememberSharedProfile(raw.trim()) : null;
};

// The stored token, or null if absent, unreadable, or past its window.
export const getStoredSharedProfile = () => {
  const raw = safeRead(STORAGE_KEY);
  if (!raw) return null;

  try {
    const { token, savedAt } = JSON.parse(raw);
    if (!token || !TOKEN_PATTERN.test(token)) return null;
    if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
      safeRemove(STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    // Corrupt entry (hand-edited, or an older format) — drop it.
    safeRemove(STORAGE_KEY);
    return null;
  }
};

// Called once we've actually returned the user to the shared profile, so the
// redirect fires exactly once and never ambushes a later dashboard visit.
export const clearStoredSharedProfile = () => safeRemove(STORAGE_KEY);
