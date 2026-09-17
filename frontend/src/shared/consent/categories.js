/**
 * The cookie categories Famlink asks about.
 *
 * Deliberately data-only — no icons and no JSX. The banner needs this list on
 * every page load to know which ids exist and which are essential, so anything
 * imported here lands on the critical path. The per-category icons are only
 * ever painted inside the "Customize" dialog, so they live in that lazy chunk
 * instead (see `CookiePreferencesDialog.jsx`).
 *
 * Adding or re-scoping a category means bumping `CONSENT_VERSION` in
 * `cookieConsent.js`: a record written before the category existed expresses no
 * opinion about it, and an unanswered category must not be read as a yes.
 */
export const COOKIE_CATEGORIES = [
  {
    id: "essential",
    name: "Essential",
    description:
      "Needed for the site to work — signing in, keeping your session, and security. Always on.",
    isEssential: true,
  },
  {
    id: "analytics",
    name: "Analytics",
    description:
      "Anonymous data about which pages families and caregivers use, so we know what to improve.",
  },
  {
    id: "marketing",
    name: "Marketing",
    description:
      "Lets us show Famlink ads to people who might be looking for a nanny share, and measure whether they worked.",
  },
];

/** The all-off baseline: essential on, everything else off until asked. */
export function essentialOnly(categories = COOKIE_CATEGORIES) {
  return Object.fromEntries(categories.map((c) => [c.id, Boolean(c.isEssential)]));
}

/** Everything on — what "Accept all" commits. */
export function allAccepted(categories = COOKIE_CATEGORIES) {
  return Object.fromEntries(categories.map((c) => [c.id, true]));
}
