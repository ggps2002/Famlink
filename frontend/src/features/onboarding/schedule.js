/* The weekly schedule the onboarding day picker produces, checked and
 * serialised for saving. Shared by the caregiver completion questionnaires.
 *
 * `daysState` is { Monday: { checked, start, end } … } with dayjs times.
 * Returns { error } to show the member, or { specificDays } — only the ticked
 * days, times as ISO strings — which is what the profile page reads. */
export function validateSchedule(daysState) {
  const selected = Object.entries(daysState || {}).filter(([, d]) => d.checked);
  if (selected.length === 0) {
    return { error: "Atleast select one day and time." };
  }

  const invalid = selected
    .filter(([, { start, end }]) => !start || !end || start.isSame(end) || end.isBefore(start))
    .map(([day]) => day);
  if (invalid.length) {
    return {
      error: `The following selected days have invalid start or end times: ${invalid.join(", ")}`,
    };
  }

  const specificDays = Object.fromEntries(
    selected.map(([day, d]) => [day, { ...d, start: d.start.toISOString(), end: d.end.toISOString() }])
  );
  return { specificDays };
}

export const emptyWeek = () =>
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].reduce((acc, day) => {
    acc[day] = { checked: false, start: null, end: null };
    return acc;
  }, {});
