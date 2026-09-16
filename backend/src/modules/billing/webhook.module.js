import express from "express";
import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { StripeWebhookService } from "./webhook.service.js";
import { stripeGateway } from "./stripe.gateway.js";
import { userRepository } from "../user/user.repository.js";
import Revenue from "./revenue.model.js";
import config from "../../config/index.js";

export const revenueRepository = new BaseRepository(Revenue);

// No fallback, deliberately. A wrong or missing signing secret fails every
// delivery, and `premium` is only ever granted from this handler — so a
// customer would pay and stay on the free tier with nothing in the logs to
// say why. The live and test endpoints have different secrets, so this can
// only come from the environment.
if (!config.stripe.webhookSecret) {
  console.error(
    "STRIPE_WEBHOOK_SECRET is not set. Stripe webhooks will be rejected, " +
      "so subscriptions will never be activated. Set it from the signing secret " +
      "of the endpoint in the Stripe dashboard."
  );
}

class StripeWebhookController extends BaseController {
  constructor({ webhookService }) {
    super();
    this.webhookService = webhookService;
  }

  /**
   * Stripe reads the status code, not the body.
   *
   * 2xx means "delivered, stop retrying". 4xx and 5xx both make Stripe retry
   * with backoff, which is what we want for a transient database failure and
   * what we do NOT want for a bad signature — hence the split below. An
   * unrecognised event type is a success: retrying will not make us understand
   * it any better.
   */
  async receive(req, res) {
    try {
      await this.webhookService.handle({
        payload: req.body,
        signature: req.headers["stripe-signature"],
      });
    } catch (error) {
      // Signature failures are permanent. Answering 400 tells Stripe not to
      // keep retrying something that will never verify.
      if (error?.type === "StripeSignatureVerificationError") {
        console.error("Webhook signature verification failed.", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
      }
      throw error;
    }

    return res.status(200).send("Webhook received");
  }
}

export class StripeWebhookModule extends RouteModule {
  static basePath = "/stripe";
  static moduleName = "stripe";

  // Mounted ahead of express.json(): Stripe signs the literal bytes it sent,
  // and a parsed-then-reserialised body does not reproduce them.
  static rawBody = true;

  registerRoutes(router) {
    const controller = new StripeWebhookController({
      webhookService: new StripeWebhookService({
        stripe: stripeGateway,
        userRepository,
        revenueRepository,
      }),
    });

    router.post("/webhook", express.raw({ type: "application/json" }), controller.receive);
  }
}

export default StripeWebhookModule;
