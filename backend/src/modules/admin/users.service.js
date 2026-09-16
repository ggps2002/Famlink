import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta, parseSort, searchTerm, escapeRegex } from "./admin.middleware.js";
import { requireReason } from "./adminAudit.js";
import { scoreProfile } from "../profile/profileCompleteness.js";
import {
  ADMIN_LIST_FIELDS,
  COMPLETION_BUCKETS,
  decorate,
} from "./adminUser.presenter.js";
import { MIN_SUSPEND_DAYS, MAX_SUSPEND_DAYS, isValidSuspendDays } from "./moderationSanctions.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const SORTABLE = ["createdAt", "lastLogin", "name", "email", "loginCount", "termsAcceptedAt"];

/** Activity is a range over `lastLogin`, so it becomes a date filter. */
const activityFilter = (activity, now = Date.now()) => {
  const ago = (days) => new Date(now - days * DAY_MS);

  if (activity === "active") return { $gte: ago(7) };
  if (activity === "recent") return { $gte: ago(30), $lt: ago(7) };
  if (activity === "lapsed") return { $gte: ago(90), $lt: ago(30) };
  if (activity === "inactive") return { $lt: ago(90) };
  if (activity === "unknown") return null;
  return undefined;
};

/**
 * The console's user administration.
 *
 * Every state-changing method here goes through `#loadTarget`, which refuses to
 * act on the acting admin's own account. That is always a mistake — there is no
 * reason to block yourself out of the console you are using — and the result is
 * a platform nobody can administer.
 */
export class AdminUsersService extends BaseService {
  async list({ query = {} }) {
    const paging = parsePaging(query);
    const filter = {};
    const { search, type, status, tier, city, activity, flagged, completion } = query;

    if (search) {
      const term = searchTerm(search);
      filter.$or = [
        { name: term },
        { email: term },
        { zipCode: term },
        { "location.city": term },
      ];
    }

    if (type && ["Parents", "Nanny", "Admin"].includes(type)) filter.type = type;

    // No status filter means "everyone except deleted accounts". A soft-deleted
    // member is still a row, and defaulting to showing them would make the
    // table grow forever with accounts that no longer exist as far as anyone is
    // concerned. They stay reachable via ?status=Deleted.
    if (status && ["Active", "Block", "Suspended", "Deleted"].includes(status)) {
      filter.status = status;
    } else {
      filter.status = { $ne: "Deleted" };
    }

    if (tier === "plus") filter.premium = true;
    if (tier === "free") {
      // "Free" means no benefits at all, so an active referrer is excluded —
      // they are listed under `referral`. Written as `$not` rather than an `$or`
      // over null/past dates because the search filter above also assigns
      // `$or`, and the second assignment would silently drop the first — turning
      // "free accounts matching Jane" into "any account matching Jane".
      filter.premium = { $ne: true };
      filter.referralMatchingUntil = { $not: { $gt: new Date() } };
    }
    if (tier === "referral") filter.referralMatchingUntil = { $gt: new Date() };

    if (city) filter["location.city"] = new RegExp(`^${escapeRegex(city)}$`, "i");
    if (flagged === "true") filter.suspiciousFlaggedAt = { $ne: null };

    if (activity) {
      const range = activityFilter(activity);
      if (range !== undefined) filter.lastLogin = range;
    }

    const [users, totalRecords] = await Promise.all([
      this.userRepository.find(filter, {
        select: ADMIN_LIST_FIELDS,
        sort: parseSort(query.sort, SORTABLE, { createdAt: -1 }),
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.userRepository.count(filter),
    ]);

    // Profile completion needs each member's share profile. One query for the
    // whole page keyed by userId, not one per row — the N+1 version is
    // invisible on a seed database and costs 25 round trips per page in
    // production.
    const profiles = await this.profileRepository.findManyByUserIds(
      users.map((user) => user._id),
      { lean: true }
    );
    const byUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    let data = users.map((user) =>
      decorate(user, scoreProfile(user, byUser.get(String(user._id))))
    );

    // Completion is computed rather than stored, so it cannot be a Mongo filter
    // and is applied to the page. `pageFiltered` says so explicitly rather than
    // letting the console show a total that does not match its rows.
    let pageFiltered = false;
    if (completion && COMPLETION_BUCKETS[completion]) {
      const inBucket = COMPLETION_BUCKETS[completion];
      data = data.filter((user) => inBucket(user.profileCompletion?.percent ?? 0));
      pageFiltered = true;
    }

    return { data, pagination: pagingMeta(totalRecords, paging), pageFiltered };
  }

  /** Everything the detail drawer shows, in one round trip. */
  async detail(id) {
    if (!mongoose.isValidObjectId(id)) throw new ValidationError("Invalid user id");

    const user = await this.userRepository.findById(id, {
      select: ADMIN_LIST_FIELDS,
      lean: true,
    });
    if (!user) throw new NotFoundError("User not found");

    const [
      profile,
      matchesSent,
      matchesReceived,
      mutualMatches,
      conversations,
      messagesSent,
      reportsAgainst,
      reportsBy,
      recentEmails,
      adminHistory,
    ] = await Promise.all([
      this.profileRepository.findByUserId(id, { lean: true }),
      this.matchRepository.count({ senderId: id }),
      this.matchRepository.count({ receiverId: id }),
      this.matchRepository.count({
        $or: [{ senderId: id }, { receiverId: id }],
        status: "accepted",
      }),
      this.chatRepository.count({ participants: id }),
      this.messageRepository.count({ sender: id }),
      this.reportRepository.count({ reportedUserId: id }),
      this.reportRepository.count({ reporterId: id }),
      this.emailLogRepository.find({ userId: id }, { sort: { sentAt: -1 }, limit: 20, lean: true }),
      this.adminActionRepository.find(
        { targetUserId: id },
        {
          sort: { createdAt: -1 },
          limit: 50,
          select: "action adminEmail reason createdAt metadata",
          lean: true,
        }
      ),
    ]);

    return {
      user: decorate(user, scoreProfile(user, profile)),
      profile: profile || null,
      shareLink: profile?.shareToken
        ? {
            token: profile.shareToken,
            enabled: profile.shareEnabled !== false,
            views: profile.shareViewCount || 0,
            lastViewedAt: profile.shareLastViewedAt || null,
          }
        : null,
      activity: {
        matchesSent,
        matchesReceived,
        mutualMatches,
        conversations,
        messagesSent,
        reportsAgainst,
        reportsBy,
      },
      recentEmails,
      // Deliberately part of the detail view: an admin about to delete an
      // account should see that someone already suspended it twice this month.
      adminHistory,
    };
  }

  /* ═══════════════════════════════ moderation ═══════════════════════════════ */

  async #loadTarget({ id, adminId }) {
    if (!mongoose.isValidObjectId(id)) throw new ValidationError("Invalid user id");
    if (String(id) === String(adminId)) {
      throw new ValidationError("You cannot perform this action on your own account.");
    }

    const user = await this.userRepository.findById(id, {
      select: "_id name email type status premium",
    });
    if (!user) throw new NotFoundError("User not found");

    return user;
  }

  #requireReason(raw, verb) {
    const reason = requireReason(raw);
    if (!reason) {
      throw new ValidationError(
        `A reason of at least 10 characters is required to ${verb}.`
      );
    }
    return reason;
  }

  /** Indefinite. Only an admin lifts it. */
  async block({ id, adminId, reason: rawReason }) {
    const user = await this.#loadTarget({ id, adminId });
    const reason = this.#requireReason(rawReason, "block an account");

    await this.userRepository.updateById(user._id, {
      $set: {
        status: "Block",
        moderationReason: reason,
        // Cleared: a block is indefinite, and a leftover date would let the
        // account come back on its own.
        suspendedUntil: null,
        suspendedAt: new Date(),
      },
    });

    return { user, reason, previousStatus: user.status };
  }

  /**
   * A timed pause.
   *
   * The sign-in path lifts it automatically once `suspendedUntil` passes, so
   * nobody has to remember to undo it.
   */
  async suspend({ id, adminId, days: rawDays, reason: rawReason }) {
    const user = await this.#loadTarget({ id, adminId });
    const reason = this.#requireReason(rawReason, "suspend an account");

    if (!isValidSuspendDays(rawDays)) {
      throw new ValidationError(
        `Suspension length must be between ${MIN_SUSPEND_DAYS} and ${MAX_SUSPEND_DAYS} days.`
      );
    }

    const days = Number(rawDays);
    const until = new Date(Date.now() + days * DAY_MS);

    await this.userRepository.updateById(user._id, {
      $set: {
        status: "Suspended",
        suspendedUntil: until,
        suspendedAt: new Date(),
        moderationReason: reason,
      },
    });

    return { user, reason, days, until, previousStatus: user.status };
  }

  /**
   * Undo a block or a suspension.
   *
   * One method for both, because "make this account work again" is one intent —
   * and two operations that do it differently is how an admin lifts a
   * suspension and leaves a block in place.
   */
  async reinstate({ id, adminId, reason }) {
    const user = await this.#loadTarget({ id, adminId });

    if (user.status === "Deleted") {
      throw new ValidationError("This account was deleted. Use restore instead.");
    }

    await this.userRepository.updateById(user._id, {
      $set: {
        status: "Active",
        suspendedUntil: null,
        suspendedAt: null,
        moderationReason: null,
      },
    });

    return {
      user,
      previousStatus: user.status,
      action: user.status === "Suspended" ? "user.unsuspend" : "user.unblock",
      reason: reason || "Reinstated by admin",
    };
  }

  /**
   * "Take my listing down." Removes the share profile and kills the public link.
   *
   * THE ACCOUNT SURVIVES: they can still sign in, their chats and match history
   * are intact, and they can build a new profile. Kept distinct from deleting
   * the account — conflating the two is how a "please hide my listing" request
   * becomes a data-loss incident.
   */
  async deleteProfile({ id, adminId, reason: rawReason }) {
    const user = await this.#loadTarget({ id, adminId });
    const reason = this.#requireReason(rawReason, "delete a profile");

    const profile = await this.profileRepository.findByUserId(user._id, { lean: true });

    await this.profileRepository.deleteOne({ userId: user._id });
    await this.userRepository.updateById(user._id, {
      $set: {
        profileDeletedAt: new Date(),
        nannyProfileCompleted: false,
        shareSetupCompleted: false,
      },
    });

    return { user, reason, profile };
  }

  /**
   * Account deletion. SOFT by design.
   *
   * The row stays and `status` becomes "Deleted". A hard delete would leave
   * every message, match request and review that references this member
   * pointing at a missing id — and those records belong to the OTHER party as
   * much as to this one. The family who spent three weeks arranging a share
   * should not find their half of the conversation broken because the caregiver
   * closed their account.
   *
   * What actually stops: sign-in, appearing in browse or match results, the
   * public share link, and all future email.
   */
  async deleteAccount({ id, adminId, reason: rawReason }) {
    const user = await this.#loadTarget({ id, adminId });
    const reason = this.#requireReason(rawReason, "delete an account");

    // The address is released rather than kept. It is unique-indexed, and
    // holding it would stop the same person signing up again — not a sanction
    // anyone chose, just a side effect of the index. Tombstoned rather than
    // nulled because `email` is required; the original is preserved in the
    // audit row.
    const tombstone = `deleted+${user._id}@famlink.invalid`;

    await this.userRepository.updateById(user._id, {
      $set: {
        status: "Deleted",
        deletedAt: new Date(),
        moderationReason: reason,
        email: tombstone,
        phoneNo: null,
        password: null,
        imageUrl: null,
        aboutMe: null,
        dob: null,
        stripeId: null,
        subscriptionId: null,
        subscriptionStatus: null,
        premium: false,
        online: false,
        // Belt and braces: every email path filters on unsubscribe or on
        // status, but a deleted account must not be mailed even if one is
        // missed.
        "notifications.email.platformUpdates": false,
        "notifications.email.newsletter": false,
        "notifications.sms": false,
      },
      $unset: { location: "", resetPasswordToken: "", resetPasswordExpires: "", otp: "" },
    });

    // The profile is theirs alone — nothing else references it — so it goes.
    await this.profileRepository.deleteOne({ userId: user._id });

    // Pending requests are cancelled so the other side stops seeing an
    // invitation from an account that no longer exists. Accepted ones are left:
    // they are the history of a real connection.
    const cancelled = await this.matchRepository.deleteMany({
      $or: [{ senderId: user._id }, { receiverId: user._id }],
      status: "pending",
    });

    return {
      user,
      reason,
      originalEmail: user.email,
      cancelledPendingRequests: cancelled.deletedCount,
    };
  }

  /**
   * Mark an account for review without sanctioning it.
   *
   * Feeds the moderation queue's "flagged" filter. Deliberately not audited —
   * it changes nothing about the account's access, and an audit row per glance
   * would drown the entries that record real decisions.
   */
  async flag({ id, adminId, suspicious: rawSuspicious, reason }) {
    const user = await this.#loadTarget({ id, adminId });

    // Defaults to flagging: the button that clears a flag sends `false`
    // explicitly, so an absent value means "raise it".
    const suspicious = rawSuspicious !== false;

    await this.userRepository.updateById(
      user._id,
      suspicious
        ? {
            $set: {
              suspiciousFlaggedAt: new Date(),
              suspiciousReason: String(reason || "").trim().slice(0, 500),
            },
          }
        : { $set: { suspiciousFlaggedAt: null, suspiciousReason: null } }
    );

    return { suspicious };
  }
}

export default AdminUsersService;
