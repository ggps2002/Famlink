import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { ReferralsAdminService } from "./referrals.service.js";
import { userRepository } from "../user/user.repository.js";

class ReferralsAdminController extends BaseController {
  constructor({ referralsService }) {
    super();
    this.referralsService = referralsService;
  }

  async list(req, res) {
    const { data, pagination } = await this.referralsService.listReferrers({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async stats(req, res) {
    return this.sendData(res, await this.referralsService.stats());
  }

  async signups(req, res) {
    const { data, pagination } = await this.referralsService.listSignups({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async detail(req, res) {
    return this.sendData(res, await this.referralsService.detail(req.params.userId));
  }
}

export class AdminReferralsModule extends RouteModule {
  static basePath = "/admin/referrals";
  static moduleName = "admin:referrals";

  registerRoutes(router) {
    const controller = new ReferralsAdminController({
      referralsService: new ReferralsAdminService({ userRepository }),
    });

    router.use(adminOnly);

    // "/stats" and "/signups" must precede "/:userId", or Express reads the
    // literal as a user id and both screens 400 on an invalid ObjectId.
    router.get("/", controller.list);
    router.get("/stats", controller.stats);
    router.get("/signups", controller.signups);
    router.get("/:userId", controller.detail);
  }
}

export default AdminReferralsModule;
