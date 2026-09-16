import { fireToastMessage } from "@shared/ui/toast";

/** Children's ages, as the questionnaires collect them and the cards show them. */

/**
 * The age labels the browse filter offers, as a numeric range.
 *
 * `max: null` on the way out means "no upper bound", and callers must send no
 * maxAge at all in that case — see the note on School-age below.
 */
const AGE_LABELS = {
  "Infant": { min: 0, max: 1 },
  "Toddler": { min: 1, max: 3 },
  "Preschool": { min: 3, max: 5 },
  "School-age": { min: 3, max: null },
};

export function convertAgeRanges(ageRanges) {
  let min = Infinity;
  let max = null;
  // School-age has no upper bound, and an unbounded label has to win over the
  // bounded ones rather than be skipped. Skipping it is what made ticking
  // "Infant" and "School-age" together send maxAge: 1 — the widest selection
  // produced the narrowest filter, and every school-age share the member had
  // just asked for was excluded by the option they added to see it.
  let unbounded = false;

  ageRanges.forEach((age) => {
    const bounds = AGE_LABELS[age];
    if (!bounds) return; // an unknown label used to throw here

    min = Math.min(bounds.min, min);

    if (bounds.max === null) unbounded = true;
    else max = max === null ? bounds.max : Math.max(bounds.max, max);
  });

  return {
    min: min === Infinity ? null : min,
    max: unbounded ? null : max,
  };
}

export function resolveChildrenAges(formValues) {
  const ages = [];

  let i = 1;
  while (formValues[`Child${i}_age`] !== undefined) {
    const age = formValues[`Child${i}_age`];
    const unit = formValues[`Child${i}_unit`] || "years";

    const num = parseFloat(age);

    if (isNaN(num) || num <= 0) {
      fireToastMessage({
        type: "error",
        message: "Each child's age must be greater than 0",
      });
      return [];  // return empty to trigger the length === 0 guard below
    }

    const value = unit === "months" ? num / 12 : num;
    const label = `${age} ${unit === "months" ? "months" : "yrs"}`;

    ages.push({ label, value, unit });
    i++;
  }

  return ages;
}
