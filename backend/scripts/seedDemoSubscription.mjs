/**
 * Put the demo screenshot account on a live FamLink Plus subscription.
 *
 * Settings → Subscription reads `active` and the renewal date straight from
 * Stripe (payment.service.js `subscriptionStatus`), so flipping `premium` in
 * Mongo alone leaves that screen showing "Free plan / Inactive". The only way
 * the page renders as a subscriber is a real subscription — so this creates one
 * in Stripe TEST mode, against the test card, and stores the ids on the user.
 *
 * Split out from seedDemoUsers.mjs deliberately: that script must stay offline
 * and deterministic. This one needs the network and an API key, and is the only
 * thing here that reaches outside the machine.
 *
 *   node scripts/seedDemoSubscription.mjs                 subscribe the hero
 *   node scripts/seedDemoSubscription.mjs --months 6      renewal ~6 months out
 *   node scripts/seedDemoSubscription.mjs --cancel        undo it
 *
 * Refuses to run on a live key or a non-local database.
 */
import mongoose from "mongoose";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

import { config } from "../src/config/index.js";
import { isLocalMongoUri } from "../src/config/mongoUri.js";
import User from "../src/modules/user/user.model.js";

const API_VERSION = "2024-06-20"; // matches stripe.gateway.js
const DEMO_EMAIL = "maya.brennan@famylink-demo.test";
const PRICE_ID = process.env.DEMO_STRIPE_PRICE_ID || "price_1SKD9hLEfRvfzdFsTJlY15Bo";

const arg = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const main = async () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  // Two hard stops. This script attaches a card and opens a recurring
  // subscription; doing either against a live account would bill a real person.
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (!secretKey.startsWith("sk_test")) {
    throw new Error("Refusing to run: STRIPE_SECRET_KEY is not a test key.");
  }
  if (!isLocalMongoUri(config.db.uri)) {
    throw new Error(`Refusing to run against a non-local database: ${config.db.uri}`);
  }

  const stripe = new Stripe(secretKey, { apiVersion: API_VERSION });
  await mongoose.connect(config.db.uri);

  const user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) throw new Error(`${DEMO_EMAIL} not found — run seedDemoUsers.mjs first.`);

  /* ── find or create the customer, the way the gateway does (by email) ── */
  const found = await stripe.customers.list({ email: DEMO_EMAIL, limit: 1 });
  const customer =
    found.data[0] ??
    (await stripe.customers.create({
      email: DEMO_EMAIL,
      name: user.name,
      metadata: { userId: String(user._id), demo: "famylink-screenshots" },
    }));
  console.log(`[sub] customer ${customer.id}`);

  /* ── clear any subscription from a previous run ── */
  const existing = await stripe.subscriptions.list({
    customer: customer.id,
    status: "all",
    limit: 20,
  });
  for (const sub of existing.data) {
    if (["canceled", "incomplete_expired"].includes(sub.status)) continue;
    await stripe.subscriptions.cancel(sub.id);
    console.log(`[sub] cancelled previous ${sub.id} (${sub.status})`);
  }

  if (process.argv.includes("--cancel")) {
    await User.updateOne(
      { _id: user._id },
      { $set: { premium: false, subscriptionStatus: "canceled" }, $unset: { subscriptionId: "" } }
    );
    await mongoose.disconnect();
    console.log("[sub] cancelled and cleared. Account is back on the free plan.");
    return;
  }

  /* ── a test card, attached and made the default for invoices ── */
  const pm = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });
  await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: pm.id },
  });
  console.log(`[sub] test card attached (${pm.id})`);

  /* ── the subscription ──
   *
   * `billing_cycle_anchor` is what makes the renewal date choosable. Without it
   * the first period ends one interval from now; with it the date is ours, and
   * `proration_behavior: "none"` stops Stripe billing a partial period to reach
   * it. The subscription still goes active immediately either way. */
  const months = Number(arg("--months", "1"));
  const params = {
    customer: customer.id,
    items: [{ price: PRICE_ID }],
    metadata: { userId: String(user._id), demo: "famylink-screenshots" },
    expand: ["latest_invoice.payment_intent"],
  };

  if (months !== 1) {
    const anchor = new Date();
    anchor.setMonth(anchor.getMonth() + months);
    params.billing_cycle_anchor = Math.floor(anchor.getTime() / 1000);
    params.proration_behavior = "none";
  }

  const subscription = await stripe.subscriptions.create(params);

  if (subscription.status !== "active") {
    throw new Error(
      `Subscription came back "${subscription.status}", not "active" — the ` +
        "settings page only shows a plan for an active one."
    );
  }

  // current_period_end moved onto the item in recent API versions; read both so
  // this keeps working whichever shape the pinned version returns.
  const periodEnd =
    subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        stripeId: customer.id,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        premium: true,
      },
    }
  );

  const renews = new Date(periodEnd * 1000);
  console.log(
    [
      "",
      "──────────────────────────────────────────────",
      "  FamLink Plus — active",
      "──────────────────────────────────────────────",
      `  Member:   ${user.name} <${user.email}>`,
      `  Plan:     FamLink Plus ($35/month in the UI)`,
      `  Status:   ${subscription.status}`,
      `  Renews:   ${renews.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
      `  Stripe:   ${subscription.id} (test mode)`,
      "──────────────────────────────────────────────",
      "",
    ].join("\n")
  );

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("[sub] failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
