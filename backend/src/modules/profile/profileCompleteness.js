// How complete is this user's profile, as a percentage and as a list of what is
// missing.
//
// The console needs both numbers and reasons: "62% complete" tells an admin who
// to chase, but "no photo, no schedule" is what goes in the email that chases
// them. So this returns the breakdown rather than a bare score.
//
// The weights below are not arbitrary and are worth keeping honest: they are
// ordered by what actually blocks a match. A profile with no schedule and no
// location cannot be matched at all no matter how well written its bio is, so
// those carry more than the free-text fields.

const has = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
};

// A schedule is stored as { monday: { checked, start, end }, ... } and an empty
// one is an object full of unchecked days, not an absent key — so `has()` alone
// would score it as present.
const hasSchedule = (schedule) => {
  if (!schedule || typeof schedule !== "object") return false;
  return Object.values(schedule).some((day) => day?.checked);
};

// Shared by both roles. Each entry is [label, weight, test].
const ACCOUNT_CHECKS = [
  ["Name", 5, (u) => has(u.name)],
  ["Email verified", 10, (u) => Boolean(u.verified?.emailVer)],
  ["Photo", 10, (u) => has(u.imageUrl)],
  ["Location", 15, (u) => has(u.location?.city) || has(u.location?.format_location)],
  ["About / bio", 10, (u) => has(u.aboutMe)],
];

const FAMILY_CHECKS = [
  ["Share type", 10, (_u, p) => has(p?.nannyShareType)],
  ["Schedule", 15, (_u, p) => hasSchedule(p?.specificDays)],
  ["Children's ages", 10, (_u, p) => has(p?.childrenAges)],
  ["Hosting preference", 5, (_u, p) => has(p?.hostingPreference)],
  ["Budget", 10, (_u, p) => has(p?.hourlyBudget)],
];

const CAREGIVER_CHECKS = [
  ["Care experience", 10, (_u, p) => has(p?.careExperience)],
  ["Availability", 15, (_u, p) => hasSchedule(p?.specificDays) || has(p?.startAvailability)],
  ["Ages you care for", 10, (_u, p) => has(p?.preferredAges) || has(p?.agesCare)],
  ["Rate", 10, (_u, p) => has(p?.sharedRate) || has(p?.soloRate) || has(p?.hourlyBudget)],
  ["Certifications", 5, (_u, p) => has(p?.certifications)],
];

/**
 * @param {object} user            a user document or lean object
 * @param {object|null} profile    their nannyProfile, if they have one
 * @returns {{percent:number, completed:string[], missing:string[], hasProfile:boolean}}
 */
export const scoreProfile = (user, profile = null) => {
  const checks = [
    ...ACCOUNT_CHECKS,
    ...(user?.type === "Parents" ? FAMILY_CHECKS : CAREGIVER_CHECKS),
  ];

  const completed = [];
  const missing = [];
  let earned = 0;
  let total = 0;

  for (const [label, weight, test] of checks) {
    total += weight;
    let passed = false;
    try {
      passed = test(user || {}, profile);
    } catch {
      // A malformed stored profile scores as incomplete rather than throwing.
      // This runs over every user in a bulk report; one bad row must not 500
      // the whole page.
      passed = false;
    }
    if (passed) {
      earned += weight;
      completed.push(label);
    } else {
      missing.push(label);
    }
  }

  return {
    percent: total ? Math.round((earned / total) * 100) : 0,
    completed,
    missing,
    hasProfile: Boolean(profile),
  };
};

// Buckets for the completeness histogram on the monitor screen.
export const completenessBucket = (percent) => {
  if (percent >= 100) return "complete";
  if (percent >= 75) return "almost";
  if (percent >= 40) return "partial";
  return "barely-started";
};
