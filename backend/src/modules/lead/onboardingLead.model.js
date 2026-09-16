import mongoose from "mongoose";

const { Schema } = mongoose;

// Someone who answered the intake questions but never created an account.
//
// The intake forms record their answers in a Google Sheet and then hand the
// visitor a questionnaire URL. That sheet is where the row lives, but it is not
// something the backend can query, so an abandoned signup was invisible to us:
// nothing here knew the person existed until they registered. This collection
// is the server-side copy that makes the drop-off addressable — it exists so
// src/shared/jobs/onboardingNudge.js can find people who answered the questions,
// never finished, and still have no account (email 20).
//
// Deliberately a third lead model, alongside src/modules/lead/lead.model.js (outbound leads
// scraped for Slack triage) and src/modules/lead/resourceLead.model.js (Resource Center
// downloads). This one is a half-finished signup, has a resume link, and is
// consumed by a cron rather than answered immediately.
//
// PRIVACY: `location` carries the coordinates the visitor picked, and unlike
// User.location.coordinates it is NOT select:false. That is safe only because
// this collection is write-only from the public capture endpoint and is never
// serialised back to a client — the cron reads it in-process to pick nearby
// families and nothing else. Do not add a read route that returns these docs.
const onboardingLeadSchema = new Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  },

  name: { type: String, trim: true, default: "" },

  // Which intake form they came from. Decides the copy and the resume link.
  source: {
    type: String,
    enum: ["family-match", "caregiver-job", "caregiver-share"],
    default: "family-match",
  },

  // The Google Sheet record id minted by the intake form. It is also the `:id`
  // segment of the questionnaire URL, so it is what lets the nudge drop them
  // back exactly where they stopped instead of at the top of the funnel.
  sheetId: { type: String, trim: true, default: "" },

  // Same shape the intake form builds and the User schema stores:
  // { type: "Point", coordinates: [lng, lat], format_location, city, neighborhood }.
  // Stored verbatim so cityOf() and getNearbyFamilies() work on a lead exactly
  // as they do on a user doc.
  location: {
    type: { type: String },
    coordinates: { type: [Number] }, // [lng, lat]
    format_location: String,
    city: String,
    neighborhood: String,
    zip: String,
  },

  // Whatever that particular form asked, as "Label: value | Label: value" —
  // the same convention as the waitlist sheet's Details column. Kept as one
  // string on purpose: adding a question to a form must not mean adding a
  // field here.
  details: { type: String, trim: true, default: "" },

  // Timestamp of the one-time nudge (email 20), set by the cron so an address
  // is emailed at most once. Null means "not yet nudged".
  nudgeSentAt: { type: Date, default: null },

  // Set when the footer unsubscribe link is used by an address with no account
  // — a lead has no notifications.email.* flags to switch off, so the opt-out
  // is recorded here instead. See src/modules/unsubscribe/unsubscribe.module.js.
  unsubscribedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
});

const OnboardingLead = mongoose.model("onboardingLeads", onboardingLeadSchema);

export default OnboardingLead;
