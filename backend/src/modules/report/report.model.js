import mongoose from "mongoose";

const { Schema } = mongoose;

// A user report: harassment, a scam, an inappropriate profile, a suspicious
// account. This is the queue an admin works through.
//
// The design rule here is that a report is never destroyed by acting on it. The
// outcome is appended to the same document, so six months later "what did we do
// about the March complaint against this account" is answerable from one row.
// Deleting the reported user does not delete their report history.

// What an admin did about it. Recorded as a sub-document rather than a status
// string alone, so the queue keeps who decided, when, and on what reasoning.
const resolutionSchema = new Schema(
  {
    action: {
      type: String,
      enum: ["warned", "suspended", "blocked", "deleted", "dismissed"],
      required: true,
    },
    // The admin's own note. Internal — never shown to either party, and never
    // included in the email the reported user receives.
    note: { type: String, trim: true, default: "" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "users" },
    resolvedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reportSchema = new Schema({
  // Who complained. Nullable: an admin can open a case from their own review of
  // flagged content, with nobody having reported it.
  reporterId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },

  // Who the case is about. Always set — a report with no subject has nothing to
  // action.
  reportedUserId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
    index: true,
  },

  // What kind of thing is being reported. `profile` and `user` differ: the
  // first is about what someone wrote, the second about how they behaved.
  targetType: {
    type: String,
    enum: ["user", "profile", "message", "conversation", "activity"],
    default: "user",
    index: true,
  },

  // The message or chat the report points at, when it points at one. Left null
  // for a whole-account report.
  messageId: { type: Schema.Types.ObjectId, ref: "messages", default: null },
  chatId: { type: Schema.Types.ObjectId, ref: "chats", default: null },

  reason: {
    type: String,
    enum: [
      "harassment",
      "scam",
      "inappropriate_content",
      "fake_profile",
      "spam",
      "safety_concern",
      "other",
    ],
    default: "other",
    index: true,
  },

  // What the reporter wrote in their own words.
  details: { type: String, trim: true, default: "" },

  // A copy of the reported message text, taken when the report is filed.
  //
  // Deliberate duplication: the whole value of a harassment report is the
  // message, and the sender can delete it the moment they realise they have
  // been reported. Snapshotting on file means the evidence survives them
  // tidying up.
  evidenceSnapshot: { type: String, trim: true, default: "" },

  status: {
    type: String,
    enum: ["open", "reviewing", "resolved"],
    default: "open",
    index: true,
  },

  // Rough triage weight. Set by the admin; safety concerns arrive as "high"
  // from the report form so they surface at the top of the queue unread.
  priority: {
    type: String,
    enum: ["low", "normal", "high"],
    default: "normal",
    index: true,
  },

  // Which admin picked this up. Stops two people working the same case.
  assignedTo: { type: Schema.Types.ObjectId, ref: "users", default: null },

  // Appended, never replaced — see the note at the top of this file.
  resolution: { type: resolutionSchema, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

// The queue's default sort: open cases, worst first, oldest first within that.
reportSchema.index({ status: 1, priority: -1, createdAt: 1 });

// Mongoose 9 removed callback-style middleware: a hook is now either synchronous
// (returns nothing, throws to fail) or async (returns a promise). It is called
// with the save arguments, NOT with a `next` — so the old `function (next) {
// …; next(); }` form threw "next is not a function" and every save failed.
reportSchema.pre("save", function () {
  this.updatedAt = new Date();
});

const Report = mongoose.model("reports", reportSchema);

export default Report;
