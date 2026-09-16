import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The dispatcher is the only thing in the system that talks to SMTP, so these
 * tests are where the delivery rules are pinned down: what gets retried, what
 * gets dead-lettered, what never gets sent at all, and what the breaker does.
 *
 * Everything it touches is mocked. The queue functions are module-level imports
 * rather than injected collaborators — they are a persistence vocabulary, not a
 * policy — so they are mocked at the module boundary, and the transport is
 * injected because a test wants a different one per case.
 */

vi.mock("#src/shared/email/transport.js", () => ({
  transporter: { sendMail: vi.fn() },
  verifyTransport: vi.fn().mockResolvedValue(true),
}));

vi.mock("#src/shared/email/emailLog.js", () => ({
  recordEmail: vi.fn().mockResolvedValue(undefined),
  recordSkipped: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#src/shared/email/emailQueue.js", () => ({
  claimNext: vi.fn(),
  reclaimStale: vi.fn().mockResolvedValue({ revived: 0, exhausted: 0 }),
  markSent: vi.fn().mockResolvedValue(undefined),
  markFailed: vi.fn().mockResolvedValue({ retrying: true }),
  markCancelled: vi.fn().mockResolvedValue(undefined),
  isSuppressed: vi.fn().mockResolvedValue(null),
  queueStats: vi.fn().mockResolvedValue({}),
}));

const { EmailDispatcher } = await import("#src/shared/email/emailDispatcher.js");
const queue = await import("#src/shared/email/emailQueue.js");
const { recordEmail } = await import("#src/shared/email/emailLog.js");

const aJob = (over = {}) => ({
  _id: "job-1",
  to: "sam@example.com",
  from: "FamLink <noreply@famlink.care>",
  replyTo: "support@famlink.care",
  subject: "Welcome to FamLink!",
  html: "<p>hello</p>",
  type: "welcome",
  category: "transactional",
  campaign: null,
  triggeredBy: null,
  userId: "user-1",
  attempts: 1,
  maxAttempts: 5,
  ...over,
});

/** Hand the dispatcher a finite list of jobs, then nothing. */
const queueOf = (...jobs) => {
  const pending = [...jobs];
  queue.claimNext.mockImplementation(async () => pending.shift() || null);
};

const smtpError = (message, props = {}) => Object.assign(new Error(message), props);

const build = (options = {}) => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "<abc@famlink>" });
  const dispatcher = new EmailDispatcher({
    transporter: { sendMail },
    workerId: "test-worker",
    ...options,
  });
  return { dispatcher, sendMail };
};

beforeEach(() => {
  vi.clearAllMocks();
  queue.reclaimStale.mockResolvedValue({ revived: 0, exhausted: 0 });
  queue.isSuppressed.mockResolvedValue(null);
  queue.markFailed.mockResolvedValue({ retrying: true });
});

describe("delivering a message", () => {
  it("sends the claimed row and settles it as sent", async () => {
    queueOf(aJob());
    const { dispatcher, sendMail } = build();

    const result = await dispatcher.tick();

    expect(result).toMatchObject({ sent: 1, failed: 0, cancelled: 0 });
    expect(sendMail).toHaveBeenCalledWith({
      from: "FamLink <noreply@famlink.care>",
      to: "sam@example.com",
      subject: "Welcome to FamLink!",
      html: "<p>hello</p>",
      replyTo: "support@famlink.care",
    });
    expect(queue.markSent).toHaveBeenCalledWith("job-1", { messageId: "<abc@famlink>" });
    expect(recordEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted", type: "welcome", userId: "user-1" })
    );
  });

  it("omits replyTo entirely when the row has none", async () => {
    queueOf(aJob({ replyTo: null }));
    const { dispatcher, sendMail } = build();

    await dispatcher.tick();

    expect(sendMail.mock.calls[0][0]).not.toHaveProperty("replyTo");
  });

  it("stops at batchSize even when more work is waiting", async () => {
    queueOf(aJob(), aJob({ _id: "job-2" }), aJob({ _id: "job-3" }));
    const { dispatcher, sendMail } = build({ batchSize: 2 });

    const result = await dispatcher.tick();

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(2);
  });

  it("does nothing when the queue is empty", async () => {
    queueOf();
    const { dispatcher, sendMail } = build();

    const result = await dispatcher.tick();

    expect(sendMail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, failed: 0, cancelled: 0 });
  });
});

describe("the opt-out gate", () => {
  it("cancels a marketing message to an unsubscribed address without sending it", async () => {
    queueOf(aJob({ type: "weekly_resources", category: "marketing" }));
    queue.isSuppressed.mockResolvedValue("recipient unsubscribed from all email");
    const { dispatcher, sendMail } = build();

    const result = await dispatcher.tick();

    expect(sendMail).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
    expect(queue.markCancelled).toHaveBeenCalledWith(
      "job-1",
      "recipient unsubscribed from all email"
    );
    // Recorded rather than dropped, so "why didn't she get it" has an answer.
    expect(recordEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped", error: "recipient unsubscribed from all email" })
    );
  });

  it("retries the whole message when the opt-out lookup fails, rather than assuming consent", async () => {
    queueOf(aJob({ category: "marketing" }));
    queue.isSuppressed.mockRejectedValue(new Error("mongo down"));
    const { dispatcher, sendMail } = build();

    const result = await dispatcher.tick();

    expect(sendMail).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(queue.markFailed).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ retryable: true })
    );
  });
});

describe("failure handling", () => {
  it("schedules a retry for a transient failure and does not write a log row yet", async () => {
    queueOf(aJob());
    const { dispatcher } = build();
    dispatcher.transporter.sendMail.mockRejectedValue(smtpError("socket hang up", { code: "ESOCKET" }));
    queue.markFailed.mockResolvedValue({ retrying: true });

    const result = await dispatcher.tick();

    expect(result.failed).toBe(1);
    expect(queue.markFailed).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ retryable: true, attempts: 1, maxAttempts: 5 })
    );
    // One row per message, not per attempt — otherwise every transient blip
    // would drag the console's acceptance rate down for no reason.
    expect(recordEmail).not.toHaveBeenCalled();
  });

  it("treats a 5xx refusal as permanent and dead-letters it immediately", async () => {
    queueOf(aJob());
    const { dispatcher } = build();
    dispatcher.transporter.sendMail.mockRejectedValue(
      smtpError("550 5.1.1 Recipient not found", { responseCode: 550 })
    );
    queue.markFailed.mockResolvedValue({ retrying: false });

    await dispatcher.tick();

    expect(queue.markFailed).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ retryable: false })
    );
    expect(recordEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });

  it("treats a 4xx as SMTP's own try-again-later", async () => {
    queueOf(aJob());
    const { dispatcher } = build();
    dispatcher.transporter.sendMail.mockRejectedValue(
      smtpError("451 4.7.1 Try again", { responseCode: 451 })
    );

    await dispatcher.tick();

    expect(queue.markFailed).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ retryable: true })
    );
  });

  it("retries a 535, because Exchange Online returns it for a throttled mailbox", async () => {
    queueOf(aJob());
    const { dispatcher } = build();
    dispatcher.transporter.sendMail.mockRejectedValue(
      smtpError("535 5.7.139 Authentication unsuccessful", { responseCode: 535 })
    );

    await dispatcher.tick();

    expect(queue.markFailed).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ retryable: true })
    );
  });

  it("grows the backoff with each attempt", async () => {
    const { dispatcher } = build({
      backoffBaseMs: 1000,
      backoffFactor: 5,
      backoffMaxMs: 10 ** 9,
    });
    dispatcher.transporter.sendMail.mockRejectedValue(smtpError("nope", { code: "ESOCKET" }));

    queueOf(aJob({ attempts: 1 }));
    await dispatcher.tick();
    const first = queue.markFailed.mock.calls[0][1].backoffMs;

    queueOf(aJob({ attempts: 3 }));
    await dispatcher.tick();
    const third = queue.markFailed.mock.calls[1][1].backoffMs;

    // Jittered ±25%, so compare generously — the property under test is growth.
    expect(third).toBeGreaterThan(first * 5);
  });

  it("caps the backoff", async () => {
    const { dispatcher } = build({
      backoffBaseMs: 1000,
      backoffFactor: 5,
      backoffMaxMs: 5000,
    });
    dispatcher.transporter.sendMail.mockRejectedValue(smtpError("nope", { code: "ESOCKET" }));

    queueOf(aJob({ attempts: 9 }));
    await dispatcher.tick();

    // The cap, plus the upper end of the jitter.
    expect(queue.markFailed.mock.calls[0][1].backoffMs).toBeLessThanOrEqual(5000 * 1.25);
  });
});

describe("the auth circuit breaker", () => {
  const authError = () => smtpError("535 5.7.139 Authentication unsuccessful", { code: "EAUTH" });

  it("stops claiming after a run of consecutive auth failures", async () => {
    const { dispatcher } = build({ breakerThreshold: 3, breakerCooldownMs: 60000, batchSize: 10 });
    dispatcher.transporter.sendMail.mockRejectedValue(authError());
    queueOf(aJob(), aJob({ _id: "b" }), aJob({ _id: "c" }), aJob({ _id: "d" }), aJob({ _id: "e" }));

    await dispatcher.tick();

    // Three failures trip it; the fourth and fifth are never claimed at all.
    expect(dispatcher.transporter.sendMail).toHaveBeenCalledTimes(3);
  });

  it("leaves unsent messages on the queue rather than failing them, while open", async () => {
    const { dispatcher } = build({ breakerThreshold: 1, breakerCooldownMs: 60000, batchSize: 5 });
    dispatcher.transporter.sendMail.mockRejectedValue(authError());
    queueOf(aJob(), aJob({ _id: "b" }), aJob({ _id: "c" }));

    await dispatcher.tick();

    // Exactly one message was touched. The other two were never claimed, so
    // nothing marked them failed and nothing spent an attempt on them — the
    // whole difference from the version this replaces, where an open breaker
    // destroyed every message composed during the lockout.
    expect(queue.markFailed).toHaveBeenCalledTimes(1);
  });

  it("clears the failure count when the cooldown lapses, instead of latching", async () => {
    // The bug this pins down: the previous implementation reset the counter only
    // on a success, so after a cooldown the counter was still at the threshold
    // and the very next auth failure re-opened the breaker for another full
    // cooldown. One bad digest run could keep email dark for hours.
    const { dispatcher } = build({ breakerThreshold: 2, breakerCooldownMs: 0, batchSize: 1 });
    dispatcher.transporter.sendMail.mockRejectedValue(authError());

    queueOf(aJob(), aJob({ _id: "b" }));
    await dispatcher.tick();
    await dispatcher.tick();

    let health = await dispatcher.health();
    expect(health.breakerOpen).toBe(false);

    // With the cooldown elapsed the next pass must actually attempt a send.
    dispatcher.transporter.sendMail.mockResolvedValue({ messageId: "<ok>" });
    queueOf(aJob({ _id: "c" }));
    const result = await dispatcher.tick();

    expect(result.sent).toBe(1);
    health = await dispatcher.health();
    expect(health.consecutiveAuthFailures).toBe(0);
  });

  it("closes on any success", async () => {
    const { dispatcher } = build({ breakerThreshold: 5, batchSize: 2 });
    dispatcher.transporter.sendMail
      .mockRejectedValueOnce(authError())
      .mockResolvedValueOnce({ messageId: "<ok>" });
    queueOf(aJob(), aJob({ _id: "b" }));

    await dispatcher.tick();

    expect((await dispatcher.health()).consecutiveAuthFailures).toBe(0);
  });
});

describe("reclaiming abandoned work", () => {
  it("reclaims stalled rows before claiming new ones", async () => {
    queue.reclaimStale.mockResolvedValue({ revived: 2, exhausted: 1 });
    queueOf();
    const { dispatcher } = build({ lockTimeoutMs: 120000 });

    await dispatcher.tick();

    expect(queue.reclaimStale).toHaveBeenCalledWith({ olderThanMs: 120000 });
  });

  it("will not run two passes at once", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    queueOf(aJob());
    const { dispatcher } = build();
    dispatcher.transporter.sendMail.mockReturnValue(gate);

    const first = dispatcher.tick();
    const second = await dispatcher.tick();

    expect(second).toEqual({ skipped: true });
    release({ messageId: "<ok>" });
    await first;
  });
});
