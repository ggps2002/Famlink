import mongoose from "mongoose";
const { Schema } = mongoose;

const nannyProfileSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    unique: true,
  },





  //**FAMILY PROFILE**





  // Page 1: Basic Info
  nannyShareType: { type: String, required: true }, // "Full-time" or "Part-time" — the only two the questionnaires offer.
  // Not an enum: profiles written before that carry five retired types and
  // three other spellings, and an enum would make them unsaveable. Read it
  // through normalizeShareSchedule (frontend) / shareTypeLabel (email).
  otherShareTypeSpecify: { type: String }, // Optional if "Other" is selected
  hasNanny: { type: Boolean, required: true },
  shareLocation: { type: [String], required: true },
  specifyNearbyWorkplace: { type: String },

  // Page 2: Schedule & Hosting
  specificDays: {
    type: Schema.Types.Mixed,
    required: true,
  },
  scheduleNotes: { type: String }, // optional
  flexibility: { type: String }, // Very / Somewhat / Not flexible
  hostingPreference: { type: String }, // Your home, Other home, Rotate, Neutral
  hostingSpecify: { type: String }, // optional "Other" text
  nannyshareStart: { type: String },
  urgency: { type: String },

  // Page 3: Children’s Details
  numberOfChildren: { type: Number },
  childrenAges: [
    {
      label: { type: String },
      value: { type: Number },
      unit: { type: String, enum: ["months", "years"] },
    }
  ],
  childrenSchools: { type: String }, // optional
  allergiesHealth: { type: [String] }, // Food allergies, Asthma, etc.
  allergiesHealthSpecify: { type: String }, // optional

  // Page 4: Responsibilities
  childResponsibilities: { type: [String] }, // Transportation, Homework, Nap, etc.
  householdAddOns: { type: [String] }, // Grocery, Meal prep, Errands, optional
  responsibilitiesNA: { type: Boolean, default: false }, // N/A toggle

  // Page 5: Parenting Style & House Rules
  parentingStyle: { type: [String] }, // Montessori, Attachment, etc.
  parentingStyleSpecify: { type: String },
  houseRules: { type: [String] }, // Screen time, Diet, Hygiene, etc.
  houseRulesSpecify: { type: String },

  // Page 6: Daily Routine / Activities
  dailyRoutine: { type: [String] }, // Nap, Outdoor play, Storytime, Arts & Crafts, etc.
  dailyRoutineNA: { type: Boolean, default: false },

  // Page 7: Budget & Pets
  hourlyBudget: {
    type: Schema.Types.Mixed,
  }, // $10–$15/hr, etc.
  hourlyBudgetSpecify: { type: Number },
  pets: { type: [String], }, // Dog, Cat, None, etc.
  petsSpecify: { type: String },

  // Page 8: Communication & Backup
  communicationPreference: { type: String }, // Chat, Email, Phone, etc.
  communicationSpecify: { type: String }, // optional
  backupCare: { type: String }, // Family, Nanny service, None, etc.
  backupCareSpecify: { type: String }, // optional
  involvementLevel: { type: String }, // Very / Moderate / Minimal

  // Page 9: Open Notes
  openNotes: { type: String }, // optional free-text

  //Miscelleneous
  Seasonal: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  careDescription: { type: String },





  //**CAREGIVER PROFILE**






  careExperience: {
    type: String,
  },

  careType: {
    type: String,
  },
  careDistance: {
    type: String,
  },

  specificDays: {
    type: Schema.Types.Mixed,
  },

  hasFamily: {
    type: Boolean,
    required: true
  },

  /* -------- SHARE COMPATIBILITY -------- */
  shareExperience: String,
  multiFamilyComfort: String,

  childrenCapacity: {
    type: String,
  },

  // AFTER
  preferredAges: [
    {
      label: { type: String },
      min: { type: Number },
      max: { type: Number },
    }
  ],

  forWho: String,
  numChildrenCare: String,
  agesCare: [String],
  currentSchedule: String,
  joinTiming: String,
  together: String,

  workSetup: {
    type: String,
  },

  /* -------- AVAILABILITY -------- */
  // availability: {
  //   type: Schema.Types.Mixed,
  //   required: true,
  // },

  startAvailability: {
    type: String,
  },

  /* -------- ROLE & EXPECTATIONS -------- */
  responsibilities: [
    {
      type: String,
    },
  ],

  householdHelp: {
    type: String,
  },

  /* -------- TRUST -------- */
  hasTransport: String,
  backgroundCheck: String,

  /* -------- PAY -------- */
  sharedRate: String,
  soloRate: String,
  rateType: String,

  budget: {
    type: Schema.Types.Mixed,
  },

  /* -------- PROFILE -------- */
  bio: String,

  certifications: [
    {
      type: String,
    },
  ],

  customCertifications: String,
  skills: String,

  imageFile: String,


  /* -------- PUBLIC SHARE LINK -------- */
  // Opaque token behind /share/:token — the privacy-safe public view of this
  // profile that the owner posts to Facebook groups, WhatsApp, Nextdoor etc.
  // Minted on first use (see src/modules/share/shareProfile.util.js) and never rotated,
  // so a link already out in the world keeps resolving. `sparse` because every
  // profile that predates the feature has no token and they must not collide
  // on null.
  shareToken: {
    type: String,
    unique: true,
    sparse: true,
  },

  // Whether the link currently resolves. The admin console toggles this per
  // user, and the public route checks it before serving anything.
  //
  // Separate from the token on purpose. Revoking by deleting the token would
  // mean the next "enable" mints a new one and every URL already pasted into a
  // Facebook group is dead — so turning a share back on would silently fail to
  // restore it. A boolean makes the switch actually reversible: the same URL
  // goes dark and comes back.
  //
  // Defaults true so every profile that predates this field keeps working; a
  // default of false would take every live share link down on deploy.
  shareEnabled: {
    type: Boolean,
    default: true,
  },

  // Who last flipped the switch and when. The link is a public listing of a
  // family's schedule and children's ages, so "who turned this on" is worth
  // being able to answer.
  shareDisabledAt: { type: Date, default: null },
  shareToggledBy: { type: Schema.Types.ObjectId, ref: "users", default: null },

  // Who minted the token, and when.
  //
  // The same helper serves both paths — a member opening their own share sheet
  // and an admin generating one on their behalf — so without recording it there
  // is no way afterwards to tell a listing the member chose to publish from one
  // the office created for them. That distinction matters: "did they ask for
  // this to be public" is the first question worth asking about a page carrying
  // a family's schedule and their children's ages.
  //
  // Written once, at mint, inside the same atomic update that sets the token
  // (src/modules/share/shareProfile.util.js). Never rewritten — the token is never
  // rotated, so its origin does not change either.
  shareTokenCreatedAt: { type: Date, default: null },

  // "member" when the owner generated it themselves, "admin" when the console
  // did. Null on every profile whose token predates these fields; the console
  // renders that as "Unknown" rather than guessing, because the two cases are
  // genuinely indistinguishable in the stored data.
  shareTokenSource: {
    type: String,
    enum: ["member", "admin", null],
    default: null,
  },

  // The admin who generated it, when the source was the console. Null for
  // member-generated links — the owner is already known from `userId`.
  shareTokenCreatedBy: { type: Schema.Types.ObjectId, ref: "users", default: null },

  // Count of public views, incremented by the public share route. The console
  // shows it so an admin can see which listings are actually getting traffic
  // before spending effort promoting them.
  shareViewCount: { type: Number, default: 0 },
  shareLastViewedAt: { type: Date, default: null },


  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

export default mongoose.model("nannyprofiles", nannyProfileSchema);