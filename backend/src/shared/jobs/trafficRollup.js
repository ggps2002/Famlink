import cron from "node-cron";

import PageView from "../../modules/analytics/pageView.model.js";
import TrafficDaily from "../../modules/analytics/trafficDaily.model.js";
import User from "../../modules/user/user.model.js";

// Nightly rollup of raw page views into one row per day.
//
// Two things depend on this running. The obvious one is speed: a year-long
// traffic chart against the raw collection scans every row the site has ever
// written. The less obvious one is that raw views are deleted after 180 days by
// a TTL index — so any history older than that exists ONLY if this job wrote
// it. A rollup that silently stops means history quietly disappears six months
// later, which is why the failure path logs loudly rather than passing.

const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight UTC of the given day, and midnight of the next. UTC throughout
// rather than local time: fly.io machines run in UTC, the TTL index is UTC, and
// a rollup that used local boundaries would double-count or skip an hour twice
// a year at daylight-saving transitions.
const dayBounds = (date) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
};

/**
 * Summarise one day. Idempotent — keyed on the date with an upsert, so
 * re-running for a day already covered corrects it rather than doubling it.
 */
export const rollupDay = async (date = new Date(Date.now() - DAY_MS)) => {
  const { start, end } = dayBounds(date);
  const range = { createdAt: { $gte: start, $lt: end } };

  const [sessionRows, sourceRows, pageRows, uniqueVisitors, newSignups] = await Promise.all([
    // Roll views up per session first, then summarise the sessions. Bounce and
    // duration are session properties; computing them from views directly gets
    // both wrong.
    PageView.aggregate([
      { $match: range },
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
          bounces: { $sum: { $cond: [{ $eq: ["$pageViews", 1] }, 1, 0] } },
          totalDurationSec: { $sum: "$duration" },
          measuredSessions: { $sum: { $cond: [{ $gt: ["$measured", 0] }, 1, 0] } },
          visits: { $sum: "$pageViews" },
        },
      },
    ]),
    PageView.aggregate([
      { $match: { ...range, isEntry: true } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]),
    PageView.aggregate([
      { $match: range },
      {
        $group: {
          _id: "$path",
          title: { $first: "$title" },
          views: { $sum: 1 },
          totalDuration: { $sum: { $ifNull: ["$durationSec", 0] } },
          measured: { $sum: { $cond: [{ $ne: ["$durationSec", null] }, 1, 0] } },
        },
      },
      { $sort: { views: -1 } },
      // Capped so a rollup row stays bounded. The tail of a path distribution
      // is noise, and keeping all of it would make this document grow with the
      // site's URL count forever.
      { $limit: 50 },
    ]),
    PageView.distinct("visitorId", range),
    User.countDocuments({ ...range, type: { $in: ["Parents", "Nanny"] } }),
  ]);

  const totals = sessionRows[0] || {};

  const doc = {
    date: start,
    visits: totals.visits || 0,
    // Distinct hashes within this one day. Meaningful precisely because the
    // salt is constant for a day and rotates after it — see
    // src/modules/analytics/analytics.util.js.
    uniqueVisitors: uniqueVisitors.length,
    sessions: totals.sessions || 0,
    bounces: totals.bounces || 0,
    totalDurationSec: totals.totalDurationSec || 0,
    measuredSessions: totals.measuredSessions || 0,
    sources: Object.fromEntries(sourceRows.map((s) => [s._id || "direct", s.count])),
    topPages: pageRows.map((p) => ({
      path: p._id,
      title: p.title || null,
      views: p.views,
      avgDurationSec: p.measured ? Math.round(p.totalDuration / p.measured) : null,
    })),
    newSignups,
    computedAt: new Date(),
  };

  await TrafficDaily.updateOne({ date: start }, { $set: doc }, { upsert: true });

  return { date: start.toISOString().slice(0, 10), visits: doc.visits, sessions: doc.sessions };
};

// Runs at 02:15 UTC, summarising the day that just ended.
//
// Deliberately not midnight: a beacon sent at 23:59:58 can arrive a second or
// two after the hour, and rolling up the instant the day closes would miss it.
// Two hours of slack costs nothing and makes the boundary a non-issue.
export const startTrafficRollupJob = () => {
  cron.schedule(
    "15 2 * * *",
    async () => {
      try {
        const result = await rollupDay();
        console.log(`📊 Traffic rollup for ${result.date}: ${result.visits} views, ${result.sessions} sessions`);
      } catch (error) {
        // Loud. A rollup that has stopped is invisible until someone opens a
        // year-long chart six months from now and finds a gap that can no
        // longer be reconstructed — the raw views are gone by then.
        console.error("❌ TRAFFIC ROLLUP FAILED — historical traffic data will be lost:", error);
      }
    },
    { timezone: "UTC" }
  );

  console.log("📊 Traffic rollup scheduled (02:15 UTC daily)");
};
