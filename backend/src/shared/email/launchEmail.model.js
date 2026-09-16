import mongoose from "mongoose";
const { Schema } = mongoose;

// The launch announcement, written per city.
//
// The default templates (07/08) say "FamLink just launched near you". That is
// true everywhere and specific nowhere — and the whole point of opening a city
// at a time is that the message can name the neighbourhoods, quote what local
// families are paying, and come from whoever has been talking to them.
//
// So each city gets its own draft, saved between sessions. Without persistence
// an admin composing the Oakland email would lose it the moment they closed the
// dialog, which is the same as not having the feature.
//
// A city with no row here falls back to the built-in templates, so this is
// additive: nothing breaks if nobody ever writes a draft.

const launchEmailSchema = new Schema({
  // Lowercased on write and matched case-insensitively on read, because the
  // city arrives from a geocoded address ("Oakland") and from an admin's typing
  // ("oakland") and both must reach the same draft.
  city: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    index: true,
  },

  // As typed, for display. `city` is the key; this is what the admin sees.
  cityLabel: { type: String, trim: true, default: "" },

  subject: { type: String, trim: true, default: "" },

  // The band above the message: eyebrow chip, headline, subtitle.
  //
  // Plain text, not HTML. The band's appearance comes entirely from its CSS
  // classes, and class attributes do not survive the sanitiser — so storing
  // markup here would mean either weakening that filter or watching the
  // headline lose its styling on save. Empty means "use the standard wording",
  // per field, so a half-filled draft still renders a complete band.
  heroEyebrow: { type: String, trim: true, default: "", maxlength: 80 },
  heroHeadline: { type: String, trim: true, default: "", maxlength: 160 },
  heroSub: { type: String, trim: true, default: "", maxlength: 240 },

  // The button's text and the note under it. Text only — the DESTINATION is
  // never stored, because it is what tells the two audiences apart: someone
  // without an account goes to sign-up, a member goes to the site.
  ctaLabel: { type: String, trim: true, default: "", maxlength: 60 },
  ctaNote: { type: String, trim: true, default: "", maxlength: 120 },

  // Sanitised on write with the same allow-list as the legal documents
  // (src/shared/utils/sanitizeHtml.js). It is admin-authored and goes out to
  // strangers' inboxes, so it gets the same treatment as anything else an admin
  // writes that other people read.
  bodyHtml: { type: String, default: "" },

  // Two audiences, one draft. Members whose area just opened need "your area is
  // now live"; everyone else needs "come and join". Rather than two drafts to
  // keep in sync, the body may contain {{#member}}…{{/member}} and
  // {{#guest}}…{{/guest}} blocks, and only the matching one is kept per
  // recipient. A draft using neither goes to both unchanged.
  //
  // Sending the wrong one asks a long-standing member to sign up again.

  updatedBy: { type: Schema.Types.ObjectId, ref: "users", default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Synchronous, with no `next`. Mongoose 9 dropped callback-style middleware and
// calls hooks with the save arguments instead, so the old callback form threw
// "next is not a function" on every save.
launchEmailSchema.pre("save", function setUpdatedAt() {
  this.updatedAt = new Date();
});

export default mongoose.model("LaunchEmail", launchEmailSchema);
