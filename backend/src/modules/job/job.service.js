import _ from "lodash";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import { PUBLIC_USER_SELECT, USER_IDENTITY_SELECT, toPublicUser } from "../user/user.privacy.js";
import {
  JOB_TYPES,
  averageRatingOf,
  reviewCountsByStars,
  toBrowsePost,
  toJobCard,
  toJobEnvelope,
  toOpportunity,
} from "./job.presenter.js";

/**
 * Job posts: creating them, and the six ways they are read back — the
 * caregiver browse, a poster's own list, the admin table, the public feed, the
 * public zip-code teasers, and a single post's detail page.
 *
 * Migrated from Routes/postJob.js. Behaviour is preserved rather than
 * corrected; the two places where that preserves something questionable are
 * marked, because fixing them changes what callers see and belongs in its own
 * commit.
 */

const MILES_TO_KM = 1.60934;
const EARTH_RADIUS_KM = 6378.1;

/** The member types allowed to post a job. */
const POSTER_TYPES = ["Parents", "Admin"];

/** Fields the owner-facing and admin lists populate for the poster. */
const POSTER_SELECT = "email name imageUrl noOfChildren location";

export class JobService {
  constructor({ jobRepository, userRepository, bookingRepository }) {
    this.jobs = jobRepository;
    this.users = userRepository;
    this.bookings = bookingRepository;
  }

  /**
   * Create a post.
   *
   * The body arrives as `{ jobType, [jobType]: { …fields } }` and only the
   * named type's sub-document is stored, so a request cannot populate a type
   * it did not declare.
   */
  async create(userId, body) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (!POSTER_TYPES.includes(user.type)) {
      throw new ForbiddenError("Access denied. Unauthorized user.");
    }

    const { jobType, ...jobData } = body;
    if (!jobType) throw new ValidationError("Missing required field: jobType");

    const specificJobData = jobData[jobType];
    if (!specificJobData) {
      throw new ValidationError(`Missing job data for type: ${jobType}`);
    }

    return this.jobs.create({ jobType, user: userId, [jobType]: specificJobData });
  }

  /** Delete a post the caller owns. */
  async remove(userId, jobId) {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundError("Job not found");

    if (job.user.toString() !== userId) {
      throw new ForbiddenError("Unauthorized. You can only delete your own jobs.");
    }

    await this.jobs.deleteById(jobId);
  }

  /**
   * Patch the type-specific sub-document of a post the caller owns.
   *
   * `_.merge` is a deep merge, so a partial body updates nested fields without
   * clearing their siblings — which is what the edit screens send.
   */
  async update(userId, jobId, updates) {
    const post = await this.jobs.findById(jobId, {
      populate: {
        path: "user",
        select: "email name imageUrl noOfChildren location age gender reviews",
      },
    });
    if (!post) throw new NotFoundError("Post not found");

    if (post.user._id.toString() !== userId) {
      throw new ForbiddenError("You are not authorized to update this post");
    }

    const { jobType } = post;
    if (updates) _.merge(post[jobType], updates);
    await post.save();

    const { _id, user, createdAt, updatedAt } = post;
    return {
      _id,
      jobType,
      user: { ...user.toObject(), averageRating: averageRatingOf(user.reviews) },
      createdAt,
      updatedAt,
      [jobType]: post[jobType],
    };
  }

  /**
   * The caregiver-facing browse.
   *
   * NOTE: `totalRecords` counts the query before the children filter below
   * runs, and the page is sliced by the database before that filter too. So a
   * page can come back shorter than `limit` and the total can exceed what is
   * reachable. Both are the original behaviour and the job screens are built
   * around them.
   */
  async browse(userId, query) {
    const {
      jobType,
      minChildren = 0,
      maxChildren = 5,
      minAge = 0,
      maxAge = 18,
      minRate = 0,
      maxRate = 100,
      preferredSchedule,
      page = 1,
      location,
      limit = 10,
    } = query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const currentUser = await this.users.findById(userId, {
      select: "location zipCode type",
    });
    if (!currentUser) throw new NotFoundError("User not found.");

    // Parents post jobs; they do not browse them.
    if (currentUser.type === "Parents") {
      throw new ForbiddenError("You are not authorized to view job posts.");
    }

    const nearbyUserIds = await this.#nearbyPosterIds(currentUser, location);
    if (!nearbyUserIds.length) throw new NotFoundError("No nearby users found.");

    const filter = this.#browseFilter({
      nearbyUserIds,
      jobType,
      minRate,
      maxRate,
      preferredSchedule,
    });

    const [posts, totalRecords] = await Promise.all([
      this.jobs.find(filter, {
        populate: { path: "user", select: PUBLIC_USER_SELECT },
        sort: { createdAt: -1 },
        skip,
        limit: limitNumber,
      }),
      this.jobs.count(filter),
    ]);

    const data = posts
      .filter((post) => this.#matchesHousehold(post.user, { minChildren, maxChildren, minAge, maxAge }))
      .map(toBrowsePost);

    return {
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber,
      },
      data,
    };
  }

  /** Public teasers for everyone posting in one zip code. */
  async opportunitiesByZip(zipCode) {
    // Ids only: the label below is a constant, so nothing about the poster
    // reaches this response.
    const users = await this.users.find({ zipCode }, { select: "_id" });
    const userIds = users.map((user) => user._id.toString());

    const jobs = await this.jobs.find({ user: { $in: userIds } });
    return jobs.map((job) => toOpportunity(job, "Local Family"));
  }

  /** A poster's own jobs. 404 when they have none — the original contract. */
  async listForUser(userId) {
    const jobs = await this.jobs.find(
      { user: userId },
      { populate: { path: "user", select: POSTER_SELECT }, sort: { createdAt: -1 } }
    );

    if (!jobs.length) throw new NotFoundError("No jobs found for this user");

    return jobs.map((job) => toJobEnvelope(job));
  }

  /** Total posts, for the admin dashboard tile. */
  async count(userId) {
    await this.#assertAdmin(userId, "Access denied.");
    return this.jobs.count();
  }

  /** The unauthenticated feed. Cards only, through the public projection. */
  async listAllPublic() {
    const jobs = await this.jobs.find(
      {},
      {
        populate: { path: "user", select: PUBLIC_USER_SELECT },
        sort: { createdAt: -1 },
        lean: true,
      }
    );

    return jobs.map(toJobCard).filter(Boolean);
  }

  /** The admin table: every job, each with its booking if one exists. */
  async adminList(userId, { page = 1, limit = 10 }) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    if (user.type !== "Admin") {
      throw new ForbiddenError("Access denied. Only Admins can view all jobs.");
    }

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const [jobs, totalJobs] = await Promise.all([
      this.jobs.find(
        {},
        {
          populate: { path: "user", select: POSTER_SELECT },
          sort: { createdAt: -1 },
          skip,
          limit: limitNumber,
          lean: true,
        }
      ),
      this.jobs.count({}),
    ]);

    const bookings = await this.bookings.find(
      { jobId: { $in: jobs.map((job) => job._id) } },
      { populate: { path: "requestBy", select: "name email" }, lean: true }
    );

    // One booking per job. Where a job has several, the last one wins — as it
    // did before, since this is a plain object keyed by job id.
    const byJob = new Map(bookings.map((booking) => [booking.jobId.toString(), booking]));

    const data = jobs.map((job) => {
      const booking = byJob.get(job._id.toString()) || null;
      return toJobEnvelope(job, {
        booking: booking
          ? {
              status: booking.status,
              isPaid: booking.isPaid,
              startAt: booking.startAt,
              totalPayment: booking.totalPayment,
              requestBy: booking.requestBy,
              completedAt: booking.completedAt,
              rejectedAt: booking.rejectedAt,
            }
          : null,
      });
    });

    return {
      data,
      pagination: {
        total: totalJobs,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalJobs / limitNumber),
      },
    };
  }

  /** One post, with the poster's reviews resolved to names and avatars. */
  async detail(jobId) {
    const job = await this.jobs.findById(jobId, {
      populate: { path: "user", select: PUBLIC_USER_SELECT },
    });
    if (!job) throw new NotFoundError("Job not found");

    const hired = await this.bookings.findOne({ jobId, status: "completed" });
    const userObj = toPublicUser(job.user);
    const reviews = await this.#enrichReviews(userObj.reviews);

    const { _id, jobType, createdAt, updatedAt } = job;
    return {
      _id,
      jobType,
      hired: Boolean(hired),
      user: {
        ...userObj,
        averageRating: averageRatingOf(reviews),
        reviews,
        reviewCountsByStars: reviewCountsByStars(reviews),
      },
      createdAt,
      updatedAt,
      [jobType]: job[jobType],
    };
  }

  /* ─────────────────────────────── internals ─────────────────────────────── */

  async #assertAdmin(userId, message) {
    const user = await this.users.findById(userId);
    if (!user || user.type !== "Admin") throw new ForbiddenError(message);
    return user;
  }

  /**
   * Who counts as "nearby" for a browse.
   *
   * Coordinates when the member has them, their zip code otherwise. A member
   * with neither cannot be placed at all, which is a 400 rather than an empty
   * page — there is a setting they need to fill in.
   */
  async #nearbyPosterIds(currentUser, location) {
    const select = "_id zipCode location noOfChildren";

    if (currentUser.location?.coordinates?.length === 2) {
      const [lng, lat] = currentUser.location.coordinates;
      const radiusInRadians =
        ((location ? parseFloat(location) : 5) * MILES_TO_KM) / EARTH_RADIUS_KM;

      const nearby = await this.users.find(
        { location: { $geoWithin: { $centerSphere: [[lng, lat], radiusInRadians] } } },
        { select }
      );
      return nearby.map((user) => user._id.toString());
    }

    if (currentUser.zipCode) {
      const sameZip = await this.users.find({ zipCode: currentUser.zipCode }, { select });
      return sameZip.map((user) => user._id.toString());
    }

    throw new ValidationError(
      "User must have either location coordinates or a zip code to search jobs."
    );
  }

  /** Rate and schedule conditions, applied across the requested job types. */
  #browseFilter({ nearbyUserIds, jobType, minRate, maxRate, preferredSchedule }) {
    const asList = (value) =>
      value ? (Array.isArray(value) ? value : value.split(",")) : [];

    const selectedJobTypes = jobType ? asList(jobType) : JOB_TYPES;

    const filter = { user: { $in: nearbyUserIds } };

    // Two shapes per type: a {min,max} range, or a bare number. Which one a
    // post carries depends on the questionnaire version that created it.
    filter.$or = selectedJobTypes.flatMap((type) => [
      {
        [`${type}.hourlyRate.min`]: {
          $exists: true,
          $gte: Number(minRate),
          $lte: Number(maxRate),
        },
      },
      {
        [`${type}.hourlyRate`]: {
          $type: "number",
          $gte: Number(minRate),
          $lte: Number(maxRate),
        },
      },
    ]);

    const schedules = asList(preferredSchedule);
    if (schedules.length > 0) {
      filter.$and = [
        {
          $or: selectedJobTypes.flatMap((type) =>
            schedules.map((schedule) => ({ [`${type}.preferredSchedule`]: schedule }))
          ),
        },
      ];
    }

    return filter;
  }

  /**
   * Whether a poster's household matches the caregiver's filters.
   *
   * Runs in memory because the ages live in `noOfChildren.info`, an object
   * keyed by child rather than an array, which cannot be range-queried.
   */
  #matchesHousehold(user, { minChildren, maxChildren, minAge, maxAge }) {
    if (!user?.noOfChildren?.info) return false;

    const ages = Object.values(user.noOfChildren.info)
      .map(Number)
      .filter((age) => !Number.isNaN(age));
    if (!ages.length) return false;

    const count = user.noOfChildren.length || ages.length;

    return (
      count >= Number(minChildren) &&
      count <= Number(maxChildren) &&
      Math.min(...ages) >= Number(minAge) &&
      Math.max(...ages) <= Number(maxAge)
    );
  }

  /** Attach each reviewer's identity to their review, or null if they are gone. */
  async #enrichReviews(reviews) {
    if (!Array.isArray(reviews) || reviews.length === 0) return [];

    // A byline needs a name and an avatar — and nothing else. Selecting the
    // identity projection is what keeps the reviewer's email address out.
    const reviewers = await this.users.find(
      { _id: { $in: reviews.map((review) => review.userId) } },
      { select: USER_IDENTITY_SELECT }
    );
    const byId = new Map(reviewers.map((user) => [user._id.toString(), user]));

    return reviews.map((review) => ({
      ...review,
      reviewer: byId.get(review.userId.toString()) || null,
    }));
  }
}

export default JobService;
