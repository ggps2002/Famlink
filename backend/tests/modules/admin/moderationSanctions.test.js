import { describe, it, expect } from "vitest";
import {
  OUTCOMES,
  MIN_SUSPEND_DAYS,
  MAX_SUSPEND_DAYS,
  sanctionFor,
  isValidSuspendDays,
} from "#src/modules/admin/moderationSanctions.js";

const NOW = new Date("2026-08-12T00:00:00Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

const apply = (action, extra = {}) =>
  sanctionFor({ action, note: "Repeated harassment of caregivers", userId: "u1", now: NOW, ...extra });

describe("the outcome vocabulary", () => {
  it("is the five the queue offers", () => {
    expect(OUTCOMES).toEqual(["warned", "suspended", "blocked", "deleted", "dismissed"]);
  });

  it("returns nothing for an outcome it does not recognise", () => {
    expect(apply("banished")).toEqual({ update: null, sanction: null });
  });
});

describe("warned", () => {
  it("changes nothing on the account", () => {
    // A warning is recorded on the report so a second complaint shows this
    // person has already been spoken to — but it is not a status change.
    expect(apply("warned")).toEqual({ update: null, sanction: { type: "warned" } });
  });

  it("is still reported as a sanction, unlike a dismissal", () => {
    expect(apply("warned").sanction).toEqual({ type: "warned" });
    expect(apply("dismissed").sanction).toBeNull();
  });
});

describe("dismissed", () => {
  it("touches nothing and records no sanction", () => {
    expect(apply("dismissed")).toEqual({ update: null, sanction: null });
  });
});

describe("suspended", () => {
  it("sets an end date the stated number of days out", () => {
    const { update, sanction } = apply("suspended", { suspendDays: 7 });

    expect(update.$set.status).toBe("Suspended");
    expect(update.$set.suspendedUntil).toEqual(new Date(NOW + 7 * DAY_MS));
    expect(sanction).toEqual({
      type: "suspended",
      until: new Date(NOW + 7 * DAY_MS),
      days: 7,
    });
  });

  it("records the moderator's reasoning on the account", () => {
    // Internal only — it is never shown to the member, because in a small local
    // marketplace the wording identifies the reporter.
    expect(apply("suspended", { suspendDays: 7 }).update.$set.moderationReason).toBe(
      "Repeated harassment of caregivers"
    );
  });
});

describe("blocked", () => {
  it("is indefinite, and clears any suspension end date", () => {
    // A stale `suspendedUntil` would let a blocked account come back on its own.
    const { update } = apply("blocked");

    expect(update.$set.status).toBe("Block");
    expect(update.$set.suspendedUntil).toBeNull();
  });
});

describe("deleted", () => {
  it("is a soft delete — the row survives", () => {
    const { update } = apply("deleted");

    expect(update.$set.status).toBe("Deleted");
    expect(update.$set.deletedAt).toEqual(new Date(NOW));
  });

  it("overwrites the address rather than removing it", () => {
    // Keeps the unique index satisfied and lets the person register again.
    expect(apply("deleted").update.$set.email).toBe("deleted+u1@famlink.invalid");
  });

  it("strips the credentials and the contact details", () => {
    const { $set } = apply("deleted").update;

    expect($set.password).toBeNull();
    expect($set.phoneNo).toBeNull();
    expect($set.imageUrl).toBeNull();
    expect($set.premium).toBe(false);
  });

  it("removes the home address and any live reset token outright", () => {
    // Not things a soft delete should keep.
    expect(Object.keys(apply("deleted").update.$unset).sort()).toEqual([
      "location",
      "otp",
      "resetPasswordToken",
    ]);
  });
});

describe("isValidSuspendDays", () => {
  it("accepts the documented range", () => {
    expect(isValidSuspendDays(MIN_SUSPEND_DAYS)).toBe(true);
    expect(isValidSuspendDays(MAX_SUSPEND_DAYS)).toBe(true);
    expect(isValidSuspendDays("30")).toBe(true);
  });

  it("rejects zero, negatives and anything past a year", () => {
    // A zero-day suspension is a no-op dressed as a sanction; a multi-year one
    // is a block that will quietly expire.
    expect(isValidSuspendDays(0)).toBe(false);
    expect(isValidSuspendDays(-5)).toBe(false);
    expect(isValidSuspendDays(366)).toBe(false);
  });

  it("rejects anything that is not a finite number", () => {
    expect(isValidSuspendDays("soon")).toBe(false);
    expect(isValidSuspendDays(undefined)).toBe(false);
    expect(isValidSuspendDays(Infinity)).toBe(false);
  });
});
