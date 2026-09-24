/* Children's ages as the caregiver form holds them (Child1_age / Child1_unit …),
 * read for the live card preview on the edit page.
 *
 * resolveChildrenAges() in @shared/lib/children does the same job for SAVING,
 * and reports a bad age with a toast. The preview re-renders on every
 * keystroke, so it uses this quiet version: a half-typed age is normal here,
 * not a mistake to report. */
export function childAgesFromCaregiverForm(values) {
  const ages = [];
  if (!values) return ages;
  for (let i = 1; values[`Child${i}_age`] !== undefined; i++) {
    const age = values[`Child${i}_age`];
    const unit = values[`Child${i}_unit`] || "years";
    const num = parseFloat(age);
    if (!Number.isFinite(num) || num <= 0) continue;
    ages.push({
      label: `${age} ${unit === "months" ? "months" : "yrs"}`,
      value: unit === "months" ? num / 12 : num,
      unit,
    });
  }
  return ages;
}
