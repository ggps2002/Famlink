import { describe, it, expect, vi, afterEach } from "vitest";
import { DebugService } from "#src/modules/debug/debug.service.js";
import config from "#src/config/index.js";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "#src/core/errors/index.js";

// `config.isProduction` is read at call time, so the access rule can be
// exercised both ways without reloading the module.
const inProduction = (value) => {
  Object.defineProperty(config, "isProduction", { value, configurable: true });
};

afterEach(() => inProduction(false));

const anAccount = (over = {}) => ({
  _id: "u1",
  name: "Sam",
  email: "sam@example.com",
  type: "Nanny",
  referralCode: "SAM123",
  ...over,
});

const build = (over = {}) => {
  const userRepository = {
    findById: vi.fn().mockResolvedValue(anAccount()),
    findOne: vi.fn().mockResolvedValue(anAccount()),
    find: vi.fn().mockResolvedValue([]),
    ...over.userRepository,
  };

  const creditReferrer = vi.fn().mockResolvedValue(null);
  const sendReferralRewardEmail = vi.fn().mockResolvedValue(undefined);
  const sendWelcomeEmail = vi.fn().mockResolvedValue({ response: "250 OK", messageId: "<1>" });

  return {
    service: new DebugService({
      userRepository,
      creditReferrer,
      sendReferralRewardEmail,
      sendWelcomeEmail,
    }),
    userRepository,
    creditReferrer,
    sendReferralRewardEmail,
    sendWelcomeEmail,
  };
};

describe("the production gate", () => {
  it("lets anyone inspect referrals outside production", async () => {
    // Open in dev so it can be hit straight from a browser.
    const { service } = build();

    await expect(service.inspectReferral({ requesterId: "u1" })).resolves.toBeTruthy();
  });

  it("requires an admin in production", async () => {
    inProduction(true);
    const { service } = build();

    await expect(service.inspectReferral({ requesterId: "u1" })).rejects.toThrow(ForbiddenError);
    await expect(service.recreditReferral({ requesterId: "u1", email: "x@y.com" })).rejects.toThrow(
      ForbiddenError
    );
  });

  it("admits an admin in production", async () => {
    inProduction(true);
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(anAccount({ type: "Admin" })) },
    });

    await expect(service.inspectReferral({ requesterId: "a1" })).resolves.toBeTruthy();
  });
});

describe("inspectReferral", () => {
  it("looks up by email, then by code, then falls back to the caller", async () => {
    const { service, userRepository } = build();

    await service.inspectReferral({ requesterId: "u1", email: " sam@example.com " });
    expect(userRepository.findOne.mock.calls[0][0]).toEqual({ email: "sam@example.com" });

    await service.inspectReferral({ requesterId: "u1", code: " sam123 " });
    // Codes are stored uppercase, so a pasted lowercase one still resolves.
    expect(userRepository.findOne.mock.calls[1][0]).toEqual({ referralCode: "SAM123" });

    await service.inspectReferral({ requesterId: "u1" });
    expect(userRepository.findOne.mock.calls[2][0]).toEqual({ _id: "u1" });
  });

  it("404s when nothing matched", async () => {
    const { service } = build({ userRepository: { findOne: vi.fn().mockResolvedValue(null) } });

    await expect(service.inspectReferral({ requesterId: "u1" })).rejects.toThrow(NotFoundError);
  });

  it("separates 'never linked' from 'linked but not credited'", async () => {
    // The whole point of the endpoint: a "my referral didn't pay out" report is
    // one of exactly these two things.
    const unlinked = build();
    expect((await unlinked.service.inspectReferral({ requesterId: "u1" })).referredByStatus).toBe(
      "not linked to any referrer"
    );

    const linked = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(anAccount({ referredBy: "r1" })) },
    });
    expect((await linked.service.inspectReferral({ requesterId: "u1" })).referredByStatus).toBe(
      "linked, NOT yet credited"
    );

    const credited = build({
      userRepository: {
        findOne: vi
          .fn()
          .mockResolvedValue(anAccount({ referredBy: "r1", referralCreditedAt: "2026-01-01" })),
      },
    });
    expect((await credited.service.inspectReferral({ requesterId: "u1" })).referredByStatus).toBe(
      "linked & credited"
    );
  });

  it("reports whether the referrer's free matching is still running", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();

    const active = build({
      userRepository: {
        findOne: vi.fn().mockResolvedValue(anAccount({ referralMatchingUntil: future })),
      },
    });
    expect((await active.service.inspectReferral({ requesterId: "u1" })).account.hasActiveMatching).toBe(
      true
    );

    const expired = build({
      userRepository: {
        findOne: vi.fn().mockResolvedValue(anAccount({ referralMatchingUntil: past })),
      },
    });
    expect(
      (await expired.service.inspectReferral({ requesterId: "u1" })).account.hasActiveMatching
    ).toBe(false);
  });

  it("lists everyone the account referred, with each one's state", async () => {
    const { service } = build({
      userRepository: {
        find: vi.fn().mockResolvedValue([
          { name: "A", email: "a@x.com", nannyProfileCompleted: true, referralCreditedAt: "2026-01-01" },
          { name: "B", email: "b@x.com", nannyProfileCompleted: false },
        ]),
      },
    });

    const { referredFriends } = await service.inspectReferral({ requesterId: "u1" });

    expect(referredFriends.map((friend) => friend.credited)).toEqual([true, false]);
  });
});

describe("recreditReferral", () => {
  it("requires an email", async () => {
    const { service } = build();

    await expect(service.recreditReferral({ requesterId: "u1", email: "  " })).rejects.toThrow(
      ValidationError
    );
  });

  it("404s an address with no account", async () => {
    const { service } = build({ userRepository: { findOne: vi.fn().mockResolvedValue(null) } });

    await expect(
      service.recreditReferral({ requesterId: "u1", email: "nobody@x.com" })
    ).rejects.toThrow(NotFoundError);
  });

  it("explains when the friend was never linked to a referrer", async () => {
    const { service, creditReferrer } = build();

    await expect(
      service.recreditReferral({ requesterId: "u1", email: "sam@example.com" })
    ).rejects.toThrow("never linked to a referrer");
    expect(creditReferrer).not.toHaveBeenCalled();
  });

  it("reports no change when the payout was already made", async () => {
    // Idempotent: the underlying claim is atomic, so this cannot double-pay.
    const { service } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(anAccount({ referredBy: "r1" })) },
    });

    expect(await service.recreditReferral({ requesterId: "u1", email: "sam@example.com" })).toEqual({
      credited: false,
      message: "Already credited (or nothing to do) — no change made",
    });
  });

  it("credits the referrer and emails them", async () => {
    const { service, creditReferrer, sendReferralRewardEmail } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(anAccount({ referredBy: "r1" })) },
    });
    creditReferrer.mockResolvedValue({
      referrer: { _id: "r1", email: "ref@x.com", name: "Ref", referralCount: 1 },
      referred: { name: "Sam", email: "sam@example.com" },
    });

    const result = await service.recreditReferral({ requesterId: "u1", email: "sam@example.com" });

    expect(result.credited).toBe(true);
    expect(sendReferralRewardEmail).toHaveBeenCalled();
  });
});

describe("sendTestEmail", () => {
  it("requires an admin even outside production", async () => {
    // Unlike the referral routes: this one sends real mail to an address of
    // the caller's choosing, so it stays shut in every environment.
    const { service } = build();

    await expect(service.sendTestEmail({ requesterId: "u1" })).rejects.toThrow(ForbiddenError);
  });

  it("401s when the token names an account that is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.sendTestEmail({ requesterId: "ghost" })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("defaults to the admin's own address", async () => {
    const { service, sendWelcomeEmail } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue(anAccount({ type: "Admin", email: "admin@x.com" })),
      },
    });

    const result = await service.sendTestEmail({ requesterId: "a1" });

    expect(sendWelcomeEmail.mock.calls[0][0]).toBe("admin@x.com");
    expect(result).toMatchObject({
      ok: true,
      message: "Test email queued for admin@x.com; the dispatcher will send it within seconds.",
    });
  });

  it("sends to a named address when one is given", async () => {
    const { service, sendWelcomeEmail } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(anAccount({ type: "Admin" })) },
    });

    await service.sendTestEmail({ requesterId: "a1", to: " to@x.com ", name: "Pat" });

    expect(sendWelcomeEmail.mock.calls[0].slice(0, 2)).toEqual(["to@x.com", "Pat"]);
  });

  it("400s when there is no address to send to at all", async () => {
    const { service } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue(anAccount({ type: "Admin", email: null })),
      },
    });

    await expect(service.sendTestEmail({ requesterId: "a1" })).rejects.toThrow(ValidationError);
  });
});
