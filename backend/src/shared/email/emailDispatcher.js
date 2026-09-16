import os from "node:os";
import { transporter, verifyTransport } from "./transport.js";
import { recordEmail } from "./emailLog.js";
import {
  claimNext,
  reclaimStale,
  markSent,
  markFailed,
  markCancelled,
  isSuppressed,
  queueStats,
} from "./emailQueue.js";

/**
 * The centralized sender: the one thing in the system that talks to SMTP.
 *
 * Everything else composes a message and writes it to the queue. This drains
 * the queue. The separation is what makes delivery diagnosable — the web app
 * can no longer "send" an email in a way that leaves no trace, because the web
 * app no longer sends email at all.
 *
 * ── Why the retry budget moved ──────────────────────────────────────────────
 * The old arrangement retried three times over about ten seconds, inside the
 * HTTP request that triggered the send. That budget was set by how long a user
 * would wait for a page, which has nothing to do with how long a mail host
 * stays down. Ten seconds covers a dropped socket and nothing else; a provider
 * blip of two minutes — routine — lost the message permanently.
 *
 * Retries now live on the row, so the budget is measured in hours and survives
 * the process. A message is tried, then retried a minute later, then five, then
 * twenty-five, then two hours. Nothing is holding a connection open in between,
 * and a deploy in the middle of that schedule costs nothing.
 */

const DEFAULTS = {
  // How often to look for work when the queue was empty last time. Transactional
  // mail is latency-sensitive, and a poll this cheap (one indexed query) is
  // affordable at this rate.
  pollIntervalMs: Number(process.env.EMAIL_POLL_INTERVAL_MS) || 5000,

  // Messages per pass. Bounded so one machine cannot claim a whole digest run
  // and sit on it while another machine idles — and so `stop()` never waits
  // long for the current pass to finish.
  batchSize: Number(process.env.EMAIL_BATCH_SIZE) || 20,

  // A claim held longer than this is presumed dead and reclaimed. Must exceed
  // the slowest realistic single send: Exchange Online tarpits a throttled
  // mailbox for ~12s before answering, so a socket timeout plus that is the
  // number to beat.
  lockTimeoutMs: Number(process.env.EMAIL_LOCK_TIMEOUT_MS) || 2 * 60 * 1000,

  // First retry delay. Each subsequent attempt multiplies by BACKOFF_FACTOR.
  backoffBaseMs: Number(process.env.EMAIL_BACKOFF_BASE_MS) || 60 * 1000,
  backoffFactor: Number(process.env.EMAIL_BACKOFF_FACTOR) || 5,
  backoffMaxMs: Number(process.env.EMAIL_BACKOFF_MAX_MS) || 2 * 60 * 60 * 1000,

  // See the breaker note below.
  breakerThreshold: Number(process.env.EMAIL_BREAKER_THRESHOLD) || 5,
  breakerCooldownMs: Number(process.env.EMAIL_BREAKER_COOLDOWN_MS) || 10 * 60 * 1000,
};

/* ──────────────────────────── error classification ─────────────────────── */

// 535 is nominally a permanent refusal, but Exchange Online returns it for a
// mailbox that is temporarily throttled or locked out, worded as though the
// password were wrong. It is the case most worth retrying, so it is treated as
// transient rather than taken at its word.
const isAuthFailure = (error) =>
  error?.code === "EAUTH" || Number(error?.responseCode) === 535;

const RETRYABLE_CODES = new Set([
  "EAUTH",
  "ECONNECTION",
  "ESOCKET",
  "ETIMEDOUT",
  "EDNS",
  "EENVELOPE",
]);

const isRetryable = (error) => {
  if (!error) return false;
  if (error.code === "EENVELOPE" && Number(error.responseCode) >= 500) return false;
  if (RETRYABLE_CODES.has(error.code)) return true;
  const status = Number(error.responseCode);
  // 4xx is SMTP's own "try again later"; 5xx means it will never work.
  return (status >= 400 && status < 500) || status === 535;
};

/* ───────────────────────────────── the worker ──────────────────────────── */

export class EmailDispatcher {
  #timer = null;
  #running = false;
  #draining = false;

  // Whether the poll loop is scheduling itself. Starts false; start() flips it.
  #polling = false;

  // Set by stop() so a pass already under way abandons its batch promptly
  // instead of working through all of it while the process is trying to exit.
  // Kept separate from #polling because a pass must be able to run on a
  // dispatcher that was never started — the admin flush endpoint calls tick()
  // directly, and with a single flag that call would silently do nothing.
  #stopRequested = false;

  // Breaker state. Shared across every message this process sends, because the
  // thing it is protecting — the mailbox's submission quota — is shared too.
  #consecutiveAuthFailures = 0;
  #breakerOpenUntil = 0;

  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.transporter = options.transporter || transporter;
    // Identifies the holder of a claim in the queue row. Only ever read by a
    // human working out which machine stalled.
    this.workerId = options.workerId || `${os.hostname()}:${process.pid}`;
  }

  async start() {
    if (this.#polling) return this;
    this.#polling = true;
    this.#stopRequested = false;

    // Reported, not enforced: the queue holds messages safely while the mail
    // host is unreachable, so a failed check is a log line and not a reason to
    // refuse to start.
    verifyTransport().catch(() => {});

    console.log(`[email-dispatcher] started as ${this.workerId}`);
    this.#schedule(0);
    return this;
  }

  async stop() {
    this.#polling = false;
    this.#stopRequested = true;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    // Let an in-flight pass finish so its outcomes are recorded rather than
    // left as stale claims for another machine to reclaim in two minutes.
    while (this.#running) await new Promise((r) => setTimeout(r, 50));
    console.log("[email-dispatcher] stopped");
  }

  #schedule(delayMs) {
    if (!this.#polling) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.tick()
        .catch((error) =>
          console.error("[email-dispatcher] pass failed:", error?.message || error)
        )
        .finally(() => {
          // A pass that did real work polls again immediately — a backlog
          // should drain at the rate the mail host allows, not at the rate of
          // the idle poll. An empty pass waits.
          this.#schedule(this.#draining ? 0 : this.options.pollIntervalMs);
        });
    }, delayMs);
  }

  /**
   * One pass: reclaim what was abandoned, then deliver up to `batchSize`.
   *
   * Exposed rather than private so a test can drive the dispatcher one pass at
   * a time, and so an admin endpoint can flush the queue on demand.
   */
  async tick() {
    if (this.#running) return { skipped: true };
    this.#running = true;
    this.#draining = false;

    let sent = 0;
    let failed = 0;
    let cancelled = 0;

    try {
      const reclaimed = await reclaimStale({ olderThanMs: this.options.lockTimeoutMs });
      if (reclaimed.revived || reclaimed.exhausted) {
        console.warn(
          `[email-dispatcher] reclaimed ${reclaimed.revived} stalled message(s), ` +
            `dead-lettered ${reclaimed.exhausted}`
        );
      }

      for (let i = 0; i < this.options.batchSize; i++) {
        if (this.#stopRequested) break;

        // While the breaker is open nothing is claimed at all. That is the
        // point: a claimed message has already spent an attempt, so claiming
        // during a lockout burns the retry budget on messages that were never
        // going to be sent.
        if (this.#breakerIsOpen()) break;

        const job = await claimNext({ workerId: this.workerId });
        if (!job) break;

        const outcome = await this.#deliver(job);
        if (outcome === "sent") sent++;
        else if (outcome === "cancelled") cancelled++;
        else failed++;
      }

      // A full batch means there is probably more waiting.
      this.#draining = sent + failed + cancelled >= this.options.batchSize;

      if (sent || failed || cancelled) {
        console.log(
          `[email-dispatcher] pass complete — sent: ${sent}, failed: ${failed}, cancelled: ${cancelled}`
        );
      }
      return { sent, failed, cancelled };
    } finally {
      this.#running = false;
    }
  }

  /** Deliver one claimed message and settle its row. Never throws. */
  async #deliver(job) {
    const id = job._id;

    // Checked now rather than when the message was composed: someone who
    // unsubscribes while their digest is queued must not receive it.
    try {
      const suppression = await isSuppressed(job.to, job.category);
      if (suppression) {
        await markCancelled(id, suppression);
        await recordEmail({
          recipient: job.to,
          type: job.type,
          subject: job.subject,
          status: "skipped",
          error: suppression,
          campaign: job.campaign,
          triggeredBy: job.triggeredBy,
          userId: job.userId,
        });
        return "cancelled";
      }
    } catch (error) {
      // An opt-out lookup that fails must not silently become consent. Treat it
      // as a transient failure and try the whole message again later.
      await markFailed(id, {
        error: `opt-out check failed: ${error?.message || error}`,
        retryable: true,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        backoffMs: this.#backoffFor(job.attempts),
      });
      return "failed";
    }

    try {
      const info = await this.transporter.sendMail({
        from: job.from,
        to: job.to,
        subject: job.subject,
        html: job.html,
        ...(job.replyTo ? { replyTo: job.replyTo } : {}),
      });

      this.#consecutiveAuthFailures = 0;

      await markSent(id, { messageId: info?.messageId || null });
      await recordEmail({
        recipient: job.to,
        type: job.type,
        subject: job.subject,
        status: "accepted",
        messageId: info?.messageId || null,
        campaign: job.campaign,
        triggeredBy: job.triggeredBy,
        userId: job.userId,
      });
      return "sent";
    } catch (error) {
      return this.#recordFailure(job, error);
    }
  }

  async #recordFailure(job, error) {
    const retryable = isRetryable(error);
    const reason = error?.message || String(error);

    if (isAuthFailure(error)) this.#noteAuthFailure(error);

    const { retrying } = await markFailed(job._id, {
      error: reason,
      retryable,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      backoffMs: this.#backoffFor(job.attempts),
    });

    // The permanent log gets one row per message, not one per attempt, so it is
    // written only once the message is actually out of road. A row per attempt
    // would make the acceptance rate on the admin console meaningless — every
    // transient blip would count as several failures and one success.
    if (!retrying) {
      await recordEmail({
        recipient: job.to,
        type: job.type,
        subject: job.subject,
        status: "failed",
        error: `[${job.attempts} attempt(s)] ${reason}`,
        campaign: job.campaign,
        triggeredBy: job.triggeredBy,
        userId: job.userId,
      });
      console.error(
        `[email-dispatcher] giving up on ${job.type} → ${job.to}: ${reason}`
      );
    }

    return "failed";
  }

  /**
   * Retry delay for the attempt that just failed, with jitter.
   *
   * Jitter matters more here than it looks: a provider outage fails a hundred
   * queued messages within the same second, and without it all hundred would
   * come back in the same second too — re-tripping whatever limit they hit.
   */
  #backoffFor(attempts) {
    const { backoffBaseMs, backoffFactor, backoffMaxMs } = this.options;
    const raw = backoffBaseMs * backoffFactor ** Math.max(0, attempts - 1);
    const capped = Math.min(raw, backoffMaxMs);
    return Math.round(capped * (0.75 + Math.random() * 0.5));
  }

  /* ───────────────────────────── the breaker ───────────────────────────── */

  /**
   * A throttled mailbox does not recover inside one message's backoff, and
   * every further attempt extends the lockout. After a run of consecutive auth
   * failures, stop claiming for a while and let the provider have the quiet it
   * is asking for.
   *
   * Nothing is lost while the breaker is open — that is the difference from the
   * version this replaces. There, an open breaker failed every send outright,
   * and since a failed send was gone forever, a ten-minute lockout silently
   * destroyed every welcome and match-request email composed in that window.
   * Here the messages simply stay on the queue and go out when it closes.
   */
  #breakerIsOpen() {
    if (Date.now() < this.#breakerOpenUntil) return true;

    // Closing the window also clears the count. Without this the counter stays
    // at or above the threshold forever, so the first auth failure after a
    // cooldown re-opens the breaker immediately — one bad digest run could keep
    // the breaker latched for hours, which is exactly the bug this replaces.
    if (this.#breakerOpenUntil) {
      this.#breakerOpenUntil = 0;
      this.#consecutiveAuthFailures = 0;
      console.log("[email-dispatcher] auth circuit closed, resuming sends");
    }
    return false;
  }

  #noteAuthFailure(error) {
    this.#consecutiveAuthFailures++;
    if (this.#consecutiveAuthFailures < this.options.breakerThreshold) return;

    this.#breakerOpenUntil = Date.now() + this.options.breakerCooldownMs;
    console.error(
      `[email-dispatcher] ${this.#consecutiveAuthFailures} consecutive SMTP auth ` +
        `failures — pausing sends for ${Math.round(this.options.breakerCooldownMs / 60000)} min. ` +
        `Queued mail is held, not dropped. Last error: ${error?.message || error}`
    );
  }

  /** For a health endpoint: queue depth plus this worker's breaker state. */
  async health() {
    return {
      worker: this.workerId,
      breakerOpen: Date.now() < this.#breakerOpenUntil,
      breakerOpensUntil: this.#breakerOpenUntil
        ? new Date(this.#breakerOpenUntil).toISOString()
        : null,
      consecutiveAuthFailures: this.#consecutiveAuthFailures,
      queue: await queueStats(),
    };
  }
}

/**
 * The process-wide dispatcher.
 *
 * A singleton because the SMTP pool and the breaker it guards are per-process
 * resources — two dispatchers in one process would each pace to the mailbox
 * limit and together exceed it. Across *machines* concurrency is fine and
 * intended: the atomic claim in claimNext() is what makes that safe.
 */
export const emailDispatcher = new EmailDispatcher();

/** Job declaration for Server's job runner (see core/Server.js). */
export const startEmailDispatcherJob = () => {
  emailDispatcher.start();
  return { stop: () => emailDispatcher.stop() };
};

export default emailDispatcher;
