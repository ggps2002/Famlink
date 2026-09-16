import mongoose from "mongoose";

const { Schema } = mongoose;

// Versioned Terms & Conditions (and the other legal documents that behave the
// same way).
//
// The requirement is that editing the terms updates them everywhere the
// platform shows them. The reason that isn't automatic today is that the copy
// lives in a React component (frontend/src/Components/Authority/Terms&Condition.jsx)
// and is quoted again in half a dozen checkboxes and onboarding screens, so
// changing it means a deploy and finding every copy.
//
// So the document moves into the database and every surface reads it from one
// endpoint. Propagation is then not a feature that has to work — it is the only
// possible behaviour, because there is one row to read.
//
// APPEND-ONLY. Publishing an edit writes a NEW document and demotes the old one
// rather than overwriting it. Terms are the thing a user agreed to at a moment
// in time; if a dispute turns on what the text said in March, an UPDATE would
// have destroyed the only answer. `User.termsVersion` records which version
// each person accepted, and that reference is worthless if the old row is gone.
const termsSchema = new Schema({
  // Which legal document this is. One collection rather than three near-identical
  // ones — they are edited by the same screen and read by the same endpoint.
  slug: {
    type: String,
    enum: ["terms", "privacy", "community-guidelines"],
    default: "terms",
    required: true,
    index: true,
  },

  // Monotonic per slug, assigned on publish. This is the value stamped onto
  // `User.termsAcceptedVersion`, so it must never be reused or reordered.
  version: {
    type: Number,
    required: true,
  },

  title: { type: String, trim: true, default: "Terms & Conditions" },

  // The body, as HTML. The admin editor produces it and the public page renders
  // it, so it is sanitised on the way IN (src/shared/utils/sanitizeHtml.js) rather
  // than on the way out — a stored script tag would otherwise run in the browser
  // of every user who opens the terms page.
  content: { type: String, required: true },

  // Shown to users as "Last updated 12 March 2026". Separate from `createdAt`
  // because an admin fixing a typo may not want to claim the document changed
  // substantively, and because a version can be published to take effect later.
  effectiveDate: { type: Date, default: Date.now },

  // Exactly one row per slug has this true. Enforced by the publish transaction
  // in src/modules/admin/terms.module.js, which demotes the incumbent before promoting the
  // new row.
  isPublished: { type: Boolean, default: false, index: true },

  // When true, everyone who accepted an earlier version is asked to accept
  // again — the change was material. A typo fix leaves this false so users
  // aren't re-prompted for nothing.
  requiresReacceptance: { type: Boolean, default: false },

  // Free-text note for the admin history view: "added the cancellation clause".
  changeSummary: { type: String, trim: true, default: "" },

  publishedBy: { type: Schema.Types.ObjectId, ref: "users", default: null },

  createdAt: { type: Date, default: Date.now },
});

// One published document per slug. A partial index rather than a plain unique
// one, because every superseded version also carries a slug and they must be
// allowed to coexist — only `isPublished: true` is exclusive.
termsSchema.index(
  { slug: 1, isPublished: 1 },
  { unique: true, partialFilterExpression: { isPublished: true } }
);

termsSchema.index({ slug: 1, version: -1 }, { unique: true });

const Terms = mongoose.model("terms", termsSchema);

export default Terms;
