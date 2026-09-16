import EmailLog from "./emailLog.model.js";
import User from "../../modules/user/user.model.js";

// The permanent record of outbound automated email: one row per message, kept
// forever, holding no body.
//
// This is deliberately NOT the queue. The queue (emailQueue.model.js) is
// working state — it holds the rendered body, it is written by the web app, and
// its rows are dropped once they are terminal and stale. This is the history:
// written by the dispatcher at the moment a message reaches a final outcome, so
// "did we ever send her the welcome email, and what happened" has an answer a
// year later.
//
// The retry loop and the SMTP circuit breaker used to live here, wrapped around
// the send. Both now belong to the dispatcher, because retrying is a property
// of the queue rather than of logging — a send that fails is rescheduled on its
// row, not re-attempted inside the call that logged it.

// ── Recipient → account resolution ──
//
// Cache of address → userId. The senders are handed an email address, not a
// user, so linking the row to an account means a lookup per send; the weekly
// digests send hundreds in a loop and would otherwise do hundreds of identical
// queries. Bounded so a long-running process can't grow it without limit.
const userIdCache = new Map();
const CACHE_MAX = 5000;

const resolveUserId = async (email) => {
  const address = String(email || "").trim().toLowerCase();
  if (!address) return null;

  if (userIdCache.has(address)) return userIdCache.get(address);

  let id = null;
  try {
    const user = await User.findOne({ email: address }).select("_id").lean();
    id = user?._id || null;
  } catch {
    // A lookup failure must not stop the email being logged — an orphan row
    // with a recipient and no userId is still the answer to "did we send it".
    return null;
  }

  if (userIdCache.size >= CACHE_MAX) userIdCache.clear();
  userIdCache.set(address, id);
  return id;
};

// Write a row. Never throws, for the same reason the audit logger doesn't: this
// runs after the mail has already gone, and a logging failure must not turn a
// delivered email into an error the caller retries.
export const recordEmail = async ({
  recipient,
  type,
  subject = "",
  status = "accepted",
  messageId = null,
  error = null,
  campaign = null,
  triggeredBy = null,
  userId,
}) => {
  try {
    await EmailLog.create({
      recipient: String(recipient || "").trim().toLowerCase(),
      type,
      subject: String(subject || "").slice(0, 500),
      status,
      messageId,
      // Provider errors can be kilobytes of SMTP transcript; the first few
      // hundred characters carry the code and the reason, which is the part
      // anyone reads.
      error: error ? String(error).slice(0, 500) : null,
      campaign,
      triggeredBy,
      userId: userId !== undefined ? userId : await resolveUserId(recipient),
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("Email log write failed:", err?.message || err);
  }
};


// Record a send that was deliberately not made — an unsubscribed address, a
// notification preference switched off, a user already emailed this week.
//
// Worth a row of its own. Without one, "she never got the digest" looks
// identical to a bug, and the honest answer (she turned it off in March) is not
// recoverable from anywhere.
export const recordSkipped = (recipient, type, reason) =>
  recordEmail({ recipient, type, status: "skipped", error: reason });
