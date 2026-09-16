import EmailQueue from "./emailQueue.model.js";
import User from "../../modules/user/user.model.js";
import OnboardingLead from "../../modules/lead/onboardingLead.model.js";
import WaitlistEntry from "../../modules/waitlist/waitlistEntry.model.js";

/**
 * The queue's vocabulary: everything that puts a row in, takes one out, or
 * settles it. Delivery itself lives in emailDispatcher.js — this file knows
 * nothing about SMTP, which is the point. Swapping nodemailer for a provider
 * API changes the dispatcher and leaves every caller untouched.
 */

/* ────────────────────────────── enqueueing ─────────────────────────────── */

// Terminal rows carry a body, so they are kept only as long as anyone would
// plausibly investigate them — see the sensitivity note in emailQueue.model.js.
// The durable record lives in emaillogs, without the body.
const PURGE_AFTER_DAYS = Number(process.env.EMAIL_QUEUE_PURGE_DAYS) || 30;
const purgeDate = (now = new Date()) =>
  new Date(now.getTime() + PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);

/**
 * Put a message on the queue. This is what the web app calls.
 *
 * Returns as soon as the row is written — one indexed insert, not an SMTP
 * round trip — so a request handler can await it honestly instead of the
 * fire-and-forget `.catch(console.error)` these calls used to need. That
 * matters more than the latency: `await enqueueEmail(...)` means a signup that
 * returns 200 has a durable promise of an email behind it, where before it only
 * meant nobody had looked.
 *
 * @param {object}  message
 * @param {string}  message.to
 * @param {string}  message.subject
 * @param {string}  message.html          the fully rendered body
 * @param {string}  message.type          stable template name, e.g. "welcome"
 * @param {string}  [message.from]
 * @param {string}  [message.replyTo]
 * @param {"transactional"|"marketing"} [message.category]
 * @param {string}  [message.campaign]
 * @param {*}       [message.userId]
 * @param {*}       [message.triggeredBy]
 * @param {number}  [message.priority]    lower runs first; bulk should pass 10
 * @param {Date}    [message.runAt]       schedule for later
 * @param {number}  [message.maxAttempts]
 * @param {string}  [message.dedupeKey]   idempotency key, unique collection-wide
 * @returns {Promise<{ id: string, queued: boolean, deduped: boolean }>}
 */
export const enqueueEmail = async ({
  to,
  subject,
  html,
  type,
  from,
  replyTo = null,
  category = "transactional",
  campaign = null,
  userId = null,
  triggeredBy = null,
  priority = 0,
  runAt = new Date(),
  maxAttempts,
  dedupeKey = null,
}) => {
  const recipient = String(to || "").trim().toLowerCase();
  if (!recipient) throw new Error("enqueueEmail: no recipient");
  if (!html) throw new Error(`enqueueEmail: no body for "${type}"`);

  try {
    const row = await EmailQueue.create({
      to: recipient,
      from,
      replyTo,
      subject,
      html,
      type,
      category,
      campaign,
      userId,
      triggeredBy,
      priority,
      runAt,
      ...(maxAttempts ? { maxAttempts } : {}),
      dedupeKey,
    });
    return { id: String(row._id), queued: true, deduped: false };
  } catch (error) {
    // The unique index on dedupeKey did its job: this exact message is already
    // queued or already sent. That is a success from the caller's point of
    // view — the email exists — so report the row we collided with rather than
    // making every call site handle a duplicate-key error it did not ask for.
    if (error?.code === 11000 && dedupeKey) {
      const existing = await EmailQueue.findOne({ dedupeKey }).select("_id").lean();
      return { id: existing ? String(existing._id) : null, queued: false, deduped: true };
    }
    throw error;
  }
};

/* ─────────────────────────────── claiming ──────────────────────────────── */

/**
 * Atomically take the next eligible message.
 *
 * The `findOneAndUpdate` is the whole concurrency design. The status transition
 * and the read happen in one document-level atomic operation, so two
 * dispatchers — two fly.io machines, or an old one still draining during a
 * deploy — cannot both claim the same row. The previous in-memory arrangement
 * had no such guarantee: each process had its own pool, its own rate limiter
 * and its own circuit breaker, so N machines submitted at N times the rate the
 * mailbox allows and tripped exactly the throttling they were pacing to avoid.
 *
 * `attempts` increments on claim rather than on failure, deliberately. A
 * dispatcher that dies mid-send never reports anything, and counting on claim
 * is what stops a message that reliably kills the process from being retried
 * forever.
 */
export const claimNext = async ({ workerId, now = new Date() } = {}) =>
  EmailQueue.findOneAndUpdate(
    { status: "pending", runAt: { $lte: now } },
    {
      $set: { status: "sending", lockedAt: now, lockedBy: workerId || null },
      $inc: { attempts: 1 },
    },
    { sort: { priority: 1, runAt: 1 }, new: true }
  ).lean();

/**
 * Return claims whose holder never came back.
 *
 * A row is left in `sending` when the process holding it stops between the
 * claim and the outcome — a SIGTERM mid-deploy, an OOM, fly stopping the
 * machine. Nothing else would ever move it, so without this the message is
 * stuck forever in a state that reads as "in progress".
 *
 * This is the single largest reliability gain over sending in-process: there,
 * the equivalent message was not stuck, it was *gone*, along with any record
 * that it had existed.
 *
 * The timeout must exceed the longest plausible single send. A row past its
 * attempt budget is not resurrected — it goes to `failed`, where it is visible
 * and can be requeued by hand.
 */
export const reclaimStale = async ({ olderThanMs, now = new Date() }) => {
  const cutoff = new Date(now.getTime() - olderThanMs);

  const [revived, exhausted] = await Promise.all([
    EmailQueue.updateMany(
      {
        status: "sending",
        lockedAt: { $lt: cutoff },
        $expr: { $lt: ["$attempts", "$maxAttempts"] },
      },
      {
        $set: {
          status: "pending",
          lockedAt: null,
          lockedBy: null,
          runAt: now,
          lastError: "Reclaimed: dispatcher did not report an outcome",
        },
      }
    ),
    EmailQueue.updateMany(
      {
        status: "sending",
        lockedAt: { $lt: cutoff },
        $expr: { $gte: ["$attempts", "$maxAttempts"] },
      },
      {
        $set: {
          status: "failed",
          lockedAt: null,
          lockedBy: null,
          lastError: "Abandoned: out of attempts with no outcome reported",
          purgeAt: purgeDate(now),
        },
      }
    ),
  ]);

  return {
    revived: revived.modifiedCount || 0,
    exhausted: exhausted.modifiedCount || 0,
  };
};

/* ────────────────────────────── settlement ─────────────────────────────── */

export const markSent = (id, { messageId = null, now = new Date() } = {}) =>
  EmailQueue.updateOne(
    { _id: id },
    {
      $set: {
        status: "sent",
        sentAt: now,
        messageId,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        purgeAt: purgeDate(now),
      },
    }
  );

/**
 * Record a failed attempt and decide what happens next.
 *
 * `retryable` is the dispatcher's judgement about the SMTP error; this function
 * only applies the attempt budget to it. A permanent rejection — a malformed
 * address, a sender the provider refuses — is dead-lettered on the first
 * attempt, because trying it twice spends submission rate the messages behind
 * it need and produces the identical refusal.
 */
export const markFailed = async (
  id,
  { error, retryable, attempts, maxAttempts, backoffMs, now = new Date() }
) => {
  const reason = String(error || "unknown").slice(0, 1000);
  const giveUp = !retryable || attempts >= maxAttempts;

  if (giveUp) {
    await EmailQueue.updateOne(
      { _id: id },
      {
        $set: {
          status: "failed",
          lockedAt: null,
          lockedBy: null,
          lastError: retryable
            ? `[gave up after ${attempts} attempts] ${reason}`
            : `[permanent] ${reason}`,
          purgeAt: purgeDate(now),
        },
      }
    );
    return { retrying: false };
  }

  const runAt = new Date(now.getTime() + backoffMs);
  await EmailQueue.updateOne(
    { _id: id },
    {
      $set: {
        status: "pending",
        lockedAt: null,
        lockedBy: null,
        lastError: `[attempt ${attempts}] ${reason}`,
        runAt,
      },
    }
  );
  return { retrying: true, runAt };
};

/** Deliberately not sent. Distinct from `failed` so "why didn't she get it" has an answer. */
export const markCancelled = (id, reason, { now = new Date() } = {}) =>
  EmailQueue.updateOne(
    { _id: id },
    {
      $set: {
        status: "cancelled",
        lockedAt: null,
        lockedBy: null,
        lastError: reason,
        purgeAt: purgeDate(now),
      },
    }
  );

/**
 * Put a failed message back on the queue — the "resend" the old design could
 * not offer at any price.
 *
 * The attempt counter is reset, because a human deciding to retry is new
 * information: the usual reason to requeue is that the thing which broke has
 * been fixed.
 */
export const requeue = async (id, { now = new Date() } = {}) => {
  const result = await EmailQueue.updateOne(
    { _id: id, status: { $in: ["failed", "cancelled"] } },
    {
      $set: {
        status: "pending",
        attempts: 0,
        runAt: now,
        lockedAt: null,
        lockedBy: null,
        purgeAt: null,
      },
    }
  );
  return (result.modifiedCount || 0) > 0;
};

/** Depth by status — what a health check and the admin console both want. */
export const queueStats = async () => {
  const rows = await EmailQueue.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));

  // Age of the oldest thing still waiting. Depth alone is ambiguous — a
  // thousand rows draining steadily is healthy and ten rows stuck since
  // Tuesday is not.
  const oldest = await EmailQueue.findOne({ status: "pending" })
    .sort({ runAt: 1 })
    .select("runAt")
    .lean();

  return {
    pending: byStatus.pending || 0,
    sending: byStatus.sending || 0,
    sent: byStatus.sent || 0,
    failed: byStatus.failed || 0,
    cancelled: byStatus.cancelled || 0,
    oldestPendingAt: oldest?.runAt || null,
  };
};

/* ───────────────────────────── opt-out gate ────────────────────────────── */

/**
 * Whether this address has opted out of mail in this category.
 *
 * Checked here, once, at the moment of delivery — not at each of the twenty
 * call sites that compose a message. Two reasons that placement is the right
 * one, and both are about correctness rather than tidiness:
 *
 *   * A message can sit in the queue for minutes or, if the provider is down,
 *     hours. Someone who unsubscribes in that window must not receive what was
 *     composed before they clicked, and only a check at dispatch honours that.
 *   * Before this, the opt-out was enforced by whichever cron job happened to
 *     remember to filter on `notifications.email.platformUpdates`. Every other
 *     sender ignored it entirely, so unsubscribing stopped the weekly digests
 *     and nothing else.
 *
 * Transactional mail is never suppressed. An OTP, a password reset or a match
 * notification is a reply to something the recipient just did; withholding it
 * because they left the newsletter would break their account, and CAN-SPAM's
 * opt-out requirement has never covered it.
 */
export const isSuppressed = async (email, category) => {
  if (category !== "marketing") return null;

  const address = String(email || "").trim().toLowerCase();
  if (!address) return null;

  const user = await User.findOne({ email: address })
    .select("notifications.email status")
    .lean();

  if (user) {
    if (user.status === "Deleted" || user.status === "Deactivated") {
      return `recipient account is ${user.status.toLowerCase()}`;
    }
    // Both categories off is what the one-click unsubscribe link writes.
    // A single category being off is a preference the sender should already
    // have honoured, so it is not second-guessed here.
    const prefs = user.notifications?.email || {};
    if (prefs.platformUpdates === false && prefs.newsletter === false) {
      return "recipient unsubscribed from all email";
    }
    return null;
  }

  // No account: the opt-out was recorded on the lead and waitlist rows instead.
  // See UnsubscribeService — it stamps those precisely so an address with no
  // account still has somewhere to say no. Both are checked because which one
  // carries the stamp depends on how the address reached us, and an opt-out
  // recorded in either place is the same person saying the same thing.
  const [lead, waitlisted] = await Promise.all([
    OnboardingLead.findOne({ email: address, unsubscribedAt: { $ne: null } })
      .select("_id")
      .lean(),
    WaitlistEntry.findOne({ email: address, unsubscribedAt: { $ne: null } })
      .select("_id")
      .lean(),
  ]);

  return lead || waitlisted ? "recipient unsubscribed (no account)" : null;
};

export default {
  enqueueEmail,
  claimNext,
  reclaimStale,
  markSent,
  markFailed,
  markCancelled,
  requeue,
  queueStats,
  isSuppressed,
};
