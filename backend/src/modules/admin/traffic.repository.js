import { BaseRepository } from "../../core/database/BaseRepository.js";
import PageView from "../analytics/pageView.model.js";
import TrafficDaily from "../analytics/trafficDaily.model.js";

/**
 * Aggregations over the raw page-view stream.
 *
 * Two properties of this data shape everything below, and both are deliberate:
 *
 *  1. The visitor hash is salted with a daily rotating value, so a stored row
 *     cannot be linked to a person across days. That is a privacy guarantee,
 *     and its cost is that "unique visitors this month" is not computable —
 *     only the sum of daily uniques, which counts a returning visitor again.
 *
 *  2. A view whose duration never arrived (tab closed mid-request, beacon
 *     blocked) has `durationSec: null`. Those are excluded from averages rather
 *     than counted as zero — treating them as instant departures is what makes
 *     a bounce rate read 90% on a site that does not have one.
 */
export class PageViewAnalyticsRepository extends BaseRepository {
  constructor(model = PageView) {
    super(model);
  }

  /** Visits, distinct visitor hashes and distinct sessions in a window. */
  async totals({ from, to }) {
    const match = { createdAt: to ? { $gte: from, $lt: to } : { $gte: from } };

    const [row] = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          visits: { $sum: 1 },
          visitors: { $addToSet: "$visitorId" },
          sessions: { $addToSet: "$sessionId" },
        },
      },
    ]);

    return row ?? null;
  }

  /** Entry views grouped by traffic source. */
  sourceBreakdown(since) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since }, isEntry: true } },
      { $group: { _id: "$source", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
    ]);
  }

  deviceBreakdown(since) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$device", visits: { $sum: 1 } } },
    ]);
  }

  /**
   * Session-level statistics.
   *
   * Views are rolled up per session first, then averaged. Averaging per-view
   * durations instead would weight a twenty-page session twenty times as
   * heavily as a one-page one.
   */
  async sessionStats(since) {
    const [row] = await this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$sessionId",
          pageViews: { $sum: 1 },
          duration: { $sum: { $ifNull: ["$durationSec", 0] } },
          measured: { $sum: { $cond: [{ $ne: ["$durationSec", null] }, 1, 0] } },
        },
      },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          // A session with exactly one page view — the standard definition, and
          // the reason `isEntry`/`isExit` exist on the schema.
          bounces: { $sum: { $cond: [{ $eq: ["$pageViews", 1] }, 1, 0] } },
          totalDuration: { $sum: "$duration" },
          measuredSessions: { $sum: { $cond: [{ $gt: ["$measured", 0] }, 1, 0] } },
          totalPageViews: { $sum: "$pageViews" },
        },
      },
    ]);

    return row ?? null;
  }

  dailyTotals(since) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          visits: { $sum: 1 },
          visitors: { $addToSet: "$visitorId" },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  /** Per-page usage: time on page, clicks, scroll depth, entries and exits. */
  pageUsage({ since, limit }) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$path",
          title: { $first: "$title" },
          views: { $sum: 1 },
          uniqueSessions: { $addToSet: "$sessionId" },
          totalDuration: { $sum: { $ifNull: ["$durationSec", 0] } },
          measured: { $sum: { $cond: [{ $ne: ["$durationSec", null] }, 1, 0] } },
          clicks: { $sum: "$clicks" },
          avgScroll: { $avg: "$maxScrollPct" },
          entries: { $sum: { $cond: ["$isEntry", 1, 0] } },
          exits: { $sum: { $cond: ["$isExit", 1, 0] } },
        },
      },
      { $sort: { views: -1 } },
      { $limit: limit },
    ]);
  }

  referrers({ since, limit = 50 }) {
    return this.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          referrerHost: { $nin: [null, ""] },
          isEntry: true,
        },
      },
      {
        $group: {
          _id: "$referrerHost",
          visits: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
          source: { $first: "$source" },
        },
      },
      { $sort: { visits: -1 } },
      { $limit: limit },
    ]);
  }

  campaigns({ since, limit = 50 }) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since }, "campaign.source": { $ne: null } } },
      {
        $group: {
          _id: {
            source: "$campaign.source",
            medium: "$campaign.medium",
            name: "$campaign.name",
          },
          visits: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      { $sort: { visits: -1 } },
      { $limit: limit },
    ]);
  }
}

/**
 * The nightly rollup.
 *
 * Raw views are dropped by a TTL index after 180 days, so anything older than
 * that exists ONLY here — which is why the rollup job is not optional.
 */
export class TrafficDailyRepository extends BaseRepository {
  constructor(model = TrafficDaily) {
    super(model);
  }

  since(date) {
    return this.find({ date: { $gte: date } }, { sort: { date: 1 }, lean: true });
  }
}

export const pageViewAnalyticsRepository = new PageViewAnalyticsRepository();
export const trafficDailyRepository = new TrafficDailyRepository();
