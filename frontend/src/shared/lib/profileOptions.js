/* The choices every profile question offers — one list per question, used by
 * the onboarding questionnaires, the profile-completion questionnaires and
 * both edit-profile pages, for caregivers and families alike.
 *
 * Before this each surface kept its own copy, and they had drifted: "Fixed"
 * vs "Not flexible", "1-2 miles" vs "1-3 miles", three spellings of the age
 * groups, a caregiver "Nap/bedtime routines" beside a family "Nap/bedtime
 * support". Answers given in one place didn't preselect in another, and the
 * same fact read differently on two profiles.
 *
 * Storage: answers are saved lowercased — OnboardingOptionSelector has always
 * done that, and the profile page sentence-cases on display. The edit pages
 * use toSelectOptions() (lowercase value, cased label) and normalizeAnswer()
 * on load so older answers — other casing, retired spellings — still select.
 *
 * Where the surfaces disagreed, the onboarding list won: it is what most
 * members actually answered. */

export const CARE_EXPERIENCE = ["Less than 1 year", "1-3 years", "3-5 years", "5+ years"];

// Children's age groups — what a caregiver prefers, has cared for, or cares
// for now. job/Screen4's AGE_LABEL_MAP keys off these exact labels.
export const AGE_GROUPS = ["Infants (0–1)", "Toddlers (1–3)", "Preschool (3–5)", "School-age (5+)"];

export const LANGUAGES = ["English", "Spanish", "French", "Mandarin", "Cantonese", "Arabic"];

// Only these four read as credentials on the profile page; anything else goes
// in the free-text "other certifications" field.
export const CERTIFICATIONS = [
  "CPR Certified",
  "First Aid Certified",
  "Early Childhood Education (ECE)",
  "TrustLine Registered",
];

export const NOT_APPLICABLE = "Not applicable";

// "Help with the children": what a family wants and what a caregiver offers.
export const CHILD_HELP = [
  "Transportation",
  "Educational activities",
  "Outdoor play",
  "Storytime / reading",
  "Meal/snack prep for kids",
  "Homework help",
  "Nap/bedtime support",
];

// "Help around the house": the same list for both sides of the share.
export const HOUSEHOLD_TASKS = [
  "Light housekeeping",
  "Grocery shopping",
  "Errands",
  "Meal preparation for family",
];

export const FLEXIBILITY = ["Very flexible", "Somewhat flexible", "Not flexible"];

export const COMMUNICATION = [
  "Group chat",
  "Shared calendar",
  "Email updates",
  "Phone calls",
  "Regular in-person meetings",
];

export const BACKUP_CARE = [
  "Family members",
  "Backup nanny service",
  "Friends or neighbors",
  "Local daycare",
  "No backup options",
];

export const INVOLVEMENT = ["Very involved", "Moderately involved", "Minimal involvement"];

export const TRAVEL_DISTANCE = ["1-3 miles", "3-5 miles", "5-10 miles", "Flexible"];

export const ALLERGIES_HEALTH = ["Food allergies", "Environmental allergies", "Asthma", "Medication needs", "None"];

export const PARENTING_STYLE = ["Montessori", "Attachment parenting", "RIE", "Authoritative", "Permissive", "Strict", "Flexible"];

export const HOUSE_RULES = [
  "Screen time limits",
  "Dietary restrictions",
  "Behavior expectations",
  "Hygiene practices",
  "Chore responsibilities",
];

export const DAILY_ROUTINE = [
  "Nap times",
  "Outdoor play",
  "Educational activities",
  "Structured meal times",
  "Storytime",
  "Arts & crafts",
  "Playdates/outings",
];

export const PETS = ["No pets", "Dog(s)", "Cat(s)", "Small animals", "Birds"];

export const URGENCY = ["Urgent – I need care soon", "Actively looking", "Just exploring"];

export const YES_NO = ["Yes", "No"];

/* Retired spellings → the current answer (both lowercased). */
const ALIASES = {
  "1-0 year": "less than 1 year",
  "over 5 years": "5+ years",
  fixed: "not flexible",
  "1-2 miles": "1-3 miles",
  "infants (0-1)": "infants (0–1)",
  "toddlers (1-3)": "toddlers (1–3)",
  "preschoolers (3-5)": "preschool (3–5)",
  "preschool (3-5)": "preschool (3–5)",
  "school-aged (5+)": "school-age (5+)",
  infant: "infants (0–1)",
  toddler: "toddlers (1–3)",
  preschool: "preschool (3–5)",
  "school-age": "school-age (5+)",
  cpr: "cpr certified",
  "first aid": "first aid certified",
  "early childhood education": "early childhood education (ece)",
  "meal/snack prep": "meal/snack prep for kids",
  "nap/bedtime routines": "nap/bedtime support",
  "storytime/reading": "storytime / reading",
  "arts and crafts": "arts & crafts",
  "regular meetings": "regular in-person meetings",
};

/** One answer, or a list of them, in the stored form: lowercased, with retired
 *  spellings mapped to the current option. Non-strings pass through. */
export function normalizeAnswer(value) {
  if (Array.isArray(value)) return value.map(normalizeAnswer);
  if (typeof value !== "string") return value;
  const lower = value.trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}

/** antd Select options for a list: the stored (lowercase) value, the cased label. */
export const toSelectOptions = (list) => list.map((label) => ({ value: label.toLowerCase(), label }));

/** A stored list answer as an array. Depending on which flow saved it, a list
 *  arrives as an array, a JSON string ('["english"]' — the profile create path
 *  doesn't parse every list field) or a legacy comma string. */
export function readList(value) {
  if (Array.isArray(value)) return value.flatMap(readList);
  if (value && typeof value === "object") return value.label ? [value.label] : [];
  if (typeof value !== "string" || !value.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      return readList(JSON.parse(trimmed));
    } catch {
      /* fall through to the comma split */
    }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}
