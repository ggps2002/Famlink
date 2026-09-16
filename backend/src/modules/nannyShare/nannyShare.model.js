import mongoose from "mongoose";
const { Schema } = mongoose;

const nannyShareSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },

  // Page 1: Basic Info
  nannyShareType: { type: String }, // "Full-time" or "Part-time" — the only two the questionnaires offer.
  // Not an enum: profiles written before that carry five retired types and
  // three other spellings, and an enum would make them unsaveable. Read it
  // through normalizeShareSchedule (frontend) / shareTypeLabel (email).
  otherShareTypeSpecify: { type: String }, // Optional if "Other" is selected
  hasNanny: { type: String },
  shareLocation: { type: [String] },
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
  childrenAges: { type: [String] }, // e.g., ["2 yrs", "5 yrs"]
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
  careDescription: { type: String }
}, {
  timestamps: true,
});

export default mongoose.model("NannyShare", nannyShareSchema);
