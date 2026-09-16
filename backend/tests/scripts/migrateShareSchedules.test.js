import { describe, it, expect } from "vitest";

import {
  normalize,
  rewriteAdditionalInfo,
} from "../../scripts/migrateShareSchedules.mjs";

/**
 * The migration's two rules, tested without a database.
 *
 * Worth pinning because a migration is the one piece of code that gets exactly
 * one chance against production data. Both rules are pure, so the risk is not
 * the Mongo plumbing — it is whether "Summer/Seasonal" lands on the right side
 * and whether a blank answer survives being left blank.
 */

describe("normalize", () => {
  it("folds every spelling of full-time onto one", () => {
    // Four spellings reached the database: the caregiver questionnaire wrote
    // "Full-time", the family one "Full-time care", the share editor lowercased
    // whatever it got, and older rows hold "Full Time".
    for (const stored of [
      "Full-time",
      "Full-time care",
      "full-time care",
      "Full Time",
      "fulltime",
      "  Full-time  ",
    ]) {
      expect(normalize(stored)).toBe("Full-time");
    }
  });

  it("folds the retired types onto part-time", () => {
    // Five types the product does not run, plus the free-text escape hatch.
    // Each describes a partial week, so each is a part-time share.
    for (const stored of [
      "Part-time",
      "Part-time care",
      "part-time care",
      "After-school care",
      "Summer/Seasonal",
      "Weekend Nanny Share",
      "Pickup/Drop-off (Carpool style)",
      "Flexible",
      "Other",
      "Tuesdays and Thursdays only",
    ]) {
      expect(normalize(stored)).toBe("Part-time");
    }
  });

  it("leaves a blank answer blank", () => {
    // "Not stated" is not "part-time". A migration that invents an answer the
    // member never gave is worse than one that leaves the field empty, and it
    // cannot be undone by looking at the data afterwards.
    for (const blank of ["", "   ", null, undefined, 42, {}]) {
      expect(normalize(blank)).toBeNull();
    }
  });
});

describe("rewriteAdditionalInfo", () => {
  it("rewrites the three schedule keys and nothing else", () => {
    const before = [
      { key: "nannyShareType", value: "Summer/Seasonal" },
      { key: "careType", value: "full-time care" },
      { key: "currentSchedule", value: "Part-time care" },
      { key: "hosting", value: "Full-time care" },
    ];

    expect(rewriteAdditionalInfo(before)).toEqual([
      { key: "nannyShareType", value: "Part-time" },
      { key: "careType", value: "Full-time" },
      { key: "currentSchedule", value: "Part-time" },
      // Not a schedule key: a hosting answer that happens to read like one is
      // still a hosting answer.
      { key: "hosting", value: "Full-time care" },
    ]);
  });

  it("reaches inside the sheet-imported rows", () => {
    // Sheet-imported caregivers carry a single JSON-stringified array instead
    // of plain objects. It goes back as a string, in the same shape it arrived
    // in — re-shaping it would be a second migration hiding inside this one.
    const before = [
      JSON.stringify([
        { key: "currentSchedule", value: "After-school care" },
        { key: "forWho", value: "My child" },
      ]),
    ];

    const after = rewriteAdditionalInfo(before);

    expect(after).toHaveLength(1);
    expect(typeof after[0]).toBe("string");
    expect(JSON.parse(after[0])).toEqual([
      { key: "currentSchedule", value: "Part-time" },
      { key: "forWho", value: "My child" },
    ]);
  });

  it("returns null when there is nothing to change, so the row is not written", () => {
    // Idempotence, and the reason a re-run is safe: a document already holding
    // a canonical value produces no write at all.
    expect(
      rewriteAdditionalInfo([
        { key: "careType", value: "Full-time" },
        { key: "nannyShareType", value: "Part-time" },
      ]),
    ).toBeNull();

    expect(rewriteAdditionalInfo([])).toBeNull();
    expect(rewriteAdditionalInfo(null)).toBeNull();
  });

  it("leaves entries it cannot read alone", () => {
    // additionalInfo is Mixed, so it holds whatever anything ever put there:
    // objects with no key, values that are objects rather than strings, and
    // strings that are not JSON. None of them is a reason to fail a migration
    // or to drop a member's data.
    const junk = [
      "not json at all",
      JSON.stringify({ key: "careType", value: "Full-time care" }), // object, not array
      { key: "careType", value: { option: ["Full-time care"] } },
      { noKey: true },
      null,
    ];

    expect(rewriteAdditionalInfo(junk)).toBeNull();
  });

  it("rewrites a mixed array without disturbing its untouched neighbours", () => {
    const before = [
      { key: "language", value: { option: ["English"] } },
      JSON.stringify([{ key: "forWho", value: "My child" }]),
      { key: "careType", value: "Weekend Nanny Share" },
    ];

    const after = rewriteAdditionalInfo(before);

    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toEqual({ key: "careType", value: "Part-time" });
  });
});
