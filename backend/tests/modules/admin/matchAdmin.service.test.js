import { describe, it, expect, vi } from "vitest";
import { MatchAdminService } from "#src/modules/admin/matchAdmin.service.js";
import { dateRange, searchTerm } from "#src/modules/admin/admin.middleware.js";

const aRequest = (over = {}) => ({
  _id: "m1",
  senderId: { _id: "u1", name: "Sam" },
  receiverId: { _id: "u2", name: "Pat" },
  status: "pending",
  createdAt: new Date(),
  ...over,
});

const build = (over = {}) => {
  const matchRepository = {
    findAdminPage: vi.fn().mockResolvedValue({ requests: [], totalRecords: 0 }),
    find: vi.fn().mockResolvedValue([]),
    countsByStatusSince: vi.fn().mockResolvedValue([]),
    distinctSendersSince: vi.fn().mockResolvedValue([]),
    distinctReceiversSince: vi.fn().mockResolvedValue([]),
    averageResponseTimeSince: vi.fn().mockResolvedValue(null),
    dailyCountsSince: vi.fn().mockResolvedValue([]),
    ...over.matchRepository,
  };

  const userRepository = {
    findIdsMatching: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    ...over.userRepository,
  };

  return {
    service: new MatchAdminService({ matchRepository, userRepository }),
    matchRepository,
    userRepository,
  };
};

describe("dateRange", () => {
  it("is undefined when neither end was given", () => {
    expect(dateRange({})).toBeUndefined();
  });

  it("stretches the end date to the end of that day", () => {
    // The picker sends a plain date, which parses to midnight — so without
    // this, filtering "to 5 March" excludes everything sent on 5 March and a
    // single-day filter returns nothing.
    const { $lte } = dateRange({ to: "2026-03-05" });

    expect($lte.getHours()).toBe(23);
    expect($lte.getMinutes()).toBe(59);
  });

  it("accepts one end without the other", () => {
    expect(dateRange({ from: "2026-03-01" })).toHaveProperty("$gte");
    expect(dateRange({ from: "2026-03-01" })).not.toHaveProperty("$lte");
  });
});

describe("searchTerm", () => {
  it("escapes regex metacharacters", () => {
    // "a{100000}" is otherwise a denial of service.
    expect(searchTerm("a{100}").source).toBe("a\\{100\\}");
  });

  it("is case-insensitive and trims", () => {
    expect(searchTerm("  Sam  ").flags).toContain("i");
    expect(searchTerm("  Sam  ").source).toBe("Sam");
  });
});

describe("list filters", () => {
  it("ignores a status the schema does not have", async () => {
    const { service, matchRepository } = build();

    await service.list({ query: { status: "invented" } });

    expect(matchRepository.findAdminPage.mock.calls[0][0]).toEqual({});
  });

  it("maps the console's connection vocabulary onto stored statuses", async () => {
    const { service, matchRepository } = build();

    await service.list({ query: { connection: "pending" } });
    expect(matchRepository.findAdminPage.mock.calls[0][0].status).toBe("pending");

    await service.list({ query: { connection: "connected" } });
    expect(matchRepository.findAdminPage.mock.calls[1][0].status).toBe("accepted");
  });

  it("resolves a person search to ids on either side of the request", async () => {
    const { service, matchRepository, userRepository } = build({
      userRepository: { findIdsMatching: vi.fn().mockResolvedValue([{ _id: "u9" }]) },
    });

    await service.list({ query: { search: "sam" } });

    expect(userRepository.findIdsMatching.mock.calls[0][1]).toBe(500);
    expect(matchRepository.findAdminPage.mock.calls[0][0].$or).toEqual([
      { senderId: { $in: ["u9"] } },
      { receiverId: { $in: ["u9"] } },
    ]);
  });
});

describe("connectionType", () => {
  it("calls an accepted request connected", async () => {
    const { service } = build({
      matchRepository: {
        findAdminPage: vi
          .fn()
          .mockResolvedValue({ requests: [aRequest({ status: "accepted" })], totalRecords: 1 }),
      },
    });

    const { data } = await service.list({});

    expect(data[0].connectionType).toBe("connected");
  });

  it("calls two opposing pending requests mutual", async () => {
    // Not a stored status — a pair of rows pointing in opposite directions.
    const { service } = build({
      matchRepository: {
        findAdminPage: vi.fn().mockResolvedValue({ requests: [aRequest()], totalRecords: 1 }),
        find: vi.fn().mockResolvedValue([{ senderId: "u2", receiverId: "u1", status: "pending" }]),
      },
    });

    const { data } = await service.list({});

    expect(data[0]).toMatchObject({ connectionType: "mutual", isMutual: true });
  });

  it("prefers connected over mutual, because that is the outcome", async () => {
    const { service } = build({
      matchRepository: {
        findAdminPage: vi
          .fn()
          .mockResolvedValue({ requests: [aRequest({ status: "accepted" })], totalRecords: 1 }),
        find: vi.fn().mockResolvedValue([{ senderId: "u2", receiverId: "u1" }]),
      },
    });

    const { data } = await service.list({});

    expect(data[0].connectionType).toBe("connected");
    expect(data[0].isMutual).toBe(true);
  });

  it("passes a rejected or blocked status straight through", async () => {
    const { service } = build({
      matchRepository: {
        findAdminPage: vi
          .fn()
          .mockResolvedValue({ requests: [aRequest({ status: "blocked" })], totalRecords: 1 }),
      },
    });

    expect((await service.list({})).data[0].connectionType).toBe("blocked");
  });

  it("asks for reverses once for the page, not once per row", async () => {
    const requests = [aRequest(), aRequest({ _id: "m2" }), aRequest({ _id: "m3" })];
    const { service, matchRepository } = build({
      matchRepository: { findAdminPage: vi.fn().mockResolvedValue({ requests, totalRecords: 3 }) },
    });

    await service.list({});

    expect(matchRepository.find).toHaveBeenCalledTimes(1);
  });

  it("skips the reverse lookup entirely for an empty page", async () => {
    const { service, matchRepository } = build();

    await service.list({});

    expect(matchRepository.find).not.toHaveBeenCalled();
  });

  it("survives a request whose sender has been deleted", async () => {
    const { service } = build({
      matchRepository: {
        findAdminPage: vi
          .fn()
          .mockResolvedValue({ requests: [aRequest({ senderId: null })], totalRecords: 1 }),
      },
    });

    const { data } = await service.list({});

    expect(data[0].sender).toBeNull();
    expect(data[0].isMutual).toBe(false);
  });
});

describe("pendingForDays", () => {
  it("counts days for a request still waiting", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const { service } = build({
      matchRepository: {
        findAdminPage: vi
          .fn()
          .mockResolvedValue({ requests: [aRequest({ createdAt: threeDaysAgo })], totalRecords: 1 }),
      },
    });

    expect((await service.list({})).data[0].pendingForDays).toBe(3);
  });

  it("is null once answered — the age of a settled request means nothing", async () => {
    const { service } = build({
      matchRepository: {
        findAdminPage: vi
          .fn()
          .mockResolvedValue({ requests: [aRequest({ status: "accepted" })], totalRecords: 1 }),
      },
    });

    expect((await service.list({})).data[0].pendingForDays).toBeNull();
  });
});

describe("the mutual filter", () => {
  it("filters the page and says so", async () => {
    // The total counts the unfiltered set, so the flag stops the console
    // presenting a total that does not match its rows.
    const requests = [aRequest(), aRequest({ _id: "m2", senderId: { _id: "u3" } })];
    const { service } = build({
      matchRepository: {
        findAdminPage: vi.fn().mockResolvedValue({ requests, totalRecords: 2 }),
        find: vi.fn().mockResolvedValue([{ senderId: "u2", receiverId: "u1" }]),
      },
    });

    const { data, pageFiltered, pagination } = await service.list({
      query: { connection: "mutual" },
    });

    expect(data).toHaveLength(1);
    expect(pageFiltered).toBe(true);
    expect(pagination.totalRecords).toBe(2);
  });

  it("is not flagged when no mutual filter was asked for", async () => {
    const { service } = build();

    expect((await service.list({})).pageFiltered).toBe(false);
  });
});

describe("insights", () => {
  it("clamps the window between a week and a year", async () => {
    const { service } = build();

    expect((await service.insights({ days: "1" })).windowDays).toBe(7);
    expect((await service.insights({ days: "9999" })).windowDays).toBe(365);
    expect((await service.insights({})).windowDays).toBe(90);
  });

  it("reports rates as whole percentages of everything sent", async () => {
    const { service } = build({
      matchRepository: {
        countsByStatusSince: vi.fn().mockResolvedValue([
          { _id: "accepted", count: 25 },
          { _id: "pending", count: 50 },
          { _id: "rejected", count: 25 },
        ]),
      },
    });

    const insights = await service.insights({});

    expect(insights.totalRequests).toBe(100);
    expect(insights.successRate).toBe(25);
    expect(insights.unansweredRate).toBe(50);
  });

  it("reports 0 rather than NaN on a platform with no requests", async () => {
    const { service } = build();

    const insights = await service.insights({});

    expect(insights.successRate).toBe(0);
    expect(insights.reachRate).toBe(0);
  });

  it("counts distinct people, not requests", async () => {
    // A platform where 90% of requests target the same ten profiles has a
    // discovery problem a headline acceptance rate hides completely.
    const { service } = build({
      matchRepository: {
        distinctReceiversSince: vi.fn().mockResolvedValue(["u1", "u1", "u2"]),
        distinctSendersSince: vi.fn().mockResolvedValue(["u3"]),
      },
      userRepository: { count: vi.fn().mockResolvedValue(4) },
    });

    const insights = await service.insights({});

    expect(insights.usersReceivingRequests).toBe(2);
    expect(insights.usersSendingRequests).toBe(1);
    expect(insights.reachRate).toBe(50);
  });

  it("returns no average time, and says why, until responses are recorded", async () => {
    const { service } = build();

    const insights = await service.insights({});

    expect(insights.avgTimeToMatchHours).toBeNull();
    expect(insights.avgTimeToMatchSample).toBe(0);
    expect(insights.avgTimeToMatchNote).toContain("No matches with a recorded response time");
  });

  it("reports the average in hours to one decimal, with its sample size", async () => {
    const { service } = build({
      matchRepository: {
        averageResponseTimeSince: vi
          .fn()
          .mockResolvedValue({ avgMs: 5 * 60 * 60 * 1000 + 30 * 60 * 1000, measured: 12 }),
      },
    });

    const insights = await service.insights({});

    expect(insights.avgTimeToMatchHours).toBe(5.5);
    expect(insights.avgTimeToMatchSample).toBe(12);
    expect(insights.avgTimeToMatchNote).toBeNull();
  });
});
