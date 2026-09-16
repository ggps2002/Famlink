import { describe, it, expect } from "vitest";
import {
  SIGNALS,
  THRESHOLDS,
  reasonsFor,
  score,
  toFlaggedRow,
} from "#src/modules/admin/suspiciousSignals.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-12T00:00:00Z").getTime();

const aUser = (over = {}) => ({
  _id: "u1",
  name: "Sam",
  email: "sam@example.com",
  type: "Nanny",
  status: "Active",
  createdAt: new Date(NOW - 30 * DAY_MS),
  lastLogin: new Date(NOW - DAY_MS),
  loginCount: 3,
  verified: { emailVer: true },
  ...over,
});

const codes = (user, counts) => reasonsFor(user, counts, NOW).map((reason) => reason.code);

describe("a normal account", () => {
  it("raises nothing", () => {
    expect(reasonsFor(aUser(), { sent: 3, accepted: 1, messages: 20, reports: 0 }, NOW)).toEqual(
      []
    );
  });
});

describe("already_reported", () => {
  it("fires on a single open report", () => {
    expect(codes(aUser(), { reports: 1 })).toContain(SIGNALS.ALREADY_REPORTED);
  });

  it("carries the highest weight, so it sorts to the top", () => {
    const [reason] = reasonsFor(aUser(), { reports: 1 }, NOW);

    expect(reason.weight).toBe(40);
  });

  it("says how many, and gets the plural right", () => {
    expect(reasonsFor(aUser(), { reports: 1 }, NOW)[0].detail).toBe("1 open report");
    expect(reasonsFor(aUser(), { reports: 3 }, NOW)[0].detail).toBe("3 open reports");
  });
});

describe("high_outbound_no_replies", () => {
  it("needs both halves — volume alone is a keen member", () => {
    expect(codes(aUser(), { sent: 50, accepted: 1 })).not.toContain(
      SIGNALS.HIGH_OUTBOUND_NO_REPLIES
    );
  });

  it("does not fire below the threshold", () => {
    // A handful of unanswered requests is the ordinary experience of a new
    // member on a small platform; flagging it would bury the real signal.
    expect(codes(aUser(), { sent: THRESHOLDS.outboundRequests - 1, accepted: 0 })).toEqual([]);
  });

  it("fires at the threshold with nothing accepted", () => {
    expect(codes(aUser(), { sent: THRESHOLDS.outboundRequests, accepted: 0 })).toContain(
      SIGNALS.HIGH_OUTBOUND_NO_REPLIES
    );
  });
});

describe("rapid_messaging", () => {
  it("fires only at a burst far above normal use", () => {
    expect(codes(aUser(), { messages: THRESHOLDS.messagesPerWeek - 1 })).toEqual([]);
    expect(codes(aUser(), { messages: THRESHOLDS.messagesPerWeek })).toContain(
      SIGNALS.RAPID_MESSAGING
    );
  });
});

describe("unverified_but_active", () => {
  it("needs heavy use as well as an unverified address", () => {
    const unverified = aUser({ verified: { emailVer: false }, loginCount: 1 });
    expect(codes(unverified, {})).toEqual([]);

    const active = aUser({ verified: { emailVer: false }, loginCount: 5 });
    expect(codes(active, {})).toContain(SIGNALS.UNVERIFIED_BUT_ACTIVE);
  });

  it("does not fire for a verified member however active", () => {
    expect(codes(aUser({ loginCount: 500 }), {})).toEqual([]);
  });

  it("treats a missing verification object as unverified", () => {
    const noRecord = aUser({ verified: undefined, loginCount: 10 });

    expect(codes(noRecord, {})).toContain(SIGNALS.UNVERIFIED_BUT_ACTIVE);
  });
});

describe("never_logged_in_after_signup", () => {
  it("waits out the grace period before flagging", () => {
    // The account has to have had a fair chance to come back.
    const fresh = aUser({ lastLogin: null, createdAt: new Date(NOW - 3 * DAY_MS) });
    expect(codes(fresh, {})).toEqual([]);

    const stale = aUser({ lastLogin: null, createdAt: new Date(NOW - 30 * DAY_MS) });
    expect(codes(stale, {})).toContain(SIGNALS.NEVER_LOGGED_IN);
  });

  it("carries the lowest weight — usually a broken funnel, not a bad actor", () => {
    const stale = aUser({ lastLogin: null, createdAt: new Date(NOW - 30 * DAY_MS) });

    expect(reasonsFor(stale, {}, NOW)[0].weight).toBe(5);
  });
});

describe("score", () => {
  it("sums the weights so the worst accounts sort first", () => {
    const reasons = reasonsFor(
      aUser({ verified: { emailVer: false }, loginCount: 10 }),
      { reports: 2, sent: 20, accepted: 0, messages: 200 },
      NOW
    );

    expect(score(reasons)).toBe(40 + 25 + 20 + 15);
  });

  it("is zero when nothing fired", () => {
    expect(score([])).toBe(0);
  });
});

describe("toFlaggedRow", () => {
  it("carries only the fields the console renders", () => {
    // The scan holds thousands of these in memory; there is no reason for a
    // password hash to be among them.
    const row = toFlaggedRow(aUser({ password: "hash", stripeId: "cus_1" }), []);

    expect(Object.keys(row.user).sort()).toEqual([
      "_id",
      "createdAt",
      "email",
      "lastLogin",
      "name",
      "status",
      "type",
    ]);
  });

  it("reports whether a moderator already flagged this account", () => {
    expect(toFlaggedRow(aUser(), []).alreadyFlagged).toBe(false);
    expect(toFlaggedRow(aUser({ suspiciousFlaggedAt: new Date() }), []).alreadyFlagged).toBe(true);
  });
});
