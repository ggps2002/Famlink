import mongoose from "mongoose";

const { Schema } = mongoose;

// An audit trail of everything an admin does through the console.
//
// The console can block an account, delete a profile, wipe a user, read private
// messages and mail every address in a city. Those are exactly the powers that
// need to be attributable: not because admins are suspected, but because
// "someone deleted this family's account last Tuesday" has to have an answer,
// and because a shared admin login with no trail is indistinguishable from a
// compromised one.
//
// Written by `logAdminAction` (src/modules/admin/adminAudit.js) at the point each
// destructive route succeeds. Read-only from the API — there is no route that
// edits or deletes a row here, and there should never be one.
const adminActionSchema = new Schema({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
    index: true,
  },

  // Denormalised so the trail still reads correctly after the admin account is
  // renamed or removed. A populate that returns null tells you nothing about
  // who acted.
  adminEmail: { type: String, default: "" },

  action: {
    type: String,
    required: true,
    index: true,
    enum: [
      "user.block",
      "user.unblock",
      "user.suspend",
      "user.unsuspend",
      "user.delete_profile",
      "user.delete_account",
      "user.restore",
      "user.plan_change",
      "share_link.toggle",
      "share_link.generate",
      "message.delete",
      // A flagged message promoted into a tracked case in the reports queue.
      "message.escalate",
      "conversation.delete",
      "conversation.flag",
      "report.resolve",
      "report.assign",
      // Pulling the recent messages between two people while working a report.
      // Less invasive than opening the whole thread, but it is still reading
      // private messages, so it leaves the same kind of trace.
      "report.context",
      "terms.publish",
      "waitlist.notify",
      "waitlist.consent_backfill",
      "support.update",
      // Pulling personal data off the platform as a file is worth a record of
      // who did it, the same as a deletion is.
      "export.sheet",
    ],
  },

  // What was acted on. `targetUserId` is separate from `targetId` because the
  // overwhelmingly common question is "what has been done to this user", and
  // that should not require knowing whether the row's target was their account,
  // their profile or one of their messages.
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
    index: true,
  },
  targetId: { type: Schema.Types.ObjectId, default: null },
  targetType: { type: String, default: null },

  // Why. Required by the routes for the destructive actions — the API rejects a
  // block or a delete with no reason, so the trail is never a list of
  // unexplained deletions.
  reason: { type: String, trim: true, default: "" },

  // Anything else worth keeping: the plan a subscription moved between, how
  // many recipients a launch email reached, the counts a cascade deleted.
  // Free-shaped because each action has different particulars and a schema that
  // enumerated them would need editing every time an action is added.
  //
  // Never put message bodies or credentials in here.
  metadata: { type: Schema.Types.Mixed, default: {} },

  ip: { type: String, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
});

adminActionSchema.index({ targetUserId: 1, createdAt: -1 });
adminActionSchema.index({ adminId: 1, createdAt: -1 });

const AdminAction = mongoose.model("adminactions", adminActionSchema);

export default AdminAction;
