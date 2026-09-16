import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { sendSubscriptionConfirmedEmail } from "../../shared/email/email.js";
import { PaymentService } from "./payment.service.js";
import { stripeGateway } from "./stripe.gateway.js";
import { userRepository } from "../user/user.repository.js";

class PaymentController extends BaseController {
  constructor({ paymentService }) {
    super();
    this.paymentService = paymentService;
  }

  async saveCard(req, res) {
    const customerId = await this.paymentService.saveCard({
      userId: req.userId,
      paymentMethod: req.body.paymentMethod,
    });

    return this.ok(res, { message: "Card saved successfully", customerId });
  }

  async listCards(req, res) {
    // Stripe's own list envelope, passed through unchanged — the card screen
    // reads `data` and `has_more` off it.
    return this.ok(res, await this.paymentService.listCards(req.userId));
  }

  async deleteCard(req, res) {
    await this.paymentService.deleteCard({
      userId: req.userId,
      paymentMethodId: req.params.paymentMethodId,
    });

    return this.message(res, "Card removed successfully.");
  }

  async createPayment(req, res) {
    const paymentIntentId = await this.paymentService.createPayment({
      userId: req.userId,
      paymentMethodId: req.body.paymentMethodId,
      amount: req.body.amount,
    });

    return this.ok(res, { message: "Payment successful", paymentIntentId });
  }

  async createSubscription(req, res) {
    const subscriptionId = await this.paymentService.createSubscription({
      userId: req.userId,
      paymentMethodId: req.body.paymentMethodId,
      planPriceId: req.body.planPriceId,
    });

    return this.ok(res, { message: "Subscription created", subscriptionId });
  }

  async createCheckoutSession(req, res) {
    return this.ok(res, {
      url: await this.paymentService.createCheckoutSession({
        userId: req.userId,
        priceId: req.body.priceId,
      }),
    });
  }

  async confirmCheckout(req, res) {
    return this.ok(
      res,
      await this.paymentService.confirmCheckout({
        userId: req.userId,
        sessionId: req.body.sessionId,
      }),
    );
  }

  async cancelSubscription(req, res) {
    const { cancelAtPeriodEnd, currentPeriodEnd } =
      await this.paymentService.cancelSubscription(req.userId);

    return this.ok(res, {
      message: "Subscription set to cancel at period end",
      cancelAtPeriodEnd,
      currentPeriodEnd,
    });
  }

  async subscriptionStatus(req, res) {
    return this.ok(res, await this.paymentService.subscriptionStatus(req.userId));
  }
}

export class PaymentModule extends RouteModule {
  // Two segments: this has always been mounted under /payment/stripe, and the
  // frontend's payment client is built from that prefix.
  static basePath = "/payment/stripe";
  static moduleName = "payment";

  registerRoutes(router) {
    const controller = new PaymentController({
      paymentService: new PaymentService({
        userRepository,
        stripe: stripeGateway,
        sendSubscriptionConfirmedEmail,
      }),
    });

    router.use(authenticate);

    router.post("/save-card", controller.saveCard);
    router.get("/get-save-cards", controller.listCards);
    router.delete("/delete-card/:paymentMethodId", controller.deleteCard);

    router.post("/create-payment", controller.createPayment);
    router.post("/create-subscription", controller.createSubscription);
    router.post("/create-checkout-session", controller.createCheckoutSession);
    // Called by the browser on its way back from Stripe. Authenticated like
    // everything else here, and the service re-checks that the session it is
    // handed actually belongs to the caller.
    router.post("/confirm-checkout", controller.confirmCheckout);
    router.post("/cancel-subscription", controller.cancelSubscription);
    router.get("/subscription-status", controller.subscriptionStatus);
  }
}

export default PaymentModule;
