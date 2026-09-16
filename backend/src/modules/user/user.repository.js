import { BaseRepository } from "../../core/database/BaseRepository.js";
import {
  PUBLIC_LOCATION_PATHS,
  PUBLIC_USER_FIELDS,
  PUBLIC_USER_SELECT,
  SELF_USER_SELECT,
  USER_IDENTITY_SELECT,
} from "./user.privacy.js";
import User from "./user.model.js";

/**
 * Inclusion projection for aggregation pipelines.
 *
 * `$project` cannot mix inclusion and exclusion, so browse results built with
 * an aggregate need the whitelist spelled out as `{ field: 1 }`. Built from the
 * same field list the rest of the API uses, with the address named subpath by
 * subpath so `coordinates` is never read out of the database at all.
 */
export const PUBLIC_USER_PROJECTION = Object.fromEntries(
  [
    ...PUBLIC_USER_FIELDS.filter((field) => field !== "location"),
    ...PUBLIC_LOCATION_PATHS,
  ].map((field) => [field, 1])
);

/** MongoDB's $centerSphere measures its radius in radians. */
const EARTH_RADIUS_KM = 6378.1;
const KM_PER_MILE = 1.60934;

export const kmToRadians = (km) => km / EARTH_RADIUS_KM;
export const milesToRadians = (miles) => kmToRadians(miles * KM_PER_MILE);

/**
 * All access to the users collection.
 *
 * The projections are the reason this class matters more than the others. A
 * user document holds a bcrypt hash, a Stripe customer id, and a home address;
 * which of those a query returns was previously decided at each of ~59 call
 * sites, and the failures were the kind you only notice in a response body —
 * a route that forgot `.select(PUBLIC_USER_SELECT)` served whole records.
 * Here the choice is named: `findPublicById` cannot accidentally return a hash
 * because the projection is part of the method, not the caller's job.
 */
export class UserRepository extends BaseRepository {
  constructor(model = User) {
    super(model);
  }

  /** The full document, including secrets. For auth and for a user's own account. */
  findByEmail(email, options = {}) {
    // Addresses are stored as entered but compared case-insensitively; without
    // this, "Sam@x.com" and "sam@x.com" are two accounts.
    return this.findOne({ email: String(email ?? "").toLowerCase().trim() }, options);
  }

  /** Only the fields any signed-in member may see about another member. */
  findPublicById(id, options = {}) {
    return this.findById(id, { ...options, select: PUBLIC_USER_SELECT, lean: true });
  }

  findPublicByIds(ids, options = {}) {
    return this.find(
      { _id: { $in: ids } },
      { ...options, select: PUBLIC_USER_SELECT, lean: true }
    );
  }

  /** Name and avatar only — for message senders and match cards. */
  findIdentityById(id, options = {}) {
    return this.findById(id, { ...options, select: USER_IDENTITY_SELECT, lean: true });
  }

  /** Everything a member may see about themselves; still excludes secrets. */
  findSelfById(id, options = {}) {
    return this.findById(id, { ...options, select: SELF_USER_SELECT });
  }

  /** Bump the counter the match paywall reads. */
  incrementMatchRequestsSent(id, by = 1) {
    return this.updateById(id, { $inc: { matchRequestsSent: by } });
  }

  /**
   * Members near a point, for the "new families in your area" digest and the
   * nearby-match list. Requires the 2dsphere index on `location`.
   */
  findNearby({ coordinates, maxDistance = 10000, type, exclude = [], limit }) {
    const filter = {
      location: {
        $near: {
          $geometry: { type: "Point", coordinates },
          $maxDistance: maxDistance,
        },
      },
    };
    if (type) filter.type = type;
    if (exclude.length) filter._id = { $nin: exclude };

    return this.find(filter, { select: PUBLIC_USER_SELECT, lean: true, limit });
  }

  /* ──────────────────────────────── browse ────────────────────────────────
   * The member-facing directory. Every query here is a whitelist read: these
   * results are shown to one member about another, so none of them may use the
   * self projection. */

  /**
   * Filter for "members of this type within `radiusRadians` of this point".
   *
   * Exposed rather than inlined because the browse endpoints run it twice — once
   * to fetch a page and once to count the total — and a filter that drifted
   * between the two would report a page count for a different query than the
   * one that produced the page.
   */
  withinRadiusFilter({ coordinates, radiusRadians, type }) {
    const [lng, lat] = coordinates;
    return {
      type,
      location: { $geoWithin: { $centerSphere: [[lng, lat], radiusRadians] } },
    };
  }

  /** One page of the public directory, plus the total for the pager. */
  async findPublicPage(filter, { skip, limit }) {
    const [users, totalRecords] = await Promise.all([
      this.find(filter, { select: PUBLIC_USER_SELECT, skip, limit, lean: true }),
      this.count(filter),
    ]);

    return { users, totalRecords };
  }

  /**
   * The same page via an aggregation, for filters that `find` cannot express.
   *
   * `$skip`/`$limit` run before `$project` exactly as they did before the
   * refactor — the projection is a whitelist, so applying it later costs one
   * page of documents rather than the whole matched set.
   */
  async aggregatePublicPage(matchStage, { skip, limit }) {
    const [users, totalRecords] = await Promise.all([
      this.aggregate([
        { $match: matchStage },
        { $skip: skip },
        { $limit: limit },
        { $project: PUBLIC_USER_PROJECTION },
      ]),
      this.count(matchStage),
    ]);

    return { users, totalRecords };
  }

  /** The caregiver preview on the logged-out marketing homepage. */
  findActiveNanniesInZip(zipCode, { select }) {
    return this.find({ zipCode, type: "Nanny", status: "Active" }, { select });
  }

  countByType(type) {
    return this.count({ type });
  }

  /**
   * Accounts for a set of email addresses, matched case-insensitively.
   *
   * The collation is the point. Stored addresses are saved as typed rather than
   * normalised, so a plain `$in` misses every account whose address has a
   * capital in it — and the caller here is the sheets screen, which reports
   * "never signed up" for anything it fails to match. A case mismatch would
   * therefore produce exactly the wrong answer, about a real person, on a list
   * meant for follow-up.
   *
   * Strength 2 compares base letters and accents but not case. It costs the
   * index on `email` — a collation mismatch cannot use it — which is acceptable
   * because the caller is bounded by a sheet's own size and sits behind a
   * 60-second cache.
   */
  findByEmailsInsensitive(emails, select = "email status createdAt type") {
    return this.model
      .find({ email: { $in: emails } })
      .collation({ locale: "en", strength: 2 })
      .select(select)
      .lean()
      .exec();
  }

  /** Ids and roles only — for building the id lists a share browse filters on. */
  findIdsAndTypes(filter) {
    return this.find(filter, { select: "_id type", lean: true });
  }

  /**
   * Ids of members matching a console search.
   *
   * Capped: the result becomes an `$in`, and an unbounded one built from a
   * broad search term produces a query document megabytes wide.
   */
  findIdsMatching(filter, limit = 2000) {
    return this.find(filter, { select: "_id", limit, lean: true });
  }

  /* ──────────────────────────────── admin ─────────────────────────────────
   * The console's own reads. These use SELF_USER_SELECT — everything but the
   * credentials — because an admin acting through the console is entitled to
   * the private tier. They must never be reachable without the admin gate. */

  /** Best-rated members of a type, for the console dashboard. */
  topRatedByType(type, limit = 5) {
    return this.aggregate([
      // Only members who have actually been reviewed: without this, everyone
      // with no reviews ties at the top on a null average.
      { $match: { type, "reviews.0": { $exists: true } } },
      {
        $addFields: {
          avgRating: { $avg: "$reviews.rating" },
          reviewCount: { $size: "$reviews" },
        },
      },
      { $sort: { avgRating: -1, reviewCount: -1 } },
      { $limit: limit },
      { $project: { _id: 1, name: 1, imageUrl: 1, avgRating: 1, reviewCount: 1 } },
    ]);
  }

  /** One page of the console's user table. */
  async findAdminPage(filter, { skip, limit, select = SELF_USER_SELECT, sort }) {
    const [users, totalRecords] = await Promise.all([
      this.find(filter, { select, sort, skip, limit, lean: true }),
      this.count(filter),
    ]);

    return { users, totalRecords };
  }

  /** A single record for the console's edit screen. */
  findAdminById(id) {
    return this.findById(id, { select: SELF_USER_SELECT, lean: true });
  }

  /* ─────────────────────────── console reporting ──────────────────────────── */

  /**
   * Real members: not deleted, not staff.
   *
   * Every activity figure in the console is measured against this population,
   * so it lives here rather than being spelled out at each call site — a report
   * that quietly included admins would flatter every engagement number.
   */
  get membersFilter() {
    return { status: { $ne: "Deleted" }, type: { $ne: "Admin" } };
  }

  countActiveMembers() {
    return this.count(this.membersFilter);
  }

  /**
   * Engagement buckets, in one pass over the collection.
   *
   * One aggregation rather than five counts: separate round trips can disagree
   * with each other if a login lands between them, and a dashboard whose
   * buckets do not sum to its own total is worse than one a second stale.
   */
  async activityBuckets({ day7, day30, day90 }) {
    const [row] = await this.aggregate([
      { $match: this.membersFilter },
      {
        $group: {
          _id: null,
          active7: { $sum: { $cond: [{ $gte: ["$lastLogin", day7] }, 1, 0] } },
          active30: { $sum: { $cond: [{ $gte: ["$lastLogin", day30] }, 1, 0] } },
          lapsed: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$lastLogin", day90] }, { $lt: ["$lastLogin", day30] }] },
                1,
                0,
              ],
            },
          },
          inactive: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$lastLogin", null] }, { $lt: ["$lastLogin", day90] }] },
                1,
                0,
              ],
            },
          },
          neverRecorded: { $sum: { $cond: [{ $eq: ["$lastLogin", null] }, 1, 0] } },
          totalLogins: { $sum: "$loginCount" },
          total: { $sum: 1 },
        },
      },
    ]);

    return row ?? null;
  }

  async profileAndModerationStats() {
    const [row] = await this.aggregate([
      { $match: this.membersFilter },
      {
        $group: {
          _id: null,
          profileComplete: { $sum: { $cond: ["$nannyProfileCompleted", 1, 0] } },
          onboardingComplete: { $sum: { $cond: ["$onboarding.completed", 1, 0] } },
          flagged: { $sum: { $cond: [{ $ne: ["$suspiciousFlaggedAt", null] }, 1, 0] } },
          suspended: { $sum: { $cond: [{ $eq: ["$status", "Suspended"] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ["$status", "Block"] }, 1, 0] } },
        },
      },
    ]);

    return row ?? null;
  }

  /**
   * The accounts the suspicious scan examines: the most recent, capped.
   *
   * Only the fields the signals actually read — the scan holds all of these in
   * memory at once, and there is no reason for two thousand password hashes to
   * be among them.
   */
  scanCandidates(limit = 2000) {
    return this.find(
      { status: { $nin: ["Deleted"] }, type: { $ne: "Admin" } },
      {
        select:
          "_id name email type createdAt lastLogin loginCount verified " +
          "matchRequestsSent suspiciousFlaggedAt suspiciousReason status",
        sort: { createdAt: -1 },
        limit,
        lean: true,
      }
    );
  }

  /** Signups per ISO week and member type, over a window. */
  weeklySignups({ from, to }) {
    return this.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, type: { $in: ["Nanny", "Parents"] } } },
      {
        $group: {
          _id: { week: { $week: "$createdAt" }, year: { $year: "$createdAt" }, type: "$type" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          week: "$_id.week",
          year: "$_id.year",
          type: "$_id.type",
          count: 1,
        },
      },
      { $sort: { year: 1, week: 1 } },
    ]);
  }

  /* ────────────────────────────── referrals ──────────────────────────────── */

  /** Everyone who has ever been credited as somebody's referrer. */
  distinctReferrerIds() {
    return this.model.distinct("referredBy", { referredBy: { $ne: null } }).exec();
  }

  /**
   * Signup and completion counts per referrer, for a page of them.
   *
   * The two are counted separately because the gap between them is the point:
   * a referrer with eight signups and one completion has earned one month, and
   * a single number would hide why their matching lapsed.
   */
  referralCountsFor(referrerIds) {
    return this.aggregate([
      { $match: { referredBy: { $in: referrerIds } } },
      {
        $group: {
          _id: "$referredBy",
          signups: { $sum: 1 },
          completed: { $sum: { $cond: [{ $ne: ["$referralCreditedAt", null] }, 1, 0] } },
          lastSignupAt: { $max: "$createdAt" },
          lastCreditedAt: { $max: "$referralCreditedAt" },
        },
      },
    ]);
  }

  /** Total months granted across the whole scheme. */
  async totalReferralMonths() {
    const [row] = await this.aggregate([
      { $match: { referralCount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$referralCount" } } },
    ]);

    return row?.total || 0;
  }

  /** Daily signups, split by member type, for the growth chart. */
  dailySignupsSince(since) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since }, type: { $in: ["Parents", "Nanny"] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
          families: { $sum: { $cond: [{ $eq: ["$type", "Parents"] }, 1, 0] } },
          caregivers: { $sum: { $cond: [{ $eq: ["$type", "Nanny"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  countsByType() {
    return this.aggregate([
      { $match: { type: { $in: ["Nanny", "Parents"] } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
  }

  /** The same counts as of a date, for a period-over-period comparison. */
  countsByTypeBefore(date) {
    return this.aggregate([
      { $match: { createdAt: { $lte: date }, type: { $in: ["Nanny", "Parents"] } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
  }

  /** The commonest areas for a member type, with each one's share. */
  topLocations(type, total, limit = 3) {
    return this.aggregate([
      { $match: { type } },
      { $group: { _id: "$location.format_location", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $addFields: {
          // Guarded: `total` is the caller's count of members of this type, and
          // dividing by zero on an empty platform errors the aggregation out.
          percentage: total > 0 ? { $multiply: [{ $divide: ["$count", total] }, 100] } : 0,
        },
      },
    ]);
  }

  /**
   * Members of a type ranked by rating or review count.
   *
   * `preserveNullAndEmptyArrays` on the unwind keeps members with no reviews in
   * the result — they rank last rather than vanishing, which is what the
   * console's "all members" table expects.
   */
  async rankedByReviews({ type, sortBy, skip, limit }) {
    const groupStage = {
      $group: {
        _id: "$_id",
        name: { $first: "$name" },
        email: { $first: "$email" },
        location: { $first: "$location" },
        type: { $first: "$type" },
        age: { $first: "$age" },
        gender: { $first: "$gender" },
        imageUrl: { $first: "$imageUrl" },
        avgRating: { $avg: "$reviews.rating" },
        totalReviews: { $sum: { $cond: [{ $ifNull: ["$reviews", false] }, 1, 0] } },
      },
    };

    const [users, totalRecords] = await Promise.all([
      this.aggregate([
        { $match: { type } },
        { $unwind: { path: "$reviews", preserveNullAndEmptyArrays: true } },
        groupStage,
        { $sort: { [sortBy]: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      // Counted after the group so it counts members, not review rows.
      this.count({ type }),
    ]);

    return { users, totalRecords };
  }
}

export const userRepository = new UserRepository();

export default userRepository;
