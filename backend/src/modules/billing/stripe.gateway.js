import Stripe from "stripe";
import config from "../../config/index.js";

/**
 * The Stripe API version this code is written against.
 *
 * Pinned deliberately. Stripe changes response shapes between versions, and an
 * unpinned client silently adopts whatever the account's default is — so an
 * account-level upgrade in the dashboard could change what `current_period_end`
 * means without a single line of this repository changing.
 */
const API_VERSION = "2024-06-20";

/**
 * Everything this application asks of Stripe, in one place.
 *
 * The point is the seam. Before this, five route files each constructed their
 * own `new Stripe(...)` at module scope and called the SDK inline, which meant
 * three things: importing a route opened a Stripe client, the same
 * "find-or-create a customer by email" dance was written out four times with
 * small differences, and none of it could be tested without either a network
 * call or module mocking. A service now receives a gateway and a test passes a
 * plain object.
 *
 * The client is built lazily so that importing this file — which the module
 * registry does at boot, and the test suite does transitively — does not
 * require STRIPE_SECRET_KEY to be set.
 */
export class StripeGateway {
  #client;

  constructor(client) {
    this.#client = client ?? null;
  }

  get client() {
    if (!this.#client) {
      this.#client = new Stripe(config.stripe.secretKey, { apiVersion: API_VERSION });
    }
    return this.#client;
  }

  /**
   * The Stripe customer for an email address, created if there isn't one.
   *
   * Looked up by email rather than by the stored `stripeId`, which is how this
   * has always worked. Worth knowing: if two Stripe customers share an address,
   * this takes the first the API returns, and a customer created outside the
   * app (by a manual dashboard entry, say) will be adopted.
   */
  async findOrCreateCustomer(email) {
    const existing = await this.client.customers.list({ email });
    if (existing.data.length > 0) return existing.data[0];

    return this.client.customers.create({ email });
  }

  attachPaymentMethod(paymentMethodId, customerId) {
    return this.client.paymentMethods.attach(paymentMethodId, { customer: customerId });
  }

  detachPaymentMethod(paymentMethodId) {
    return this.client.paymentMethods.detach(paymentMethodId);
  }

  setDefaultPaymentMethod(customerId, paymentMethodId) {
    return this.client.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  listCards(customerId) {
    return this.client.paymentMethods.list({ customer: customerId, type: "card" });
  }

  /**
   * Charge a saved card without the customer present.
   *
   * `off_session: true` tells Stripe there is nobody to complete a 3-D Secure
   * challenge, so a card that needs one fails here rather than hanging.
   */
  createPaymentIntent({ amount, customerId, paymentMethodId, userId }) {
    return this.client.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: { userId },
    });
  }

  createSubscription({ customerId, priceId, userId }) {
    return this.client.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ["latest_invoice.payment_intent"],
      // The webhook reads this back to find the member a payment belongs to.
      metadata: { userId },
    });
  }

  retrieveSubscription(subscriptionId) {
    return this.client.subscriptions.retrieve(subscriptionId);
  }

  /**
   * A Checkout Session, by the id Stripe puts in the success redirect.
   *
   * Read back from Stripe rather than trusted from the URL: the id arrives via
   * the member's own browser, so nothing it claims counts until Stripe says so.
   */
  retrieveCheckoutSession(sessionId) {
    return this.client.checkout.sessions.retrieve(sessionId);
  }

  /**
   * Every subscription a customer has had, current or not.
   *
   * `status: "all"` on purpose — the console is often opened precisely because
   * something was cancelled, and a list that hid cancelled rows would answer
   * "no subscription" to the question "what happened to their subscription".
   */
  listSubscriptions(customerId, limit = 10) {
    return this.client.subscriptions.list({ customer: customerId, limit, status: "all" });
  }

  listInvoices(customerId, limit = 10) {
    return this.client.invoices.list({ customer: customerId, limit });
  }

  /** Cancel at the end of the paid period, not immediately — they paid for it. */
  cancelSubscriptionAtPeriodEnd(subscriptionId) {
    return this.client.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }

  createCheckoutSession({ email, priceId, userId, successUrl, cancelUrl }) {
    return this.client.checkout.sessions.create({
      customer_email: email,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    });
  }

  /**
   * Verify a webhook's signature and return the event.
   *
   * Throws if the signature does not match, which is the only thing standing
   * between this endpoint and anyone on the internet marking accounts premium.
   * Requires the exact raw bytes of the request, which is why the webhook route
   * mounts before the JSON body parser.
   */
  constructWebhookEvent(payload, signature) {
    return this.client.webhooks.constructEvent(payload, signature, config.stripe.webhookSecret);
  }
}

export const stripeGateway = new StripeGateway();

export default stripeGateway;
