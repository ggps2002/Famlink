import { describe, it, expect } from "vitest";
import {
  parseHourlyRate,
  normalizeHourlyBudget,
  formatSharedRate,
  formatSoloRate,
  deparseHourlyRate,
  findMatchingRate1,
} from "@shared/lib/rates";

/**
 * `hourlyBudget` is stored in three different shapes by three generations of
 * questionnaire, and some stored values are malformed ("$20 - $undefined per
 * hour"). These tests pin the reading of all of them, because the failure mode
 * is not a crash — it is a profile quietly advertising the wrong price.
 */

describe("normalizeHourlyBudget", () => {
  it("passes through the current object shape", () => {
    expect(normalizeHourlyBudget({ min: 40, max: 50, minShare: 20, maxShare: 25 })).toEqual({
      min: 40,
      max: 50,
      minShare: 20,
      maxShare: 25,
    });
  });

  it("parses the shape a FormData save stringifies", () => {
    expect(normalizeHourlyBudget('{"minShare":20,"maxShare":25}')).toEqual({
      minShare: 20,
      maxShare: 25,
    });
  });

  it("reads a legacy display string with a share clause", () => {
    // With "each family pays", the leading range is the combined rate.
    expect(
      normalizeHourlyBudget("$40 - $50 per hour (Each family pays $20 - $25)")
    ).toEqual({ min: 40, max: 50, minShare: 20, maxShare: 25 });
  });

  it("treats a bare range as the per-family split, not the combined rate", () => {
    // Without the clause the string was built from per-family numbers. Reading
    // it as combined would halve every price on screen.
    expect(normalizeHourlyBudget("$20 - $25 per hour")).toEqual({
      minShare: 20,
      maxShare: 25,
    });
  });

  it("salvages a floor from the '$undefined' records already in the database", () => {
    expect(normalizeHourlyBudget("$20 - $undefined per hour")).toEqual({ minShare: 20 });
  });

  it("drops values that are not usable numbers", () => {
    // "" and null and NaN have all been stored. None of them is a price.
    expect(normalizeHourlyBudget({ min: "", max: null, minShare: 0, maxShare: "abc" })).toEqual({});
  });

  it("never throws on unreadable input", () => {
    for (const input of [null, undefined, "", "   ", "{not json", []]) {
      expect(normalizeHourlyBudget(input)).toEqual({});
    }
  });
});

describe("formatSharedRate / formatSoloRate", () => {
  it("renders the per-family and solo rates from one budget", () => {
    const budget = { min: 40, max: 50, minShare: 20, maxShare: 25 };
    expect(formatSharedRate(budget)).toBe("~$20 - $25/hr per family");
    expect(formatSoloRate(budget)).toBe("~$40 - $50/hr");
  });

  it("returns null rather than a broken label when there is no rate", () => {
    // The callers render nothing on null. A string here would print "~$NaN".
    expect(formatSharedRate({})).toBeNull();
    expect(formatSoloRate(undefined)).toBeNull();
  });

  it("shows an open-ended rate when only one bound is known", () => {
    expect(formatSharedRate({ minShare: 20 })).toBe("~$20+/hr per family");
  });

  it("orders the bounds low-to-high however they were stored", () => {
    // "$25 - $20/hr" reads as our mistake, not the member's.
    expect(formatSoloRate({ min: 50, max: 40 })).toBe("~$40 - $50/hr");
  });

  it("collapses an equal range to a single figure", () => {
    expect(formatSoloRate({ min: 40, max: 40 })).toBe("~$40/hr");
  });

  it("keeps cents to two digits and whole dollars whole", () => {
    expect(formatSharedRate({ minShare: 7.5, maxShare: 10 })).toBe("~$7.50 - $10/hr per family");
  });
});

describe("deparseHourlyRate", () => {
  it("round-trips a budget back into the label the questionnaires store", () => {
    const label = "$40 - $50 per hour (Each family pays $20 - $25)";
    expect(deparseHourlyRate(normalizeHourlyBudget(label))).toBe(label);
  });

  it("never writes 'undefined' into the label", () => {
    // This is the bug that put "$20 - $undefined per hour" in the database.
    const result = deparseHourlyRate({ min: 20, max: undefined, minShare: 10 });
    expect(result).not.toMatch(/undefined|NaN/);
    expect(result).toBe("$20+ per hour (Each family pays $10+)");
  });

  it("returns an empty string when there is nothing to describe", () => {
    expect(deparseHourlyRate({})).toBe("");
  });
});

describe("parseHourlyRate", () => {
  it("reads an open-ended rate", () => {
    expect(parseHourlyRate("$40+ per hour (Each family pays $20+)")).toEqual({
      min: 40,
      minShare: 20,
    });
  });

  it("reads a bounded rate", () => {
    expect(parseHourlyRate("$10 - $15 per hour (Each family pays $5 - $7.50)")).toEqual({
      min: 10,
      max: 15,
      minShare: 5,
      maxShare: 7.5,
    });
  });
});

describe("findMatchingRate1", () => {
  it("matches a stored range to its option label", () => {
    expect(findMatchingRate1({ min: 20, max: 25 })).toBe("$20 - $25 per hour");
  });

  it("matches the open-ended top option", () => {
    expect(findMatchingRate1({ min: 35 })).toBe("$35+ per hour");
  });

  it("says N/A rather than inventing an option", () => {
    expect(findMatchingRate1({ min: 12, max: 19 })).toBe("N/A");
    expect(findMatchingRate1(null)).toBe("N/A");
    expect(findMatchingRate1({ min: 20 })).toBe("N/A");
  });
});
