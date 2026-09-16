// Referral link capture.
//
// A shared link looks like https://www.famlink.care/?ref=FAM7K2QX. The visitor
// almost never signs up on that first page — they browse, land on an onboarding
// flow, and register several screens later — so the code is parked in
// localStorage on arrival and replayed into whichever /auth/register call
// eventually fires (see registerThunk in Components/Redux/authSlice.jsx).

const STORAGE_KEY = "famlink.referralCode";

// 30 days. Long enough to survive "I'll sign up this weekend", short enough
// that a code picked up months ago doesn't silently credit a stranger.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Matches what the backend mints (FAM + 5 chars). Anything else is ignored
// rather than sent — a junk value would just be a wasted round trip.
const CODE_PATTERN = /^FAM[A-Z0-9]{4,12}$/;

// Reading and writing localStorage can throw outright in Safari private mode
// and when the user has blocked site data. Referral attribution is never worth
// breaking a page load over, so every access here is best-effort.
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
    /* storage unavailable — the referral is simply not attributed */
  }
};

const safeRemove = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
};

// Pull ?ref= off the current URL and remember it. Call on every navigation:
// the parameter can appear on any landing page, not just "/".
export const captureReferralFromUrl = (search = window.location.search) => {
  const raw = new URLSearchParams(search).get("ref");
  if (!raw) return null;

  const code = raw.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return null;

  // Last link wins. Someone who clicks a second friend's link is most plausibly
  // acting on that one.
  safeWrite(STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() }));
  return code;
};

// The stored code, or null if absent, unreadable, or past its window.
export const getStoredReferralCode = () => {
  const raw = safeRead(STORAGE_KEY);
  if (!raw) return null;

  try {
    const { code, savedAt } = JSON.parse(raw);
    if (!code || !CODE_PATTERN.test(code)) return null;
    if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
      safeRemove(STORAGE_KEY);
      return null;
    }
    return code;
  } catch {
    // Corrupt entry (hand-edited, or written by an older format) — drop it.
    safeRemove(STORAGE_KEY);
    return null;
  }
};

// Called once registration succeeds, so a second account made on the same
// browser doesn't credit the same referrer again.
export const clearStoredReferralCode = () => safeRemove(STORAGE_KEY);
