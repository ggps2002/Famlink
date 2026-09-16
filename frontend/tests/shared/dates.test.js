import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { formatStartDate, formatTimeRange, formatCreatedAt } from "@shared/lib/dates";

describe("formatStartDate", () => {
  it("formats a dayjs object from the date picker", () => {
    expect(formatStartDate(dayjs("2026-08-01"))).toBe("August 1, 2026");
  });

  it("formats an ISO string from the API", () => {
    expect(formatStartDate("2026-08-01T00:00:00.000Z")).toBe("August 1, 2026");
  });

  it("strips the JSON quotes older records still carry", () => {
    // Without this the detail views printed '"2026-08-01T00:00:00.000Z"' while
    // the card beside them read "August 1, 2026".
    expect(formatStartDate('"2026-08-01T00:00:00.000Z"')).toBe("August 1, 2026");
  });

  it("leaves a non-date answer alone", () => {
    // Some shares answer "Flexible" or "ASAP". Those are valid answers, not
    // broken dates, and must not become "Invalid Date".
    expect(formatStartDate("Flexible")).toBe("Flexible");
    expect(formatStartDate("ASAP")).toBe("ASAP");
  });

  it("renders nothing for an empty value", () => {
    expect(formatStartDate(null)).toBe("");
    expect(formatStartDate(undefined)).toBe("");
    expect(formatStartDate("")).toBe("");
  });

  it("reports an invalid dayjs object rather than guessing", () => {
    expect(formatStartDate(dayjs("not a date"))).toBe("Invalid Date");
  });
});

describe("formatTimeRange", () => {
  it("renders a start and end as a 12-hour range", () => {
    const start = new Date(2026, 7, 1, 9, 0).toISOString();
    const end = new Date(2026, 7, 1, 17, 30).toISOString();
    expect(formatTimeRange(start, end)).toBe("09:00 AM - 05:30 PM");
  });
});

describe("formatCreatedAt", () => {
  it("says Today for a timestamp from today", () => {
    const now = new Date();
    now.setHours(14, 5, 0, 0);
    expect(formatCreatedAt(now)).toBe("Today, 02:05 PM");
  });

  it("says Yesterday for a timestamp from yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 0, 0, 0);
    expect(formatCreatedAt(yesterday)).toBe("Yesterday, 09:00 AM");
  });

  it("names the date for anything older", () => {
    const old = new Date(2020, 0, 15, 10, 30);
    expect(formatCreatedAt(old)).toBe("January 15, 10:30 AM");
  });

  it("renders nothing for an empty value", () => {
    expect(formatCreatedAt(null)).toBe("");
  });
});
