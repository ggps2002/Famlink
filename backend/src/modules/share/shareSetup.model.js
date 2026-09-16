import mongoose from "mongoose";
const { Schema } = mongoose;

const shareSetupSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },

  /* -------- CURRENT SETUP -------- */
  setupType: {
    type: String,
    enum: ["family_i_work_with", "bringing_own_child"],
  },

  childrenCount: {
    type: String,
    enum: ["1", "2", "3+"],
  },

  childrenAges: [
    {
      type: String,
      enum: ["infant", "toddler", "preschool", "school-age"],
    },
  ],

  location: {
    city: String,
    neighborhood: String,
    coordinates: [Number],
  },

  currentSchedule: {
    type: String,
    // "full-time" or "part-time" — a share is one or the other. "flexible"
    // was removed with the questionnaires that offered it; documents written
    // before that still hold it, and scripts/migrateShareSchedules.mjs folds
    // it into "part-time" along with the other retired answers.
    enum: ["full-time", "part-time"],
  },

  secondFamilyTiming: {
    type: String,
    enum: ["same", "overlap", "gaps", "flexible"],
  },

  childrenTogether: {
    type: String,
    enum: ["yes", "sometimes", "no"],
  },

  /* -------- SHARE DETAILS -------- */
  careLocation: {
    type: String,
    enum: ["current_home", "rotating", "flexible"],
  },

  scheduleFlexibility: {
    type: String,
    enum: ["very", "somewhat", "fixed"],
  },

  hourlyRate: {
    min: Number,
    max: Number,
  },

  /* -------- MATCH PREFERENCES -------- */
  preferredChildType: {
    type: String,
    enum: ["similar_age", "younger", "older", "flexible"],
  },

  preferredDistance: {
    type: String,
    enum: ["1-2", "3-5", "5-10", "flexible"],
  },

  /* -------- TRUST -------- */
  hasTransport: Boolean,
  backgroundCheck: Boolean,

  /* -------- PROFILE -------- */
  description: String,

  certifications: [
    {
      type: String,
      enum: ["cpr", "first_aid", "other"],
    },
  ],

  photo: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("sharesetups", shareSetupSchema);