/**
 * Demo data for screenshots: 15 complete Oakland members.
 *
 * Fills a LOCAL database with a plausible Oakland nanny-share market — eight
 * families and seven caregivers, clustered inside the 5-mile default browse
 * radius so the dashboard comes up full instead of showing the empty state.
 *
 * Every account is finished the way a real one is after onboarding:
 * `nannyProfileCompleted`, a verified email, a `nannyprofiles` document with
 * the fields the browse cards actually read (schedule, rates, ages, location),
 * and a handful of reviews so the star ratings aren't blank.
 *
 *   node scripts/seedDemoUsers.mjs           seed (wipes previous demo rows)
 *   node scripts/seedDemoUsers.mjs --purge   remove the demo rows and stop
 *
 * Re-running is safe: rows are keyed by the @famylink-demo.test domain and
 * dropped before reseeding, so this never accumulates duplicates.
 *
 * Refuses to run against anything but a local mongod — see the guard below.
 * These are invented people with mockup portraits; nothing here should ever
 * reach a database real members share.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { config } from "../src/config/index.js";
import { isLocalMongoUri } from "../src/config/mongoUri.js";
import User from "../src/modules/user/user.model.js";
import NannyProfile from "../src/modules/profile/nannyProfile.model.js";

/* ─────────────────────────────── constants ─────────────────────────────── */

// Every seeded address ends here. It is the purge key, and a reserved TLD, so
// a stray welcome email can never reach a real inbox.
const DEMO_DOMAIN = "famylink-demo.test";
const DEMO_EMAIL_RE = new RegExp(`@${DEMO_DOMAIN.replace(/\./g, "\\.")}$`, "i");

// One password for all fifteen — these are throwaway demo logins, and a
// different one per account just means fifteen things to paste.
const DEMO_PASSWORD = "FamlinkDemo123!";

// The account to log in as for screenshots: a Grand Lake family, centred so
// every other seeded member falls inside the 5-mile default radius.
const HERO_EMAIL = `maya.brennan@${DEMO_DOMAIN}`;

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/* ──────────────────────────────── helpers ──────────────────────────────── */

/**
 * A schedule the cards can read: `{ Monday: { checked, start, end } }`.
 *
 * The hours are built as LOCAL clock time and then serialised, which is what
 * the questionnaire does — it calls `.toISOString()` on a Date the member
 * picked in their own timezone. Constructing these in UTC instead makes an
 * 8am–5pm day render as "13:30 – 22:30" to anyone not on UTC.
 */
const days = (names, startHour = 8, endHour = 17) =>
  Object.fromEntries(
    names.map((day) => {
      const dayOfMonth = 5 + DAY_ORDER.indexOf(day); // 2026-01-05 is a Monday
      const start = new Date(2026, 0, dayOfMonth, startHour, 0, 0, 0);
      const end = new Date(2026, 0, dayOfMonth, endHour, 0, 0, 0);
      return [day, { checked: true, start: start.toISOString(), end: end.toISOString() }];
    })
  );

/** `{ label, value, unit }` — the shape childrenAges is read back in. */
const child = (value, unit = "years") => ({
  label: `${value} ${unit === "years" ? (value === 1 ? "year" : "years") : "months"}`,
  value,
  unit,
});

/** `{ label, min, max }` — what a caregiver says they'll take. */
const ageBand = (label, min, max) => ({ label, min, max });

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Unique share codes in the real alphabet, handed out deterministically. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
let codeSeed = 7919;
const referralCode = () => {
  let code = "";
  for (let i = 0; i < 5; i++) {
    codeSeed = (codeSeed * 31 + 17) % 2147483647;
    code += CODE_ALPHABET[codeSeed % CODE_ALPHABET.length];
  }
  return `FAM${code}`;
};

const place = (city, neighborhood, zipCode, lat, lng) => ({
  zipCode,
  location: {
    type: "Point",
    coordinates: [lng, lat],
    format_location: `${neighborhood}, ${city}, CA ${zipCode}`,
    city,
    neighborhood,
  },
});

const oakland = (neighborhood, zip, lat, lng) => place("Oakland", neighborhood, zip, lat, lng);

/* ──────────────────────────────── the cast ─────────────────────────────── */
//
// Eight families and seven caregivers, all women.
//
// Portraits are randomuser.me mockup photos: 128px stand-ins published for
// exactly this purpose, which is also why they read as real at card size
// without being anyone. They are not members, and nothing in the app
// substitutes one for a member who has not uploaded a picture — a real profile
// without a photo shows its initial, because a stranger's face over someone
// else's name is a lie told to the family reading it.

const portrait = (gender, n) => `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;

const PEOPLE = [
  /* ───────────────────────────── families ───────────────────────────── */
  {
    name: "Maya Brennan",
    email: HERO_EMAIL,
    type: "Parents",
    gender: "Female",
    age: "34",
    img: portrait("women", 44),
    ...oakland("Grand Lake", "94610", 37.8115, -122.247),
    goal: "Family looking for a nanny share",
    aboutMe:
      "Mum to a spirited two-year-old, three blocks from the Grand Lake farmers market. We're after a warm, unhurried share with one other family nearby — ideally a full-time weekday rhythm with lots of park time.",
    children: [child(2)],
    joined: 26,
    profile: {
      nannyShareType: "Full-time",
      hasNanny: false,
      hasFamily: false,
      shareLocation: ["Grand Lake", "Adams Point", "Lakeshore"],
      specifyNearbyWorkplace: "Kaiser Oakland — I commute there three days a week",
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 8, 17),
      flexibility: "Somewhat flexible",
      hostingPreference: "Rotate between homes",
      nannyshareStart: "Within a month",
      urgency: "Within a month",
      numberOfChildren: 1,
      childrenAges: [child(2)],
      allergiesHealth: ["None"],
      childResponsibilities: ["Nap routine", "Outdoor play", "Meal prep for child"],
      householdAddOns: ["Tidy play areas"],
      parentingStyle: ["Montessori-inspired", "Gentle parenting"],
      houseRules: ["Limited screen time", "Outside time daily"],
      dailyRoutine: ["Morning park", "Nap", "Storytime", "Arts & crafts"],
      hourlyBudget: { min: 38, max: 46, minShare: 19, maxShare: 23 },
      pets: ["Dog"],
      communicationPreference: "Text / WhatsApp",
      backupCare: "Family nearby",
      involvementLevel: "Moderately involved",
      careDescription:
        "Looking for one other family with a toddler close in age. We have a fenced yard, a nap room, and a very patient golden retriever.",
      openNotes: "Happy to host most days — our place is set up for two toddlers.",
    },
  },
  {
    name: "Priya Raghunathan",
    email: `priya.raghunathan@${DEMO_DOMAIN}`,
    type: "Parents",
    gender: "Female",
    age: "37",
    img: portrait("women", 68),
    ...oakland("Rockridge", "94618", 37.8447, -122.2518),
    goal: "Family looking for a nanny share",
    aboutMe:
      "Two kids, one very full calendar. We already have a wonderful nanny and are looking for a second family to share her with from the new year.",
    children: [child(4), child(18, "months")],
    joined: 41,
    premium: true,
    profile: {
      nannyShareType: "Full-time",
      hasNanny: true,
      hasFamily: false,
      shareLocation: ["Rockridge", "Temescal", "Elmwood"],
      specifyNearbyWorkplace: "UCSF Mission Bay",
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 8, 18),
      flexibility: "Very flexible",
      hostingPreference: "Your home",
      nannyshareStart: "Within 2-3 months",
      urgency: "Within 2-3 months",
      numberOfChildren: 2,
      childrenAges: [child(4), child(18, "months")],
      allergiesHealth: ["Food allergies"],
      allergiesHealthSpecify: "Peanut — no nuts in the house",
      childResponsibilities: ["School drop-off", "Nap routine", "Homework help"],
      householdAddOns: ["Children's laundry", "Meal prep"],
      parentingStyle: ["Attachment parenting"],
      houseRules: ["No screens before 4pm", "Shoes off indoors"],
      dailyRoutine: ["Outdoor play", "Nap", "Music class", "Storytime"],
      hourlyBudget: { min: 42, max: 50, minShare: 21, maxShare: 25 },
      pets: ["None"],
      communicationPreference: "Daily written log",
      backupCare: "Nanny agency",
      involvementLevel: "Very involved",
      careDescription:
        "Our nanny has been with us three years — CPR certified, drives, endlessly patient. We'd love a family with one child under three.",
    },
  },
  {
    name: "Adaeze Okonjo",
    email: `adaeze.okonjo@${DEMO_DOMAIN}`,
    type: "Parents",
    gender: "Female",
    age: "39",
    img: portrait("women", 19),
    ...oakland("Temescal", "94609", 37.836, -122.263),
    goal: "Family looking for a nanny share",
    aboutMe:
      "Mum of twins, working hybrid out of a home office in Temescal. Looking for a part-time share to cover the middle of the week.",
    children: [child(3), child(3)],
    joined: 19,
    profile: {
      nannyShareType: "Part-time",
      hasNanny: false,
      hasFamily: false,
      shareLocation: ["Temescal", "Piedmont Avenue", "Rockridge"],
      specificDays: days(["Tuesday", "Wednesday", "Thursday"], 9, 15),
      flexibility: "Somewhat flexible",
      hostingPreference: "Other family's home",
      nannyshareStart: "Immediately",
      urgency: "Immediately",
      numberOfChildren: 2,
      childrenAges: [child(3), child(3)],
      allergiesHealth: ["Asthma"],
      childResponsibilities: ["Outdoor play", "Meal prep for child", "Nap routine"],
      householdAddOns: ["Tidy play areas"],
      parentingStyle: ["Gentle parenting"],
      houseRules: ["Limited screen time"],
      dailyRoutine: ["Outdoor play", "Arts & crafts", "Nap"],
      hourlyBudget: { min: 36, max: 44, minShare: 18, maxShare: 22 },
      pets: ["Cat"],
      communicationPreference: "Text / WhatsApp",
      backupCare: "None yet",
      involvementLevel: "Moderately involved",
      careDescription:
        "Twins are three and thick as thieves. A third child in the mix would be ideal — they play better with an audience.",
    },
  },
  {
    name: "Hannah Lieberman",
    email: `hannah.lieberman@${DEMO_DOMAIN}`,
    type: "Parents",
    gender: "Female",
    age: "32",
    img: portrait("women", 12),
    ...oakland("Adams Point", "94610", 37.812, -122.259),
    goal: "Family looking for a nanny share",
    aboutMe:
      "First-time parent, back at work in January. Looking for a gentle, experienced caregiver and a family to split the week with.",
    children: [child(11, "months")],
    joined: 8,
    profile: {
      nannyShareType: "Full-time",
      hasNanny: false,
      hasFamily: false,
      shareLocation: ["Adams Point", "Grand Lake", "Uptown"],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 8, 16),
      flexibility: "Not very flexible",
      hostingPreference: "Rotate between homes",
      nannyshareStart: "Within a month",
      urgency: "Within a month",
      numberOfChildren: 1,
      childrenAges: [child(11, "months")],
      allergiesHealth: ["None"],
      childResponsibilities: ["Nap routine", "Bottle feeding", "Outdoor play"],
      householdAddOns: ["Bottle washing"],
      parentingStyle: ["Attachment parenting", "Montessori-inspired"],
      houseRules: ["No screens", "Hand washing on arrival"],
      dailyRoutine: ["Nap", "Sensory play", "Stroller walk"],
      hourlyBudget: { min: 40, max: 48, minShare: 20, maxShare: 24 },
      pets: ["None"],
      communicationPreference: "Daily written log",
      backupCare: "Family nearby",
      involvementLevel: "Very involved",
      careDescription:
        "Our apartment is small but sunny and two minutes from Lakeside Park. Ideally sharing with another infant family.",
    },
  },
  {
    name: "Sofia Marchetti",
    email: `sofia.marchetti@${DEMO_DOMAIN}`,
    type: "Parents",
    gender: "Female",
    age: "35",
    img: portrait("women", 26),
    ...oakland("Piedmont Avenue", "94611", 37.827, -122.25),
    goal: "Family looking for a nanny share",
    aboutMe:
      "We run a small bakery, so our hours start early. Looking for a share with a family who also needs a 7am start.",
    children: [child(5), child(2)],
    joined: 33,
    profile: {
      nannyShareType: "Full-time",
      hasNanny: true,
      hasFamily: false,
      shareLocation: ["Piedmont Avenue", "Temescal", "Montclair"],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 7, 15),
      flexibility: "Somewhat flexible",
      hostingPreference: "Your home",
      nannyshareStart: "Within a month",
      urgency: "Within a month",
      numberOfChildren: 2,
      childrenAges: [child(5), child(2)],
      allergiesHealth: ["None"],
      childResponsibilities: ["School drop-off", "Meal prep for child", "Nap routine"],
      householdAddOns: ["Children's laundry", "Grocery run"],
      parentingStyle: ["Gentle parenting"],
      houseRules: ["Family dinner rule", "Limited screen time"],
      dailyRoutine: ["School run", "Outdoor play", "Nap", "Storytime"],
      hourlyBudget: { min: 40, max: 46, minShare: 20, maxShare: 23 },
      pets: ["Dog", "Cat"],
      communicationPreference: "Phone call",
      backupCare: "Family nearby",
      involvementLevel: "Moderately involved",
      careDescription:
        "Early starts, early finishes. Our nanny is with us already and is happy to take on one more child.",
    },
  },
  {
    name: "Grace Whitfield",
    email: `grace.whitfield@${DEMO_DOMAIN}`,
    type: "Parents",
    gender: "Female",
    age: "36",
    img: portrait("women", 90),
    ...oakland("Crocker Highlands", "94610", 37.8105, -122.235),
    goal: "Family looking for a nanny share",
    aboutMe:
      "After-school cover is what we're missing — someone to collect from Crocker Highlands Elementary and hold the fort until six.",
    children: [child(7), child(9)],
    joined: 14,
    profile: {
      nannyShareType: "Part-time",
      hasNanny: false,
      hasFamily: false,
      shareLocation: ["Crocker Highlands", "Trestle Glen", "Glenview"],
      specifyNearbyWorkplace: "Downtown Oakland — 12th St BART",
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 14, 18),
      flexibility: "Not very flexible",
      hostingPreference: "Your home",
      nannyshareStart: "Immediately",
      urgency: "Immediately",
      numberOfChildren: 2,
      childrenAges: [child(7), child(9)],
      childrenSchools: "Crocker Highlands Elementary",
      allergiesHealth: ["None"],
      childResponsibilities: ["School pickup", "Homework help", "Driving to activities"],
      householdAddOns: ["Meal prep"],
      parentingStyle: ["Structured routine"],
      houseRules: ["Homework before screens"],
      dailyRoutine: ["School pickup", "Homework", "Outdoor play", "Dinner prep"],
      hourlyBudget: { min: 34, max: 42, minShare: 17, maxShare: 21 },
      pets: ["Dog"],
      communicationPreference: "Text / WhatsApp",
      backupCare: "Neighbour",
      involvementLevel: "Minimally involved",
      careDescription:
        "Both kids are at Crocker Highlands. A family at the same school would make pickup trivial.",
    },
  },
  {
    name: "Aisha Cole",
    email: `aisha.cole@${DEMO_DOMAIN}`,
    type: "Parents",
    gender: "Female",
    age: "31",
    img: portrait("women", 55),
    ...oakland("Glenview", "94602", 37.803, -122.226),
    goal: "Family looking for a nanny share",
    aboutMe:
      "Nurse on rotating shifts, so our week moves around. Looking for a flexible share with a family who gets it.",
    children: [child(3)],
    joined: 5,
    profile: {
      nannyShareType: "Part-time",
      hasNanny: false,
      hasFamily: false,
      shareLocation: ["Glenview", "Dimond District", "Laurel"],
      specificDays: days(["Monday", "Wednesday", "Friday"], 7, 16),
      flexibility: "Very flexible",
      hostingPreference: "Rotate between homes",
      nannyshareStart: "Within 2-3 months",
      urgency: "Within 2-3 months",
      numberOfChildren: 1,
      childrenAges: [child(3)],
      allergiesHealth: ["Eczema"],
      childResponsibilities: ["Outdoor play", "Nap routine", "Meal prep for child"],
      householdAddOns: [],
      responsibilitiesNA: false,
      parentingStyle: ["Gentle parenting"],
      houseRules: ["Limited screen time"],
      dailyRoutine: ["Outdoor play", "Nap", "Arts & crafts"],
      hourlyBudget: { min: 34, max: 40, minShare: 17, maxShare: 20 },
      pets: ["None"],
      communicationPreference: "Text / WhatsApp",
      backupCare: "None yet",
      involvementLevel: "Moderately involved",
      careDescription:
        "Three days a week, but which three can shift. A family with similar flexibility would be a dream.",
    },
  },
  {
    name: "Tessa Ashford",
    email: `tessa.ashford@${DEMO_DOMAIN}`,
    type: "Parents",
    gender: "Female",
    age: "41",
    img: portrait("women", 28),
    ...oakland("Montclair", "94611", 37.826, -122.21),
    goal: "Family looking for a nanny share",
    aboutMe:
      "School hours are the gap for us — both of us are still working when the bell goes. Looking for a part-time share up in Montclair, afternoons mostly.",
    children: [child(6), child(8)],
    joined: 22,
    profile: {
      nannyShareType: "Part-time",
      hasNanny: false,
      hasFamily: false,
      shareLocation: ["Montclair", "Dimond District", "Piedmont Avenue"],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 9, 17),
      flexibility: "Somewhat flexible",
      hostingPreference: "Your home",
      nannyshareStart: "Within 2-3 months",
      urgency: "Just exploring",
      numberOfChildren: 2,
      childrenAges: [child(6), child(8)],
      allergiesHealth: ["None"],
      childResponsibilities: ["Driving to activities", "Meal prep for child", "Outdoor play"],
      householdAddOns: ["Tidy play areas"],
      parentingStyle: ["Outdoorsy / free-range"],
      houseRules: ["Outside time daily"],
      dailyRoutine: ["Hikes", "Swimming", "Arts & crafts", "Library"],
      hourlyBudget: { min: 36, max: 44, minShare: 18, maxShare: 22 },
      pets: ["Dog"],
      communicationPreference: "Text / WhatsApp",
      backupCare: "Family nearby",
      involvementLevel: "Minimally involved",
      Seasonal: { startDate: new Date("2026-06-15"), endDate: new Date("2026-08-21") },
      careDescription:
        "Mid-June through late August. We back onto the Redwood trails, so expect a lot of time outdoors.",
    },
  },

  /* ──────────────────────────── caregivers ──────────────────────────── */
  {
    name: "Rosa Delgado",
    email: `rosa.delgado@${DEMO_DOMAIN}`,
    type: "Nanny",
    gender: "Female",
    age: "42",
    img: portrait("women", 65),
    ...oakland("Fruitvale", "94601", 37.78, -122.223),
    goal: "Nanny looking for a share position",
    aboutMe:
      "Twelve years with East Bay families, most recently a three-year share in Rockridge. Bilingual English/Spanish, CPR certified, and I drive.",
    joined: 30,
    intent: "looking_for_job",
    profile: {
      hasFamily: false,
      hasNanny: false,
      careType: "Full-time",
      nannyShareType: "Full-time",
      shareLocation: ["Fruitvale", "Grand Lake", "Glenview"],
      languages: ["English", "Spanish"],
      ageGroupsExp: ["Infant (0-12 months)", "Toddler (1-3 years)", "Preschool (3-5 years)"],
      workSetup: "Either home — happy to rotate",
      salaryExp: { firstChild: 28, secChild: 34, thirdChild: 39 },
      customCertifications: "Water safety instructor",
      carpool: "Yes — happy to drive",
      whereCare: "Rotate between homes",
      careExperience: "12+ years",
      careDistance: "Up to 10 miles",
      shareExperience: "I have worked in a nanny share before",
      multiFamilyComfort: "Very comfortable",
      childrenCapacity: "Up to 3 children",
      preferredAges: [ageBand("6 months - 2 years", 0, 2), ageBand("2 - 5 years", 2, 5)],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 8, 17),
      startAvailability: "Immediately",
      responsibilities: ["Nap routine", "Meal prep for child", "Outdoor play", "Light tidying"],
      householdHelp: "Happy to help with children's laundry and meals",
      hasTransport: "Yes — own car",
      backgroundCheck: "Completed",
      sharedRate: "34",
      soloRate: "28",
      rateType: "hourly",
      budget: { sharedRate: { min: 32, max: 38 }, soloRate: { min: 26, max: 30 } },
      certifications: ["CPR", "First Aid", "Infant care"],
      skills: "Bilingual English/Spanish, early literacy, cooking for toddlers",
      bio:
        "I've spent twelve years caring for East Bay families and love the rhythm of a share — the children get a playmate and the families get a village.",
    },
  },
  {
    name: "Chloe Nakamura",
    email: `chloe.nakamura@${DEMO_DOMAIN}`,
    type: "Nanny",
    gender: "Female",
    age: "27",
    img: portrait("women", 33),
    ...oakland("Uptown", "94612", 37.808, -122.268),
    goal: "Nanny looking for a share position",
    aboutMe:
      "Early-childhood degree from Mills, four years in the field. I'm the arts-and-crafts, let's-build-a-fort sort of nanny.",
    joined: 11,
    intent: "looking_for_job",
    profile: {
      hasFamily: false,
      hasNanny: false,
      careType: "Part-time",
      nannyShareType: "Part-time",
      shareLocation: ["Uptown", "Adams Point", "Temescal"],
      languages: ["English", "Japanese"],
      ageGroupsExp: ["Toddler (1-3 years)", "Preschool (3-5 years)", "School-age (5-10 years)"],
      workSetup: "Prefer the family's home",
      salaryExp: { firstChild: 25, secChild: 30, thirdChild: 35 },
      customCertifications: "Water safety, Art therapy basics",
      carpool: "No — I travel by bike",
      whereCare: "Other family's home",
      careExperience: "4 years",
      careDistance: "Up to 5 miles",
      shareExperience: "New to nanny shares but keen",
      multiFamilyComfort: "Comfortable",
      childrenCapacity: "Up to 2 children",
      preferredAges: [ageBand("2 - 5 years", 2, 5), ageBand("5 - 10 years", 5, 10)],
      specificDays: days(["Tuesday", "Wednesday", "Thursday"], 9, 16),
      startAvailability: "Within a month",
      responsibilities: ["Outdoor play", "Arts & crafts", "Homework help"],
      householdHelp: "Tidy up after activities",
      hasTransport: "Yes — public transport and bike",
      backgroundCheck: "Completed",
      sharedRate: "30",
      soloRate: "25",
      rateType: "hourly",
      budget: { sharedRate: { min: 28, max: 34 }, soloRate: { min: 24, max: 27 } },
      certifications: ["CPR", "Early Childhood Education"],
      skills: "Art projects, music, sign language basics",
      bio:
        "I studied early childhood education at Mills and have been nannying in Oakland ever since. Big believer in messy play.",
    },
  },
  {
    name: "Beatrice Nyong'o",
    email: `beatrice.nyongo@${DEMO_DOMAIN}`,
    type: "Nanny",
    gender: "Female",
    age: "48",
    img: portrait("women", 72),
    ...oakland("West Oakland", "94607", 37.809, -122.293),
    goal: "Nanny with a family, looking for a share",
    aboutMe:
      "I've been with the Harpers in West Oakland for two years and we're looking for a second family to join the share.",
    joined: 45,
    intent: "already_with_family",
    profile: {
      hasFamily: true,
      hasNanny: false,
      careType: "Full-time",
      nannyShareType: "Full-time",
      shareLocation: ["West Oakland", "Uptown", "Temescal"],
      languages: ["English", "Swahili"],
      ageGroupsExp: ["Newborn (0-3 months)", "Infant (0-12 months)", "Toddler (1-3 years)", "Preschool (3-5 years)"],
      workSetup: "Currently hosting at my family's home",
      salaryExp: { firstChild: 34, secChild: 44, thirdChild: 52, fourthChild: 58 },
      customCertifications: "Lactation support, Sleep consultant",
      carpool: "Yes — happy to drive",
      whereCare: "Your home",
      careExperience: "20+ years",
      careDistance: "Up to 8 miles",
      shareExperience: "Currently in a nanny share",
      multiFamilyComfort: "Very comfortable",
      childrenCapacity: "Up to 4 children",
      numberOfChildren: 1,
      childrenAges: [child(2)],
      preferredAges: [ageBand("6 months - 2 years", 0, 2), ageBand("2 - 5 years", 2, 5)],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 8, 18),
      startAvailability: "Within a month",
      responsibilities: ["Nap routine", "Meal prep for child", "Outdoor play", "School drop-off"],
      householdHelp: "Children's laundry, meal prep, light tidying",
      hasTransport: "Yes — own car",
      backgroundCheck: "Completed",
      hourlyBudget: { min: 44, max: 52, minShare: 22, maxShare: 26 },
      sharedRate: "44",
      soloRate: "34",
      rateType: "hourly",
      budget: { sharedRate: { min: 42, max: 48 }, soloRate: { min: 32, max: 36 } },
      certifications: ["CPR", "First Aid", "Newborn Care Specialist"],
      skills: "Newborn care, sleep routines, cooking",
      bio:
        "Twenty years of nannying, the last two with a lovely family in West Oakland. Their little one is two and ready for a playmate.",
    },
  },
  {
    name: "Margot Whitlow",
    email: `margot.whitlow@${DEMO_DOMAIN}`,
    type: "Nanny",
    gender: "Female",
    age: "34",
    img: portrait("women", 51),
    ...oakland("Dimond District", "94602", 37.799, -122.21),
    goal: "Nanny looking for a share position",
    aboutMe:
      "Former primary school teacher, now nannying. Strong on routine, homework and getting kids outside — afternoons and part-time weeks suit me best.",
    joined: 17,
    intent: "looking_for_job",
    profile: {
      hasFamily: false,
      hasNanny: false,
      careType: "Part-time",
      nannyShareType: "Part-time",
      shareLocation: ["Dimond District", "Glenview", "Laurel"],
      languages: ["English"],
      ageGroupsExp: ["School-age (5-10 years)", "Pre-teen (10-13 years)"],
      workSetup: "Either home — happy to rotate",
      salaryExp: { firstChild: 27, secChild: 32, thirdChild: 37, fourthChild: 42 },
      customCertifications: "California Teaching Credential, Youth soccer coaching",
      carpool: "Yes — happy to drive",
      whereCare: "Rotate between homes",
      careExperience: "8 years",
      careDistance: "Up to 6 miles",
      shareExperience: "I have worked in a nanny share before",
      multiFamilyComfort: "Very comfortable",
      childrenCapacity: "Up to 4 children",
      preferredAges: [ageBand("5 - 10 years", 5, 10), ageBand("10+ years", 10, 16)],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 14, 19),
      startAvailability: "Immediately",
      responsibilities: ["School pickup", "Homework help", "Driving to activities", "Dinner prep"],
      householdHelp: "Dinner prep and kitchen tidy",
      hasTransport: "Yes — own car",
      backgroundCheck: "Completed",
      sharedRate: "32",
      soloRate: "27",
      rateType: "hourly",
      budget: { sharedRate: { min: 30, max: 36 }, soloRate: { min: 25, max: 29 } },
      certifications: ["CPR", "First Aid", "Teaching Credential"],
      skills: "Homework support, reading intervention, coaching soccer",
      bio:
        "I taught third grade for six years before moving into nannying. After-school is my sweet spot — homework done before anyone touches a screen.",
    },
  },
  {
    name: "Lucia Ferreira",
    email: `lucia.ferreira@${DEMO_DOMAIN}`,
    type: "Nanny",
    gender: "Female",
    age: "30",
    img: portrait("women", 79),
    ...oakland("Laurel", "94602", 37.799, -122.204),
    goal: "Nanny looking for a share position",
    aboutMe:
      "Portuguese and English speaker, six years with infants and toddlers. Certified in infant sleep and newborn care.",
    joined: 9,
    intent: "looking_for_job",
    profile: {
      hasFamily: false,
      hasNanny: false,
      careType: "Full-time",
      nannyShareType: "Full-time",
      shareLocation: ["Laurel", "Glenview", "Grand Lake"],
      languages: ["English", "Portuguese"],
      ageGroupsExp: ["Newborn (0-3 months)", "Infant (0-12 months)", "Toddler (1-3 years)"],
      workSetup: "Prefer the family's home",
      salaryExp: { firstChild: 27, secChild: 33 },
      customCertifications: "Baby-led weaning, Infant massage",
      carpool: "Yes — own car",
      whereCare: "Other family's home",
      careExperience: "6 years",
      careDistance: "Up to 7 miles",
      shareExperience: "New to nanny shares but keen",
      multiFamilyComfort: "Comfortable",
      childrenCapacity: "Up to 2 children",
      preferredAges: [ageBand("0 - 6 months", 0, 1), ageBand("6 months - 2 years", 0, 2)],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 8, 16),
      startAvailability: "Within a month",
      responsibilities: ["Nap routine", "Bottle feeding", "Sensory play", "Outdoor play"],
      householdHelp: "Bottle washing and children's laundry",
      hasTransport: "Yes — own car",
      backgroundCheck: "Completed",
      sharedRate: "33",
      soloRate: "27",
      rateType: "hourly",
      budget: { sharedRate: { min: 31, max: 37 }, soloRate: { min: 25, max: 29 } },
      certifications: ["CPR", "Newborn Care Specialist", "Infant Sleep"],
      skills: "Bilingual English/Portuguese, infant sleep training, baby-led weaning",
      bio:
        "Infants are what I love — the sleep routines, the first foods, the tiny milestones. I'd be glad to take on two little ones in a share.",
    },
  },
  {
    name: "Yolanda Pierce",
    email: `yolanda.pierce@${DEMO_DOMAIN}`,
    type: "Nanny",
    gender: "Female",
    age: "52",
    img: portrait("women", 89),
    ...oakland("Trestle Glen", "94610", 37.8055, -122.232),
    goal: "Nanny with a family, looking for a share",
    aboutMe:
      "Long-time Oakland nanny. My current family in Trestle Glen is keen to bring a second family into the share from spring.",
    joined: 38,
    intent: "already_with_family",
    profile: {
      hasFamily: true,
      hasNanny: false,
      careType: "Part-time",
      nannyShareType: "Part-time",
      shareLocation: ["Trestle Glen", "Crocker Highlands", "Grand Lake"],
      languages: ["English"],
      ageGroupsExp: ["Toddler (1-3 years)", "Preschool (3-5 years)", "School-age (5-10 years)"],
      workSetup: "Currently hosting at my family's home",
      salaryExp: { firstChild: 32, secChild: 40, thirdChild: 46 },
      customCertifications: "Child Development Associate, Food handler",
      carpool: "Yes — happy to drive",
      whereCare: "Your home",
      careExperience: "20+ years",
      careDistance: "Up to 5 miles",
      shareExperience: "Currently in a nanny share",
      multiFamilyComfort: "Very comfortable",
      childrenCapacity: "Up to 3 children",
      numberOfChildren: 2,
      childrenAges: [child(4), child(6)],
      preferredAges: [ageBand("2 - 5 years", 2, 5), ageBand("5 - 10 years", 5, 10)],
      specificDays: days(["Monday", "Wednesday", "Friday"], 8, 15),
      startAvailability: "Within 2-3 months",
      responsibilities: ["School drop-off", "Outdoor play", "Meal prep for child", "Homework help"],
      householdHelp: "Meal prep and children's laundry",
      hasTransport: "Yes — own car",
      backgroundCheck: "Completed",
      hourlyBudget: { min: 40, max: 48, minShare: 20, maxShare: 24 },
      sharedRate: "40",
      soloRate: "32",
      rateType: "hourly",
      budget: { sharedRate: { min: 38, max: 44 }, soloRate: { min: 30, max: 34 } },
      certifications: ["CPR", "First Aid", "Child Development Associate"],
      skills: "School-age enrichment, baking, gardening with kids",
      bio:
        "I've been nannying in Oakland since my own children were small. The family I'm with now has two children, four and six, and a very welcoming home.",
    },
  },
  {
    name: "Amara Osei",
    email: `amara.osei@${DEMO_DOMAIN}`,
    type: "Nanny",
    gender: "Female",
    age: "29",
    img: portrait("women", 47),
    ...oakland("Lakeshore", "94610", 37.806, -122.243),
    goal: "Nanny looking for a share position",
    aboutMe:
      "Five years in nanny shares specifically — I genuinely prefer two families to one. Trained in Montessori methods.",
    joined: 3,
    intent: "looking_for_job",
    profile: {
      hasFamily: false,
      hasNanny: false,
      careType: "Full-time",
      nannyShareType: "Full-time",
      shareLocation: ["Lakeshore", "Grand Lake", "Adams Point", "Crocker Highlands"],
      languages: ["English", "Twi"],
      ageGroupsExp: ["Infant (0-12 months)", "Toddler (1-3 years)", "Preschool (3-5 years)"],
      workSetup: "Either home — happy to rotate",
      salaryExp: { firstChild: 29, secChild: 35, thirdChild: 41 },
      customCertifications: "Montessori Assistant Certificate (AMI)",
      carpool: "Yes — own car",
      whereCare: "Rotate between homes",
      careExperience: "5 years",
      careDistance: "Up to 4 miles",
      shareExperience: "I have worked in a nanny share before",
      multiFamilyComfort: "Very comfortable",
      childrenCapacity: "Up to 3 children",
      preferredAges: [ageBand("6 months - 2 years", 0, 2), ageBand("2 - 5 years", 2, 5)],
      specificDays: days(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], 8, 17),
      startAvailability: "Immediately",
      responsibilities: ["Nap routine", "Outdoor play", "Meal prep for child", "Sensory play"],
      householdHelp: "Children's laundry and tidying play areas",
      hasTransport: "Yes — own car",
      backgroundCheck: "Completed",
      sharedRate: "35",
      soloRate: "29",
      rateType: "hourly",
      budget: { sharedRate: { min: 33, max: 39 }, soloRate: { min: 27, max: 31 } },
      certifications: ["CPR", "First Aid", "Montessori Training"],
      skills: "Montessori practical life, outdoor education, toddler conflict resolution",
      bio:
        "Nanny shares are what I do — five years of them. Two toddlers learning to share a caregiver learn a great deal about sharing everything else.",
    },
  },
];

/* ─────────────────────────── reviews between members ────────────────────── */
//
// Keyed by email so they survive reordering. Each entry is a review LEFT ON the
// keyed member BY the listed author.

const REVIEWS = {
  [`rosa.delgado@${DEMO_DOMAIN}`]: [
    { by: `priya.raghunathan@${DEMO_DOMAIN}`, rating: 5, msg: "Rosa was with us for three years. Utterly reliable, and our daughter adored her." },
    { by: `adaeze.okonjo@${DEMO_DOMAIN}`, rating: 5, msg: "Covered for us for a month and the twins still ask after her." },
  ],
  [`chloe.nakamura@${DEMO_DOMAIN}`]: [
    { by: `hannah.lieberman@${DEMO_DOMAIN}`, rating: 5, msg: "Endlessly patient and full of ideas. The craft projects were a highlight." },
  ],
  [`beatrice.nyongo@${DEMO_DOMAIN}`]: [
    { by: `sofia.marchetti@${DEMO_DOMAIN}`, rating: 5, msg: "Beatrice is the most experienced caregiver we've worked with. Calm in every situation." },
    { by: `grace.whitfield@${DEMO_DOMAIN}`, rating: 4, msg: "Wonderful with our two. Communicative and always on time." },
  ],
  [`margot.whitlow@${DEMO_DOMAIN}`]: [
    { by: `grace.whitfield@${DEMO_DOMAIN}`, rating: 5, msg: "Homework gets done before anyone touches a screen. Worth every penny." },
    { by: `tessa.ashford@${DEMO_DOMAIN}`, rating: 5, msg: "Margot got our six-year-old reading properly. Brilliant with school-age kids." },
  ],
  [`lucia.ferreira@${DEMO_DOMAIN}`]: [
    { by: `aisha.cole@${DEMO_DOMAIN}`, rating: 5, msg: "Lucia sorted our sleep routine in a fortnight. I cannot recommend her enough." },
  ],
  [`yolanda.pierce@${DEMO_DOMAIN}`]: [
    { by: `sofia.marchetti@${DEMO_DOMAIN}`, rating: 5, msg: "Yolanda has been part of our neighbourhood for years. Everyone trusts her." },
  ],
  [`amara.osei@${DEMO_DOMAIN}`]: [
    { by: `maya.brennan@${DEMO_DOMAIN}`, rating: 5, msg: "Met Amara through a share that fell through for other reasons — she was lovely throughout." },
    { by: `hannah.lieberman@${DEMO_DOMAIN}`, rating: 5, msg: "Really thoughtful about how two toddlers learn to share space. Impressive." },
  ],
  [`priya.raghunathan@${DEMO_DOMAIN}`]: [
    { by: `rosa.delgado@${DEMO_DOMAIN}`, rating: 5, msg: "A genuinely kind family to work for. Clear expectations and always paid on time." },
  ],
  [`maya.brennan@${DEMO_DOMAIN}`]: [
    { by: `amara.osei@${DEMO_DOMAIN}`, rating: 5, msg: "Warm, organised and easy to talk to. Any caregiver would be lucky to work with Maya." },
  ],
};

/* ──────────────────────────────── the seed ─────────────────────────────── */

const buildUser = async (person) => {
  const {
    name, email, type, gender, age, img, zipCode, location, goal, aboutMe,
    children = [], joined, premium = false, intent, profile,
  } = person;

  const createdAt = daysAgo(joined);

  return {
    name,
    email,
    password: await bcrypt.hash(DEMO_PASSWORD, config.auth.bcryptSaltRounds),
    type,
    gender,
    age,
    imageUrl: img,
    goal,
    aboutMe,
    zipCode,
    location,
    registeredVia: "email",
    noOfChildren: children,
    additionalInfo: [
      { key: "currentSchedule", value: profile.careType || profile.nannyShareType },
      { key: "numberOfChildren", value: String(children.length || profile.numberOfChildren || 0) },
      { key: "shareLocation", value: profile.shareLocation },
      { key: "urgency", value: profile.urgency || profile.startAvailability },
    ],
    services: type === "Nanny" ? profile.responsibilities || [] : [],
    verified: { emailVer: true, phoneVer: true, nationalIDVer: "true" },
    status: "Active",
    premium,
    online: false,
    ActiveAt: daysAgo(Math.min(joined, 2)),
    createdAt,
    lastLogin: daysAgo(1),
    loginCount: 6 + (joined % 11),
    activeDays: 3 + (joined % 7),
    matchRequestsSent: 0,
    nannyProfileCompleted: true,
    shareSetupCompleted: true,
    onboarding: { completed: true, step: 9, ...(intent ? { intent } : {}) },
    notifications: { email: { platformUpdates: true, newsletter: true }, sms: false },
    termsAcceptedAt: createdAt,
    termsAcceptedVersion: 1,
    referralCode: referralCode(),
    referralCodeCreatedAt: createdAt,
    referralCount: 0,
    favourite: [],
    reviews: [],
  };
};

const purge = async () => {
  const doomed = await User.find({ email: DEMO_EMAIL_RE }).select("_id").lean();
  const ids = doomed.map((u) => u._id);
  if (ids.length === 0) return 0;

  await NannyProfile.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  return ids.length;
};

const main = async () => {
  const uri = config.db.uri;

  // The script writes fifteen fictional people and deletes anything already
  // matching the demo domain. Both are fine locally and catastrophic anywhere
  // else, so this is a hard stop rather than a prompt.
  if (!isLocalMongoUri(uri)) {
    throw new Error(
      `Refusing to seed demo data into a non-local database: ${uri}\n` +
        "  Start one with `npm run db:up`."
    );
  }

  await mongoose.connect(uri);
  console.log(`[seed] connected to ${uri}`);

  const removed = await purge();
  if (removed > 0) console.log(`[seed] removed ${removed} existing demo account(s)`);

  if (process.argv.includes("--purge")) {
    await mongoose.disconnect();
    console.log("[seed] purge complete");
    return;
  }

  // Insert the people first so reviews can reference real ids.
  const docs = await Promise.all(PEOPLE.map(buildUser));
  const created = await User.insertMany(docs);
  const byEmail = new Map(created.map((u) => [u.email, u]));
  console.log(`[seed] created ${created.length} users`);

  await NannyProfile.insertMany(
    PEOPLE.map((person) => ({
      ...person.profile,
      userId: byEmail.get(person.email)._id,
      imageFile: person.img,
      createdAt: daysAgo(person.joined),
    }))
  );
  console.log(`[seed] created ${PEOPLE.length} nanny-share profiles`);

  let reviewCount = 0;
  for (const [email, entries] of Object.entries(REVIEWS)) {
    const target = byEmail.get(email);
    if (!target) continue;
    const reviews = entries
      .filter((entry) => byEmail.has(entry.by))
      .map((entry, i) => ({
        userId: byEmail.get(entry.by)._id,
        rating: entry.rating,
        msg: entry.msg,
        createdAt: daysAgo(4 + i * 9),
      }));
    await User.updateOne({ _id: target._id }, { $set: { reviews } });
    reviewCount += reviews.length;
  }
  console.log(`[seed] created ${reviewCount} reviews`);

  // The geo index is what makes the radius filter work at all; building it
  // explicitly means a fresh database doesn't depend on the app having booted.
  await User.syncIndexes();
  console.log("[seed] indexes synced");

  const hero = byEmail.get(HERO_EMAIL);
  console.log(
    [
      "",
      "──────────────────────────────────────────────",
      "  Screenshot login",
      "──────────────────────────────────────────────",
      `  Email:    ${hero.email}`,
      `  Password: ${DEMO_PASSWORD}`,
      `  Name:     ${hero.name} (${hero.type})`,
      `  Location: Grand Lake, Oakland CA 94610`,
      `  User id:  ${hero._id}`,
      "",
      `  Sees ${PEOPLE.length - 1} other members inside the 5-mile default radius.`,
      "  Every other seeded account uses the same password.",
      "──────────────────────────────────────────────",
      "",
    ].join("\n")
  );

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("[seed] failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
