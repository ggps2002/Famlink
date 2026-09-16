import mongoose from "mongoose";

const { Schema } = mongoose;

/* ---------------- LOCATION ---------------- */
const locationSchema = new Schema({
  type: {
    type: Schema.Types.String,
    enum: ["Point"],
    required: false,
  },
  coordinates: {
    type: [Number], // [lng, lat]
    required: false,
    // Opt-in only. This is the exact latitude and longitude of a home, in a
    // product used by families with young children and the people who care for
    // them, so it is the one field in the schema that must never travel by
    // accident.
    //
    // `select: false` inverts the default for any query that does not name the
    // address: a bare `findById(id)` no longer carries coordinates.
    //
    // Two rules follow from it, and getting the second one wrong takes the site
    // down, so read both before touching a projection here.
    //
    // 1. IT IS NOT SUFFICIENT ON ITS OWN. Projecting the parent path —
    //    `select("location")`, i.e. `{ location: 1 }` — asks MongoDB for the
    //    whole subdocument, and an included parent overrides a child's
    //    `select: false`: the coordinates come back. That is why the
    //    outward-facing projection names the address subpath by subpath
    //    (PUBLIC_LOCATION_PATHS in src/modules/user/user.privacy.js) rather than
    //    selecting `location` whole.
    //
    // 2. NEVER SELECT THE PARENT AND `+location.coordinates` TOGETHER.
    //    `select("location +location.coordinates")` looks like the obvious way
    //    to opt in, and MongoDB REJECTS it: "Path collision at
    //    location.coordinates". The query throws, the route 500s, and the page
    //    goes blank. Rule 1 is why the `+` is unnecessary anyway — selecting
    //    the parent already returns them. Use `+location.coordinates` only when
    //    the parent is NOT in the projection (src/modules/location/mapPins.service.js
    //    is the one such case).
    //
    // Matching is unaffected either way: $near / $geoWithin run against the
    // 2dsphere index and don't depend on the projection.
    select: false,
  },
  format_location: {
    type: Schema.Types.String,
    required: false,
  },
  city: {
    type: Schema.Types.String,
    required: false,
  },
  neighborhood: {
    type: Schema.Types.String,
    required: false,
  },
  distance: {
    type: Schema.Types.String,
    required: false,
  }
});

/* ---------------- REVIEWS ---------------- */
const reviewSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: "bookings",
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
  },
  msg: {
    type: Schema.Types.String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/* ---------------- USER ---------------- */
const userSchema = new Schema({
  name: {
    type: Schema.Types.String,
    required: true,
  },

  email: {
    type: Schema.Types.String,
    required: true,
    unique: true,
  },

  goal: String,

  password: {
    type: Schema.Types.String,
  },

  /* -------- EXISTING -------- */
  sheetId: String,
  hasSubmittedSheetResponse: {
    type: Schema.Types.Boolean,
    default: false,
  },

  location: locationSchema,

  registeredVia: String,
  dob: Date,
  phoneNo: String,
  zipCode: String,

  services: [Schema.Types.String],
  noOfChildren: Schema.Types.Mixed,
  favourite: [Schema.Types.Mixed],

  type: {
    type: Schema.Types.String,
    enum: ["Parents", "Nanny", "Admin"],
    required: true,
  },

  ActiveAt: {
    type: Date,
    required: true,
  },

  online: {
    type: Boolean,
    default: false,
  },

  verified: {
    emailVer: { type: Boolean, default: false },
    phoneVer: { type: Boolean, default: false },
    nationalIDVer: {
      type: String,
      enum: ["false", "underprocess", "true"],
      default: "false",
    },
  },

  imageUrl: String,
  additionalInfo: [Schema.Types.Mixed],

  age: String,
  gender: String,

  // The SHA-256 hash of the current email-verification code, never the code
  // itself — a code is a short-lived password, and a database dump should not
  // contain working ones. The raw value exists only in the email.
  otp: String,
  otpExpiry: Date,

  // Wrong guesses against the current code. Six digits is a million
  // possibilities, which only resists guessing if the number of tries is
  // bounded, and the per-IP rate limit cannot do that on its own — IPs are
  // cheap, this account is not. Reset to 0 whenever a new code is issued, so
  // someone who genuinely mistyped can recover by requesting another.
  otpAttempts: { type: Number, default: 0 },

  // Link-based password reset. We store only the SHA-256 hash of the token; the
  // raw token lives solely in the emailed reset link and expires after 1 hour.
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  /* -------- NOTIFICATIONS -------- */
  //
  // Two email categories, both opt-out. Everyone is subscribed to both on
  // signup (default: true); the only ways off are the Settings screen and the
  // Unsubscribe link in the footer of every email.
  //
  // These replaced eight narrower per-topic flags (newMessage, safetyNoti,
  // tipsAndTricks, …). Nothing distinguished them to the person receiving the
  // mail, and eight switches made "am I still subscribed?" unanswerable at a
  // glance — here and in the admin console. See scripts/migrateEmailPrefs.mjs
  // for how existing users were folded into the two.
  notifications: {
    email: {
      // Account and activity: new messages, match and safety notices,
      // background-check results, new members nearby. The recommended one.
      platformUpdates: { type: Boolean, default: true },
      // Marketing: the weekly resource digest, new articles, re-engagement
      // nudges, launch announcements.
      newsletter: { type: Boolean, default: true },
    },
    sms: {
      type: Boolean,
      default: false,
    },
  },

  /* -------- SUBSCRIPTION -------- */
  stripeId: String,
  subscriptionId: String,
  subscriptionStatus: String,
  premium: {
    type: Boolean,
    default: false,
  },

  // Account state, as set by the admin console.
  //
  //   Active    — normal.
  //   Suspended — a timed pause. `suspendedUntil` says when it lifts, and the
  //               login path restores them automatically once it passes. This
  //               is the sanction for a first offence: reversible, and it
  //               expires without anyone having to remember to undo it.
  //   Block     — indefinite. Only an admin lifts it.
  //   Deleted   — soft-deleted account (see `deletedAt`). The row stays so that
  //               match history, reports and the audit trail still resolve to a
  //               name instead of a dangling id.
  //
  // "Block" keeps its exact spelling because src/modules/admin/adminUser.module.js, the login
  // path and the frontend all compare against that literal string. Renaming it
  // to "Blocked" would silently unblock every currently-blocked account.
  status: {
    type: Schema.Types.String,
    enum: ["Active", "Block", "Suspended", "Deleted"],
    default: "Active",
    required: true,
  },

  // When a suspension lifts. Null for an indefinite block — the two are
  // distinguished by `status`, not by this field.
  suspendedUntil: { type: Date, default: null },
  suspendedAt: { type: Date, default: null },

  // Why the account was blocked or suspended. INTERNAL: this is the admin's own
  // wording and can name a complainant, so it is in neither the public nor the
  // self projection, and the deactivation email deliberately sends generic copy
  // instead of quoting it.
  moderationReason: { type: String, default: null },

  // Soft-delete stamps. Two separate actions, because they are two different
  // requests and conflating them is how a support ticket becomes a data-loss
  // incident:
  //
  //   profileDeletedAt — "take my listing down". Clears the nanny share profile
  //                      and share link; the account, chat history and login
  //                      survive.
  //   deletedAt        — "delete my account". The user can no longer sign in and
  //                      disappears from every member-facing surface.
  //
  // Neither issues a hard delete. A row removed from `users` breaks every
  // message, match request and review that references it, and those belong to
  // the other party as much as to this one.
  profileDeletedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  aboutMe: String,
  reviews: [reviewSchema],

  /* ===================================================== */
  /* 🔥 NEW ADDITIONS (SAFE + NON-BREAKING) */
  /* ===================================================== */

  onboarding: {
    completed: {
      type: Boolean,
      default: false,
    },
    step: {
      type: Number,
      default: 0,
    },
    intent: {
      type: String,
      enum: ["already_with_family", "looking_for_job"],
    },
  },

  nannyProfileCompleted: {
    type: Boolean,
    default: false,
  },

  // Timestamp of the one-time "complete your profile" reminder email.
  // Set by the cron job in src/shared/jobs/completeProfileReminder.js so a user
  // is reminded at most once.
  profileReminderSentAt: {
    type: Date,
    default: null,
  },

  // Most recent time we saw this user active — set on login and on token
  // refresh (src/modules/auth/auth.module.js). A refresh only succeeds within the 7-day refresh
  // window, so this stays fresh for anyone actually using the app and only goes
  // stale once they've genuinely stopped visiting. Powers the re-engagement
  // email (src/shared/jobs/reengagementReminder.js). Null until the first login
  // after this field shipped, so the backlog isn't emailed on deploy.
  lastLogin: {
    type: Date,
    default: null,
  },

  // Timestamp of the last re-engagement ("we miss you") email we sent. Guards
  // against re-nudging the same inactive user every day: they become eligible
  // again only after they log in (which pushes lastLogin past this). Set by the
  // re-engagement cron.
  reengagementSentAt: {
    type: Date,
    default: null,
  },

  // When we asked this member what they think of FamLink (email 15). Unlike
  // `reengagementSentAt` this is once per ACCOUNT, never reset: the email asks
  // an open question, and asking the same person the same question twice reads
  // as nobody having listened the first time. Set by
  // src/shared/jobs/feedbackRequest.js.
  feedbackRequestSentAt: {
    type: Date,
    default: null,
  },

  matchRequestsSent: {
    type: Number,
    default: 0,
  },

  /* -------- TERMS & CONDITIONS ACCEPTANCE -------- */
  // When this user agreed, and to which version (src/modules/legal/terms.model.js `version`).
  //
  // The version number is the point of this. Recording only a date says the
  // user accepted *something* on a Tuesday; when the terms change and a dispute
  // turns on which text they agreed to, only the version answers it. Terms rows
  // are append-only for the same reason.
  //
  // Null for every account created before this shipped. That is honest rather
  // than convenient — backfilling a date would be inventing a consent record —
  // and the console shows those as "not recorded" instead of pretending.
  termsAcceptedAt: { type: Date, default: null },
  termsAcceptedVersion: { type: Number, default: null },

  /* -------- ACTIVITY -------- */
  // Lifetime successful logins. The denominator for "activity frequency": that
  // figure is derived, not stored, as logins per week since `createdAt`, so it
  // stays correct without a nightly job recomputing it.
  loginCount: { type: Number, default: 0 },

  // Distinct days on which this user has been seen. Incremented by the login
  // path only when `lastLogin` was on an earlier calendar day, so someone who
  // logs in six times on Monday counts as one active day rather than six — the
  // difference between "engaged" and "having trouble staying signed in".
  activeDays: { type: Number, default: 0 },

  // Set by the admin console when an account is flagged as suspicious, so the
  // moderation queue can surface it without a report being filed. Cleared when
  // an admin clears it.
  suspiciousFlaggedAt: { type: Date, default: null },
  suspiciousReason: { type: String, default: null },

  shareSetupCompleted: {
    type: Boolean,
    default: false,
  },

  /* -------- REFERRALS -------- */
  // Caregivers (Nanny + hasFamily === false) don't pay to keep matching — they
  // refer a friend instead. Each friend who signs up with their code AND
  // completes their profile grants one month of matching, so referring someone
  // monthly keeps them permanently free.
  // See src/modules/referral/referral.util.js for the credit + expiry rules.

  // This user's own share code, e.g. "FAM7K2QX". Assigned on registration;
  // `sparse` so the pre-existing users without one don't collide on null.
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
  },

  // When the code was minted — the moment the referral link came into
  // existence.
  //
  // Not derivable from anything else. Most codes are assigned during
  // registration, but `ensureReferralCode` also backfills one the first time an
  // older account opens the referral screen, so `createdAt` on the user is the
  // wrong answer for exactly the accounts where the question is interesting.
  // Null on codes minted before this was recorded; the console says "not
  // recorded" rather than substituting the signup date.
  referralCodeCreatedAt: {
    type: Date,
    default: null,
  },

  // Who referred this user, resolved from the code they signed up with.
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },

  // When this user's signup actually paid out to their referrer. The reward
  // lands on profile completion, not registration, so a throwaway email alone
  // earns nothing. Null while the referral is still pending.
  //
  // This is also the idempotency guard: profile completion runs through an
  // upsert that a user can trigger repeatedly, so the credit is claimed by
  // atomically setting this field and only pays out if that claim wins.
  referralCreditedAt: {
    type: Date,
    default: null,
  },

  // How many friends have signed up with this user's code. Lifetime count —
  // shown in the UI, never decremented.
  referralCount: {
    type: Number,
    default: 0,
  },

  // Free matching runs until this moment. Each referral pushes it a calendar
  // month further out (stacking from the current expiry when still active, from
  // now when lapsed). Null means the user has never earned a month.
  referralMatchingUntil: {
    type: Date,
    default: null,
  },

  // How many earned months the user has already been shown the in-dashboard
  // "you earned a free month" popup for. When referralCount runs ahead of this,
  // there's an unseen reward to celebrate; acknowledging the popup bumps this up
  // to referralCount so it shows exactly once per referral (across devices).
  referralRewardSeenCount: {
    type: Number,
    default: 0,
  },
});

/* ---------------- INDEX ---------------- */
userSchema.index({ location: "2dsphere" });

/* ---------------- SERIALIZATION GUARD ---------------- */
// Last line of defence for the credentials. Routes decide what a given caller
// may see (src/modules/user/user.privacy.js), but a route that forgets — or a new
// one written next month — must not be able to put a bcrypt hash, a live OTP or
// a password-reset token on the wire. Nothing in the app reads these through
// toJSON/toObject: password checks read `user.password` off the document
// directly, which this does not touch.
const stripCredentials = (_doc, ret) => {
  delete ret.password;
  delete ret.otp;
  delete ret.otpExpiry;
  delete ret.resetPasswordToken;
  delete ret.resetPasswordExpires;
  return ret;
};

userSchema.set("toJSON", { transform: stripCredentials });
userSchema.set("toObject", { transform: stripCredentials });

/* ---------------- MODEL ---------------- */
const User = mongoose.model("users", userSchema);

export default User;