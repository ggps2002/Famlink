// A member's star rating, derived from the reviews on their user document.
//
// One function, used everywhere a rating is shown or compared, because the two
// have to agree. Rounding the average for display but comparing the filter
// against the unrounded value puts a 3.95 profile above a "4+ stars" filter and
// then prints "4.0" beside it — or hides a profile the card says is a 4. Both
// read as the rating being wrong rather than as a rounding difference.
export const ratingOf = (reviews) => {
  const list = Array.isArray(reviews) ? reviews : [];
  if (list.length === 0) return { averageRating: 0, totalRatings: 0 };

  const total = list.reduce((sum, review) => sum + (Number(review?.rating) || 0), 0);

  return {
    averageRating: parseFloat((total / list.length).toFixed(1)),
    totalRatings: list.length,
  };
};

export default ratingOf;
