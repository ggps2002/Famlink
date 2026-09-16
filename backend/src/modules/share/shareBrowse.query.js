// The nanny-share browse filter.
//
// Pure query construction: give it the request's filter values and the id lists
// for the members in range, and it returns the Mongo filter. No database, no
// request, which is what makes each clause below testable on its own — and
// these clauses are the ones most likely to be got subtly wrong, because a
// mistake shows up as "a profile that should have appeared didn't" rather than
// as an error.

/** The four job-type options, and what each one means in the data. */
const JOB_TYPES = {
  "Family ● Looking for a share": { list: "family", match: { hasNanny: false } },
  "Family ● Has a Nanny, Looking for a share": { list: "family", match: { hasNanny: true } },
  "Nanny ● Looking for a share position": { list: "nanny", match: { hasFamily: false } },
  "Nanny ● With a Family, Looking for a share": { list: "nanny", match: { hasFamily: true } },
};

/** The rate slider's ends. Untouched means "no rate filter at all". */
export const RATE_DEFAULTS = { min: 0, max: 50 };

/** The age slider's ends, likewise. */
export const AGE_DEFAULTS = { min: 0, max: 100 };

/**
 * Build the profile filter for a browse request.
 *
 * @param {object} criteria      the values the member chose
 * @param {object} audience      `{ all, family, nanny }` — member ids in range,
 *                               split by role
 */
export const buildShareBrowseFilter = (criteria = {}, audience = {}) => {
  const {
    minRate = RATE_DEFAULTS.min,
    maxRate = RATE_DEFAULTS.max,
    minAge = AGE_DEFAULTS.min,
    maxAge = AGE_DEFAULTS.max,
    jobType = [],
    preferredSchedule = [],
    nannyShareTypes = [],
  } = criteria;

  const clauses = [];
  const { all = [], family = [], nanny = [] } = audience;

  if (all.length > 0) clauses.push({ userId: { $in: all } });

  // ── Schedule ───────────────────────────────────────────────────────────────
  // A share is full-time or part-time; there is nothing else. Families answer
  // `nannyShareType` and caregivers answer `careType`, and the member picks
  // from one control, so both fields are matched.
  //
  // Two controls send here and they mean the same thing: the caregiver
  // dashboard's "Schedule" chips arrive as `preferredSchedule`, the family
  // dashboard's as `nannyShareTypes`. The second was read by nobody, so that
  // filter did nothing at all.
  //
  // Everything that is not recognisably full-time is part-time. That is the
  // same rule `normalizeShareSchedule` applies in
  // frontend/src/shared/lib/scheduleFormat.js, and the two have to agree: the
  // stored answers include four spellings of these two ("Full-time",
  // "Full-time care", "full-time care", "Full Time") plus five retired ones
  // ("After-school care", "Summer/Seasonal", "Weekend Nanny Share",
  // "Pickup/Drop-off (Carpool style)", "Other"), all of which now DISPLAY as
  // part-time. Matching by prefix alone, a card reading "Part-time" would be
  // hidden by the "Part-time" chip — visibly wrong, and in the direction that
  // looks like missing data.
  const FULL_TIME = /^full[\s-]*time/i;

  const chosen = new Set(
    [...preferredSchedule, ...nannyShareTypes]
      .map((type) => String(type ?? "").trim())
      .filter(Boolean)
      .map((type) => (FULL_TIME.test(type) ? "Full-time" : "Part-time")),
  );

  // Both chosen narrows nothing — and, like the rate and age filters below, a
  // filter should narrow by what people said rather than exclude everyone who
  // said nothing.
  if (chosen.size === 1) {
    if (chosen.has("Full-time")) {
      clauses.push({
        $or: [{ careType: FULL_TIME }, { nannyShareType: FULL_TIME }],
      });
    } else {
      clauses.push({
        $and: [
          // Answered something…
          {
            $or: [
              { careType: { $exists: true, $nin: [null, ""] } },
              { nannyShareType: { $exists: true, $nin: [null, ""] } },
            ],
          },
          // …and it was not full-time. An absent field passes $not, which is
          // what lets a profile that only filled in one of the two match.
          { careType: { $not: FULL_TIME } },
          { nannyShareType: { $not: FULL_TIME } },
        ],
      });
    }
  }

  // ── Job type ───────────────────────────────────────────────────────────────
  // Each option is scoped to an id list as well as a boolean. Every profile
  // stores both `hasNanny` and `hasFamily` because the schema requires them, so
  // filtering on the boolean alone would also match the opposite role — a nanny
  // profile with `hasNanny: false` would appear under "Family · Looking for a
  // share". The id list is what keeps the two apart.
  if (jobType.length > 0) {
    const conditions = jobType
      .filter((option) => JOB_TYPES[option])
      .map((option) => {
        const { list, match } = JOB_TYPES[option];
        return { userId: { $in: list === "family" ? family : nanny }, ...match };
      });

    if (conditions.length > 0) clauses.push({ $or: conditions });
  }

  // ── Rate ───────────────────────────────────────────────────────────────────
  // Overlap, not containment: a member browsing $20–40 wants anyone whose range
  // reaches into that band, unlike the caregiver search on /userData.
  if (minRate !== RATE_DEFAULTS.min || maxRate !== RATE_DEFAULTS.max) {
    const floor = Number(minRate) || 0;
    const ceiling = Number(maxRate) || 999999;

    clauses.push({
      $or: [
        // Families state a share budget…
        {
          "hourlyBudget.minShare": { $lte: ceiling },
          "hourlyBudget.maxShare": { $gte: floor },
        },
        // …caregivers state a shared rate.
        {
          "budget.sharedRate.min": { $lte: ceiling },
          "budget.sharedRate.max": { $gte: floor },
        },
        // Someone who stated neither is shown rather than hidden: a filter
        // should narrow by what people said, not exclude everyone silent.
        {
          "hourlyBudget.minShare": { $exists: false },
          "budget.sharedRate.min": { $exists: false },
        },
      ],
    });
  }

  // ── Children's ages ────────────────────────────────────────────────────────
  if (minAge !== AGE_DEFAULTS.min || maxAge !== AGE_DEFAULTS.max) {
    clauses.push({
      $or: [
        { "childrenAges.value": { $gte: minAge, $lte: maxAge } },
        { "preferredAges.min": { $lte: maxAge }, "preferredAges.max": { $gte: minAge } },
        // Same reasoning as the rate filter: no answer is not a "no".
        { childrenAges: { $size: 0 }, preferredAges: { $size: 0 } },
      ],
    });
  }

  return clauses.length > 0 ? { $and: clauses } : {};
};

export default buildShareBrowseFilter;
