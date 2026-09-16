import { describe, it, expect } from "vitest";
import { buildShareBrowseFilter } from "#src/modules/share/shareBrowse.query.js";

const audience = { all: ["a", "b", "c"], family: ["a"], nanny: ["b", "c"] };

// Pull the clause that mentions a given key, so each assertion names the one
// filter it is about rather than the whole $and.
const clauseWith = (filter, predicate) => (filter.$and || []).find(predicate);

describe("no filters", () => {
  it("still scopes to the members in range", () => {
    expect(buildShareBrowseFilter({}, audience)).toEqual({
      $and: [{ userId: { $in: ["a", "b", "c"] } }],
    });
  });

  it("returns an empty filter when nobody is in range", () => {
    // Not `{ userId: { $in: [] } }` — that is a filter matching nothing, and
    // the browse would return an empty page for reasons the caller cannot see.
    expect(buildShareBrowseFilter({}, { all: [] })).toEqual({});
  });

  it("adds nothing when the sliders are at their defaults", () => {
    const filter = buildShareBrowseFilter(
      { minRate: 0, maxRate: 50, minAge: 0, maxAge: 100 },
      audience
    );

    expect(filter.$and).toHaveLength(1);
  });
});

describe("schedule filter", () => {
  // A share is full-time or part-time. The clause is asserted through a tiny
  // matcher rather than by shape, because what matters is which stored answers
  // it lets through — and those answers are a mess of four spellings plus five
  // retired types, all of which the UI now displays as one of the two.
  const scheduleClause = (criteria) => {
    const filter = buildShareBrowseFilter(criteria, audience);
    return (filter.$and || []).find((c) => JSON.stringify(c).includes("careType"));
  };

  /** Does `clause` admit a profile whose stored careType is `value`? */
  const admits = (clause, value) => {
    const isFullTime = /^full[\s-]*time/i.test(value);
    if (clause.$or) return isFullTime; // the Full-time branch
    // The Part-time branch: answered something, and it was not full-time.
    return Boolean(value) && !isFullTime;
  };

  it("matches both questionnaires' fields", () => {
    // Families answer nannyShareType, caregivers answer careType, and the
    // member picks from one control.
    const clause = scheduleClause({ preferredSchedule: ["Full-time"] });

    expect(clause.$or.map((c) => Object.keys(c)[0])).toEqual(["careType", "nannyShareType"]);
  });

  it("matches every spelling the questionnaires store", () => {
    // The chip says "Full-time". The caregiver questionnaire stores exactly
    // that, the family one appends " care", and the share edit form lowercases
    // the whole thing — an equality test against a lowercased chip matched none
    // of them, so choosing a schedule emptied the browse list.
    const clause = scheduleClause({ preferredSchedule: ["Full-time"] });

    for (const stored of ["Full-time", "Full-time care", "full-time care", "Full Time"]) {
      expect(admits(clause, stored)).toBe(true);
    }
    expect(admits(clause, "Part-time care")).toBe(false);
  });

  it("counts every retired type as part-time, the way the profile displays it", () => {
    // These five were removed from the questionnaires but are still stored on
    // profiles written before that, and every one of them is a part-time week.
    // The UI normalises them to "Part-time"; if the filter did not agree, a
    // card reading "Part-time" would vanish under the "Part-time" chip.
    const clause = scheduleClause({ preferredSchedule: ["Part-time"] });

    for (const retired of [
      "After-school care",
      "Summer/Seasonal",
      "Weekend Nanny Share",
      "Pickup/Drop-off (Carpool style)",
      "Other",
    ]) {
      expect(admits(clause, retired)).toBe(true);
    }
    expect(admits(clause, "Full-time care")).toBe(false);
  });

  it("narrows nothing when both are chosen", () => {
    // Same principle as the rate and age filters: a filter narrows by what
    // people said, it does not exclude everyone who said nothing.
    expect(scheduleClause({ preferredSchedule: ["Full-time", "Part-time"] })).toBeUndefined();
  });

  it("is skipped entirely when nothing was chosen", () => {
    expect(scheduleClause({ preferredSchedule: ["", "  "] })).toBeUndefined();
  });

  it("reads the family dashboard's control as well as the caregiver one", () => {
    // "Schedule" on one dashboard and "Nanny Share Type" on the other pick the
    // same thing from the same two fields, but only the first was ever read —
    // the family-side chips went to the server and were dropped on the floor.
    const clause = scheduleClause({ nannyShareTypes: ["Part-time care"] });

    expect(admits(clause, "Part-time care")).toBe(true);
    expect(admits(clause, "Full-time care")).toBe(false);
  });
});

describe("job type filter", () => {
  it("scopes each option to the right role's id list", () => {
    // Every profile stores both hasNanny and hasFamily because the schema
    // requires them, so the boolean alone also matches the opposite role — a
    // nanny profile with hasNanny:false would show under "Family · Looking".
    const filter = buildShareBrowseFilter(
      { jobType: ["Family ● Looking for a share"] },
      audience
    );
    const clause = clauseWith(filter, (c) => c.$or?.[0]?.hasNanny !== undefined);

    expect(clause.$or).toEqual([{ userId: { $in: ["a"] }, hasNanny: false }]);
  });

  it("maps every one of the four options to a distinct condition", () => {
    const filter = buildShareBrowseFilter(
      {
        jobType: [
          "Family ● Looking for a share",
          "Family ● Has a Nanny, Looking for a share",
          "Nanny ● Looking for a share position",
          "Nanny ● With a Family, Looking for a share",
        ],
      },
      audience
    );
    const clause = clauseWith(filter, (c) => c.$or?.length === 4);

    expect(clause.$or).toEqual([
      { userId: { $in: ["a"] }, hasNanny: false },
      { userId: { $in: ["a"] }, hasNanny: true },
      { userId: { $in: ["b", "c"] }, hasFamily: false },
      { userId: { $in: ["b", "c"] }, hasFamily: true },
    ]);
  });

  it("ignores an option it does not recognise", () => {
    // A stale client sending an old label must not silently widen the search.
    const filter = buildShareBrowseFilter({ jobType: ["Something ● Else"] }, audience);

    expect(filter.$and).toHaveLength(1);
  });
});

describe("rate filter", () => {
  it("is skipped entirely while the slider is untouched", () => {
    expect(buildShareBrowseFilter({ minRate: 0, maxRate: 50 }, audience).$and).toHaveLength(1);
  });

  it("matches on overlap, so a partly-overlapping range still appears", () => {
    const filter = buildShareBrowseFilter({ minRate: 20, maxRate: 40 }, audience);
    const clause = clauseWith(filter, (c) => c.$or?.[0]?.["hourlyBudget.minShare"]);

    expect(clause.$or[0]).toEqual({
      "hourlyBudget.minShare": { $lte: 40 },
      "hourlyBudget.maxShare": { $gte: 20 },
    });
  });

  it("keeps profiles that stated no rate at all", () => {
    // A filter should narrow by what people said, not exclude everyone silent.
    const filter = buildShareBrowseFilter({ minRate: 20, maxRate: 40 }, audience);
    const clause = clauseWith(filter, (c) => c.$or?.[0]?.["hourlyBudget.minShare"]);

    expect(clause.$or[2]).toEqual({
      "hourlyBudget.minShare": { $exists: false },
      "budget.sharedRate.min": { $exists: false },
    });
  });

  it("treats a zero ceiling as no ceiling rather than as zero", () => {
    // Number(0) is falsy, so the fallback applies — matching the pre-refactor
    // behaviour, where a max of 0 could not mean "nobody".
    const filter = buildShareBrowseFilter({ minRate: 20, maxRate: 0 }, audience);
    const clause = clauseWith(filter, (c) => c.$or?.[0]?.["hourlyBudget.minShare"]);

    expect(clause.$or[0]["hourlyBudget.minShare"]).toEqual({ $lte: 999999 });
  });
});

describe("age filter", () => {
  it("is skipped while the slider is untouched", () => {
    expect(buildShareBrowseFilter({ minAge: 0, maxAge: 100 }, audience).$and).toHaveLength(1);
  });

  it("matches children's ages or a caregiver's preferred range", () => {
    const filter = buildShareBrowseFilter({ minAge: 2, maxAge: 6 }, audience);
    const clause = clauseWith(filter, (c) => c.$or?.[0]?.["childrenAges.value"]);

    expect(clause.$or[0]).toEqual({ "childrenAges.value": { $gte: 2, $lte: 6 } });
    expect(clause.$or[1]).toEqual({
      "preferredAges.min": { $lte: 6 },
      "preferredAges.max": { $gte: 2 },
    });
  });

  it("keeps profiles with no age data", () => {
    const filter = buildShareBrowseFilter({ minAge: 2, maxAge: 6 }, audience);
    const clause = clauseWith(filter, (c) => c.$or?.[0]?.["childrenAges.value"]);

    expect(clause.$or[2]).toEqual({ childrenAges: { $size: 0 }, preferredAges: { $size: 0 } });
  });
});

describe("combining filters", () => {
  it("ands them, so each must be satisfied", () => {
    const filter = buildShareBrowseFilter(
      {
        preferredSchedule: ["Full-time"],
        jobType: ["Family ● Looking for a share"],
        minRate: 20,
        maxRate: 40,
        minAge: 2,
        maxAge: 6,
      },
      audience
    );

    expect(filter.$and).toHaveLength(5);
  });
});
