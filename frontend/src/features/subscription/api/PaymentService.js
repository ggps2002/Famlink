import { HttpService } from "@shared/api/HttpService";

/**
 * Stripe: saved cards, subscriptions, and the two ways a payment can start.
 *
 * `createCheckoutSession` is the live path: the server creates a session and the
 * browser is redirected to Stripe's own page. The older embedded-Elements calls
 * that used to sit alongside it (`createPayment`, `webhook`) are gone — nothing
 * dispatched them and the server serves neither route.
 */
export class PaymentService extends HttpService {
  saveCard(body) {
    return this.post("/payment/stripe/save-card", body);
  }

  savedCards() {
    return this.get("/payment/stripe/get-save-cards");
  }

  deleteCard(paymentMethodId) {
    return this.delete(`/payment/stripe/delete-card/${paymentMethodId}`);
  }

  createSubscription(body) {
    return this.post("/payment/stripe/create-subscription", body);
  }

  subscriptionStatus() {
    return this.get("/payment/stripe/subscription-status");
  }

  cancelSubscription(body) {
    return this.post("/payment/stripe/cancel-subscription", body);
  }

  createCheckoutSession(body) {
    return this.post("/payment/stripe/create-checkout-session", body);
  }

  /**
   * Settle the upgrade on the way back from Stripe.
   *
   * Stripe's redirect beats its webhook, so without this a member who has paid
   * is shown the free tier until the webhook lands — and locally it never
   * lands, because Stripe cannot reach a laptop. The server re-reads the
   * session from Stripe and checks it belongs to the caller before granting
   * anything, so the id travelling through the browser proves nothing on its own.
   */
  confirmCheckout(sessionId) {
    return this.post("/payment/stripe/confirm-checkout", { sessionId });
  }
}

export const paymentService = new PaymentService();
export default paymentService;
