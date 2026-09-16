import { describe, it, expect, vi } from "vitest";
import { PaymentService } from "#src/modules/billing/payment.service.js";
import { RevenueService } from "#src/modules/billing/revenue.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "#src/core/errors/index.js";

const aUser = (over = {}) => ({
  _id: { toString: () => "u1" },
  email: "sam@example.com",
  name: "Sam",
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const build = (over = {}) => {
  const user = over.user ?? aUser();
  const userRepository = {
    findById: vi.fn().mockResolvedValue(user),
    ...over.userRepository,
  };

  const stripe = {
    findOrCreateCustomer: vi.fn().mockResolvedValue({ id: "cus_1" }),
    attachPaymentMethod: vi.fn().mockResolvedValue({}),
    detachPaymentMethod: vi.fn().mockResolvedValue({}),
    setDefaultPaymentMethod: vi.fn().mockResolvedValue({}),
    listCards: vi.fn().mockResolvedValue({ data: [] }),
    createPaymentIntent: vi.fn().mockResolvedValue({ id: "pi_1" }),
    createSubscription: vi.fn().mockResolvedValue({ id: "sub_1" }),
    retrieveSubscription: vi.fn(),
    cancelSubscriptionAtPeriodEnd: vi.fn(),
    createCheckoutSession: vi.fn().mockResolvedValue({ url: "https://checkout/x" }),
    ...over.stripe,
  };

  const sendSubscriptionConfirmedEmail = vi.fn().mockResolvedValue(undefined);

  return {
    service: new PaymentService({ userRepository, stripe, sendSubscriptionConfirmedEmail }),
    user,
    stripe,
    userRepository,
    sendSubscriptionConfirmedEmail,
  };
};

describe("saveCard", () => {
  it("404s a caller whose account is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.saveCard({ userId: "u1", paymentMethod: { id: "pm_1" } })).rejects.toThrow(
      NotFoundError
    );
  });

  it("400s a request with no payment method", async () => {
    const { service, stripe } = build();

    await expect(service.saveCard({ userId: "u1", paymentMethod: undefined })).rejects.toThrow(
      ValidationError
    );
    expect(stripe.attachPaymentMethod).not.toHaveBeenCalled();
  });

  it("attaches the card and mirrors the customer id onto the account", async () => {
    const { service, user, stripe } = build();

    const customerId = await service.saveCard({ userId: "u1", paymentMethod: { id: "pm_1" } });

    expect(stripe.attachPaymentMethod).toHaveBeenCalledWith("pm_1", "cus_1");
    expect(user.stripeId).toBe("cus_1");
    expect(customerId).toBe("cus_1");
  });
});

describe("listCards", () => {
  it("404s a member who has never paid for anything", async () => {
    const { service } = build();

    await expect(service.listCards("u1")).rejects.toThrow("No Cards found for the user!");
  });

  it("lists the customer's cards once there is a customer", async () => {
    const { service, stripe } = build({ user: aUser({ stripeId: "cus_1" }) });

    await service.listCards("u1");

    expect(stripe.listCards).toHaveBeenCalledWith("cus_1");
  });
});

describe("deleteCard", () => {
  it("400s when the member has no Stripe customer", async () => {
    const { service } = build();

    await expect(service.deleteCard({ userId: "u1", paymentMethodId: "pm_1" })).rejects.toThrow(
      ValidationError
    );
  });

  it("detaches the card", async () => {
    const { service, stripe } = build({ user: aUser({ stripeId: "cus_1" }) });

    await service.deleteCard({ userId: "u1", paymentMethodId: "pm_1" });

    expect(stripe.detachPaymentMethod).toHaveBeenCalledWith("pm_1");
  });
});

describe("createSubscription", () => {
  it("sets the card as the default, not merely attaches it", async () => {
    // A subscription bills the customer's default payment method; attaching
    // alone leaves the renewal with nothing to charge.
    const { service, stripe } = build();

    await service.createSubscription({ userId: "u1", paymentMethodId: "pm_1", planPriceId: "price_1" });

    expect(stripe.attachPaymentMethod).toHaveBeenCalledWith("pm_1", "cus_1");
    expect(stripe.setDefaultPaymentMethod).toHaveBeenCalledWith("cus_1", "pm_1");
  });

  it("mirrors the subscription onto the account", async () => {
    const { service, user } = build();

    await service.createSubscription({ userId: "u1", paymentMethodId: "pm_1", planPriceId: "p" });

    expect(user).toMatchObject({ stripeId: "cus_1", subscriptionId: "sub_1", premium: true });
    expect(user.save).toHaveBeenCalled();
  });

  it("succeeds even when the confirmation email fails", async () => {
    // They are subscribed either way; a mail failure must not read as a
    // payment failure.
    const { service } = build();
    service.sendSubscriptionConfirmedEmail = vi.fn().mockRejectedValue(new Error("smtp down"));

    await expect(
      service.createSubscription({ userId: "u1", paymentMethodId: "pm_1", planPriceId: "p" })
    ).resolves.toBe("sub_1");
  });
});

describe("createCheckoutSession", () => {
  it("writes nothing — the member has not paid yet", async () => {
    // `premium` is granted by the webhook, which is why the session carries the
    // member's id in its metadata.
    const { service, user, stripe } = build();

    await service.createCheckoutSession({ userId: "u1", priceId: "price_1" });

    expect(user.save).not.toHaveBeenCalled();
    expect(stripe.createCheckoutSession.mock.calls[0][0].userId).toBe("u1");
  });

  it("returns the hosted page's url", async () => {
    const { service } = build();

    expect(await service.createCheckoutSession({ userId: "u1", priceId: "p" })).toBe(
      "https://checkout/x"
    );
  });

  it("sends the member back to the dashboard either way", async () => {
    const { service, stripe } = build();

    await service.createCheckoutSession({ userId: "u1", priceId: "p" });

    const { successUrl, cancelUrl } = stripe.createCheckoutSession.mock.calls[0][0];
    expect(successUrl).toContain("/dashboard?status=success");
    expect(cancelUrl).toContain("/dashboard?status=cancelled");
  });
});

describe("cancelSubscription", () => {
  it("404s a member with no subscription", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue({}) } });

    await expect(service.cancelSubscription("u1")).rejects.toThrow("Subscription not found");
  });

  it("cancels at period end, not immediately — they paid for it", async () => {
    const { service, stripe } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ subscriptionId: "sub_1" }) },
      stripe: {
        cancelSubscriptionAtPeriodEnd: vi
          .fn()
          .mockResolvedValue({ cancel_at_period_end: true, current_period_end: 1_760_000_000 }),
      },
    });

    const result = await service.cancelSubscription("u1");

    expect(stripe.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith("sub_1");
    expect(result).toEqual({ cancelAtPeriodEnd: true, currentPeriodEnd: 1_760_000_000 });
  });
});

describe("subscriptionStatus", () => {
  it("reports inactive without calling Stripe when there is no subscription", async () => {
    const { service, stripe } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({}) },
    });

    expect(await service.subscriptionStatus("u1")).toEqual({ active: false });
    expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
  });

  it("reads the live status from Stripe, not the mirrored flag", async () => {
    // This is the screen someone opens when they think the flag is wrong.
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ subscriptionId: "sub_1" }) },
      stripe: {
        retrieveSubscription: vi.fn().mockResolvedValue({
          status: "active",
          cancel_at_period_end: false,
          current_period_end: 1_760_000_000,
          items: { data: [{ price: { nickname: "Premium" } }] },
        }),
      },
    });

    expect(await service.subscriptionStatus("u1")).toEqual({
      active: true,
      cancelAtPeriodEnd: false,
      periodEnd: 1_760_000_000,
      plan: "Premium",
    });
  });

  it("names an unnamed plan rather than showing undefined", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ subscriptionId: "sub_1" }) },
      stripe: {
        retrieveSubscription: vi.fn().mockResolvedValue({
          status: "past_due",
          items: { data: [{ price: {} }] },
        }),
      },
    });

    const status = await service.subscriptionStatus("u1");

    expect(status.plan).toBe("Unknown Plan");
    expect(status.active).toBe(false);
  });
});

describe("RevenueService", () => {
  const revenue = (over = {}) => {
    const userRepository = {
      findById: vi.fn().mockResolvedValue({ type: "Admin" }),
      ...over.userRepository,
    };
    const revenueRepository = {
      aggregate: vi.fn().mockResolvedValue([]),
      ...over.revenueRepository,
    };
    return {
      service: new RevenueService({ userRepository, revenueRepository }),
      revenueRepository,
    };
  };

  it("blocks a non-admin from both reports", async () => {
    const { service } = revenue({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await expect(service.currentMonthTotal({ adminId: "u1" })).rejects.toThrow(ForbiddenError);
    await expect(service.monthlyBreakdown({ adminId: "u1" })).rejects.toThrow(ForbiddenError);
  });

  it("reports zero for a month with no revenue", async () => {
    const { service } = revenue();

    expect(await service.currentMonthTotal({ adminId: "a1" })).toBe(0);
  });

  it("counts only payments since the first of the month", async () => {
    const { service, revenueRepository } = revenue();
    const now = new Date(2026, 7, 12);

    await service.currentMonthTotal({ adminId: "a1", now });

    const { $gte } = revenueRepository.aggregate.mock.calls[0][0][0].$match.paidAt;
    expect($gte).toEqual(new Date(2026, 7, 1));
  });

  it("includes every month to date, even the empty ones", async () => {
    // A chart that omits empty months draws a line straight from March to May
    // and hides the fact that April was zero.
    const { service } = revenue({
      revenueRepository: {
        aggregate: vi.fn().mockResolvedValue([
          { _id: 1, total: 100 },
          { _id: 3, total: 300 },
        ]),
      },
    });

    const result = await service.monthlyBreakdown({ adminId: "a1", now: new Date(2026, 3, 15) });

    expect(result).toEqual([
      { name: "Jan", revenue: 100, growth: 0 },
      { name: "Feb", revenue: 0, growth: -100 },
      { name: "Mar", revenue: 300, growth: 300 },
      { name: "Apr", revenue: 0, growth: -300 },
    ]);
  });

  it("stops at the current month rather than projecting the year", async () => {
    const { service } = revenue();

    const result = await service.monthlyBreakdown({ adminId: "a1", now: new Date(2026, 1, 5) });

    expect(result.map((row) => row.name)).toEqual(["Jan", "Feb"]);
  });
});
