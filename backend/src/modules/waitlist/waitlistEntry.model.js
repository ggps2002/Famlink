import mongoose from "mongoose";

const { Schema } = mongoose;

// Everyone who finished the intake questions, whether or not we serve their
// area yet and whether or not they went on to create an account.
//
// This is a fourth capture collection and the duplication is deliberate, so
// here is why none of the existing three could answer the question:
//
//   src/modules/lead/onboardingLead.model.js  — only holds people who did NOT create an account,
//                               and is documented as write-only (never read back
//                               to a client), because it stores exact
//                               coordinates unprotected.
//   src/modules/user/user.model.js            — only holds people who DID.
//   src/modules/lead/lead.model.js            — outbound prospects scraped for Slack triage.
//                               Never completed anything.
//
// The waitlist view needs the union, sorted and paged as one list, filtered by
// city, and exported. Doing that across two collections at query time means
// paging two cursors and merging in application code — which is where the
// "export all of Oakland" button quietly starts dropping rows. So capture
// writes here as well, and this collection is the one thing the admin screen
// reads.
//
// One row per email address. Someone who fills in the form, comes back a week
// later and then finally registers is one person on the waitlist, not three.
const waitlistEntrySchema = new Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  },

  name: { type: String, trim: true, default: "" },

  // "Parents" or "Nanny", matching User.type so the two are directly
  // comparable. Not the User enum itself — a waitlist entry can predate any
  // decision about the account, and "Admin" is never a valid answer here.
  userType: {
    type: String,
    enum: ["Parents", "Nanny", "unknown"],
    default: "unknown",
    index: true,
  },

  // Coarse location only: city, region, zip and the formatted string. NO
  // COORDINATES. The admin screen shows a city and filters by one; it never
  // needs a point, and this collection — unlike onboardingLead — IS serialised
  // back to a client, so the exact home location must not be in it to leak.
  location: {
    city: { type: String, trim: true, default: "", index: true },
    region: { type: String, trim: true, default: "" },
    neighborhood: { type: String, trim: true, default: "" },
    zip: { type: String, trim: true, default: "", index: true },
    formatted: { type: String, trim: true, default: "" },
  },

  // Whether their zip falls in the launch radius, resolved at capture time
  // against src/shared/utils/serviceArea.js.
  //
  // Stored rather than computed on read because the radius expands: when a new
  // city opens, the people who were outside it are exactly the people to email,
  // and that list is only recoverable if we recorded where they stood at the
  // time. The admin screen recomputes the live answer separately.
  insideLaunchRadius: { type: Boolean, default: false, index: true },

  // Did they tick the box asking to be told when Famlink opens in their area.
  // Defaults to false and is only ever set by an explicit true from the form.
  //
  // THIS FIELD IS NOT THE ANSWER TO "may we email them" on its own. For a row
  // that converted into an account, the account's own email settings say what
  // the person actually wants — both categories are on from signup, and nobody
  // is shown a waitlist checkbox while registering, so a member's row sits at
  // false while the member is subscribed to everything. Consent is resolved
  // from both in src/modules/waitlist/waitlist.util.js (`resolveEmailConsent` /
  // `emailConsentStages`), and every reader goes through that.
  notifyConsent: { type: Boolean, default: false, index: true },

  // Set when the launch announcement actually went out to them, so re-running a
  // city's send does not mail the same person twice. Null means "still waiting".
  launchNotifiedAt: { type: Date, default: null },

  // Same idea for the city awareness campaign (email 09), kept as its own stamp
  // rather than reusing the one above: they are different emails to different
  // ends, and someone who was told their city opened should still be able to
  // receive an awareness piece later (and vice versa). One stamp for both would
  // silently make the second send skip everyone who got the first.
  awarenessNotifiedAt: { type: Date, default: null },

  // Which funnel they completed.
  source: {
    type: String,
    enum: [
      "family-match",
      "caregiver-job",
      "caregiver-share",
      "waitlist-form",
      "registration",
      "backfill",
      "unknown",
    ],
    default: "unknown",
    index: true,
  },

  // When they finished the intake questions. Distinct from `createdAt`: the
  // backfill writes rows long after the fact, and the admin table is sorted and
  // filtered on when the person actually completed, not when we recorded it.
  onboardingCompletedAt: { type: Date, default: Date.now, index: true },

  // Set once they register. Turns the waitlist into a conversion funnel: rows
  // with a userId converted, rows without are still waiting.
  userId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
    index: true,
  },

  // What they actually answered on the way in.
  //
  // The intake forms already build this — "Children: 2 years | Care needed:
  // Full-time | Already have nanny: No" — and post it to the Google Sheet, but
  // it was never kept on our side. So the admin waitlist could tell you someone
  // was waiting in Oakland and nothing about what they were waiting FOR, which
  // is the thing that decides whether two people on the list would actually
  // match each other.
  //
  // Stored twice on purpose:
  //
  //   `raw`     exactly as submitted, so nothing is lost to a parser that
  //             didn't anticipate a question added later.
  //   `answers` split into label/value pairs, because "filter everyone wanting
  //             full-time care in Oakland" is not a question a single string
  //             can answer. Indexed for $elemMatch.
  onboarding: {
    raw: { type: String, trim: true, default: "" },
    answers: {
      type: [
        {
          _id: false,
          label: { type: String, trim: true },
          value: { type: String, trim: true },
        },
      ],
      default: [],
    },
  },

  // Honours the footer unsubscribe for an address with no account, the same way
  // onboardingLead does. Written by src/modules/unsubscribe/unsubscribe.module.js, and it overrules
  // consent from either source — withdrawal outranks every other signal.
  unsubscribedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// The launch-notification query: everyone in a city who consented and hasn't
// been told yet.
waitlistEntrySchema.index({ "location.city": 1, notifyConsent: 1, launchNotifiedAt: 1 });

// "Everyone in this city who answered X" — the query behind the answer filters,
// and the one that makes similarities between waiting families findable.
waitlistEntrySchema.index({ "onboarding.answers.label": 1, "onboarding.answers.value": 1 });

const WaitlistEntry = mongoose.model("waitlistentries", waitlistEntrySchema);

export default WaitlistEntry;
