import { describe, it, expect, vi } from "vitest";
import { convertAgeRanges, resolveChildrenAges } from "@shared/lib/children";

vi.mock("@shared/ui/toast", () => ({ fireToastMessage: vi.fn() }));
const { fireToastMessage } = await import("@shared/ui/toast");

describe("convertAgeRanges", () => {
  it("spans the lowest min and highest max across the labels chosen", () => {
    expect(convertAgeRanges(["Infant", "Preschool"])).toEqual({ min: 0, max: 5 });
  });

  it("leaves max open for School-age, which has no upper bound", () => {
    expect(convertAgeRanges(["School-age"])).toEqual({ min: 3, max: null });
  });

  it("stays open-ended when an unbounded label joins a bounded one", () => {
    // Regression: the unbounded label used to be skipped, so this returned
    // max: 1 — and the browse filter then excluded every school-age share the
    // member had just asked to see. Adding an option must never narrow the
    // results below what the other options alone would return.
    expect(convertAgeRanges(["Infant", "School-age"])).toEqual({ min: 0, max: null });
  });

  it("widens the max across bounded labels", () => {
    expect(convertAgeRanges(["Infant", "Preschool"])).toEqual({ min: 0, max: 5 });
  });

  it("returns an empty range for no selection", () => {
    expect(convertAgeRanges([])).toEqual({ min: null, max: null });
  });

  it("ignores a label it does not know instead of throwing", () => {
    expect(convertAgeRanges(["Infant", "Newborn"])).toEqual({ min: 0, max: 1 });
  });
});

describe("resolveChildrenAges", () => {
  it("reads consecutive Child<n>_age fields until they run out", () => {
    expect(
      resolveChildrenAges({ Child1_age: "3", Child2_age: "5", Child3_unit: "years" })
    ).toEqual([
      { label: "3 yrs", value: 3, unit: "years" },
      { label: "5 yrs", value: 5, unit: "years" },
    ]);
  });

  it("converts months to a fraction of a year while labelling them as months", () => {
    expect(resolveChildrenAges({ Child1_age: "6", Child1_unit: "months" })).toEqual([
      { label: "6 months", value: 0.5, unit: "months" },
    ]);
  });

  it("rejects the whole set when any age is not a positive number", () => {
    // Returning [] is what trips the caller's length === 0 guard, so a bad age
    // stops the submission rather than sending a child aged 0.
    expect(resolveChildrenAges({ Child1_age: "3", Child2_age: "0" })).toEqual([]);
    expect(fireToastMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" })
    );
  });

  it("returns nothing when there are no children", () => {
    expect(resolveChildrenAges({})).toEqual([]);
  });
});
