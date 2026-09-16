import { describe, it, expect, vi } from "vitest";

import { PaymentService } from "#src/modules/billing/payment.service.js";

/**
 * The confirm-checkout endpoint, which grants Plus from the member's own
 * browser on the way back from Stripe.
 *
 * A second writer of `premium` is worth testing hard: the session id arrives
 * through the URL, so the only thing between it and a free upgrade is the
 * ownership check below.
 */

const service = ({ session, subscription } = {}) => {
  const userRepository = { updateById: vi.fn().mockResolvedValue({}) };
  const stripe = {
    retrieveCheckoutSession: vi.fn().mockResolvedValue(session),
    retrieveSubscription: vi.fn().mockResolvedValue(subscription),
  };
  return {
    service: new PaymentService({ userRepository, stripe, sendSubscriptionConfirmedEmail: vi.fn() }),
    userRepository,
    stripe,
  };
};

const paidSession = (userId) => ({
  metadata: { userId },
  payment_status: "paid",
  subscription: "sub_123",
  customer: "cus_123",
});

describe("confirmCheckout", () => {
  it("grants Plus for the member's own paid session", async () => {
    const { service: s, userRepository } = service({
      session: paidSession("user-1"),
      subscription: { status: "active" },
    });

    const result = await s.confirmCheckout({ userId: "user-1", sessionId: "cs_1" });

    expect(result).toEqual({ premium: true, status: "active" });
    expect(userRepository.updateById).toHaveBeenCalledWith("user-1", {
      stripeId: "cus_123",
      subscriptionId: "sub_123",
      subscriptionStatus: "active",
      premium: true,
    });
  });

  it("refuses a session belonging to somebody else", async () => {
    // The whole reason the server re-reads the session: without this check,
    // pasting another member's session id into the URL would buy you Plus on
    // their payment.
    const { service: s, userRepository } = service({
      session: paidSession("someone-else"),
      subscription: { status: "active" },
    });

    await expect(
      s.confirmCheckout({ userId: "user-1", sessionId: "cs_1" }),
    ).rejects.toThrow(/does not belong/i);

    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("writes nothing for a session that has not been paid", async () => {
    // Not an error: a session can legitimately be open or expired. The caller
    // shows "still confirming" rather than claiming a failure.
    const { service: s, userRepository } = service({
      session: { ...paidSession("user-1"), payment_status: "unpaid" },
    });

    await expect(s.confirmCheckout({ userId: "user-1", sessionId: "cs_1" })).resolves.toEqual({
      premium: false,
      status: "unpaid",
    });
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("mirrors a non-granting subscription status without granting", async () => {
    // Paid, but the subscription is incomplete — the status is recorded so the
    // admin console can explain the account, and premium stays false.
    const { service: s, userRepository } = service({
      session: paidSession("user-1"),
      subscription: { status: "incomplete" },
    });

    const result = await s.confirmCheckout({ userId: "user-1", sessionId: "cs_1" });

    expect(result).toEqual({ premium: false, status: "incomplete" });
    expect(userRepository.updateById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ premium: false, subscriptionStatus: "incomplete" }),
    );
  });

  it("rejects a missing session id before calling Stripe", async () => {
    const { service: s, stripe } = service({});
    await expect(s.confirmCheckout({ userId: "user-1" })).rejects.toThrow(/session id/i);
    expect(stripe.retrieveCheckoutSession).not.toHaveBeenCalled();
  });
});
