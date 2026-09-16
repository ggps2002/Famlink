import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The queue's persistence rules, with the collection mocked.
 *
 * What is worth pinning down here is not that Mongoose was called, but the
 * decisions encoded in the calls: which filter claims a row, what a duplicate
 * key means, when a failure is rescheduled rather than dead-lettered, and who
 * counts as opted out.
 */

const queueModel = {
  create: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
  aggregate: vi.fn(),
};

/** Mongoose's chainable query builder, as much of it as this code uses. */
const chain = (result) => {
  const q = {
    select: vi.fn(() => q),
    sort: vi.fn(() => q),
    limit: vi.fn(() => q),
    lean: vi.fn().mockResolvedValue(result),
  };
  return q;
};

const userModel = { findOne: vi.fn() };
const leadModel = { findOne: vi.fn() };
const waitlistModel = { findOne: vi.fn() };

vi.mock("#src/shared/email/emailQueue.model.js", () => ({ default: queueModel }));
vi.mock("#src/modules/user/user.model.js", () => ({ default: userModel }));
vi.mock("#src/modules/lead/onboardingLead.model.js", () => ({ default: leadModel }));
vi.mock("#src/modules/waitlist/waitlistEntry.model.js", () => ({ default: waitlistModel }));

const {
  enqueueEmail,
  claimNext,
  reclaimStale,
  markFailed,
  requeue,
  isSuppressed,
} = await import("#src/shared/email/emailQueue.js");

beforeEach(() => {
  vi.clearAllMocks();
  queueModel.create.mockResolvedValue({ _id: "row-1" });
  queueModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
  queueModel.updateMany.mockResolvedValue({ modifiedCount: 0 });
  userModel.findOne.mockReturnValue(chain(null));
  leadModel.findOne.mockReturnValue(chain(null));
  waitlistModel.findOne.mockReturnValue(chain(null));
});

describe("enqueueEmail", () => {
  it("normalises the recipient and writes one row", async () => {
    const result = await enqueueEmail({
      to: "  SAM@Example.COM ",
      subject: "Hi",
      html: "<p>x</p>",
      type: "welcome",
      from: "FamLink <noreply@famlink.care>",
    });

    expect(result).toEqual({ id: "row-1", queued: true, deduped: false });
    expect(queueModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sam@example.com", type: "welcome" })
    );
  });

  it("defaults to transactional at the front of the queue", async () => {
    await enqueueEmail({ to: "a@b.c", subject: "s", html: "<p>x</p>", type: "welcome" });

    expect(queueModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: "transactional", priority: 0 })
    );
  });

  it("refuses a message with no recipient", async () => {
    await expect(
      enqueueEmail({ to: "", subject: "s", html: "<p>x</p>", type: "welcome" })
    ).rejects.toThrow(/no recipient/);
    expect(queueModel.create).not.toHaveBeenCalled();
  });

  it("refuses a message with no body, naming the template", async () => {
    await expect(
      enqueueEmail({ to: "a@b.c", subject: "s", html: "", type: "welcome" })
    ).rejects.toThrow(/no body for "welcome"/);
  });

  it("reports the existing row when a dedupe key collides, rather than throwing", async () => {
    queueModel.create.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    queueModel.findOne.mockReturnValue(chain({ _id: "already-queued" }));

    const result = await enqueueEmail({
      to: "a@b.c",
      subject: "Welcome",
      html: "<p>x</p>",
      type: "welcome",
      dedupeKey: "welcome:user-1",
    });

    // The caller asked for an email to exist. One does.
    expect(result).toEqual({ id: "already-queued", queued: false, deduped: true });
  });

  it("still throws a duplicate-key error when no dedupe key was given", async () => {
    queueModel.create.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));

    await expect(
      enqueueEmail({ to: "a@b.c", subject: "s", html: "<p>x</p>", type: "welcome" })
    ).rejects.toThrow("dup");
  });
});

describe("claimNext", () => {
  it("claims the best-priority due row and counts the attempt", async () => {
    queueModel.findOneAndUpdate.mockReturnValue(chain({ _id: "row-1" }));
    const now = new Date("2026-09-17T09:00:00Z");

    await claimNext({ workerId: "worker-a", now });

    const [filter, update, options] = queueModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ status: "pending", runAt: { $lte: now } });
    expect(update.$set).toMatchObject({ status: "sending", lockedBy: "worker-a" });
    // Counted on claim, not on failure: a dispatcher that dies mid-send never
    // reports anything, and this is what stops such a message retrying forever.
    expect(update.$inc).toEqual({ attempts: 1 });
    expect(options.sort).toEqual({ priority: 1, runAt: 1 });
  });
});

describe("reclaimStale", () => {
  it("revives an abandoned claim that still has attempts left", async () => {
    queueModel.updateMany.mockResolvedValue({ modifiedCount: 2 });
    const now = new Date("2026-09-17T09:00:00Z");

    const result = await reclaimStale({ olderThanMs: 120000, now });

    const [reviveFilter, reviveUpdate] = queueModel.updateMany.mock.calls[0];
    expect(reviveFilter.status).toBe("sending");
    expect(reviveFilter.lockedAt.$lt).toEqual(new Date(now.getTime() - 120000));
    expect(reviveFilter.$expr).toEqual({ $lt: ["$attempts", "$maxAttempts"] });
    expect(reviveUpdate.$set.status).toBe("pending");
    expect(result.revived).toBe(2);
  });

  it("dead-letters an abandoned claim that is out of attempts", async () => {
    await reclaimStale({ olderThanMs: 120000 });

    const [filter, update] = queueModel.updateMany.mock.calls[1];
    expect(filter.$expr).toEqual({ $gte: ["$attempts", "$maxAttempts"] });
    expect(update.$set.status).toBe("failed");
    // Terminal, so it becomes eligible for the TTL index.
    expect(update.$set.purgeAt).toBeInstanceOf(Date);
  });
});

describe("markFailed", () => {
  it("reschedules a retryable failure with the given backoff", async () => {
    const now = new Date("2026-09-17T09:00:00Z");

    const result = await markFailed("row-1", {
      error: "socket hang up",
      retryable: true,
      attempts: 2,
      maxAttempts: 5,
      backoffMs: 60000,
      now,
    });

    expect(result).toMatchObject({ retrying: true });
    const update = queueModel.updateOne.mock.calls[0][1];
    expect(update.$set.status).toBe("pending");
    expect(update.$set.runAt).toEqual(new Date(now.getTime() + 60000));
    expect(update.$set.lastError).toBe("[attempt 2] socket hang up");
  });

  it("dead-letters a permanent refusal on the first attempt", async () => {
    const result = await markFailed("row-1", {
      error: "550 no such user",
      retryable: false,
      attempts: 1,
      maxAttempts: 5,
      backoffMs: 60000,
    });

    expect(result).toMatchObject({ retrying: false });
    const update = queueModel.updateOne.mock.calls[0][1];
    expect(update.$set.status).toBe("failed");
    expect(update.$set.lastError).toBe("[permanent] 550 no such user");
  });

  it("dead-letters a retryable failure once the attempt budget is spent", async () => {
    const result = await markFailed("row-1", {
      error: "timeout",
      retryable: true,
      attempts: 5,
      maxAttempts: 5,
      backoffMs: 60000,
    });

    expect(result).toMatchObject({ retrying: false });
    const update = queueModel.updateOne.mock.calls[0][1];
    expect(update.$set.status).toBe("failed");
    expect(update.$set.lastError).toBe("[gave up after 5 attempts] timeout");
  });
});

describe("requeue", () => {
  it("resets the attempt budget, because a human retrying is new information", async () => {
    const ok = await requeue("row-1");

    const [filter, update] = queueModel.updateOne.mock.calls[0];
    expect(filter.status).toEqual({ $in: ["failed", "cancelled"] });
    expect(update.$set).toMatchObject({ status: "pending", attempts: 0, purgeAt: null });
    expect(ok).toBe(true);
  });

  it("reports false when nothing matched — a sent row is not retryable", async () => {
    queueModel.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect(await requeue("row-1")).toBe(false);
  });
});

describe("isSuppressed", () => {
  it("never suppresses transactional mail, whatever the preferences say", async () => {
    // An OTP or a password reset withheld over a newsletter opt-out locks
    // someone out of their own account.
    expect(await isSuppressed("sam@example.com", "transactional")).toBeNull();
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it("suppresses marketing mail for a member who turned everything off", async () => {
    userModel.findOne.mockReturnValue(
      chain({ status: "Active", notifications: { email: { platformUpdates: false, newsletter: false } } })
    );

    expect(await isSuppressed("sam@example.com", "marketing")).toMatch(/unsubscribed/);
  });

  it("allows marketing mail when only one category is off", async () => {
    userModel.findOne.mockReturnValue(
      chain({ status: "Active", notifications: { email: { platformUpdates: false, newsletter: true } } })
    );

    expect(await isSuppressed("sam@example.com", "marketing")).toBeNull();
  });

  it("suppresses mail to a deactivated account", async () => {
    userModel.findOne.mockReturnValue(chain({ status: "Deactivated", notifications: {} }));

    expect(await isSuppressed("sam@example.com", "marketing")).toMatch(/deactivated/);
  });

  it("honours an opt-out recorded on a lead when there is no account", async () => {
    leadModel.findOne.mockReturnValue(chain({ _id: "lead-1" }));

    expect(await isSuppressed("nobody@example.com", "marketing")).toMatch(/no account/);
  });

  it("honours an opt-out recorded on the waitlist when there is no account", async () => {
    waitlistModel.findOne.mockReturnValue(chain({ _id: "wait-1" }));

    expect(await isSuppressed("nobody@example.com", "marketing")).toMatch(/no account/);
  });

  it("allows marketing mail to an address that never opted out", async () => {
    expect(await isSuppressed("nobody@example.com", "marketing")).toBeNull();
  });
});
