import { describe, it, expect } from "vitest";
import { MatchService } from "@features/matching/api/MatchService";
import { VerificationService } from "@features/auth/api/VerificationService";
import { DashboardService } from "@features/dashboard/api/DashboardService";
import { AuthService } from "@features/auth/api/AuthService";

/**
 * Services are constructed with a client, so these run with a fake one and no
 * store at all — which is the reason the URLs were pulled out of the thunks.
 *
 * What is worth asserting is the shape of the call, not that a string was
 * copied correctly: which argument the body lands in, and that no method
 * reintroduces the hand-built Authorization header the interceptor supplies.
 */
const spy = () => {
  const calls = [];
  const record = (method) => (...args) => {
    calls.push({ method, args });
    return Promise.resolve({ data: {}, status: 200 });
  };
  return {
    calls,
    get: record("get"),
    delete: record("delete"),
    post: record("post"),
    put: record("put"),
    patch: record("patch"),
  };
};

describe("MatchService", () => {
  it("puts the match id in the query string, where the server reads it", async () => {
    const client = spy();
    await new MatchService(client).accept("m1");

    expect(client.calls[0].args[0]).toBe("/match/accept-incoming-request?matchId=m1");
  });

  it("sends no body on a decision, so the id is never duplicated into one", async () => {
    const client = spy();
    await new MatchService(client).block("m1");

    expect(client.calls[0].args[1]).toBeNull();
  });

  it("defaults paging rather than sending 'undefined' in the URL", async () => {
    const client = spy();
    await new MatchService(client).outgoingRequests();

    expect(client.calls[0].args[0]).toBe("/match/get-outgoing-requests?page=1&limit=10");
  });
});

describe("VerificationService", () => {
  it("routes email and SMS to their own prefixes", async () => {
    const client = spy();
    const service = new VerificationService(client);

    await service.sendEmailOtp({ email: "a@b.c" });
    await service.sendSmsOtp({ phoneNo: "1" });

    expect(client.calls.map((c) => c.args[0])).toEqual([
      "/email-verification/send-otp",
      "/sms-verification/send-otp",
    ]);
  });
});

describe("DashboardService", () => {
  it("busts the cache only when asked", async () => {
    // The nanny profile screen re-reads a user straight after an edit and got
    // the stale response without this; the family screen does not need it.
    const client = spy();
    const service = new DashboardService(client);

    await service.userById("u1");
    await service.userById("u1", { bustCache: true });

    expect(client.calls[0].args[0]).toBe("/userData/getById/u1");
    expect(client.calls[1].args[0]).toMatch(/^\/userData\/getById\/u1\?t=\d+$/);
  });
});

describe("no service rebuilds the session header", () => {
  it("leaves Authorization to the request interceptor", async () => {
    // 57 call sites used to set this by hand. If one comes back, it will read
    // the store at a moment the interceptor was written to avoid.
    const client = spy();
    const service = new AuthService(client);

    await service.login({ email: "a@b.c" });
    await service.sendOtp();
    await service.deleteUser("u1");

    const configs = client.calls.flatMap((call) => call.args.slice(1));
    expect(JSON.stringify(configs)).not.toMatch(/Authorization/i);
  });
});

// The "does the sheet record reach registerThunk intact" tests live in
// tests/features/onboardingRegistration.test.js — they exercise
// @features/onboarding/registration, which is where that mapping now happens
// for all three onboarding flows. Kept out of this file because these are
// about services and their URLs, not about form payloads.
