import { describe, it, expect, vi } from "vitest";
import {
  AdminDashboardService,
  isoWeekNumber,
  percentageChange,
} from "#src/modules/admin/adminDashboard.service.js";
import { NotFoundError, ValidationError } from "#src/core/errors/index.js";

const build = (over = {}) => {
  const bookingRepository = {
    earliest: vi.fn().mockResolvedValue({ createdAt: new Date("2025-01-01") }),
    countSince: vi.fn().mockResolvedValue(0),
    earningsSince: vi.fn().mockResolvedValue(0),
    dailyStatsSince: vi.fn().mockResolvedValue([]),
    findCompletedPage: vi.fn().mockResolvedValue({ bookings: [], totalRecords: 0 }),
    findCompleted: vi.fn().mockResolvedValue([]),
    recentWithParties: vi.fn().mockResolvedValue([]),
    ...over.bookingRepository,
  };

  const userRepository = {
    find: vi.fn().mockResolvedValue([]),
    weeklySignups: vi.fn().mockResolvedValue([]),
    countsByType: vi.fn().mockResolvedValue([]),
    countsByTypeBefore: vi.fn().mockResolvedValue([]),
    topLocations: vi.fn().mockResolvedValue([]),
    rankedByReviews: vi.fn().mockResolvedValue({ users: [], totalRecords: 0 }),
    ...over.userRepository,
  };

  const chatRepository = { find: vi.fn().mockResolvedValue([]), ...over.chatRepository };

  return {
    service: new AdminDashboardService({ userRepository, bookingRepository, chatRepository }),
    bookingRepository,
    userRepository,
    chatRepository,
  };
};

describe("isoWeekNumber", () => {
  it("puts a year's first Thursday in week 1", () => {
    // Weeks belong to the year containing their Thursday, which is why the
    // anchor is January 4th.
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeekNumber(new Date(2026, 0, 8))).toBe(2);
  });

  it("keeps counting through the year", () => {
    expect(isoWeekNumber(new Date(2026, 11, 28))).toBeGreaterThan(50);
  });
});

describe("percentageChange", () => {
  it("reports growth and decline", () => {
    expect(percentageChange(150, 100)).toBe(50);
    expect(percentageChange(50, 100)).toBe(-50);
  });

  it("calls growth from nothing 100%, not infinity", () => {
    expect(percentageChange(5, 0)).toBe(100);
  });

  it("calls nothing-to-nothing 0%", () => {
    expect(percentageChange(0, 0)).toBe(0);
  });
});

describe("bookingStats", () => {
  it("defaults to everything, starting at the first booking ever", async () => {
    const { service } = build();

    const { startDate } = await service.bookingStats({});

    expect(startDate).toEqual(new Date("2025-01-01"));
  });

  it("404s when the platform has no bookings and no filter was given", async () => {
    const { service } = build({ bookingRepository: { earliest: vi.fn().mockResolvedValue(null) } });

    await expect(service.bookingStats({})).rejects.toThrow(NotFoundError);
  });

  // From 12 July 2026. Months are 0-based, so 6 is July.
  it.each([
    ["1M", 2026, 5],
    ["6M", 2026, 0],
    ["1Y", 2025, 6],
  ])("windows %s back to %i-%i", async (filter, year, month) => {
    const { service } = build();

    const { startDate } = await service.bookingStats({ filter, now: new Date(2026, 6, 12) });

    expect([startDate.getFullYear(), startDate.getMonth()]).toEqual([year, month]);
  });

  it("does not mutate the caller's clock while computing a window", async () => {
    // The original called `now.setMonth(...)` on the shared Date, so computing
    // one window moved the reference point for everything after it.
    const { service } = build();
    const now = new Date(2026, 6, 12);

    await service.bookingStats({ filter: "1M", now });

    expect(now.getMonth()).toBe(6);
  });

  it("counts applications, rejections and completions over the same window", async () => {
    const { service, bookingRepository } = build();

    await service.bookingStats({ filter: "1M", now: new Date(2026, 6, 12) });

    const windows = bookingRepository.countSince.mock.calls.map(([since]) => since.getTime());
    expect(new Set(windows).size).toBe(1);
  });

  it("reports zero earnings rather than undefined for an empty window", async () => {
    const { service } = build();

    expect((await service.bookingStats({})).totalEarnings).toBe(0);
  });
});

describe("userStats", () => {
  it("fills in weeks with no signups rather than omitting them", async () => {
    // A chart that omits empty weeks joins the two weeks either side of it.
    const { service } = build();

    const { weeklyStats } = await service.userStats({ now: new Date(2026, 6, 29) });

    expect(weeklyStats.length).toBeGreaterThanOrEqual(4);
    expect(weeklyStats.every((week) => week.Nanny === 0 && week.Parents === 0)).toBe(true);
  });

  it("gives the first week no percentage — it has no predecessor", async () => {
    const { service } = build();

    const { weeklyStats } = await service.userStats({ now: new Date(2026, 6, 29) });

    expect(weeklyStats[0]).toMatchObject({ NannyPercentage: 0, ParentsPercentage: 0 });
  });

  it("turns the aggregation rows into a total per type", async () => {
    const { service } = build({
      userRepository: {
        countsByType: vi.fn().mockResolvedValue([
          { _id: "Nanny", count: 40 },
          { _id: "Parents", count: 60 },
        ]),
        countsByTypeBefore: vi.fn().mockResolvedValue([{ _id: "Nanny", count: 20 }]),
      },
    });

    const { totalCounts, percentageChanges } = await service.userStats({});

    expect(totalCounts).toEqual({ Nanny: 40, Parents: 60 });
    expect(percentageChanges).toEqual([
      { type: "Nanny", percentageChange: 100 },
      // No Parents a month ago, so growth from nothing reads as 100%.
      { type: "Parents", percentageChange: 100 },
    ]);
  });

  it("rounds percentages to two decimals", async () => {
    const { service } = build({
      userRepository: {
        countsByType: vi.fn().mockResolvedValue([{ _id: "Nanny", count: 10 }]),
        countsByTypeBefore: vi.fn().mockResolvedValue([{ _id: "Nanny", count: 3 }]),
      },
    });

    const { percentageChanges } = await service.userStats({});

    expect(percentageChanges[0].percentageChange).toBe(233.33);
  });
});

describe("earningStats", () => {
  it("totals every completed booking", async () => {
    const { service } = build({
      bookingRepository: {
        findCompleted: vi
          .fn()
          .mockResolvedValue([{ totalPayment: 100 }, { totalPayment: 250 }, {}]),
      },
    });

    expect((await service.earningStats({})).totalEarning).toBe(350);
  });

  it("ignores a completed booking with no completion date when bucketing", async () => {
    const { service } = build({
      bookingRepository: {
        findCompleted: vi.fn().mockResolvedValue([{ totalPayment: 100, completedAt: null }]),
      },
    });

    const { totalEarning, weeklyEarnings } = await service.earningStats({});

    expect(totalEarning).toBe(100);
    expect(weeklyEarnings.every((week) => week.earnings === 0)).toBe(true);
  });

  it("buckets a payment into the week it completed in", async () => {
    const now = new Date(2026, 6, 29);
    const { service } = build({
      bookingRepository: {
        findCompleted: vi
          .fn()
          .mockResolvedValue([{ totalPayment: 200, completedAt: new Date(2026, 6, 28) }]),
      },
    });

    const { weeklyEarnings } = await service.earningStats({ now });

    expect(weeklyEarnings.filter((week) => week.earnings === 200)).toHaveLength(1);
  });

  it("compares the current week against the all-time total, as it always has", async () => {
    // Preserved deliberately: on a healthy platform this is always a large
    // negative number, but it is what the dashboard renders today.
    const { service } = build({
      bookingRepository: {
        findCompleted: vi.fn().mockResolvedValue([{ totalPayment: 1000, completedAt: new Date(2020, 0, 1) }]),
      },
    });

    expect((await service.earningStats({})).percentageChanges).toBe(-100);
  });

  it("reports 0% rather than dividing by zero on an empty platform", async () => {
    const { service } = build();

    expect((await service.earningStats({})).percentageChanges).toBe(0);
  });
});

describe("topUsers", () => {
  it("requires a valid type", async () => {
    const { service } = build();

    await expect(service.topUsers({})).rejects.toThrow(ValidationError);
    await expect(service.topUsers({ type: "Admin" })).rejects.toThrow(
      "Invalid or missing type filter."
    );
  });

  it("sorts by rating by default and by count when asked", async () => {
    const { service, userRepository } = build();

    await service.topUsers({ type: "Nanny" });
    expect(userRepository.rankedByReviews.mock.calls[0][0].sortBy).toBe("avgRating");

    await service.topUsers({ type: "Nanny", sort: "reviews" });
    expect(userRepository.rankedByReviews.mock.calls[1][0].sortBy).toBe("totalReviews");
  });

  it("paginates", async () => {
    const { service, userRepository } = build({
      userRepository: {
        rankedByReviews: vi.fn().mockResolvedValue({ users: [], totalRecords: 12 }),
      },
    });

    const { pagination } = await service.topUsers({ type: "Nanny", page: 2, limit: 5 });

    expect(userRepository.rankedByReviews.mock.calls[0][0].skip).toBe(5);
    expect(pagination).toEqual({ totalRecords: 12, totalPages: 3, currentPage: 2, limit: 5 });
  });
});

describe("nannyLocations", () => {
  it("passes the caregiver count through so shares add up", async () => {
    const { service, userRepository } = build({
      userRepository: { find: vi.fn().mockResolvedValue([{ _id: "n1" }, { _id: "n2" }]) },
    });

    await service.nannyLocations();

    expect(userRepository.topLocations).toHaveBeenCalledWith("Nanny", 2);
  });
});

describe("chatDirectory", () => {
  const aChat = (otherId, over = {}) => ({
    _id: `c-${otherId}`,
    lastMessage: "hi",
    participants: [{ _id: { toString: () => "admin" } }, { _id: { toString: () => otherId }, name: otherId }],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    type: "direct",
    ...over,
  });

  const aMember = (id) => ({ _id: { toString: () => id }, name: id });

  it("includes members with no conversation, so one can be started", async () => {
    const { service } = build({
      userRepository: { find: vi.fn().mockResolvedValue([aMember("u2"), aMember("u3")]) },
    });

    const rows = await service.chatDirectory({ adminId: "admin" });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.lastMessage === null)).toBe(true);
  });

  it("attaches the conversation where one exists", async () => {
    const { service } = build({
      userRepository: { find: vi.fn().mockResolvedValue([aMember("u2"), aMember("u3")]) },
      chatRepository: { find: vi.fn().mockResolvedValue([aChat("u2")]) },
    });

    const rows = await service.chatDirectory({ adminId: "admin" });

    expect(rows[0]).toMatchObject({ _id: "c-u2", lastMessage: "hi" });
  });

  it("sorts active conversations above silent members", async () => {
    const { service } = build({
      userRepository: { find: vi.fn().mockResolvedValue([aMember("u2"), aMember("u3")]) },
      chatRepository: { find: vi.fn().mockResolvedValue([aChat("u3")]) },
    });

    const rows = await service.chatDirectory({ adminId: "admin" });

    expect(rows[0]._id).toBe("c-u3");
    expect(rows[1].updatedAt).toBeNull();
  });

  it("excludes the admin and anything the caller asked to skip", async () => {
    const { service, userRepository } = build();

    await service.chatDirectory({ adminId: "admin", exclude: ["u9"] });

    expect(userRepository.find.mock.calls[0][0]).toEqual({
      _id: { $ne: "admin", $nin: ["u9"] },
    });
  });

  it("skips a chat whose other participant is gone", async () => {
    const orphan = aChat("u2", { participants: [{ _id: { toString: () => "admin" } }] });
    const { service } = build({
      userRepository: { find: vi.fn().mockResolvedValue([aMember("u2")]) },
      chatRepository: { find: vi.fn().mockResolvedValue([orphan]) },
    });

    const rows = await service.chatDirectory({ adminId: "admin" });

    expect(rows[0].lastMessage).toBeNull();
  });
});
