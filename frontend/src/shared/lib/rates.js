/* ── Hourly budget: one place that understands every shape it's stored in ──
 *
 * `hourlyBudget` reaches the UI as three different things, because three
 * different questionnaires have written it over time:
 *
 *   { min, max, minShare, maxShare }   the current shape
 *   '{"minShare":20,...}'              the same, stringified by a FormData save
 *   "$20 - $25 per hour (Each ...)"    a display string written straight to the DB
 *
 * That last one is why profiles show "$20 - $undefined per hour": an edit form
 * built the label from a budget that had no maxShare, and the raw label went to
 * the server. Records like that already exist, so reading has to cope with them
 * rather than assume they're gone.
 *
 * Every card and detail row goes through these, so a malformed value is
 * repaired once instead of leaking into each screen's own ternary. */

export function parseHourlyRate(str) {
  const result = {};

  // Check for "$40+ per hour"
  const ratePlusMatch = str.match(/\$(\d+(?:\.\d+)?)\+/);
  if (ratePlusMatch) {
    result.min = parseFloat(ratePlusMatch[1]);
  } else {
    const rateRangeMatch = str.match(
      /\$(\d+(?:\.\d+)?)\s*-\s*\$(\d+(?:\.\d+)?)/
    );
    if (rateRangeMatch) {
      result.min = parseFloat(rateRangeMatch[1]);
      result.max = parseFloat(rateRangeMatch[2]);
    }
  }

  // Check for share range or share plus
  const shareRangeMatch = str.match(
    /\(each family pays \$([\d.]+)\s*-\s*\$([\d.]+)\)/i
  );
  if (shareRangeMatch) {
    result.minShare = parseFloat(shareRangeMatch[1]);
    result.maxShare = parseFloat(shareRangeMatch[2]);
  } else {
    const sharePlusMatch = str.match(
      /\(each family pays \$(\d+(?:\.\d+)?)\+\)/i
    );
    if (sharePlusMatch) {
      result.minShare = parseFloat(sharePlusMatch[1]);
    }
  }

  return result;
}

// A usable positive number, or undefined. Rejects "", null, NaN and the string
// "undefined" — all of which have shown up in stored budgets.
const rateNumber = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const pickRateFields = (obj) => {
  const out = {};
  for (const key of ["min", "max", "minShare", "maxShare"]) {
    const n = rateNumber(obj?.[key]);
    if (n !== undefined) out[key] = n;
  }
  return out;
};

// Read a legacy display string back into numbers.
const parseLegacyRateString = (str) => {
  const out = pickRateFields(parseHourlyRate(str));

  // "(Each family pays …)" is what distinguishes the two writers. With the
  // clause, the leading range is the combined rate and the clause is the split.
  // Without it, the string was built from the per-family numbers, so the
  // leading range IS the split — which is also how the cards have always shown
  // these strings.
  const hasShareClause = /each family pays/i.test(str);
  if (!hasShareClause && out.minShare === undefined && out.maxShare === undefined) {
    if (out.min !== undefined) out.minShare = out.min;
    if (out.max !== undefined) out.maxShare = out.max;
    delete out.min;
    delete out.max;
  }

  // "$20 - $undefined per hour" matches neither range pattern, but it still
  // tells us the floor. Recover that rather than showing nothing — a share
  // advertised at "$20+" is true and useful; "$undefined" is neither.
  if (out.min === undefined && out.minShare === undefined) {
    const firstAmount = str.match(/\$\s*(\d+(?:\.\d+)?)/);
    const salvaged = rateNumber(firstAmount?.[1]);
    if (salvaged !== undefined) {
      if (hasShareClause) out.min = salvaged;
      else out.minShare = salvaged;
    }
  }

  return out;
};

// Any stored hourlyBudget → { min, max, minShare, maxShare }, holding only
// fields that are real numbers. Never throws; unreadable input yields {}.
export function normalizeHourlyBudget(value) {
  if (!value) return {};

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return pickRateFields(JSON.parse(trimmed));
      } catch {
        return parseLegacyRateString(trimmed);
      }
    }
    return parseLegacyRateString(trimmed);
  }

  return pickRateFields(value);
}

// Whole dollars stay whole, cents keep both digits: $12.5 reads as a typo.
const money = (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(2));

// Bounds are always rendered low-to-high. Some stored budgets have them the
// other way round, and "$25 - $20/hr" reads as a mistake on our part.
const rateRange = (low, high, suffix) => {
  if (low === undefined && high === undefined) return null;
  if (low !== undefined && high !== undefined) {
    const [a, b] = low <= high ? [low, high] : [high, low];
    return a === b ? `~$${money(a)}${suffix}` : `~$${money(a)} - $${money(b)}${suffix}`;
  }
  return `~$${money(low ?? high)}+${suffix}`;
};

// What each family pays in the share, e.g. "~$20 - $25/hr per family".
// Returns null when the profile has no usable share rate.
export function formatSharedRate(hourlyBudget) {
  const { minShare, maxShare } = normalizeHourlyBudget(hourlyBudget);
  return rateRange(minShare, maxShare, "/hr per family");
}

// What one family would pay on its own, e.g. "~$40 - $50/hr".
export function formatSoloRate(hourlyBudget) {
  const { min, max } = normalizeHourlyBudget(hourlyBudget);
  return rateRange(min, max, "/hr");
}

/* ── Caregiver rate answers ────────────────────────────────────────────────
 *
 * `sharedRate` and `soloRate` are stored as the questionnaire option's own
 * value — "25-30", "45-50+", sometimes a bare "30" — not as numbers, so every
 * screen that shows one has to read that shape back.
 *
 * The two are NOT two ways of saying the same thing, and the profile page used
 * to print them as if they were:
 *
 *   sharedRate  the caregiver's COMBINED rate for both families in the share
 *   soloRate    the caregiver's rate for a single family, with no share
 *
 * So a share looked more expensive than going solo. What a family actually pays
 * in the share is half the combined rate — `formatEachFamilyRate` below — which
 * is the number to put in front of someone deciding between the two. */

/** "25-30" → `{ low: 25, high: 30, open: false }`. Null when there is no number. */
export function parseRateRange(value) {
  const str = String(value ?? "").trim();
  if (!str) return null;

  const amounts = str.match(/\d+(?:\.\d+)?/g);
  if (!amounts) return null;

  const [low, high = low] = amounts.map(Number);
  if (!Number.isFinite(low)) return null;

  // "45-50+" is an open top end, not a $50 ceiling.
  return { low, high: Number.isFinite(high) ? high : low, open: str.includes("+") };
}

const formatRange = ({ low, high, open }, suffix) => {
  if (low === high) return `$${money(low)}${open ? "+" : ""}${suffix}`;
  return `$${money(low)} - $${money(high)}${open ? "+" : ""}${suffix}`;
};

/** A stored rate answer as it should read on screen, or null if unanswered. */
export function formatStoredRate(value, suffix = "/hr") {
  const range = parseRateRange(value);
  return range ? formatRange(range, suffix) : null;
}

/**
 * One family's half of a caregiver's combined share rate.
 *
 * Halved rather than shown whole because the combined figure answers a question
 * nobody asked: a family comparing a share against hiring alone needs their own
 * side of the split, and that is always the smaller of the two numbers.
 */
export function formatEachFamilyRate(sharedRate, suffix = "/hr per family") {
  const range = parseRateRange(sharedRate);
  if (!range) return null;
  return formatRange({ low: range.low / 2, high: range.high / 2, open: range.open }, suffix);
}

/**
 * What each rate means, in one place.
 *
 * The same words follow a rate wherever it appears — browse card, profile page,
 * public share link — because the difference between them is the whole reason
 * someone is reading the number.
 */
export const RATE_HINTS = {
  eachFamily:
    "What one family pays per hour in the share — half of the caregiver's combined rate for two families.",
  solo: "What one family would pay for this caregiver on their own, with no share.",
  shareTotal:
    "The caregiver's full hourly rate for the share, before it is split between the two families.",
  perChild: "The caregiver's hourly rate for this many children in one family's care.",
  familyBudget:
    "What this family expects to pay per hour as their share of the cost. In a share the caregiver's rate is split between both families.",
};

// The inverse: numbers → the labelled option the questionnaires store and the
// edit forms preselect. Guards every branch on a real number, because the
// unguarded version is what wrote "$20 - $undefined per hour" in the first
// place.
export function deparseHourlyRate(rateObj) {
  const { min, max, minShare, maxShare } = normalizeHourlyBudget(rateObj);

  let result = "";

  if (min !== undefined && max !== undefined) {
    result = `$${money(min)} - $${money(max)} per hour`;
  } else if (min !== undefined) {
    result = `$${money(min)}+ per hour`;
  } else if (max !== undefined) {
    result = `$${money(max)}+ per hour`;
  }

  if (minShare !== undefined && maxShare !== undefined) {
    result += `${result ? " " : ""}(Each family pays $${money(minShare)} - $${money(maxShare)})`;
  } else if (minShare !== undefined || maxShare !== undefined) {
    result += `${result ? " " : ""}(Each family pays $${money(minShare ?? maxShare)}+)`;
  }

  return result;
}

// Numbers → the plain hourly label a solo-rate questionnaire stores.
//
// The option list is spelled out here rather than imported from the nanny-share
// questionnaire's `hourlyData`, which holds the same six labels. Reaching into
// a feature from shared/ would invert the dependency — shared code would stop
// being importable on its own — and the labels are a wire format either way:
// they are matched against values already written to the database, so they
// cannot drift with the questionnaire's copy without breaking stored records.
export function findMatchingRate1(hourlyRate) {
  if (!hourlyRate || !hourlyRate.min) return "N/A";
  const options = [
    { name: "$10 - $15 per hour" },
    { name: "$15 - $20 per hour" },
    { name: "$20 - $25 per hour" },
    { name: "$25 - $30 per hour" },
    { name: "$30 - $35 per hour" },
    { name: "$35+ per hour" },
  ];
  const min = hourlyRate.min;
  const max = hourlyRate.max;

  if (!max) {
    if (min >= 35) return "$35+ per hour";
    return "N/A";
  }

  const format = (num) => `$${Number(num).toFixed(0)}`;
  const label = `${format(min)} - ${format(max)} per hour`;

  const match = options.find((item) => item.name === label);
  return match?.name || "N/A";
}
