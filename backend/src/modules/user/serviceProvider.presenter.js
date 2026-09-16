// The caregiver preview on the marketing homepage.
//
// This is the one directory response served to logged-out visitors, which
// changes what may appear in it. A full legal name next to a zip code, an
// hourly rate and an availability window lets a stranger identify a specific
// caregiver without ever creating an account — so the name is masked here and
// only signing in reveals it. Nothing else about a user may be added to this
// shape without answering that same question again.

/** The positions this preview will show. Anything else is skipped entirely. */
export const PREVIEW_POSITIONS = [
  "nanny",
  "privateEducator",
  "specializedCaregiver",
  "sportsCoaches",
  "musicInstructor",
  "swimInstructor",
  "houseManager",
  "babysitter",
];

/** Only the fields the formatter below reads — not a whole user document. */
export const SERVICE_PROVIDER_SELECT = "name additionalInfo reviews";

const ROLE_LABEL = {
  nanny: "Nanny",
  privateEducator: "Private Educator",
  specializedCaregiver: "Specialized Caregiver",
  sportsCoaches: "Sports Coach",
  musicInstructor: "Music Instructor",
  swimInstructor: "Swim Instructor",
  houseManager: "House Manager",
  babysitter: "Babysitter",
};

const ROLE_SERVICE = {
  nanny: "Full-time childcare",
  privateEducator: "Academic instruction",
  specializedCaregiver: "Care for special needs",
  sportsCoaches: "Sports training",
  musicInstructor: "Music education",
  swimInstructor: "Swimming lessons",
  houseManager: "Household management",
  babysitter: "Part-time childcare",
};

export const roleDisplay = (role) => ROLE_LABEL[role] || "Service Provider";
export const roleService = (role) => ROLE_SERVICE[role] || "General support";

// Teaching roles lead to a different profile layout, so the button says so.
export const roleCTA = (role) =>
  role === "musicInstructor" || role === "privateEducator"
    ? "View Teaching Profile"
    : "View Full Profile";

/** "Sam Ortiz" → "Sam O." A single-word name is left alone; it identifies less. */
export const maskedName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "A caregiver";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

const infoValue = (additionalInfo, key) =>
  Array.isArray(additionalInfo)
    ? additionalInfo.find((info) => info.key === key)?.value
    : undefined;

/**
 * "$20 - $30/hour" from the salary answer, or null if it holds no numbers.
 *
 * The answer is an object of free-text fields, so anything unparseable is
 * dropped rather than rendered as "$NaN".
 */
export const rateRange = (salaryExp) => {
  if (!salaryExp || typeof salaryExp !== "object") return null;

  const rates = Object.values(salaryExp)
    .map((value) => parseFloat(value))
    .filter((value) => !Number.isNaN(value));

  if (rates.length === 0) return null;
  return `$${Math.min(...rates)} - $${Math.max(...rates)}/hour`;
};

/**
 * One card per position a caregiver offers.
 *
 * A caregiver who lists three positions appears three times, once per role —
 * the homepage renders a grid of roles, not of people. Returns an empty array
 * for anyone whose listed positions are all outside PREVIEW_POSITIONS.
 */
export const toServiceProviderCards = (user) => {
  const positions = infoValue(user.additionalInfo, "interestedPosi")?.option;
  if (!Array.isArray(positions)) return [];

  const shown = positions.filter((position) => PREVIEW_POSITIONS.includes(position));
  if (shown.length === 0) return [];

  // Computed once per user rather than once per card.
  const rate = rateRange(infoValue(user.additionalInfo, "salaryExp"));
  const rating =
    user.reviews?.length > 0
      ? Number(
          (
            user.reviews.reduce((sum, review) => sum + review.rating, 0) /
            user.reviews.length
          ).toFixed(1)
        )
      : // An unreviewed caregiver shows 5, not 0: a new joiner should not look
        // worse than a badly-reviewed one on the shop window.
        5;

  return shown.map((role) => ({
    name: maskedName(user.name),
    role: roleDisplay(role),
    rating,
    rate: rate || "$25/hour",
    availability: infoValue(user.additionalInfo, "avaiForWorking") || "Availability not specified",
    experience: infoValue(user.additionalInfo, "experience") || "Experience not specified",
    description: infoValue(user.additionalInfo, "jobDescription") || "No description provided.",
    service: roleService(role),
    cta: roleCTA(role),
  }));
};
