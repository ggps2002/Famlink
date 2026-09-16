import { BaseService } from "../../core/http/BaseService.js";
import { scoreProfile, completenessBucket } from "../profile/profileCompleteness.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Real members. Deleted accounts and staff are excluded from every figure. */
const MEMBERS = { status: { $ne: "Deleted" }, type: { $in: ["Parents", "Nanny"] } };

/**
 * Percentage change between two periods.
 *
 * Growing from 0 to 5 reports `null`, not "+500%". A percentage against a zero
 * base is not a number that means anything, and rendering one as a metric
 * invites a decision based on it.
 */
export const percentChange = (current, previous) => {
  if (!previous) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * The at-a-glance platform dashboard, plus the profile-completeness monitor.
 */
export class AnalyticsAdminService extends BaseService {
  #ago(days, now = Date.now()) {
    return new Date(now - days * DAY_MS);
  }

  async overview({ now = Date.now() } = {}) {
    const weekAgo = this.#ago(7, now);
    const monthAgo = this.#ago(30, now);
    const prevWeek = this.#ago(14, now);
    const prevMonth = this.#ago(60, now);

    const [
      totalUsers,
      families,
      caregivers,
      newThisWeek,
      newLastWeek,
      newThisMonth,
      newPrevMonth,
      acceptedRequests,
      totalRequests,
      premiumUsers,
      waitlistTotal,
      waitlistPending,
      openReports,
      openFeedback,
      messagesThisWeek,
      profilesComplete,
    ] = await Promise.all([
      this.userRepository.count(MEMBERS),
      this.userRepository.count({ ...MEMBERS, type: "Parents" }),
      this.userRepository.count({ ...MEMBERS, type: "Nanny" }),
      this.userRepository.count({ ...MEMBERS, createdAt: { $gte: weekAgo } }),
      // The week before this one, so the headline shows a trend rather than a
      // bare count that means nothing on its own.
      this.userRepository.count({ ...MEMBERS, createdAt: { $gte: prevWeek, $lt: weekAgo } }),
      this.userRepository.count({ ...MEMBERS, createdAt: { $gte: monthAgo } }),
      this.userRepository.count({ ...MEMBERS, createdAt: { $gte: prevMonth, $lt: monthAgo } }),
      this.matchRepository.count({ status: "accepted" }),
      this.matchRepository.count({}),
      this.userRepository.count({ ...MEMBERS, premium: true }),
      this.waitlistRepository.count({}),
      // Resolved consent, not the stored flag — the same query the send runs,
      // so this headline and the waitlist screen report one number.
      this.countPendingLaunchRecipients(),
      this.reportRepository.count({ status: { $ne: "resolved" } }),
      this.feedbackRepository.count({ status: { $in: ["new", "in_progress"] } }),
      this.messageRepository.count({ createdAt: { $gte: weekAgo } }),
      this.userRepository.count({ ...MEMBERS, nannyProfileCompleted: true }),
    ]);

    return {
      users: {
        total: totalUsers,
        families,
        caregivers,
        newThisWeek,
        newThisMonth,
        weekOverWeekPct: percentChange(newThisWeek, newLastWeek),
        monthOverMonthPct: percentChange(newThisMonth, newPrevMonth),
      },
      matches: {
        activeMatches: acceptedRequests,
        totalRequests,
        // Of everything ever sent, the share that became a connection — the
        // headline "is this marketplace working" number.
        successRate: share(acceptedRequests, totalRequests),
      },
      subscriptions: {
        premiumUsers,
        conversionRate: share(premiumUsers, totalUsers),
      },
      waitlist: { total: waitlistTotal, awaitingNotification: waitlistPending },
      engagement: {
        messagesThisWeek,
        profilesComplete,
        profileCompletionRate: share(profilesComplete, totalUsers),
      },
      // The two queues with work in them. Surfaced on the front page because an
      // unread harassment report is the one thing here that should not wait for
      // someone to go looking.
      needsAttention: { openReports, openFeedback },
    };
  }

  /**
   * Daily signups and match activity over a window.
   *
   * Every day in the range appears, including the empty ones. An aggregation
   * omits days with no rows, and a chart that simply skips them draws a
   * straight line across a quiet week — which reads as steady growth rather
   * than as nothing happening.
   */
  async growth({ days: requestedDays, now = Date.now() } = {}) {
    const days = Math.min(365, Math.max(7, parseInt(requestedDays, 10) || 90));
    const since = this.#ago(days, now);

    const [signups, matches, priorTotal] = await Promise.all([
      this.userRepository.dailySignupsSince(since),
      this.matchRepository.dailyCountsSince(since),
      // The running total has to start from everyone who already existed, or
      // the cumulative line begins at zero and implies the platform launched
      // at the start of the window.
      this.userRepository.count({ createdAt: { $lt: since }, type: MEMBERS.type }),
    ]);

    const signupByDate = new Map(signups.map((row) => [row._id, row]));
    const matchByDate = new Map(matches.map((row) => [row._id, row]));

    const series = [];
    let cumulative = priorTotal;

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(now - index * DAY_MS).toISOString().slice(0, 10);
      const signup = signupByDate.get(date);
      const match = matchByDate.get(date);

      cumulative += signup?.total || 0;

      series.push({
        date,
        signups: signup?.total || 0,
        families: signup?.families || 0,
        caregivers: signup?.caregivers || 0,
        totalUsers: cumulative,
        matchRequests: match?.requests || 0,
        matchesAccepted: match?.accepted || 0,
      });
    }

    return { series, windowDays: days };
  }

  /**
   * The profile-completeness distribution, plus the people worth chasing.
   *
   * Scored in application code rather than by an aggregation because the rules
   * live in profileCompleteness.js and differ by role — expressing them twice,
   * once in JS and once in a pipeline, guarantees the two answers eventually
   * disagree. The cost is that this reads a bounded slice of members rather
   * than the whole table, which the response states.
   */
  async completeness({ limit: requestedLimit } = {}) {
    const limit = Math.min(5000, Math.max(50, parseInt(requestedLimit, 10) || 1000));

    const users = await this.userRepository.find(MEMBERS, {
      select:
        "_id name email type createdAt imageUrl aboutMe location verified lastLogin nannyProfileCompleted",
      sort: { createdAt: -1 },
      limit,
      lean: true,
    });

    const profiles = await this.profileRepository.findManyByUserIds(
      users.map((user) => user._id),
      { lean: true }
    );
    const byUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    const buckets = { complete: 0, almost: 0, partial: 0, "barely-started": 0 };
    // How often each individual field is the missing one. This is the
    // actionable output: "412 people have no photo" points at a product fix,
    // where a list of 412 individuals to email does not.
    const missingCounts = new Map();
    const incomplete = [];
    let totalPercent = 0;

    for (const user of users) {
      const score = scoreProfile(user, byUser.get(String(user._id)));

      buckets[completenessBucket(score.percent)] += 1;
      totalPercent += score.percent;

      for (const field of score.missing) {
        missingCounts.set(field, (missingCounts.get(field) || 0) + 1);
      }

      if (score.percent < 100) {
        incomplete.push({
          _id: user._id,
          name: user.name,
          email: user.email,
          type: user.type,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          percent: score.percent,
          missing: score.missing,
        });
      }
    }

    // Nearest to done first — the cheapest people to convert with a nudge.
    incomplete.sort((a, b) => b.percent - a.percent);

    return {
      scanned: users.length,
      scanLimited: users.length >= limit,
      averagePercent: users.length ? Math.round(totalPercent / users.length) : 0,
      buckets,
      commonlyMissing: [...missingCounts.entries()]
        .map(([field, count]) => ({ field, count, pct: share(count, users.length) }))
        .sort((a, b) => b.count - a.count),
      incomplete: incomplete.slice(0, 200),
    };
  }
}

export default AnalyticsAdminService;
