import { describe, it, expect, vi } from "vitest";
import { TrafficService } from "#src/modules/admin/traffic.service.js";
import { percentChange } from "#src/modules/admin/analyticsAdmin.service.js";

const build = (over = {}) => {
  const pageViewRepository = {
    totals: vi.fn().mockResolvedValue(null),
    sourceBreakdown: vi.fn().mockResolvedValue([]),
    deviceBreakdown: vi.fn().mockResolvedValue([]),
    sessionStats: vi.fn().mockResolvedValue(null),
    dailyTotals: vi.fn().mockResolvedValue([]),
    pageUsage: vi.fn().mockResolvedValue([]),
    referrers: vi.fn().mockResolvedValue([]),
    campaigns: vi.fn().mockResolvedValue([]),
    ...over.pageViewRepository,
  };

  const trafficDailyRepository = {
    since: vi.fn().mockResolvedValue([]),
    ...over.trafficDailyRepository,
  };

  const rollupDay = vi.fn().mockResolvedValue({ visits: 10 });

  return {
    service: new TrafficService({ pageViewRepository, trafficDailyRepository, rollupDay }),
    pageViewRepository,
    trafficDailyRepository,
    rollupDay,
  };
};

describe("percentChange", () => {
  it("returns null rather than a meaningless percentage against zero", () => {
    // "+500%" from a base of nothing looks like a metric and is not one.
    expect(percentChange(5, 0)).toBeNull();
  });

  it("returns 0 when both periods were empty", () => {
    expect(percentChange(0, 0)).toBe(0);
  });

  it("rounds to a whole percent", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(70, 100)).toBe(-30);
  });
});

describe("overview windows", () => {
  it("clamps days between 1 and 365", async () => {
    const { service } = build();

    expect((await service.overview({ days: "-5" })).windowDays).toBe(1);
    expect((await service.overview({ days: "9999" })).windowDays).toBe(365);
  });

  it("falls back to 30 days for anything that is not a usable number", async () => {
    // Including "0", which is falsy and so reaches the default before the
    // clamp — a zero-day window would report nothing at all.
    const { service } = build();

    expect((await service.overview({})).windowDays).toBe(30);
    expect((await service.overview({ days: "0" })).windowDays).toBe(30);
    expect((await service.overview({ days: "abc" })).windowDays).toBe(30);
  });

  it("compares against the equivalent window immediately before", async () => {
    const now = new Date("2026-08-12T00:00:00Z").getTime();
    const { service, pageViewRepository } = build();

    await service.overview({ days: 30, now });

    const [current, previous] = pageViewRepository.totals.mock.calls.map(([arg]) => arg);
    expect(current.to).toBeUndefined();
    expect(previous.to).toEqual(current.from);
    expect(current.from.getTime() - previous.from.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe("overview figures", () => {
  it("warns that unique visitors are per-day for any multi-day window", async () => {
    // The visitor hash is salted daily, so a returning visitor is counted
    // again. The figure is an upper bound and the response says so.
    const { service } = build();

    expect((await service.overview({ days: 30 })).uniqueVisitorsNote).toContain("per day");
    expect((await service.overview({ days: 1 })).uniqueVisitorsNote).toBeNull();
  });

  it("reports duration as null, not zero, when nothing was measured", async () => {
    // An average of no data is not an average of zero — counting unmeasured
    // views as instant departures is what makes a bounce rate read 90%.
    const { service } = build();

    const overview = await service.overview({});

    expect(overview.avgSessionDurationSec).toBeNull();
    expect(overview.durationSample).toBe(0);
  });

  it("averages duration over measured sessions only", async () => {
    const { service } = build({
      pageViewRepository: {
        sessionStats: vi.fn().mockResolvedValue({
          sessions: 10,
          bounces: 3,
          totalDuration: 600,
          measuredSessions: 4,
          totalPageViews: 25,
        }),
      },
    });

    const overview = await service.overview({});

    expect(overview.avgSessionDurationSec).toBe(150);
    expect(overview.durationSample).toBe(4);
    expect(overview.bounceRate).toBe(30);
    expect(overview.pagesPerSession).toBe(2.5);
  });

  it("labels a visit with no referrer as direct, not unknown", async () => {
    const { service } = build({
      pageViewRepository: {
        sourceBreakdown: vi
          .fn()
          .mockResolvedValue([{ _id: null, visits: 30 }, { _id: "google", visits: 70 }]),
      },
    });

    const { sources } = await service.overview({});

    expect(sources[0]).toEqual({ source: "direct", visits: 30, pct: 30 });
  });

  it("reports zeroes rather than NaN on a site with no traffic", async () => {
    const { service } = build();

    const overview = await service.overview({});

    expect(overview.visits).toBe(0);
    expect(overview.bounceRate).toBe(0);
    expect(overview.pagesPerSession).toBe(0);
    expect(overview.uniqueVisitors).toBe(0);
  });
});

describe("trend", () => {
  const rolledDay = (date, over = {}) => ({
    date: new Date(`${date}T00:00:00Z`),
    visits: 100,
    uniqueVisitors: 60,
    sessions: 80,
    bounces: 20,
    totalDurationSec: 4000,
    measuredSessions: 40,
    newSignups: 2,
    ...over,
  });

  it("prefers the rollup and fills recent days from the raw stream", async () => {
    const { service } = build({
      trafficDailyRepository: { since: vi.fn().mockResolvedValue([rolledDay("2026-08-10")]) },
      pageViewRepository: {
        dailyTotals: vi.fn().mockResolvedValue([
          { _id: "2026-08-10", visits: 999, visitors: [], sessions: [] },
          { _id: "2026-08-11", visits: 50, visitors: ["a"], sessions: ["s1", "s2"] },
        ]),
      },
    });

    const { series } = await service.trend({});

    expect(series).toHaveLength(2);
    // The rolled day wins; the raw duplicate is dropped.
    expect(series[0]).toMatchObject({ date: "2026-08-10", visits: 100, source: "rollup" });
    expect(series[1]).toMatchObject({ date: "2026-08-11", visits: 50, source: "live" });
  });

  it("cannot report bounce or duration for a live day, and says null", async () => {
    const { service } = build({
      pageViewRepository: {
        dailyTotals: vi
          .fn()
          .mockResolvedValue([{ _id: "2026-08-11", visits: 50, visitors: [], sessions: [] }]),
      },
    });

    const { series } = await service.trend({});

    expect(series[0].bounceRate).toBeNull();
    expect(series[0].avgDurationSec).toBeNull();
  });

  it("computes bounce and duration for a rolled day", async () => {
    const { service } = build({
      trafficDailyRepository: { since: vi.fn().mockResolvedValue([rolledDay("2026-08-10")]) },
    });

    const { series } = await service.trend({});

    expect(series[0].bounceRate).toBe(25);
    expect(series[0].avgDurationSec).toBe(100);
  });

  it("sorts the merged series by date", async () => {
    const { service } = build({
      trafficDailyRepository: {
        since: vi.fn().mockResolvedValue([rolledDay("2026-08-09"), rolledDay("2026-08-07")]),
      },
      pageViewRepository: {
        dailyTotals: vi
          .fn()
          .mockResolvedValue([{ _id: "2026-08-08", visits: 1, visitors: [], sessions: [] }]),
      },
    });

    const { series } = await service.trend({});

    expect(series.map((row) => row.date)).toEqual(["2026-08-07", "2026-08-08", "2026-08-09"]);
  });

  it("allows a two-year window, since the rollup outlives the raw views", async () => {
    const { service } = build();

    expect((await service.trend({ days: "9999" })).windowDays).toBe(730);
  });
});

describe("pages", () => {
  it("caps the number of rows", async () => {
    const { service, pageViewRepository } = build();

    await service.pages({ limit: "9999" });

    expect(pageViewRepository.pageUsage.mock.calls[0][0].limit).toBe(200);
  });

  it("reports null duration for a page nothing was measured on", async () => {
    const { service } = build({
      pageViewRepository: {
        pageUsage: vi.fn().mockResolvedValue([
          { _id: "/x", views: 10, uniqueSessions: ["s"], totalDuration: 0, measured: 0, clicks: 0, exits: 0 },
        ]),
      },
    });

    const { data } = await service.pages({});

    expect(data[0].avgDurationSec).toBeNull();
    expect(data[0].durationSample).toBe(0);
  });

  it("computes exit rate against views", async () => {
    const { service } = build({
      pageViewRepository: {
        pageUsage: vi.fn().mockResolvedValue([
          {
            _id: "/checkout",
            title: "Checkout",
            views: 200,
            uniqueSessions: ["a", "b"],
            totalDuration: 400,
            measured: 100,
            clicks: 50,
            avgScroll: 62.4,
            entries: 10,
            exits: 120,
          },
        ]),
      },
    });

    const { data } = await service.pages({});

    expect(data[0]).toMatchObject({
      path: "/checkout",
      uniqueSessions: 2,
      avgDurationSec: 4,
      clicksPerView: 0.25,
      avgScrollPct: 62,
      exitRate: 60,
    });
  });
});

describe("runRollup", () => {
  it("defaults to yesterday — the last day that is complete", async () => {
    const now = new Date("2026-08-12T12:00:00Z").getTime();
    const { service, rollupDay } = build();

    await service.runRollup({ now });

    expect(rollupDay.mock.calls[0][0].toISOString().slice(0, 10)).toBe("2026-08-11");
  });

  it("accepts a specific date, so a missed night can be recovered", async () => {
    const { service, rollupDay } = build();

    await service.runRollup({ date: "2026-07-01" });

    expect(rollupDay.mock.calls[0][0].toISOString().slice(0, 10)).toBe("2026-07-01");
  });
});
