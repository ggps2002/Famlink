import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * The outbound email queue: one row per message waiting to be sent.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Until now the web app *was* the mail sender. A route handler called
 * `sendWelcomeEmail(...)`, which opened an SMTP conversation inline and handed
 * the result to `.catch(console.error)`. That has four failure modes, and we hit
 * all four:
 *
 *   1. The message lived only in process memory. nodemailer's pool rate-limits
 *      submission to 25/min over one connection, so a message could sit in an
 *      in-memory queue for minutes. A deploy, a crash, or fly.io stopping an
 *      idle machine (`auto_stop_machines = 'stop'`, `min_machines_running = 0`
 *      in fly.toml) took every queued message with it — and because the send
 *      never reached the transport, not even a `failed` row was written. The
 *      email vanished with no evidence it had ever been attempted.
 *
 *   2. Retries were bounded by the request that triggered them. Three attempts
 *      over ~10 seconds, then gone forever. A mail host down for two minutes —
 *      routine — permanently lost every signup in that window.
 *
 *   3. There was no way to resend. Support could see a `failed` row in the
 *      email log and could do nothing with it.
 *
 *   4. Back-pressure was invisible and shared. A weekly digest run filled the
 *      same in-memory pool queue, so a welcome email for someone signing up at
 *      09:01 on a Wednesday queued behind several hundred digest messages.
 *
 * Writing the message to the database first fixes all four, because the row
 * outlives the request, the process and the machine. The web app's job ends at
 * `insert`; a dispatcher owns delivery (see emailDispatcher.js).
 *
 * ── What is stored, and what is not ─────────────────────────────────────────
 * Unlike emailLog.model.js — which is the permanent record and deliberately
 * holds NO body — a queue row must hold the rendered `html`, because the whole
 * point is that the message survives the process that composed it. That makes
 * this collection materially more sensitive than the log: these bodies contain
 * match details, children's ages and neighbourhood names.
 *
 * So rows are transient by construction. `purgeAt` is set the moment a row
 * reaches a terminal state and a TTL index drops it; the durable record of
 * "was it sent, to whom, when" remains in emaillogs, without the body. Rows
 * that are still pending have no `purgeAt` and are never expired.
 */
const emailQueueSchema = new Schema(
  {
    // ── The message ─────────────────────────────────────────────────────────
    to: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    from: { type: String, required: true, trim: true },
    replyTo: { type: String, trim: true, default: null },
    subject: { type: String, trim: true, default: "" },
    html: { type: String, required: true },

    // ── Classification ──────────────────────────────────────────────────────
    // Same stable template name the email log keys on ("welcome",
    // "match_request"), so a queue row and its log row join on it.
    type: { type: String, required: true, trim: true, index: true },

    // Transactional mail is a reply to something the recipient just did, and is
    // sent even to someone who has opted out of marketing — suppressing a
    // password reset or an OTP because they unsubscribed from the newsletter
    // would lock them out of their own account. Marketing mail is checked
    // against the opt-out at dispatch time. See SUPPRESSIBLE in emailQueue.js.
    category: {
      type: String,
      enum: ["transactional", "marketing"],
      default: "transactional",
      index: true,
    },

    campaign: { type: String, default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "users", default: null, index: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "users", default: null },

    // ── Scheduling ──────────────────────────────────────────────────────────
    // pending   — waiting to be claimed.
    // sending   — a dispatcher holds it. `lockedAt` bounds how long that claim
    //             is believed; see reclaimStale() for why that matters.
    // sent      — the mail server accepted it.
    // failed    — out of attempts, or refused permanently. Kept, and requeueable.
    // cancelled — deliberately not sent (opted out). Never retried.
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    // Lower runs first. Transactional mail is 0 and bulk is 10, so a welcome
    // email composed during a digest run is claimed ahead of the digest's
    // remaining recipients instead of behind them — the exact starvation that
    // made signups during a Wednesday-morning run look like a delivery bug.
    priority: { type: Number, default: 0 },

    // Earliest time this may be claimed. Retries push it forward; a caller can
    // also set it to schedule a send.
    runAt: { type: Date, default: Date.now, index: true },

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },

    // Which dispatcher holds the claim, and since when. `lockedBy` is for
    // diagnosis only — the claim itself is enforced by the atomic status
    // transition in claimNext(), not by comparing this field.
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },

    // ── Outcome ─────────────────────────────────────────────────────────────
    lastError: { type: String, default: null },
    messageId: { type: String, default: null },
    sentAt: { type: Date, default: null },

    // Set only on a terminal row; the TTL index below drops it then. A pending
    // row has no purgeAt and so is never expired out from under the dispatcher.
    purgeAt: { type: Date, default: null },

    /**
     * Optional caller-supplied idempotency key, unique across the collection.
     *
     * The welcome email is the reason this is here: it is sent from two places,
     * once on account creation and again on OTP verification, so an ordinary
     * signup received it twice. Two identical messages minutes apart is exactly
     * what Gmail's bulk classifier reads as a misconfigured sender, which costs
     * deliverability for every *other* message we send to that domain.
     *
     * With `welcome:<userId>` as the key the second insert is rejected by the
     * index, and enqueueEmail() reports the existing row instead of erroring.
     */
    dedupeKey: { type: String, default: null },
  },
  { timestamps: true }
);

// The dispatcher's claim query, in index order: eligible rows by status and
// time, taken best-priority-first. Without this, claiming scans the collection
// once per message — and the claim runs in a tight loop.
emailQueueSchema.index({ status: 1, runAt: 1, priority: 1 });

// Finding claims abandoned by a dead process.
emailQueueSchema.index({ status: 1, lockedAt: 1 });

// Idempotency. Sparse so the overwhelming majority of rows, which pass no key,
// do not all collide on null.
emailQueueSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

// Bodies are dropped once the row is terminal; see the note above.
emailQueueSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

const EmailQueue = mongoose.model("emailqueue", emailQueueSchema);

export default EmailQueue;
