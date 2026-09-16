import { describe, it, expect, vi } from "vitest";
import { StripeWebhookService } from "#src/modules/billing/webhook.service.js";

const build = (over = {}) => {
  const stripe = {
    constructWebhookEvent: vi.fn((payload) => payload),
    retrieveSubscription: vi.fn().mockResolvedValue({ status: "active" }),
    ...over.stripe,
  };

  const userRepository = {
    updateById: vi.fn().mockResolvedValue({}),
    findOne: vi.fn().mockResolvedValue(null),
    ...over.userRepository,
  };

  const revenueRepository = {
    create: vi.fn().mockResolvedValue({}),
    ...over.revenueRepository,
  };

  return {
    service: new StripeWebhookService({ stripe, userRepository, revenueRepository }),
    stripe,
    userRepository,
    revenueRepository,
  };
};

const event = (type, object) => ({ type, data: { object } });

const checkout = (over = {}) => ({
  metadata: { userId: "u1" },
  subscription: "sub_1",
  customer: "cus_1",
  amount_total: 2900,
  currency: "usd",
  ...over,
});

describe("signature verification", () => {
  it("runs before the body is looked at", async () => {
    // The only thing between this endpoint and anyone on the internet marking
    // accounts premium.
    const { service, userRepository } = build({
      stripe: {
        constructWebhookEvent: vi.fn(() => {
          throw Object.assign(new Error("bad sig"), {
            type: "StripeSignatureVerificationError",
          });
        }),
      },
    });

    await expect(service.handle({ payload: Buffer.from("{}"), signature: "x" })).rejects.toThrow(
      "bad sig"
    );
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("passes the raw payload and signature straight through", async () => {
    const { service, stripe } = build();
    const payload = Buffer.from('{"type":"noop"}');

    stripe.constructWebhookEvent.mockReturnValue(event("noop", {}));
    await service.handle({ payload, signature: "sig_1" });

    expect(stripe.constructWebhookEvent).toHaveBeenCalledWith(payload, "sig_1");
  });
});

describe("unknown events", () => {
  it("reports them as ignored rather than failing", async () => {
    // Stripe retries a non-2xx, and retrying will not make us understand an
    // event type we do not handle.
    const { service } = build();

    expect(await service.handle({ payload: event("invoice.created", {}) })).toEqual({
      status: "ignored",
      type: "invoice.created",
    });
  });
});

describe("checkout.session.completed", () => {
  it("grants premium and records the first payment", async () => {
    const { service, userRepository, revenueRepository } = build();

    await service.handle({ payload: event("checkout.session.completed", checkout()) });

    expect(userRepository.updateById).toHaveBeenCalledWith("u1", {
      // `stripeId` joined the other three. Only the older Elements path
      // (payment.service.createSubscription) used to set it, so a member who
      // subscribed through Checkout became premium with no customer id — and
      // listCards then threw "No Cards found for the user!" at someone who was
      // actively paying.
      stripeId: "cus_1",
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
      premium: true,
    });
    expect(revenueRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", amount: 2900, type: "initial" })
    );
  });

  it("treats a trial as premium", async () => {
    // Locking someone out during a trial is the opposite of what a trial is for.
    const { service, userRepository } = build({
      stripe: { retrieveSubscription: vi.fn().mockResolvedValue({ status: "trialing" }) },
    });

    await service.handle({ payload: event("checkout.session.completed", checkout()) });

    expect(userRepository.updateById.mock.calls[0][1].premium).toBe(true);
  });

  it("does not grant premium for a subscription that is not live", async () => {
    const { service, userRepository } = build({
      stripe: { retrieveSubscription: vi.fn().mockResolvedValue({ status: "incomplete" }) },
    });

    await service.handle({ payload: event("checkout.session.completed", checkout()) });

    expect(userRepository.updateById.mock.calls[0][1].premium).toBe(false);
  });

  it("skips a session with no member to attribute it to", async () => {
    // A retry will not add metadata that was never sent.
    const { service, userRepository, revenueRepository } = build();

    const result = await service.handle({
      payload: event("checkout.session.completed", checkout({ metadata: {} })),
    });

    expect(result.status).toBe("handled");
    expect(userRepository.updateById).not.toHaveBeenCalled();
    expect(revenueRepository.create).not.toHaveBeenCalled();
  });

  it("records zero rather than undefined when Stripe sends no total", async () => {
    const { service, revenueRepository } = build();

    await service.handle({
      payload: event("checkout.session.completed", checkout({ amount_total: undefined })),
    });

    expect(revenueRepository.create.mock.calls[0][0].amount).toBe(0);
  });
});

describe("invoice.payment_succeeded", () => {
  const invoice = (over = {}) => ({
    subscription: "sub_1",
    customer: "cus_1",
    amount_paid: 2900,
    currency: "usd",
    created: 1_760_000_000,
    ...over,
  });

  it("records a renewal against the subscription's owner", async () => {
    const { service, revenueRepository } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue({ _id: "u1" }) },
    });

    await service.handle({ payload: event("invoice.payment_succeeded", invoice()) });

    expect(revenueRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "renewal", amount: 2900 })
    );
  });

  it("converts Stripe's seconds to milliseconds", async () => {
    // Without this every renewal lands in January 1970 and the revenue chart
    // shows nothing.
    const { service, revenueRepository } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue({ _id: "u1" }) },
    });

    await service.handle({ payload: event("invoice.payment_succeeded", invoice()) });

    expect(revenueRepository.create.mock.calls[0][0].paidAt.getUTCFullYear()).toBe(2025);
  });

  it("skips a renewal for a subscription no member holds", async () => {
    const { service, revenueRepository } = build();

    await service.handle({ payload: event("invoice.payment_succeeded", invoice()) });

    expect(revenueRepository.create).not.toHaveBeenCalled();
  });

  it("does not touch premium — a renewal is revenue, not access", async () => {
    const { service, userRepository } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue({ _id: "u1" }) },
    });

    await service.handle({ payload: event("invoice.payment_succeeded", invoice()) });

    expect(userRepository.updateById).not.toHaveBeenCalled();
  });
});

describe("subscription updated / deleted", () => {
  const aUser = (over = {}) => ({
    email: "sam@example.com",
    save: vi.fn().mockResolvedValue(undefined),
    ...over,
  });

  it.each(["customer.subscription.updated", "customer.subscription.deleted"])(
    "revokes premium on %s when the status is not live",
    async (type) => {
      const user = aUser();
      const { service } = build({ userRepository: { findOne: vi.fn().mockResolvedValue(user) } });

      await service.handle({ payload: event(type, { id: "sub_1", status: "canceled" }) });

      expect(user.subscriptionStatus).toBe("canceled");
      expect(user.premium).toBe(false);
      expect(user.save).toHaveBeenCalled();
    }
  );

  it("restores premium when a subscription becomes active again", async () => {
    // One handler covers both directions, so recovering from a failed payment
    // needs no separate case.
    const user = aUser({ premium: false });
    const { service } = build({ userRepository: { findOne: vi.fn().mockResolvedValue(user) } });

    await service.handle({
      payload: event("customer.subscription.updated", { id: "sub_1", status: "active" }),
    });

    expect(user.premium).toBe(true);
  });

  it("does nothing for a subscription no member holds", async () => {
    const { service } = build();

    await expect(
      service.handle({
        payload: event("customer.subscription.deleted", { id: "sub_x", status: "canceled" }),
      })
    ).resolves.toEqual({ status: "handled", type: "customer.subscription.deleted" });
  });
});
