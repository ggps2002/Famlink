// The minimum-rating browse filter.
//
// The thresholds live here rather than in either sidebar so the two dashboards
// offer the same choices and send the same numbers — and so the values stay
// next to the sentence that explains what they do.

export const RATING_FILTER_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
  { value: 4.5, label: "4.5+" },
];

/**
 * What the filter is doing, said plainly under the chips.
 *
 * The second sentence is the one that earns its place: setting a threshold
 * hides members nobody has reviewed yet, which is the behaviour someone asking
 * for "4+" means but not the one they would guess from the label alone. A
 * directory that quietly drops every new member deserves to say so.
 */
export const ratingFilterHint = (minRating) =>
  minRating > 0
    ? `Rated ${minRating.toFixed(1)} and above. Profiles with no reviews yet are hidden.`
    : "Any rating, including profiles not yet reviewed.";

export default RATING_FILTER_OPTIONS;
