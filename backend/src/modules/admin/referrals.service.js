import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta, searchTerm } from "./admin.middleware.js";
import { referralLinkFor } from "../referral/referral.util.js";
import { subscriptionTier, referralSummary } from "../billing/subscriptionTier.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const PARTY_FIELDS =
  "name email type status imageUrl createdAt referralCode referralCodeCreatedAt " +
  "referralCount referralMatchingUntil referredBy referralCreditedAt " +
  "premium subscriptionStatus";

/**
 * The tier and benefit block every row carries, built from the SAME helpers the
 * Users and Subscriptions screens use.
 *
 * A referrer reading "Referral · free until 3 Sep" there and something else
 * here would be a support ticket about a bug that does not exist.
 */
const benefitFor = (user) => ({ tier: subscriptionTier(user), ...referralSummary(user) });

/**
 * Referral tracking.
 *
 * ── What this screen is for ────────────────────────────────────────────────
 * Caregivers do not pay. They get one free match request, and after that they
 * keep matching by referring a friend: each friend who signs up with their code
 * AND finishes a profile grants one calendar month.
 *
 * That makes referrals a billing mechanism, not a growth vanity metric, and it
 * gives the funnel three states worth separating:
 *
 *   1. LINK CREATED  — a code exists. Costs nothing, proves nothing.
 *   2. SIGNED UP     — somebody registered with it. Still pays out nothing.
 *   3. COMPLETED     — they finished a profile. THIS is when the referrer's
 *                      month is granted and their due date moves.
 *
 * Steps 2 and 3 are deliberately distinct in the data (`referredBy` set at
 * registration, `referralCreditedAt` stamped at completion) because the gap
 * between them is the whole story: a referrer with eight signups and one
 * completion has not earned eight months, and a screen showing one number would
 * hide the reason their matching lapsed.
 *
 * ── Nothing here writes ────────────────────────────────────────────────────
 * Months are granted by profile completion and by nothing else. An admin
 * hand-crediting a month would be a payout with no referral behind it, and the
 * one guarantee this scheme rests on is that a month always corresponds to a
 * real person who joined and finished.
 */
export class ReferralsAdminService extends BaseService {
  /**
   * One row per person who holds a referral link.
   *
   * `scope=active` (the default) narrows to the ones who have actually had a
   * signup — a list of every account with a code is a list of every account,
   * which is not referral activity.
   */
  async listReferrers({ query = {} }) {
    const paging = parsePaging(query);
    const { search, scope } = query;

    const filter = { referralCode: { $nin: [null, ""] } };

    if (scope !== "all") {
      const referrerIds = await this.userRepository.distinctReferrerIds();
      filter._id = { $in: referrerIds };
    }

    if (search) {
      const term = searchTerm(search);
      // The code itself is searchable: an admin chasing a specific link has the
      // code in front of them, not the owner's name.
      filter.$or = [{ name: term }, { email: term }, { referralCode: term }];
    }

    const [referrers, totalRecords] = await Promise.all([
      this.userRepository.find(filter, {
        select: PARTY_FIELDS,
        // Most active first. `referralCount` is the credited count, so this
        // ranks by months actually earned rather than by links handed out.
        sort: { referralCount: -1, referralCodeCreatedAt: -1, createdAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.userRepository.count(filter),
    ]);

    // Signup and completion counts for the page, in one aggregate rather than
    // two queries per row.
    const ids = referrers.map((user) => user._id);
    const counts = ids.length ? await this.userRepository.referralCountsFor(ids) : [];
    const byReferrer = new Map(counts.map((row) => [String(row._id), row]));

    const data = referrers.map((user) => {
      const stats = byReferrer.get(String(user._id)) || {};
      const signups = stats.signups || 0;
      const completed = stats.completed || 0;

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        type: user.type,
        status: user.status,

        code: user.referralCode,
        link: referralLinkFor(user.referralCode),
        // Null for codes minted before this was recorded — reported as null so
        // the console can say so, rather than substituting the signup date,
        // which would be wrong for every backfilled account.
        linkCreatedAt: user.referralCodeCreatedAt || null,

        signups,
        completed,
        // Signed up but not finished, so paid out nothing yet. The number that
        // explains a referrer's disappointment.
        pending: Math.max(0, signups - completed),
        lastSignupAt: stats.lastSignupAt || null,
        lastCreditedAt: stats.lastCreditedAt || null,

        // Kept alongside `completed` rather than assumed equal to it: the two
        // diverge when a referred account is deleted after paying out, and a
        // mismatch is worth seeing instead of silently reconciling.
        monthsEarned: user.referralCount || 0,
        ...benefitFor(user),
      };
    });

    return { data, pagination: pagingMeta(totalRecords, paging) };
  }

  async stats({ now = new Date() } = {}) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

    const [
      linksCreated,
      referrerIds,
      signups,
      completed,
      activeBenefit,
      signupsLast30Days,
      monthsGranted,
    ] = await Promise.all([
      this.userRepository.count({ referralCode: { $nin: [null, ""] } }),
      this.userRepository.distinctReferrerIds(),
      this.userRepository.count({ referredBy: { $ne: null } }),
      this.userRepository.count({
        referredBy: { $ne: null },
        referralCreditedAt: { $ne: null },
      }),
      this.userRepository.count({ referralMatchingUntil: { $gt: now } }),
      this.userRepository.count({
        referredBy: { $ne: null },
        createdAt: { $gte: thirtyDaysAgo },
      }),
      this.userRepository.totalReferralMonths(),
    ]);

    return {
      linksCreated,
      // Distinct referrers with at least one signup — the denominator that
      // matters, since "links created" is essentially the user count.
      activeReferrers: referrerIds.length,
      signups,
      completed,
      pending: Math.max(0, signups - completed),
      // Whether the scheme works. A referral that never completes grants
      // nothing, so the signup count alone overstates the programme
      // substantially. Null rather than 0 when there is nothing to divide.
      completionRate: signups > 0 ? Math.round((completed / signups) * 100) : null,
      monthsGranted,
      activeBenefit,
      signupsLast30Days,
    };
  }

  /**
   * One row per person who joined through somebody's link — the other side of
   * the same funnel.
   *
   * Answers "who came in through referrals and did they stick", which the
   * referrer-shaped view cannot: there, ten signups from one person are a
   * single number.
   */
  async listSignups({ query = {} }) {
    const paging = parsePaging(query);
    const { status, search } = query;

    const filter = { referredBy: { $ne: null } };

    if (status === "pending") filter.referralCreditedAt = null;
    if (status === "completed") filter.referralCreditedAt = { $ne: null };

    if (search) {
      const term = searchTerm(search);
      filter.$or = [{ name: term }, { email: term }];
    }

    const [rows, totalRecords] = await Promise.all([
      this.userRepository.find(filter, {
        select: "name email type status createdAt referredBy referralCreditedAt",
        populate: { path: "referredBy", select: "name email referralCode referralCodeCreatedAt" },
        sort: { createdAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.userRepository.count(filter),
    ]);

    const data = rows.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      type: user.type,
      status: user.status,

      joinedAt: user.createdAt,
      // Null while still pending — the referral exists but has paid nothing.
      completedAt: user.referralCreditedAt || null,
      credited: Boolean(user.referralCreditedAt),

      referrer: user.referredBy
        ? {
            _id: user.referredBy._id,
            name: user.referredBy.name,
            email: user.referredBy.email,
            code: user.referredBy.referralCode || null,
            linkCreatedAt: user.referredBy.referralCodeCreatedAt || null,
          }
        : // The referrer's account was deleted after the referral was made. The
          // row is kept rather than filtered out: the signup genuinely
          // happened, and dropping it would quietly change the denominator.
          null,

      // The lag that decides whether "pending" means "still onboarding" or
      // "never coming back".
      daysToComplete: user.referralCreditedAt
        ? Math.max(
            0,
            Math.round(
              (new Date(user.referralCreditedAt) - new Date(user.createdAt)) / DAY_MS
            )
          )
        : null,
    }));

    return { data, pagination: pagingMeta(totalRecords, paging) };
  }

  /**
   * One referrer's link, benefit and everyone who joined through them.
   *
   * What an admin opens when a caregiver writes in asking why their free
   * matching stopped.
   */
  async detail(userId) {
    if (!mongoose.isValidObjectId(userId)) throw new ValidationError("Invalid user id");

    const user = await this.userRepository.findById(userId, {
      select: PARTY_FIELDS,
      lean: true,
    });
    if (!user) throw new NotFoundError("Account not found");

    const referred = await this.userRepository.find(
      { referredBy: userId },
      {
        select: "name email type status createdAt referralCreditedAt",
        sort: { createdAt: -1 },
        limit: 100,
        lean: true,
      }
    );

    return {
      referrer: {
        _id: user._id,
        name: user.name,
        email: user.email,
        type: user.type,
        status: user.status,
        code: user.referralCode || null,
        link: referralLinkFor(user.referralCode),
        linkCreatedAt: user.referralCodeCreatedAt || null,
        monthsEarned: user.referralCount || 0,
        ...benefitFor(user),
      },
      referred: referred.map((friend) => ({
        _id: friend._id,
        name: friend.name,
        email: friend.email,
        type: friend.type,
        status: friend.status,
        joinedAt: friend.createdAt,
        completedAt: friend.referralCreditedAt || null,
        credited: Boolean(friend.referralCreditedAt),
      })),
    };
  }
}

export default ReferralsAdminService;
