// ⚠️ This module runs in Node as well as in the browser: it is reachable from
// api/ (Vercel serverless functions) and/or scripts/ (the build step), neither
// of which resolves the "@" aliases — those exist only inside Vite. Import to
// and from this file with relative paths that include the file extension.
// tests/architecture/aliases.test.js fails the build if that stops being true.

// Formatting shared by every surface that renders a nanny share profile card —
// the dashboard cards (Components/subComponents/profileCard.jsx) and the public
// shared-profile card (NewComponents/ShareProfile/SharedProfileCard.jsx).
//
// Kept dependency-free on purpose: the public share page is the first thing a
// stranger loads, and neither of these needs a date library or the store.

/* ── The share schedule: the product has two, and only two ─────────────────
 *
 * A share is full-time or part-time. Nothing else.
 *
 * Getting here took some undoing. Two questionnaires wrote this field and they
 * disagreed: caregivers answered "Full-time", families answered "Full-time
 * care", the share editor lowercased whatever it was handed, and the family
 * form additionally offered "After-school care", "Summer/Seasonal", "Weekend
 * Nanny Share", "Pickup/Drop-off (Carpool style)" and "Other" — five more
 * answers for services that do not exist. So the same schedule appeared under
 * four spellings, a filter chip matched none of them reliably, and two profiles
 * describing identical availability read as different products.
 *
 * SHARE_SCHEDULES is what anyone may now choose. `normalizeShareSchedule` maps
 * everything ever written — including the five retired answers, which are all
 * part-time arrangements — onto one of the two, so records written before this
 * read the same as records written after it. Store the canonical spelling;
 * normalise on the way out. */

/** The only two answers, in the spelling that gets stored and displayed. */
export const SHARE_SCHEDULES = ["Full-time", "Part-time"];

const FULL_TIME = /^full[\s-]*time/i;

/**
 * Any stored careType / nannyShareType → "Full-time", "Part-time", or null.
 *
 * Everything that is not recognisably full-time is part-time: after-school,
 * pickup/drop-off, weekend and seasonal shares are all part-time weeks, and
 * "Other" was never anything else in practice. Null only for a blank answer,
 * so a caller can tell "part-time" from "not stated".
 */
export function normalizeShareSchedule(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return FULL_TIME.test(text) ? "Full-time" : "Part-time";
}

/**
 * The stored value as it should read on a card.
 *
 * Kept as a function rather than the old lookup table: the table only knew the
 * five slugs the family form wrote, so a caregiver's "Full-time" missed every
 * key and fell through to the raw value — which is how one card said
 * "Full-Time" and the next said "full-time care".
 */
export const formatCareTypeLabel = (value) => normalizeShareSchedule(value) ?? "";


// Hosting is stored from the asker's point of view — the questionnaire asked
// "your home" — but every surface that renders it is read by someone else, for
// whom that phrasing points at the wrong house. Normalised in one place because
// the shared card, the Open Graph description and the preview image all show it
// and would otherwise disagree with each other.
export const formatHostingLabel = (hosting) =>
  String(hosting || "").toLowerCase() === "your home" ? "My home" : hosting;

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SHORT_DAYS = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

// "Mon–Fri", or "Mon–Wed, Fri" when the week has a gap. Collapses runs of
// consecutive days rather than listing seven abbreviations.
export const formatScheduleDays = (schedule) => {
  if (!schedule) return "";

  const activeDays = DAY_ORDER.filter((day) => schedule?.[day]?.checked);
  if (!activeDays.length) return "";

  const indexes = activeDays.map((day) => DAY_ORDER.indexOf(day));

  const ranges = [];
  let start = indexes[0];
  let prev = indexes[0];

  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] !== prev + 1) {
      ranges.push([start, prev]);
      start = indexes[i];
    }
    prev = indexes[i];
  }
  ranges.push([start, prev]);

  return ranges
    .map(([s, e]) =>
      s === e
        ? SHORT_DAYS[DAY_ORDER[s]]
        : `${SHORT_DAYS[DAY_ORDER[s]]}–${SHORT_DAYS[DAY_ORDER[e]]}`
    )
    .join(", ");
};

// Children's ages reach the UI in every shape the questionnaires have ever
// written: an array of {label} objects, a bare array of numbers, a JSON string,
// and — from older records — a single-element array holding a JSON string.
// Normalise all of them to "10 months, 3 years".
//
// A fractional year means months (0.83 → "10 months"); anything that already
// spells out its unit is passed through untouched.
export const formatAgeLabels = (ages) => {
  let parsed = ages;

  if (
    Array.isArray(parsed) &&
    parsed.length === 1 &&
    typeof parsed[0] === "string" &&
    parsed[0].startsWith("[")
  ) {
    try {
      parsed = JSON.parse(parsed[0]);
    } catch {
      /* not JSON after all — fall through and treat as a plain label */
    }
  }

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = parsed.split(",");
    }
  }

  if (!Array.isArray(parsed)) return null;

  return parsed
    .map((age) => {
      if (typeof age === "object" && age !== null && age.label) return age.label;

      const clean = String(age).replace(/[[\]"]/g, "").trim();
      const lower = clean.toLowerCase();
      if (
        lower.includes("year") ||
        lower.includes("yr") ||
        lower.includes("month") ||
        lower.includes("mo")
      ) {
        return clean;
      }

      const num = parseFloat(clean);
      if (isNaN(num)) return clean;
      if (num % 1 !== 0) {
        const months = Math.round(num * 12);
        return `${months} month${months > 1 ? "s" : ""}`;
      }
      return `${num} year${num > 1 ? "s" : ""}`;
    })
    .join(", ");
};
