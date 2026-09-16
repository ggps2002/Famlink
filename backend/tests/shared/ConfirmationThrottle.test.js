import { describe, it, expect } from "vitest";
import { ConfirmationThrottle } from "#src/shared/throttle/ConfirmationThrottle.js";

describe("ConfirmationThrottle", () => {
  it("allows a first-time address", () => {
    const throttle = new ConfirmationThrottle();

    expect(throttle.claim({ key: "a@b.com", ip: "1.1.1.1" })).toBe("allowed");
  });

  it("refuses a second send to the same address inside the window", () => {
    // A double submit or a retry must not mail a second copy.
    const throttle = new ConfirmationThrottle();
    throttle.claim({ key: "a@b.com", ip: "1.1.1.1" });

    expect(throttle.claim({ key: "a@b.com", ip: "1.1.1.1" })).toBe("already-sent");
  });

  it("claims the slot before the send, so simultaneous submits cannot both pass", () => {
    // The claim is the check — two requests arriving together get different
    // answers rather than both seeing an empty map.
    const throttle = new ConfirmationThrottle();

    const first = throttle.claim({ key: "a@b.com", ip: "1.1.1.1" });
    const second = throttle.claim({ key: "a@b.com", ip: "2.2.2.2" });

    expect([first, second]).toEqual(["allowed", "already-sent"]);
  });

  it("lets the address through again once the window has passed", () => {
    const throttle = new ConfirmationThrottle({ windowMs: 1000 });
    const t0 = Date.now();

    throttle.claim({ key: "a@b.com", ip: "1.1.1.1", now: t0 });

    expect(throttle.claim({ key: "a@b.com", ip: "1.1.1.1", now: t0 + 2000 })).toBe("allowed");
  });

  it("caps how many sends one IP can trigger", () => {
    const throttle = new ConfirmationThrottle({ maxPerIp: 3 });

    for (let i = 0; i < 3; i += 1) {
      expect(throttle.claim({ key: `a${i}@b.com`, ip: "1.1.1.1" })).toBe("allowed");
    }

    expect(throttle.claim({ key: "another@b.com", ip: "1.1.1.1" })).toBe("ip-limited");
  });

  it("counts the IP limit per address, not globally", () => {
    const throttle = new ConfirmationThrottle({ maxPerIp: 1 });
    throttle.claim({ key: "a@b.com", ip: "1.1.1.1" });

    expect(throttle.claim({ key: "c@d.com", ip: "9.9.9.9" })).toBe("allowed");
  });

  it("makes a failed send retryable rather than locking the address out", () => {
    // Without release(), a mail error would block that address for the whole
    // window by our own throttle.
    const throttle = new ConfirmationThrottle();
    throttle.claim({ key: "a@b.com", ip: "1.1.1.1" });

    throttle.release("a@b.com");

    expect(throttle.claim({ key: "a@b.com", ip: "1.1.1.1" })).toBe("allowed");
  });

  it("forgets IP history once the window has passed", () => {
    const throttle = new ConfirmationThrottle({ windowMs: 1000, maxPerIp: 1 });
    const t0 = Date.now();

    throttle.claim({ key: "a@b.com", ip: "1.1.1.1", now: t0 });

    expect(throttle.claim({ key: "b@b.com", ip: "1.1.1.1", now: t0 + 2000 })).toBe("allowed");
  });
});
