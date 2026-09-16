import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { SubscriptionsAdminService } from "./subscriptions.service.js";
import { stripeGateway } from "../billing/stripe.gateway.js";
import { userRepository } from "../user/user.repository.js";

class SubscriptionsAdminController extends BaseController {
  constructor({ subscriptionsService }) {
    super();
    this.subscriptionsService = subscriptionsService;
  }

  async list(req, res) {
    const { data, pagination } = await this.subscriptionsService.list({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async stats(req, res) {
    return this.sendData(res, await this.subscriptionsService.stats());
  }

  async stripeDetail(req, res) {
    return this.sendData(res, await this.subscriptionsService.stripeDetail(req.params.userId));
  }

  async setPlan(req, res) {
    const { plan, message } = await this.subscriptionsService.setPlan({
      userId: req.params.userId,
      plan: req.body?.plan,
      reason: req.body?.reason,
      // The audit entry records who acted, so it needs the request.
      req,
    });

    return this.ok(res, { message, data: { plan } });
  }
}

export class AdminSubscriptionsModule extends RouteModule {
  static basePath = "/admin/subscriptions";
  static moduleName = "admin:subscriptions";

  registerRoutes(router) {
    const controller = new SubscriptionsAdminController({
      subscriptionsService: new SubscriptionsAdminService({
        userRepository,
        // The same pinned client the rest of billing uses. This screen
        // previously built its own on API version 2022-11-15 while the payment
        // routes used 2024-06-20 — two clients on two versions in one process,
        // which is a shape difference waiting to be discovered in production.
        stripe: stripeGateway,
        logAdminAction,
      }),
    });

    router.use(adminOnly);

    // "/stats" before "/:userId/..." so the literal is not read as a user id.
    router.get("/", controller.list);
    router.get("/stats", controller.stats);
    router.get("/:userId/stripe", controller.stripeDetail);
    router.put("/:userId/plan", controller.setPlan);
  }
}

export default AdminSubscriptionsModule;
