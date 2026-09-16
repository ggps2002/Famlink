import mongoose from "mongoose";

const { Schema } = mongoose;

// First-party web analytics: one row per page view.
//
// Everything the traffic and page-usage screens report — visits, unique
// visitors, sources, top pages, session duration, bounce rate, drop-off — is
// derived from this one collection by aggregation. There is no separate
// "sessions" table: a session is a group of rows sharing a `sessionId`, and
// deriving it means the two views can never disagree about what a session was.
//
// PRIVACY. This is a site used by families with young children, so the
// collection is built to be un-deanonymisable by design rather than by policy:
//
//   * No IP address is stored. `visitorId` is a salted hash computed at
//     ingest (src/modules/analytics/analytics.util.js) and the salt rotates daily, so two
//     visits a week apart cannot be joined back to one person, and the raw
//     address never reaches the database.
//   * No query strings. A path like /share/aBc123 is stored, but
//     ?email=someone@example.com is stripped at ingest — marketing links carry
//     addresses and they must not end up here.
//   * `userId` is only set for a signed-in session and is what makes the
//     per-user activity view possible. Anonymous rows stay anonymous.
//
// The TTL below is part of that: raw views are for recent behaviour, not a
// permanent record of who read what.
const pageViewSchema = new Schema({
  // Groups the views of one visit. Minted client-side per tab session and sent
  // with each beacon.
  sessionId: { type: String, required: true, index: true },

  // Daily-salted hash — see the note above. Counts unique visitors within a day
  // and deliberately cannot do so across days.
  visitorId: { type: String, required: true, index: true },

  // Set only when the beacon carried a valid auth token. Null for logged-out
  // traffic, which is most of it.
  userId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
    index: true,
  },

  // Pathname only, query and hash stripped, lowercased, no trailing slash.
  path: { type: String, required: true, index: true },

  // A human label for the screen ("Nanny Share Search"), sent by the client so
  // the top-pages table doesn't read as a list of URLs.
  title: { type: String, trim: true, default: "" },

  // The referring origin, host only — never the full referring URL, which can
  // itself carry a query string belonging to another site.
  referrerHost: { type: String, default: null },

  // How they arrived. Classified at ingest from the referrer host and the utm_*
  // parameters, before the query string is discarded.
  //   direct   — no referrer
  //   organic  — a search engine
  //   social   — a social network
  //   referral — any other site
  //   campaign — carried utm_source / utm_medium
  //   internal — same-origin navigation within a session
  source: {
    type: String,
    enum: ["direct", "organic", "social", "referral", "campaign", "internal"],
    default: "direct",
    index: true,
  },

  // The utm_source / utm_medium / utm_campaign trio, when present. Kept because
  // they are the only part of a query string that is about the campaign rather
  // than about the person.
  campaign: {
    source: { type: String, default: null },
    medium: { type: String, default: null },
    name: { type: String, default: null },
  },

  device: {
    type: String,
    enum: ["mobile", "tablet", "desktop", "unknown"],
    default: "unknown",
  },

  // Seconds spent on this page, sent by the client when the view ends (on
  // navigation away or page hide). Null while a view is still open, which is
  // why the duration aggregations must filter it out rather than treat it as 0
  // — counting open views as instant departures is what makes a bounce rate
  // read 90% when it isn't.
  durationSec: { type: Number, default: null },

  // Interaction counters. `clicks` is what the page-usage view reads to
  // distinguish a page people read from one they act on; `maxScrollPct` is how
  // far down they got.
  clicks: { type: Number, default: 0 },
  maxScrollPct: { type: Number, default: 0 },

  // First view of its session. Makes the entry-page and bounce aggregations a
  // simple match instead of a per-session sort.
  isEntry: { type: Boolean, default: false, index: true },

  // Last view of its session, set when a later view in the same session arrives
  // or when the client sends its exit beacon. Drives the drop-off report.
  isExit: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now, index: true },
});

// The shapes the analytics screens actually query.
pageViewSchema.index({ createdAt: -1, source: 1 });
pageViewSchema.index({ path: 1, createdAt: -1 });
pageViewSchema.index({ sessionId: 1, createdAt: 1 });

// Raw views expire after 180 days. The dashboards that need longer history read
// the rolled-up daily counts (src/modules/analytics/trafficDaily.model.js), which the nightly
// rollup writes and which hold no per-visitor identifier at all.
//
// This index is what keeps the collection from being the largest thing in the
// database — a moderately busy site writes more rows here than every other
// collection combined.
pageViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const PageView = mongoose.model("pageviews", pageViewSchema);

export default PageView;
