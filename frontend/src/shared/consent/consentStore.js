/**
 * Where the visitor's cookie choices live, and the only code that touches
 * storage for them.
 *
 * STORED BY ID, NOT BY POSITION
 * The component this was ported from kept preferences as a `boolean[]` whose
 * index matched the category list, and validated a returning visitor's record
 * by array length alone. That is fine until the category list is edited —
 * reorder `analytics` and `marketing`, or drop a category and add another, and
 * the length still matches while every stored answer now points at a different
 * category. Someone who refused ad tracking silently starts consenting to it,
 * with no error anywhere. Consent is exactly the kind of state that must not
 * degrade quietly, so it is keyed by category id here.
 *
 * VERSIONING
 * `CONSENT_VERSION` is the other half of that. Adding a category means asking
 * again rather than assuming a "no" — a record written before the category
 * existed carries no opinion about it. Bump the constant whenever the meaning
 * of a category changes and every visitor is re-prompted.
 *
 * NAMED consentStore, NOT cookieConsent
 * The obvious name collides with `CookieConsent.jsx` in this same folder. macOS
 * and Windows both have case-insensitive filesystems, so `CookieConsent`
 * resolves to this file there, and the bundler tries `.js` before `.jsx` — the
 * component import silently resolves to the storage module and the build dies
 * on a missing default export. Linux CI would have resolved it correctly, which
 * is the worse version of the same bug. Keep the names distinct.
 *
 * Every read and write is wrapped: `localStorage` throws on access in Safari's
 * private mode and when a browser blocks site data, and an exception thrown
 * while deciding whether to show a banner would take the whole page down.
 */

const STORAGE_KEY = "famlink_cookie_consent";

/** Bump to re-prompt every visitor. */
export const CONSENT_VERSION = 1;

/** Fired on the window after any change, so listeners can react in-page. */
export const CONSENT_EVENT = "famlink:cookie-consent";

/**
 * Read the stored record, or null when there is nothing usable — no record, a
 * record from an older version, or storage that cannot be read at all. A null
 * means "ask", which is the safe default in all three cases.
 */
export function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (!parsed.prefs || typeof parsed.prefs !== "object") return null;

    return parsed.prefs;
  } catch {
    // Unreadable or malformed storage is indistinguishable from no answer.
    return null;
  }
}

/**
 * Persist a `{ [categoryId]: boolean }` map and notify listeners.
 *
 * Notifying happens even if the write failed. A visitor who has answered in a
 * browser that refuses to store it should still see the banner close and get
 * the behaviour they asked for for the rest of the session — they will simply
 * be asked again on their next visit, which is the correct fallback.
 */
export function writeConsent(prefs) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION, prefs, at: new Date().toISOString() }),
    );
  } catch {
    // Storage blocked. Fall through — see above.
  }

  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: prefs }));
  } catch {
    // CustomEvent is unavailable only in environments with no window at all.
  }
}

/** Forget the answer so the banner returns. Used by "Manage cookies". */
export function clearConsent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — if it cannot be removed it could not have been written.
  }

  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
  } catch {
    // As above.
  }
}

/**
 * Whether one category is allowed right now. This is the function that should
 * gate a tracker:
 *
 *   if (hasConsent("analytics")) loadAnalytics();
 *
 * Unanswered means not allowed. Opt-in is the requirement under GDPR and the
 * ePrivacy Directive for anything past strictly-necessary cookies, so the
 * default has to be the restrictive one.
 */
export function hasConsent(categoryId) {
  const prefs = readConsent();
  return Boolean(prefs && prefs[categoryId]);
}
