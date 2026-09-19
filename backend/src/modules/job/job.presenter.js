import { toPublicUser } from "../user/user.privacy.js";

/**
 * The response shapes the job screens read.
 *
 * Pure functions over documents, kept out of the service so the privacy rules
 * below sit in one readable place. Two of these endpoints are open to the
 * internet, and what they omit is the point of them — see `toJobCard` and
 * `toOpportunity`.
 */

/**
 * Every job type a post can be. Used to strip the sibling sub-documents off a
 * post before it is returned: a post carries one type's data, but the schema
 * has a field for all seven.
 */
export const JOB_TYPES = [
  "nanny",
  "privateEducator",
  "houseManager",
  "specializedCaregiver",
  "swimInstructor",
  "musicInstructor",
  "sportsCoaches",
];

/** Mean review score to one decimal, or 0 when there is nothing to average. */
export const averageRatingOf = (reviews) => {
  if (!Array.isArray(reviews) || reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return (total / reviews.length).toFixed(1);
};

/** Star histogram, always five rows from 5 down to 1 so the bars render. */
export const reviewCountsByStars = (reviews) => {
  const counts = reviews.reduce((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1;
    return acc;
  }, {});

  return Array.from({ length: 5 }, (_, index) => ({
    stars: 5 - index,
    count: counts[5 - index] || 0,
  }));
};

/** The `{ _id, jobType, user, …, [jobType]: data }` envelope the lists return. */
export const toJobEnvelope = (job, extra = {}) => {
  const { _id, jobType, user, createdAt, updatedAt } = job;
  return { _id, jobType, user, createdAt, updatedAt, [jobType]: job[jobType], ...extra };
};

/**
 * A browse result: the sibling job types dropped, the poster reduced to the
 * public projection, and their rating folded in.
 *
 * The poster is another member here rather than the caller, so it is an area
 * and not an address.
 */
export const toBrowsePost = (post) => {
  const cleaned = post.toObject();

  for (const type of JOB_TYPES) {
    if (type !== post.jobType) delete cleaned[type];
  }

  cleaned.user = {
    ...toPublicUser(cleaned.user),
    averageRating: averageRatingOf(cleaned.user?.reviews),
  };

  return cleaned;
};

/**
 * A card for the unauthenticated /all-jobs feed.
 *
 * Returns null for a post whose type sub-document is missing, which the caller
 * filters out — a card with no rate or schedule is not worth rendering.
 *
 * The surname is reduced to an initial on purpose. A full family name beside a
 * neighborhood, an hourly rate and a childcare schedule, on a route anyone can
 * call, identifies a specific household.
 */
export const toJobCard = (job) => {
  const details = job[job.jobType];
  if (!details) return null;

  const hourlyRate =
    typeof details.hourlyRate === "number"
      ? details.hourlyRate
      : parseFloat(details?.hourlyRate?.min?.toString() || "0");

  const user = toPublicUser(job.user) || {};
  const [firstName = "", lastName = ""] = (user.name || "").split(" ");

  return {
    id: job._id,
    title: job.jobType,
    description: details?.jobDescription || "",
    familyId: user._id || "",
    location: user.location?.format_location || "",
    hourlyRate,
    schedule: details?.preferredSchedule || "",
    requirements: details?.specificRequirements?.otherPreferences || "",
    childrenAges: user.noOfChildren || "",
    isActive: true,
    createdAt: job.createdAt,
    family: {
      firstName,
      lastName: lastName.charAt(0),
      city: user.location?.city || "",
      state: user.location?.state || "",
    },
  };
};

/**
 * A teaser for the unauthenticated /job-seeker-opportunities/:zipCode pages.
 *
 * `posterLabel` is always the constant "Local Family" — the caller builds the
 * map that way deliberately. This route is open to the internet and the title
 * is the only place the poster appears, so it must never name a household or
 * carry an address. It previously read a top-level `format_location` that does
 * not exist on the schema and was therefore undefined every time; the constant
 * makes that deliberate rather than an accident someone later "fixes" into a
 * leak.
 */
export const toOpportunity = (job, posterLabel) => {
  const details = job[job.jobType] || {};

  const jobTypeName = job.jobType
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());

  const min = details.hourlyRate?.min || null;
  const max = details.hourlyRate?.max || null;

  let rate = "Rate not specified";
  if (min && max && min !== max) rate = `$${min}–$${max}/hour`;
  else if (min) rate = `$${min}/hour`;

  return {
    title: `${jobTypeName} – ${posterLabel}`,
    rate,
    type: details.preferredSchedule || null,
    action: "View Details – Sign Up Required",
  };
};
