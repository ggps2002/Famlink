import mongoose from "mongoose";

const { Schema } = mongoose;

// Nightly rollup of src/modules/analytics/pageView.model.js, one row per calendar day.
//
// Two reasons this exists rather than aggregating raw views on every dashboard
// load. The first is cost: "traffic over the last 12 months" against the raw
// collection is a scan of every row the site has ever written, run again each
// time someone opens the page. The second is that it outlives them — raw views
// are deleted after 180 days by a TTL index, and the year-over-year trend has
// to survive that.
//
// Contains no visitor identifier of any kind. `uniqueVisitors` is a count
// computed at rollup time, not a set that could be intersected with anything,
// which is what makes it safe to keep indefinitely.
const trafficDailySchema = new Schema({
  // Midnight UTC of the day being summarised. Unique — the rollup is an upsert
  // keyed on it, so re-running for a day it already covered corrects that day
  // rather than double-counting it.
  date: { type: Date, required: true, unique: true, index: true },

  visits: { type: Number, default: 0 },
  uniqueVisitors: { type: Number, default: 0 },
  sessions: { type: Number, default: 0 },

  // Sessions with exactly one page view. Stored as a count rather than a rate so
  // a multi-day range can be summed and divided once, instead of averaging
  // percentages — which weights a quiet Sunday the same as a busy Monday.
  bounces: { type: Number, default: 0 },

  // Summed session durations, in seconds, and how many sessions that sum covers.
  // Same reason: keep the numerator and denominator so ranges combine correctly.
  totalDurationSec: { type: Number, default: 0 },
  measuredSessions: { type: Number, default: 0 },

  // Visit counts per acquisition channel, keyed by the `source` enum on
  // pageView. A plain object rather than sub-fields so adding a channel doesn't
  // need a migration.
  sources: { type: Schema.Types.Mixed, default: {} },

  // Top paths for the day: [{ path, title, views, avgDurationSec }]. Capped at
  // 50 by the rollup — the tail is noise and keeping it makes this row unbounded.
  topPages: { type: [Schema.Types.Mixed], default: [] },

  newSignups: { type: Number, default: 0 },

  computedAt: { type: Date, default: Date.now },
});

const TrafficDaily = mongoose.model("trafficdailies", trafficDailySchema);

export default TrafficDaily;
