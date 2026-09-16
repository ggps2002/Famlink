import AdminAction from "./adminAction.model.js";
import { clientIp } from "../../core/http/middleware/rateLimit.js";

// Write one row to the admin audit trail.
//
// NEVER THROWS. This is called at the end of routes that have already done the
// thing being logged — the account is blocked, the profile is gone. Letting a
// failed write bubble would turn a successful moderation action into a 500, the
// admin would retry, and the retry would run the cascade a second time. A
// missing audit row is a real cost; a double delete is a worse one.
//
// It is also deliberately awaited by its callers rather than fired and
// forgotten. The write is a single insert against an indexed collection, and
// the alternative is a response that returns before the trail records what it
// did — which is exactly the window an admin would use if they wanted an action
// to go unrecorded.
export const logAdminAction = async ({
  req,
  action,
  targetUserId = null,
  targetId = null,
  targetType = null,
  reason = "",
  metadata = {},
}) => {
  try {
    await AdminAction.create({
      adminId: req.admin?._id,
      adminEmail: req.admin?.email || "",
      action,
      targetUserId,
      targetId,
      targetType,
      reason: String(reason || "").slice(0, 1000),
      metadata,
      ip: clientIp(req),
      createdAt: new Date(),
    });
  } catch (error) {
    // Loud, because a trail that has quietly stopped recording is worse than no
    // trail at all — it looks like nothing happened.
    console.error(
      `⚠️  AUDIT WRITE FAILED for ${action} by ${req.admin?.email || "unknown"}:`,
      error?.message || error
    );
  }
};

// The destructive actions refuse to run without a stated reason. Enforced here
// rather than route by route so a new one can't be added without the check.
//
// Returns the trimmed reason, or null when it isn't usable — the caller turns
// that into a 400. Ten characters is a low bar chosen to stop "x" and "test"
// while not turning a legitimate "spam account" into a fight with the form.
export const requireReason = (value, min = 10) => {
  const reason = String(value ?? "").trim();
  if (reason.length < min) return null;
  return reason.slice(0, 1000);
};
