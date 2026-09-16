import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta } from "./admin.middleware.js";
import { reasonsFor, toFlaggedRow } from "./suspiciousSignals.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many accounts the suspicious scan will look at in one pass. */
const SCAN_LIMIT = 2000;

/**
 * User activity: who is engaged, who has gone quiet, and who looks wrong.
 *
 * Per-user numbers live on the user detail endpoint; this is the aggregate
 * view — the distribution, the lists an admin acts on, and the suspicious scan.
 */
export class ActivityService extends BaseService {
  #ago(days, now = Date.now()) {
    return new Date(now - days * DAY_MS);
  }

  /**
   * The engagement distribution.
   *
   * Everything comes from two aggregations rather than a handful of counts,
   * because separate `countDocuments` round trips can disagree with each other
   * if a login lands between them — and a dashboard whose buckets do not sum to
   * its own total is worse than one that is a second stale.
   */
  async overview({ now = Date.now() } = {}) {
    const [buckets, totalUsers, profileStats] = await Promise.all([
      this.userRepository.activityBuckets({
        day7: this.#ago(7, now),
        day30: this.#ago(30, now),
        day90: this.#ago(90, now),
      }),
      this.userRepository.countActiveMembers(),
      this.userRepository.profileAndModerationStats(),
    ]);

    const activity = buckets ?? {};
    const profiles = profileStats ?? {};
    const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

    return {
      totalUsers,
      activity: {
        activeLast7Days: activity.active7 || 0,
        activeLast30Days: activity.active30 || 0,
        lapsed30to90Days: activity.lapsed || 0,
        inactiveOver90Days: activity.inactive || 0,
        // Accounts predating the lastLogin field. Reported separately rather
        // than folded into "inactive": we genuinely do not know, and calling
        // them inactive would put long-standing members on a churn list they
        // may not belong on.
        neverRecorded: activity.neverRecorded || 0,
        // Logins per member over the lifetime of the account. A blunt number,
        // but the one that moves when the product gets stickier.
        avgLoginsPerUser: totalUsers
          ? Math.round(((activity.totalLogins || 0) / totalUsers) * 10) / 10
          : 0,
      },
      profiles: {
        completed: profiles.profileComplete || 0,
        onboardingCompleted: profiles.onboardingComplete || 0,
        completionRate: share(profiles.profileComplete || 0, totalUsers),
      },
      moderation: {
        flaggedSuspicious: profiles.flagged || 0,
        suspended: profiles.suspended || 0,
        blocked: profiles.blocked || 0,
      },
    };
  }

  /**
   * Session frequency for one member, from the analytics beacons their
   * signed-in visits produced.
   *
   * Distinct from `loginCount`, which counts authentications: someone who stays
   * signed in for a month has one login and thirty sessions, and the second
   * number is the one that describes engagement.
   */
  async sessions({ userId, days: requestedDays }) {
    if (!mongoose.isValidObjectId(userId)) throw new ValidationError("Invalid user id");

    const days = Math.min(365, Math.max(1, parseInt(requestedDays, 10) || 90));

    const sessions = await this.pageViewRepository.sessionsForUser({
      // An aggregation pipeline gets no schema casting, unlike find() — the id
      // has to be a real ObjectId or the $match silently returns nothing.
      userId: new mongoose.Types.ObjectId(String(userId)),
      since: this.#ago(days),
    });

    const totalDuration = sessions.reduce((sum, session) => sum + (session.durationSec || 0), 0);
    const totalPages = sessions.reduce((sum, session) => sum + session.pageViews, 0);
    const weeks = Math.max(1, days / 7);

    return {
      sessions,
      summary: {
        sessionCount: sessions.length,
        sessionsPerWeek: Math.round((sessions.length / weeks) * 10) / 10,
        avgDurationSec: sessions.length ? Math.round(totalDuration / sessions.length) : 0,
        avgPagesPerSession: sessions.length
          ? Math.round((totalPages / sessions.length) * 10) / 10
          : 0,
        windowDays: days,
        // Analytics only started recording when the beacon shipped, so an empty
        // result is ambiguous — it means "no visits" or "before we measured".
        // Say which rather than reporting zero as if they never visited.
        hasData: sessions.length > 0,
      },
    };
  }

  /**
   * Scan recent accounts for signals worth a human look.
   *
   * Three grouped queries over the whole candidate set, joined in memory. The
   * per-user alternative is two thousand round trips.
   */
  async suspicious({ query = {}, now = Date.now() } = {}) {
    const paging = parsePaging(query);

    const candidates = await this.userRepository.scanCandidates(SCAN_LIMIT);
    const ids = candidates.map((user) => user._id);

    const [sent, accepted, messages, reports] = await Promise.all([
      this.matchRepository.countsBySender(ids),
      this.matchRepository.countsBySender(ids, { status: "accepted" }),
      this.messageRepository.countsBySenderSince(ids, this.#ago(7, now)),
      this.reportRepository.openCountsByReportedUser(ids),
    ]);

    const toMap = (rows) => new Map(rows.map((row) => [String(row._id), row.count]));
    const sentMap = toMap(sent);
    const acceptedMap = toMap(accepted);
    const messageMap = toMap(messages);
    const reportMap = toMap(reports);

    const flagged = [];
    for (const user of candidates) {
      const key = String(user._id);
      const reasons = reasonsFor(
        user,
        {
          sent: sentMap.get(key) || 0,
          accepted: acceptedMap.get(key) || 0,
          messages: messageMap.get(key) || 0,
          reports: reportMap.get(key) || 0,
        },
        now
      );

      if (reasons.length) flagged.push(toFlaggedRow(user, reasons));
    }

    flagged.sort((a, b) => b.score - a.score);

    return {
      data: flagged.slice(paging.skip, paging.skip + paging.limit),
      pagination: pagingMeta(flagged.length, paging),
      // The scan covers the most recent accounts rather than the whole table.
      // Said out loud so the console can show it, instead of implying the list
      // is exhaustive.
      scanned: candidates.length,
      scanLimited: candidates.length >= SCAN_LIMIT,
    };
  }
}

export default ActivityService;
