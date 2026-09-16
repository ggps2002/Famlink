import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { RevenueService } from "./revenue.service.js";
import { revenueRepository } from "./webhook.module.js";
import { userRepository } from "../user/user.repository.js";

class RevenueController extends BaseController {
  constructor({ revenueService }) {
    super();
    this.revenueService = revenueService;
  }

  async monthlyTotal(req, res) {
    return this.ok(res, {
      total: await this.revenueService.currentMonthTotal({ adminId: req.userId }),
    });
  }

  async monthlyBreakdown(req, res) {
    return this.sendData(res, await this.revenueService.monthlyBreakdown({ adminId: req.userId }));
  }
}

export class RevenueModule extends RouteModule {
  static basePath = "/revenue";
  static moduleName = "revenue";

  registerRoutes(router) {
    const controller = new RevenueController({
      revenueService: new RevenueService({ revenueRepository, userRepository }),
    });

    router.use(authenticate);

    router.get("/monthly", controller.monthlyTotal);
    router.get("/monthly-breakdown", controller.monthlyBreakdown);
  }
}

export default RevenueModule;
