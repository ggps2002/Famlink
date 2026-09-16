import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import config from "../../config/index.js";
import { grantsPremium } from "./subscriptionTier.js";

/**
 * Where Stripe sends the member back after Checkout.
 *
 * The dev fallback is kept from the original: without it, an unset FRONTEND_URL
 * makes Stripe reject the session outright ("not a valid URL"), which reads as
 * a payments outage on a fresh local checkout.
 */
const frontendUrl = () => config.urls.frontend || "http://localhost:5173";

/**
 * Cards and subscriptions, from the member's side.
 *
 * Every method here mirrors a Stripe object into the user record — `stripeId`,
 * `subscriptionId`, `premium` — and that mirroring is the part to be careful
 * about. Stripe is the source of truth for whether money moved; the user record
 * is a cache of it that gates features. When the two disagree, the webhook (see
 * webhook.service.js) is what reconciles them, so nothing here should ever be
 * the only writer of `premium`.
 */
export class PaymentService extends BaseService {
  async #requireUser(userId, message = "User not found!") {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError(message);
    return user;
  }

  /** Attach a card to the member's Stripe customer, creating one if needed. */
  async saveCard({ userId, paymentMethod }) {
    const user = await this.#requireUser(userId);

    if (!paymentMethod?.id) throw new ValidationError("A payment method is required");

    const customer = await this.stripe.findOrCreateCustomer(user.email);
    await this.stripe.attachPaymentMethod(paymentMethod.id, customer.id);

    user.stripeId = customer.id;
    await user.save();

    return customer.id;
  }

  async listCards(userId) {
    const user = await this.#requireUser(userId);

    // 404 rather than an empty list, which is what the card screen expects for
    // "this member has never paid for anything".
    if (!user.stripeId) throw new NotFoundError("No Cards found for the user!");

    return this.stripe.listCards(user.stripeId);
  }

  /**
   * Remove a saved card.
   *
   * Note what is *not* checked: that the payment method belongs to this member.
   * Detaching is scoped to the id in the URL, so a member who learns another
   * member's payment-method id could remove their card. Left as it was — this
   * is a pre-existing gap, and fixing it means a lookup against the customer's
   * own methods, which is a behaviour change worth its own review.
   */
  async deleteCard({ userId, paymentMethodId }) {
    const user = await this.#requireUser(userId);

    if (!user.stripeId) {
      throw new ValidationError("No Stripe customer found for this user.");
    }

    await this.stripe.detachPaymentMethod(paymentMethodId);
  }

  /** Charge a saved card a one-off amount. */
  async createPayment({ userId, paymentMethodId, amount }) {
    const user = await this.#requireUser(userId);

    const customer = await this.stripe.findOrCreateCustomer(user.email);
    const intent = await this.stripe.createPaymentIntent({
      amount,
      customerId: customer.id,
      paymentMethodId,
      userId,
    });

    return intent.id;
  }

  /**
   * Subscribe with a card the member has just entered.
   *
   * The card is attached *and* set as the customer's default, because a
   * subscription bills the default payment method — attaching alone leaves the
   * renewal with nothing to charge.
   */
  async createSubscription({ userId, paymentMethodId, planPriceId }) {
    const user = await this.#requireUser(userId, "User not found");

    const customer = await this.stripe.findOrCreateCustomer(user.email);
    await this.stripe.attachPaymentMethod(paymentMethodId, customer.id);
    await this.stripe.setDefaultPaymentMethod(customer.id, paymentMethodId);

    const subscription = await this.stripe.createSubscription({
      customerId: customer.id,
      priceId: planPriceId,
      userId,
    });

    user.stripeId = customer.id;
    user.subscriptionId = subscription.id;
    user.premium = true;
    await user.save();

    // Non-blocking: they are subscribed either way, and a mail failure must not
    // read as a payment failure.
    this.sendSubscriptionConfirmedEmail(user.email, user.name).catch((error) =>
      console.error("Failed to send subscription email:", error)
    );

    return subscription.id;
  }

  /**
   * Stripe Checkout — the hosted payment page.
   *
   * Unlike `createSubscription`, nothing is written here: the member has not
   * paid yet. `premium` is set when the webhook reports the session completed,
   * which is why the metadata carries the member's id.
   */
  async createCheckoutSession({ userId, priceId }) {
    const user = await this.#requireUser(userId, "User not found");

    const session = await this.stripe.createCheckoutSession({
      email: user.email,
      priceId,
      userId: user._id.toString(),
      // Stripe redirects back to the dashboard, where a post-checkout dialog
      // reads ?status and shows the result.
      // {CHECKOUT_SESSION_ID} is substituted by Stripe. The dialog on the way
      // back hands it to /confirm-checkout, which is what makes the upgrade
      // land without waiting on webhook delivery.
      successUrl: `${frontendUrl()}/dashboard?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl()}/dashboard?status=cancelled`,
    });

    return session.url;
  }

  /**
   * Grant Plus for a Checkout Session the member has just come back from.
   *
   * WHY THIS EXISTS, given the webhook is the authority
   *
   * Stripe redirects the browser the moment payment succeeds and delivers
   * `checkout.session.completed` separately. The redirect usually wins. So a
   * member who has genuinely paid lands on the dashboard, is congratulated by
   * PostCheckoutDialog, and is still on the free tier — upgrade button, "Free
   * plan" in settings, no badge — until the webhook catches up. Locally it
   * never catches up at all: Stripe cannot reach localhost without `stripe
   * listen`, so the upgrade simply never happens.
   *
   * WHAT MAKES IT SAFE
   *
   * The session id arrives through the member's own browser, so it is treated
   * as a claim, not a fact. Nothing is written until Stripe is asked directly:
   *
   *   1. the session must exist in Stripe,
   *   2. it must be paid,
   *   3. its metadata.userId must be the caller's own id — this is what stops
   *      anyone pasting somebody else's session id and being upgraded on their
   *      payment.
   *
   * Revenue is deliberately NOT recorded here. The webhook owns the accounting
   * row, and writing one from both paths would double-count every first
   * payment. Entitlement is idempotent — granting it twice is granting it once
   * — which is why it is safe to do from both.
   */
  async confirmCheckout({ userId, sessionId }) {
    if (!sessionId) throw new ValidationError("Missing checkout session id");

    const session = await this.stripe.retrieveCheckoutSession(sessionId);

    if (session?.metadata?.userId !== String(userId)) {
      // Deliberately not "not found" vs "not yours": either way the caller is
      // asking about a session that is not theirs.
      throw new ForbiddenError("That checkout session does not belong to this account");
    }

    if (session.payment_status !== "paid") {
      // Not an error — a session can be legitimately open or expired. The
      // caller shows "still confirming" rather than a failure.
      return { premium: false, status: session.payment_status || "unpaid" };
    }

    const subscription = await this.stripe.retrieveSubscription(session.subscription);
    const premium = grantsPremium(subscription.status);

    await this.userRepository.updateById(userId, {
      stripeId: session.customer,
      subscriptionId: session.subscription,
      subscriptionStatus: subscription.status,
      premium,
    });

    return { premium, status: subscription.status };
  }

  async cancelSubscription(userId) {
    const user = await this.userRepository.findById(userId, {
      select: "subscriptionId",
      lean: true,
    });

    if (!user?.subscriptionId) throw new NotFoundError("Subscription not found");

    const subscription = await this.stripe.cancelSubscriptionAtPeriodEnd(user.subscriptionId);

    return {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end,
    };
  }

  /**
   * Whether the member's subscription is live, read from Stripe rather than
   * from the mirrored `premium` flag — this is the screen someone opens when
   * they think the flag is wrong.
   */
  async subscriptionStatus(userId) {
    const user = await this.userRepository.findById(userId, {
      select: "subscriptionId",
      lean: true,
    });

    if (!user?.subscriptionId) return { active: false };

    const subscription = await this.stripe.retrieveSubscription(user.subscriptionId);

    return {
      active: subscription.status === "active",
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      periodEnd: subscription.current_period_end,
      plan: subscription.items.data[0].price.nickname || "Unknown Plan",
    };
  }
}

export default PaymentService;
