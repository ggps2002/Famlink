import mongoose from "mongoose";

const { Schema } = mongoose;

// One record per message that tripped the content rules — the "Flagged" tab in
// the admin console reads this collection and nothing else.
//
// ────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NOT A FLAG ON THE MESSAGE DOCUMENT
//
// Two reasons, and the second is the load-bearing one.
//
// 1. Blocked messages were never delivered, so there is no message document to
//    hang a flag on — and a blocked attempt is the single most useful thing on
//    this screen, because it is someone who tried. Writing the attempt into
//    `messages` so it had somewhere to live would mean a row that must be
//    filtered out of every read path forever, and the first query that forgets
//    delivers the content this file exists to stop.
//
// 2. `content` here is a SNAPSHOT taken at send time, not a reference. The
//    sender can delete their message; an admin can delete it as moderation.
//    Either way the evidence of what was sent survives, which is what makes it
//    safe to remove abusive content promptly rather than after a review.
//
// A delivered-but-flagged message also gets `moderation.flagged` set on the
// message itself, so an admin reading the thread sees it in context. That is a
// marker for display. This collection is the record.
// ────────────────────────────────────────────────────────────────────────────

const messageFlagSchema = new Schema({
  // Null when the message was blocked — nothing was ever written to `messages`.
  // A present value means the message was delivered and can still be read in
  // the thread or deleted.
  messageId: {
    type: Schema.Types.ObjectId,
    ref: "messages",
    default: null,
    index: true,
  },

  chatId: { type: Schema.Types.ObjectId, ref: "chats", default: null, index: true },

  // Who sent it. Indexed because "show me everything this account has tripped"
  // is the question asked the moment a second flag appears.
  senderId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
    index: true,
  },

  // Who it was aimed at. Worth storing separately: the person on the receiving
  // end of a blocked message never saw it and never will, so they cannot be the
  // one to report it — this is the only trace that they were the target.
  recipientId: { type: Schema.Types.ObjectId, ref: "users", default: null },

  // What happened to it. "blocked" means the sender got a refusal and the
  // recipient got nothing.
  action: {
    type: String,
    enum: ["flagged", "blocked"],
    required: true,
    index: true,
  },

  // Which rule families fired. An array because one message routinely trips
  // several — a scam setup line next to a WhatsApp handle is the common shape.
  categories: [
    {
      type: String,
      enum: [
        "sexual_content",
        "threat",
        "harassment",
        "vulgar",
        "scam",
        "offsite_contact",
        "unethical",
        "child_safety",
      ],
    },
  ],

  severity: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
    index: true,
  },

  // The additive score from src/modules/messaging/messageModeration.js. Kept so the
  // thresholds can be retuned later against real traffic rather than guesses —
  // without it there is no way to ask "what would a cut-off of 5 have caught".
  score: { type: Number, default: 0 },

  // Rule ids, e.g. ["scam_overpayment", "offsite_contact"]. The specific rule
  // matters when a rule turns out to be noisy: it identifies which one to fix.
  matchedRules: [{ type: String }],

  // The exact substrings that matched. Admin-only, and the reason a moderator
  // can tell a genuine hit from a bad regex in one glance.
  matchedTerms: [{ type: String }],

  // The message as sent. See the note at the top — this outlives the message.
  content: { type: String, default: "" },

  messageType: { type: String, enum: ["Text", "Audio"], default: "Text" },

  /* ── review state ──────────────────────────────────────────────────────
     A flag is not a verdict. Most are noise, some are a pattern, a few are a
     case. These three fields are how an admin clears the queue, and the
     default view is `reviewed: false` so cleared flags stop reappearing. */

  reviewed: { type: Boolean, default: false, index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "users", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, trim: true, default: "" },

  // Set when an admin turns this flag into a case in the reports queue, so the
  // two screens link up and the same incident isn't worked twice.
  reportId: { type: Schema.Types.ObjectId, ref: "reports", default: null },

  createdAt: { type: Date, default: Date.now, index: true },
});

// The queue's default sort: unreviewed, worst first, newest first within that.
// Newest rather than oldest — unlike a report, a flag has nobody waiting on an
// answer, and a scam wave matters while it is happening.
messageFlagSchema.index({ reviewed: 1, severity: -1, createdAt: -1 });
// "Everything this account has tripped, most recent first."
messageFlagSchema.index({ senderId: 1, createdAt: -1 });

const MessageFlag = mongoose.model("messageflags", messageFlagSchema);

export default MessageFlag;
