import { BaseService } from "../../core/http/BaseService.js";
import { percentChange } from "./analyticsAdmin.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const isoDay = (value) => value.toISOString().slice(0, 10);

/**
 * Website traffic and page-usage reporting.
 *
 * Two caveats are repeated in the responses rather than hidden, because a
 * dashboard that quietly reports a wrong number is worse than one that reports
 * none:
 *
 *  1. Unique visitors are per day. The visitor hash is salted with a daily
 *     rotating value, so a returning visitor produces a different hash each day
 *     and is counted again. For any window longer than a day the figure is an
 *     upper bound, and `uniqueVisitorsNote` says so.
 *
 *  2. Duration and bounce only cover measured sessions. A view whose duration
 *     never arrived is excluded rather than counted as zero, and the sample
 *     size ships alongside the average.
 */
export class TrafficService extends BaseService {
  #ago(days, now = Date.now()) {
    return new Date(now - days * DAY_MS);
  }

  async overview({ days: requestedDays, now = Date.now() } = {}) {
    const days = Math.min(365, Math.max(1, parseInt(requestedDays, 10) || 30));
    const since = this.#ago(days, now);

    const [totals, previous, sources, devices, sessionStats] = await Promise.all([
      this.pageViewRepository.totals({ from: since }),
      // The equivalent window immediately before this one, so the headline can
      // show a trend rather than a bare count.
      this.pageViewRepository.totals({ from: this.#ago(days * 2, now), to: since }),
      this.pageViewRepository.sourceBreakdown(since),
      this.pageViewRepository.deviceBreakdown(since),
      this.pageViewRepository.sessionStats(since),
    ]);

    const current = totals ?? {};
    const prior = previous ?? {};
    const stats = sessionStats ?? {};
    const sourceTotal = sources.reduce((sum, row) => sum + row.visits, 0);

    return {
      windowDays: days,
      visits: current.visits || 0,
      visitsChangePct: percentChange(current.visits || 0, prior.visits || 0),

      uniqueVisitors: (current.visitors || []).length,
      uniqueVisitorsNote:
        days > 1
          ? "Counted per day — a returning visitor is counted once per day they visit."
          : null,

      sessions: (current.sessions || []).length,
      sessionsChangePct: percentChange(
        (current.sessions || []).length,
        (prior.sessions || []).length
      ),

      pagesPerSession: stats.sessions
        ? Math.round((stats.totalPageViews / stats.sessions) * 10) / 10
        : 0,

      // Null, not zero, when nothing was measured — an average of no data is
      // not an average of zero.
      avgSessionDurationSec: stats.measuredSessions
        ? Math.round(stats.totalDuration / stats.measuredSessions)
        : null,
      durationSample: stats.measuredSessions || 0,

      bounceRate: share(stats.bounces, stats.sessions),

      sources: sources.map((row) => ({
        // A visit with no referrer is direct traffic, not an unknown.
        source: row._id || "direct",
        visits: row.visits,
        pct: share(row.visits, sourceTotal),
      })),

      devices: devices.map((row) => ({ device: row._id || "unknown", visits: row.visits })),
    };
  }

  /**
   * The daily trend.
   *
   * Reads the nightly rollup, falling back to raw views for recent days it has
   * not covered yet. Raw views are deleted after 180 days by a TTL index, so
   * anything older than that can only come from the rollup — and each row says
   * which source it came from, because the live rows cannot report bounce or
   * duration.
   */
  async trend({ days: requestedDays, now = Date.now() } = {}) {
    const days = Math.min(730, Math.max(7, parseInt(requestedDays, 10) || 90));
    const since = this.#ago(days, now);

    const [rolled, live] = await Promise.all([
      this.trafficDailyRepository.since(since),
      this.pageViewRepository.dailyTotals(since),
    ]);

    const covered = new Set(rolled.map((row) => isoDay(row.date)));

    const series = [
      ...rolled.map((row) => ({
        date: isoDay(row.date),
        visits: row.visits,
        uniqueVisitors: row.uniqueVisitors,
        sessions: row.sessions,
        bounceRate: share(row.bounces, row.sessions),
        avgDurationSec: row.measuredSessions
          ? Math.round(row.totalDurationSec / row.measuredSessions)
          : null,
        newSignups: row.newSignups,
        source: "rollup",
      })),
      ...live
        .filter((row) => !covered.has(row._id))
        .map((row) => ({
          date: row._id,
          visits: row.visits,
          uniqueVisitors: row.visitors.length,
          sessions: row.sessions.length,
          // Not computable from the raw stream in this shape; null rather than
          // a zero that would read as a real measurement.
          bounceRate: null,
          avgDurationSec: null,
          newSignups: 0,
          source: "live",
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return { series, windowDays: days };
  }

  /**
   * Which pages people visit, how long they stay, what they click, and where
   * they leave.
   *
   * `exitRate` is the drop-off signal, and it needs reading in context: high on
   * a checkout step is a problem, the same number on the contact page is the
   * page working.
   */
  async pages({ days: requestedDays, limit: requestedLimit, now = Date.now() } = {}) {
    const days = Math.min(365, Math.max(1, parseInt(requestedDays, 10) || 30));
    const limit = Math.min(200, Math.max(5, parseInt(requestedLimit, 10) || 50));

    const pages = await this.pageViewRepository.pageUsage({
      since: this.#ago(days, now),
      limit,
    });

    return {
      data: pages.map((page) => ({
        path: page._id,
        title: page.title || null,
        views: page.views,
        uniqueSessions: page.uniqueSessions.length,
        avgDurationSec: page.measured ? Math.round(page.totalDuration / page.measured) : null,
        durationSample: page.measured,
        clicks: page.clicks,
        clicksPerView: page.views ? Math.round((page.clicks / page.views) * 100) / 100 : 0,
        avgScrollPct: Math.round(page.avgScroll || 0),
        entries: page.entries,
        exits: page.exits,
        exitRate: share(page.exits, page.views),
      })),
      windowDays: days,
    };
  }

  async referrers({ days: requestedDays, now = Date.now() } = {}) {
    const days = Math.min(365, Math.max(1, parseInt(requestedDays, 10) || 30));
    const since = this.#ago(days, now);

    const [referrers, campaigns] = await Promise.all([
      this.pageViewRepository.referrers({ since }),
      this.pageViewRepository.campaigns({ since }),
    ]);

    return {
      referrers: referrers.map((row) => ({
        host: row._id,
        visits: row.visits,
        sessions: row.sessions.length,
        source: row.source,
      })),
      campaigns: campaigns.map((row) => ({
        source: row._id.source,
        medium: row._id.medium,
        name: row._id.name,
        visits: row.visits,
        sessions: row.sessions.length,
      })),
    };
  }

  /**
   * Run the daily rollup by hand.
   *
   * Normally the cron does it; this exists so a missed night can be recovered
   * without waiting a day. Idempotent — the upsert is keyed on the date, so
   * re-running corrects a day rather than doubling it. Defaults to yesterday,
   * which is the last day that is actually complete.
   */
  async runRollup({ date, now = Date.now() } = {}) {
    const target = date ? new Date(date) : new Date(now - DAY_MS);
    return this.rollupDay(target);
  }
}

export default TrafficService;
