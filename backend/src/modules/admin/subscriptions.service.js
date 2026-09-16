import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import {
  NotFoundError,
  UpstreamServiceError,
  ValidationError,
} from "../../core/errors/index.js";
import { parsePaging, pagingMeta, searchTerm } from "./admin.middleware.js";
import { subscriptionTier, referralSummary } from "../billing/subscriptionTier.js";

/** Real members. Deleted accounts and staff never appear in billing reporting. */
const MEMBERS = { status: { $ne: "Deleted" }, type: { $in: ["Parents", "Nanny"] } };

const LIST_FIELDS =
  "_id name email type premium subscriptionStatus subscriptionId stripeId " +
  "createdAt lastLogin status referralMatchingUntil referralCount";

/** Stripe statuses that mean the customer is currently paying. */
const BILLING_ACTIVE = ["active", "trialing"];

const isBillingActive = (status) =>
  BILLING_ACTIVE.includes(String(status || "").toLowerCase());

/**
 * Subscription and plan management.
 *
 * ── The distinction that matters, because getting it wrong loses money ──────
 * THIS CONSOLE DOES NOT CHANGE ANYTHING IN STRIPE. Stripe is the system of
 * record for what a customer is actually billed. What an admin can change here
 * is the ENTITLEMENT — whether this account gets Plus features — which is a
 * separate fact that usually, but not always, agrees with the billing state.
 *
 * They come apart in exactly the cases a manual override exists for: a comped
 * account for a founding member, access restored after a card failure while the
 * customer sorts out their bank, a refund already issued out of band. Writing to
 * Stripe from here would turn "give this family a free month" into a real charge
 * — or a real cancellation — on someone's card.
 *
 * So every override is recorded as a manual grant, is attributable in the audit
 * log, and never touches the subscription itself.
 */
export class SubscriptionsAdminService extends BaseService {
  #requireObjectId(userId) {
    if (!mongoose.isValidObjectId(userId)) throw new ValidationError("Invalid user id");
    return userId;
  }

  async list({ query = {} }) {
    const paging = parsePaging(query);
    const filter = { ...MEMBERS };
    const { tier, search } = query;

    if (tier === "plus") filter.premium = true;
    if (tier === "free") {
      filter.premium = { $ne: true };
      filter.subscriptionStatus = { $in: [null, "", "canceled", "cancelled"] };
      // An active referrer is not on the free plan — they are listed under
      // `referral`. Without this they appear under both filters.
      filter.referralMatchingUntil = { $not: { $gt: new Date() } };
    }
    if (tier === "past_due") filter.subscriptionStatus = { $in: ["past_due", "unpaid"] };
    if (tier === "canceled") filter.subscriptionStatus = { $in: ["canceled", "cancelled"] };
    // Caregivers who keep matching free by referring friends. A real tier in
    // practice — they pay nothing and are not on the free plan either.
    if (tier === "referral") filter.referralMatchingUntil = { $gt: new Date() };

    if (search) {
      const term = searchTerm(search);
      filter.$or = [{ name: term }, { email: term }];
    }

    const [users, totalRecords] = await Promise.all([
      this.userRepository.find(filter, {
        select: LIST_FIELDS,
        sort: { createdAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.userRepository.count(filter),
    ]);

    return {
      data: users.map((user) => ({
        ...user,
        // Shared with /admin/users so an account cannot read "Free" on one
        // screen and "Referral" on the other.
        tier: subscriptionTier(user),
        // Whether entitlement and billing agree. A mismatch is usually a
        // deliberate manual grant — but it is also what a failed webhook looks
        // like, so the console surfaces it rather than picking one to display.
        billingMatchesEntitlement: user.premium === isBillingActive(user.subscriptionStatus),
        ...referralSummary(user),
      })),
      pagination: pagingMeta(totalRecords, paging),
    };
  }

  async stats() {
    const [total, premium, byStripeStatus, referralFreeActive, entitlementMismatches] =
      await Promise.all([
        this.userRepository.count(MEMBERS),
        this.userRepository.count({ ...MEMBERS, premium: true }),
        this.userRepository.aggregate([
          { $match: { ...MEMBERS, subscriptionStatus: { $nin: [null, ""] } } },
          { $group: { _id: "$subscriptionStatus", count: { $sum: 1 } } },
        ]),
        this.userRepository.count({ ...MEMBERS, referralMatchingUntil: { $gt: new Date() } }),
        // Entitlement and billing out of step. Small numbers are normal (manual
        // grants); a jump means webhooks have stopped landing, which is worth
        // seeing on a dashboard rather than discovering from a support ticket.
        this.userRepository.count({
          ...MEMBERS,
          $or: [
            {
              premium: true,
              subscriptionStatus: { $in: ["canceled", "cancelled", "unpaid", null] },
            },
            { premium: { $ne: true }, subscriptionStatus: "active" },
          ],
        }),
      ]);

    return {
      totalMembers: total,
      premium,
      free: total - premium,
      conversionRate: total ? Math.round((premium / total) * 100) : 0,
      byStripeStatus,
      referralFreeActive,
      entitlementMismatches,
    };
  }

  /**
   * The live billing state, read straight from Stripe.
   *
   * Read-only, and separate from the list on purpose: it is a network call per
   * member, so it happens when an admin opens one record rather than for every
   * row of a table.
   */
  async stripeDetail(userId) {
    this.#requireObjectId(userId);

    const user = await this.userRepository.findById(userId, {
      select: "stripeId subscriptionId email name",
      lean: true,
    });

    if (!user) throw new NotFoundError("User not found");
    if (!user.stripeId) {
      return { hasStripeCustomer: false, note: "This member has never started a checkout." };
    }

    let subscriptions;
    let invoices;
    try {
      [subscriptions, invoices] = await Promise.all([
        this.stripe.listSubscriptions(user.stripeId),
        this.stripe.listInvoices(user.stripeId),
      ]);
    } catch (error) {
      // A Stripe outage or a bad key must not read as "this member has no
      // subscription", which is what a generic failure looks like on screen.
      throw new UpstreamServiceError(
        "Could not reach Stripe. The entitlement shown elsewhere is unaffected.",
        { cause: error }
      );
    }

    return {
      hasStripeCustomer: true,
      customerId: user.stripeId,
      subscriptions: subscriptions.data.map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        // Stripe timestamps are seconds.
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        amount: subscription.items?.data?.[0]?.price?.unit_amount ?? null,
        currency: subscription.currency,
        interval: subscription.items?.data?.[0]?.price?.recurring?.interval ?? null,
      })),
      invoices: invoices.data.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        created: new Date(invoice.created * 1000),
        hostedUrl: invoice.hosted_invoice_url,
      })),
    };
  }

  /**
   * Grant or revoke the Plus entitlement by hand.
   *
   * A reason is mandatory and is not a formality: this is the one place where
   * what someone is charged and what they receive can be made to disagree on
   * purpose, and six months later the audit entry is the only record of why.
   */
  async setPlan({ userId, plan, reason: rawReason, req }) {
    this.#requireObjectId(userId);

    if (!["plus", "free"].includes(plan)) {
      throw new ValidationError('Plan must be "plus" or "free".');
    }

    const reason = String(rawReason || "").trim();
    if (reason.length < 10) {
      throw new ValidationError(
        "A reason of at least 10 characters is required for a manual plan change."
      );
    }

    const user = await this.userRepository.findById(userId, {
      select: "premium subscriptionStatus name email",
      lean: true,
    });
    if (!user) throw new NotFoundError("User not found");

    // `subscriptionStatus` is deliberately left alone. It mirrors what Stripe
    // last told us; overwriting it here would make the next webhook look like a
    // change that never happened, and would destroy the evidence that this
    // account's access is a manual grant rather than a paid subscription.
    await this.userRepository.updateById(userId, { premium: plan === "plus" });

    await this.logAdminAction({
      req,
      action: "user.plan_change",
      targetUserId: userId,
      targetType: "subscription",
      reason,
      metadata: {
        from: user.premium ? "plus" : "free",
        to: plan,
        stripeStatusAtTime: user.subscriptionStatus || null,
        manualGrant: true,
        note: "Entitlement only — Stripe billing was not modified.",
      },
    });

    return {
      plan,
      // Says out loud what was NOT done, because the gap between entitlement
      // and billing is the thing an admin is most likely to assume away.
      message:
        plan === "plus"
          ? "FamLink Plus granted. Stripe billing was not changed — if they should be charged, they need to check out normally."
          : "FamLink Plus removed. Any active Stripe subscription is still billing — cancel it in Stripe if that is intended.",
    };
  }
}

export default SubscriptionsAdminService;
