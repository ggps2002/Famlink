import mongoose from "mongoose";

const { Schema } = mongoose;

// One row per automated email the platform attempts to send.
//
// This exists because "did she get the waitlist confirmation?" was previously
// unanswerable. The senders in src/shared/email/email.js hand their result to a
// `.catch(console.error)` and the evidence lives in a log file on a fly.io
// machine that gets replaced on every deploy. A support question about a
// missing email had no record to check against.
//
// Written by the transport wrapper (src/shared/email/emailLog.js), not by the
// individual senders, so an email added next month is logged without its author
// remembering to log it.
//
// NOT AN AUDIT LOG OF CONTENT. The rendered HTML is deliberately absent: these
// emails contain match details, children's ages and neighbourhood names, and a
// collection holding a year of them is a far worse thing to leak than the
// mailboxes it describes. What is stored is enough to answer "was it sent, to
// whom, when, and did the server accept it".
const emailLogSchema = new Schema({
  // Lowercased recipient. Indexed because the overwhelmingly common query is
  // "show me everything we ever sent this person" from the user detail drawer.
  recipient: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },

  // Stable machine name for the template, e.g. "waitlist_confirmation".
  // Templates are numbered on disk (Automated Emails/14_waitlist_confirmation.html)
  // but the number is a filing convention that has already been renumbered once,
  // so the log keys on the name instead.
  type: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },

  // The rendered subject line. The one piece of content worth keeping: it is
  // what the recipient will quote back to support, and it carries no private
  // detail that the `type` doesn't already imply.
  subject: { type: String, trim: true, default: "" },

  // accepted  — the SMTP server took it. This is the honest ceiling on what we
  //             can know from here; actual inbox delivery needs provider
  //             webhooks we don't consume yet.
  // failed    — the send threw. `error` says why.
  // skipped   — deliberately not sent: the recipient had unsubscribed, or the
  //             notification preference for this type was off. Recorded rather
  //             than dropped so "why didn't she get it" has an answer.
  status: {
    type: String,
    enum: ["accepted", "failed", "skipped"],
    default: "accepted",
    index: true,
  },

  // Provider message id when the send succeeded — the handle to quote at the
  // email provider's support desk.
  messageId: { type: String, default: null },

  // Failure reason, trimmed. Only set when status is "failed" or "skipped".
  error: { type: String, default: null },

  // The account this went to, when there is one. Waitlist and lead emails go to
  // addresses with no user, so this is nullable by design.
  userId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
    index: true,
  },

  // Set when an admin triggered the send by hand (a launch announcement) rather
  // than it firing from a cron or a user action. Makes a bulk send attributable.
  triggeredBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },

  // Free-form grouping key for a bulk send, e.g. "launch:oakland". Lets the
  // console show one campaign's results together.
  campaign: { type: String, default: null, index: true },

  sentAt: { type: Date, default: Date.now, index: true },
});

// The console's default view is "everything, newest first", filtered by type or
// status. A compound index on the two fields that filter plus the one that
// sorts keeps that page off a collection scan once this table is large — and it
// grows by one row per email forever.
emailLogSchema.index({ type: 1, sentAt: -1 });
emailLogSchema.index({ recipient: 1, sentAt: -1 });

const EmailLog = mongoose.model("emaillogs", emailLogSchema);

export default EmailLog;
