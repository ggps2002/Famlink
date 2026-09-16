import { describe, it, expect, vi } from "vitest";
import { ReportsAdminService } from "#src/modules/admin/reports.service.js";
import { NotFoundError, ValidationError } from "#src/core/errors/index.js";

const NOTE = "Repeated harassment of caregivers over rates";

const aReport = (over = {}) => ({
  _id: "r1",
  status: "open",
  reason: "harassment",
  reportedUserId: "u2",
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const build = (over = {}) => {
  const reportRepository = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(aReport()),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue([]),
    updateById: vi.fn().mockResolvedValue(aReport()),
    countsByReportedUser: vi.fn().mockResolvedValue([]),
    priorFor: vi.fn().mockResolvedValue([]),
    ...over.reportRepository,
  };

  const userRepository = {
    findById: vi.fn().mockResolvedValue({ _id: "u2", name: "Sam", email: "sam@example.com" }),
    updateById: vi.fn().mockResolvedValue({}),
    ...over.userRepository,
  };

  const chatRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findOne: vi.fn().mockResolvedValue(null),
    ...over.chatRepository,
  };

  const messageRepository = {
    find: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    ...over.messageRepository,
  };

  const messageFlagRepository = {
    summaryForSender: vi.fn().mockResolvedValue([]),
    ...over.messageFlagRepository,
  };

  const sendAccountDeactivatedEmail = vi.fn().mockResolvedValue(undefined);

  return {
    service: new ReportsAdminService({
      reportRepository,
      userRepository,
      chatRepository,
      messageRepository,
      messageFlagRepository,
      sendAccountDeactivatedEmail,
    }),
    reportRepository,
    userRepository,
    chatRepository,
    messageRepository,
    sendAccountDeactivatedEmail,
  };
};

describe("the queue", () => {
  it("defaults to unresolved work", async () => {
    const { service, reportRepository } = build();

    await service.list({});

    expect(reportRepository.find.mock.calls[0][0].status).toEqual({ $ne: "resolved" });
  });

  it("sorts worst first, then oldest within a priority", async () => {
    // So a high-priority case cannot be buried by newer ones, and nothing sits
    // forever.
    const { service, reportRepository } = build();

    await service.list({});

    expect(reportRepository.find.mock.calls[0][1].sort).toEqual({ priority: -1, createdAt: 1 });
  });

  it("excludes the current report from the prior count", async () => {
    // A first complaint and a fourth warrant different responses.
    const { service } = build({
      reportRepository: {
        find: vi.fn().mockResolvedValue([{ ...aReport(), reportedUserId: { _id: "u2" }, createdAt: new Date() }]),
        countsByReportedUser: vi.fn().mockResolvedValue([{ _id: "u2", total: 4, resolved: 2 }]),
      },
    });

    const { data } = await service.list({});

    expect(data[0].priorReports).toBe(3);
    expect(data[0].priorResolved).toBe(2);
  });

  it("reports zero priors for a first complaint", async () => {
    const { service } = build({
      reportRepository: {
        find: vi.fn().mockResolvedValue([{ ...aReport(), reportedUserId: { _id: "u2" }, createdAt: new Date() }]),
        countsByReportedUser: vi.fn().mockResolvedValue([{ _id: "u2", total: 1, resolved: 0 }]),
      },
    });

    expect((await service.list({})).data[0].priorReports).toBe(0);
  });

  it("skips the prior-count query entirely for an empty page", async () => {
    const { service, reportRepository } = build();

    await service.list({});

    expect(reportRepository.countsByReportedUser).not.toHaveBeenCalled();
  });
});

describe("assign", () => {
  it("moves a claimed case out of the unclaimed pool", async () => {
    // So two admins do not unknowingly work the same complaint.
    const { service, reportRepository } = build();

    await service.assign({ id: "507f1f77bcf86cd799439011", body: { assignToMe: true }, adminId: "a1" });

    const { $set } = reportRepository.updateById.mock.calls[0][1];
    expect($set).toMatchObject({ assignedTo: "a1", status: "reviewing" });
  });

  it("rejects a request that would change nothing", async () => {
    const { service } = build();

    await expect(
      service.assign({ id: "507f1f77bcf86cd799439011", body: {}, adminId: "a1" })
    ).rejects.toThrow("Nothing to change.");
  });

  it("400s a malformed id rather than casting it", async () => {
    const { service } = build();

    await expect(service.assign({ id: "nope", body: { assignToMe: true } })).rejects.toThrow(
      ValidationError
    );
  });
});

describe("resolve", () => {
  const id = "507f1f77bcf86cd799439011";
  const resolve = (service, body) => service.resolve({ id, body, adminId: "a1" });

  it("requires a recognised outcome", async () => {
    const { service } = build();

    await expect(resolve(service, { action: "banished", note: NOTE })).rejects.toThrow(
      ValidationError
    );
  });

  it("requires a real note, so the decision is recorded", async () => {
    const { service } = build();

    await expect(resolve(service, { action: "warned", note: "bad" })).rejects.toThrow(
      "at least 10 characters"
    );
  });

  it("refuses to resolve a case twice", async () => {
    const { service } = build({
      reportRepository: { findById: vi.fn().mockResolvedValue(aReport({ status: "resolved" })) },
    });

    await expect(resolve(service, { action: "warned", note: NOTE })).rejects.toThrow(
      "already resolved"
    );
  });

  it("404s when the reported account is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(resolve(service, { action: "warned", note: NOTE })).rejects.toThrow(
      NotFoundError
    );
  });

  it("stops an admin actioning a report against themselves", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ _id: "a1", name: "Admin" }) },
    });

    await expect(resolve(service, { action: "dismissed", note: NOTE })).rejects.toThrow(
      "your own account"
    );
  });

  it("validates the suspension length before touching the account", async () => {
    const { service, userRepository } = build();

    await expect(
      resolve(service, { action: "suspended", note: NOTE, suspendDays: 0 })
    ).rejects.toThrow("between 1 and 365 days");
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("applies a suspension and records the outcome on the report", async () => {
    const report = aReport();
    const { service, userRepository } = build({
      reportRepository: { findById: vi.fn().mockResolvedValue(report) },
    });

    const result = await resolve(service, { action: "suspended", note: NOTE, suspendDays: 7 });

    expect(userRepository.updateById).toHaveBeenCalled();
    expect(report.status).toBe("resolved");
    expect(report.resolution).toMatchObject({ action: "suspended", note: NOTE, resolvedBy: "a1" });
    expect(result.sanction.days).toBe(7);
  });

  it("writes nothing to the account for a warning", async () => {
    const { service, userRepository } = build();

    const result = await resolve(service, { action: "warned", note: NOTE });

    expect(userRepository.updateById).not.toHaveBeenCalled();
    expect(result.sanction).toEqual({ type: "warned" });
  });

  it("emails generic copy on a block, never the moderator's note", async () => {
    // The note is the moderator's own wording and can identify the reporter.
    const { service, sendAccountDeactivatedEmail } = build();

    await resolve(service, { action: "blocked", note: NOTE });

    expect(sendAccountDeactivatedEmail).toHaveBeenCalledWith(
      "sam@example.com",
      "Sam",
      "a violation of our community guidelines"
    );
  });

  it("does not email on a suspension or a warning", async () => {
    const suspended = build();
    await suspended.service.resolve({
      id,
      body: { action: "suspended", note: NOTE, suspendDays: 3 },
      adminId: "a1",
    });
    expect(suspended.sendAccountDeactivatedEmail).not.toHaveBeenCalled();

    const warned = build();
    await warned.service.resolve({ id, body: { action: "warned", note: NOTE }, adminId: "a1" });
    expect(warned.sendAccountDeactivatedEmail).not.toHaveBeenCalled();
  });

  it("resolves the case even if the notification email fails", async () => {
    const report = aReport();
    const { service } = build({
      reportRepository: { findById: vi.fn().mockResolvedValue(report) },
    });
    service.sendAccountDeactivatedEmail = vi.fn().mockRejectedValue(new Error("smtp down"));

    await expect(resolve(service, { action: "blocked", note: NOTE })).resolves.toBeTruthy();
    expect(report.status).toBe("resolved");
  });

  it("never deletes the report — the history outlives the account", async () => {
    // A moderation system that forgets its own decisions cannot answer
    // "has this person been reported before".
    const report = aReport();
    const { service } = build({
      reportRepository: { findById: vi.fn().mockResolvedValue(report) },
    });

    await resolve(service, { action: "deleted", note: NOTE });

    expect(report.status).toBe("resolved");
    expect(report.resolution.action).toBe("deleted");
    expect(report.save).toHaveBeenCalled();
  });
});

describe("context", () => {
  const id = "507f1f77bcf86cd799439011";

  const withReport = (over = {}) =>
    build({
      reportRepository: {
        findById: vi.fn().mockResolvedValue({
          _id: "r1",
          reason: "harassment",
          reportedUserId: { _id: "u2" },
          reporterId: { _id: "u3" },
          ...over.report,
        }),
        priorFor: vi.fn().mockResolvedValue([]),
      },
      ...over.rest,
    });

  it("falls back to the chat between the two parties when none is attached", async () => {
    // A whole-account report carries no chatId, and "no conversation attached"
    // should not mean "no context".
    const { service, chatRepository } = withReport();

    await service.context(id);

    expect(chatRepository.findOne).toHaveBeenCalledWith(
      { participants: { $all: ["u2", "u3"] } },
      expect.anything()
    );
  });

  it("returns no conversation when the two have never spoken", async () => {
    const { service } = withReport();

    expect((await service.context(id)).payload.conversation).toBeNull();
  });

  it("takes the newest messages but returns them in reading order", async () => {
    const { service } = withReport({
      rest: {
        chatRepository: { findOne: vi.fn().mockResolvedValue({ _id: "c1" }) },
        messageRepository: {
          find: vi.fn().mockResolvedValue([
            { _id: "m3", content: "third", sender: { _id: "u2" }, createdAt: 3 },
            { _id: "m2", content: "second", sender: { _id: "u3" }, createdAt: 2 },
          ]),
          count: vi.fn().mockResolvedValue(40),
        },
      },
    });

    const { payload } = await service.context(id);

    expect(payload.conversation.messages.map((m) => m._id)).toEqual(["m2", "m3"]);
    expect(payload.conversation.totalMessages).toBe(40);
    expect(payload.conversation.showing).toBe(2);
  });

  it("asks for exactly five messages, and the caller cannot widen it", async () => {
    const { service, messageRepository } = withReport({
      rest: { chatRepository: { findOne: vi.fn().mockResolvedValue({ _id: "c1" }) } },
    });

    await service.context(id);

    expect(messageRepository.find.mock.calls[0][1].limit).toBe(5);
  });

  it("blanks a voice note rather than shipping its audio", async () => {
    // Voice notes are base64 in `content`; returning that pushes a megabyte of
    // audio into a queue screen that only wants to show who said what.
    const { service } = withReport({
      rest: {
        chatRepository: { findOne: vi.fn().mockResolvedValue({ _id: "c1" }) },
        messageRepository: {
          find: vi
            .fn()
            .mockResolvedValue([{ _id: "m1", type: "Audio", content: "AAAA…", sender: { _id: "u2" } }]),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    });

    const [message] = (await service.context(id)).payload.conversation.messages;

    expect(message.content).toBe("");
    expect(message.type).toBe("Audio");
  });

  it("marks which message was reported and who sent each one", async () => {
    const { service } = withReport({
      report: { messageId: "m1" },
      rest: {
        chatRepository: { findOne: vi.fn().mockResolvedValue({ _id: "c1" }) },
        messageRepository: {
          find: vi.fn().mockResolvedValue([
            { _id: "m1", content: "hi", sender: { _id: "u2" } },
            { _id: "m2", content: "ok", sender: { _id: "u3" } },
          ]),
          count: vi.fn().mockResolvedValue(2),
        },
      },
    });

    const { messages } = (await service.context(id)).payload.conversation;

    expect(messages.find((m) => m._id === "m1")).toMatchObject({
      isReported: true,
      fromReportedUser: true,
    });
    expect(messages.find((m) => m._id === "m2")).toMatchObject({
      isReported: false,
      fromReportedUser: false,
    });
  });

  it("flattens and de-duplicates the content-flag categories", async () => {
    // $addToSet over an array field nests it.
    const { service } = withReport({
      rest: {
        messageFlagRepository: {
          summaryForSender: vi.fn().mockResolvedValue([
            { total: 6, blocked: 2, categories: [["abuse", "spam"], ["spam"]] },
          ]),
        },
      },
    });

    expect((await service.context(id)).payload.contentFlags).toEqual({
      total: 6,
      blocked: 2,
      categories: ["abuse", "spam"],
    });
  });

  it("reports zeroed flags for a member the rules never fired on", async () => {
    const { service } = withReport();

    expect((await service.context(id)).payload.contentFlags).toEqual({
      total: 0,
      blocked: 0,
      categories: [],
    });
  });
});
