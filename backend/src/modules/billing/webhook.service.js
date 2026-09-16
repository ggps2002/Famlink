import { BaseService } from "../../core/http/BaseService.js";
import { grantsPremium } from "./subscriptionTier.js";

/**
 * A Stripe subscription status that means the member should have paid features.
 *
 * `trialing` counts: someone in a trial has an active subscription that has not
 * billed yet, and locking them out is the opposite of what a trial is for.
 */


/**
 * Stripe's side of the conversation.
 *
 * This is the authority on `premium`. The checkout flow never sets it — the
 * member is redirected away before anything is known — so if this handler stops
 * running, people pay and stay on the free tier. That is why the signature
 * check is fail-closed and why nothing here swallows an error quietly.
 *
 * Handlers are keyed by event type rather than written as a switch so that an
 * unknown type is data, not a fallthrough.
 */
export class StripeWebhookService extends BaseService {
  /**
   * Verify and dispatch one event.
   *
   * @returns {"handled"|"ignored"} — whether a handler existed for the type.
   */
  async handle({ payload, signature }) {
    // Throws on a bad signature. This is the only thing between the endpoint
    // and anyone on the internet marking accounts premium, so it runs before
    // the body is looked at.
    const event = this.stripe.constructWebhookEvent(payload, signature);

    const handler = this.#handlers()[event.type];
    if (!handler) return { status: "ignored", type: event.type };

    await handler(event.data.object);
    return { status: "handled", type: event.type };
  }

  #handlers() {
    return {
      "checkout.session.completed": this.#onCheckoutCompleted.bind(this),
      "invoice.payment_succeeded": this.#onInvoicePaid.bind(this),
      "customer.subscription.deleted": this.#onSubscriptionChanged.bind(this),
      "customer.subscription.updated": this.#onSubscriptionChanged.bind(this),
    };
  }

  /** First payment through Checkout: the member becomes premium here. */
  async #onCheckoutCompleted(session) {
    const userId = session.metadata?.userId;
    if (!userId) {
      // Nothing to attribute the payment to. Logged loudly rather than thrown,
      // because a retry will not add the metadata that was missing.
      console.warn("[stripe] checkout.session.completed with no userId in metadata");
      return;
    }

    const subscriptionId = session.subscription;
    const subscription = await this.stripe.retrieveSubscription(subscriptionId);

    await this.userRepository.updateById(userId, {
      // `stripeId` is written here too, and it was not before. Only the older
      // Elements path (payment.service.createSubscription) set it, so a member
      // who subscribed through Checkout became premium with no customer id —
      // and then listCards threw "No Cards found for the user!" and deleteCard
      // threw "No Stripe customer found", for someone who was actively paying.
      stripeId: session.customer,
      subscriptionId,
      subscriptionStatus: subscription.status,
      premium: grantsPremium(subscription.status),
    });

    await this.revenueRepository.create({
      userId,
      stripeCustomerId: session.customer,
      subscriptionId,
      amount: session.amount_total || 0,
      currency: session.currency,
      paidAt: new Date(),
      type: "initial",
    });
  }

  /** Every renewal after the first. Recorded for revenue, not for access. */
  async #onInvoicePaid(invoice) {
    const user = await this.userRepository.findOne(
      { subscriptionId: invoice.subscription },
      { select: "_id", lean: true }
    );

    if (!user) {
      console.warn("[stripe] renewal for a subscription no user holds:", invoice.subscription);
      return;
    }

    await this.revenueRepository.create({
      userId: user._id,
      stripeCustomerId: invoice.customer,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_paid || 0,
      currency: invoice.currency,
      // Stripe timestamps are seconds; JavaScript wants milliseconds. Without
      // the conversion every renewal lands in January 1970 and the revenue
      // chart shows nothing.
      paidAt: new Date(invoice.created * 1000),
      type: "renewal",
    });
  }

  /**
   * Cancellation, expiry, payment failure, plan change — all arrive here.
   *
   * The status is copied verbatim and `premium` is derived from it, so this one
   * handler covers both losing and regaining access without enumerating the
   * reasons.
   */
  async #onSubscriptionChanged(subscription) {
    const user = await this.userRepository.findOne({ subscriptionId: subscription.id });
    if (!user) return;

    user.subscriptionStatus = subscription.status;
    user.premium = grantsPremium(subscription.status);
    await user.save();
  }
}

export default StripeWebhookService;
