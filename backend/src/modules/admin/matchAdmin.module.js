import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { MatchAdminService } from "./matchAdmin.service.js";
import { matchRepository } from "../match/match.repository.js";
import { userRepository } from "../user/user.repository.js";

class MatchAdminController extends BaseController {
  constructor({ matchAdminService }) {
    super();
    this.matchAdminService = matchAdminService;
  }

  async list(req, res) {
    const { data, pagination, pageFiltered } = await this.matchAdminService.list({
      query: req.query,
    });

    return this.ok(res, { data, pagination, pageFiltered });
  }

  async insights(req, res) {
    return this.sendData(res, await this.matchAdminService.insights({ days: req.query.days }));
  }
}

export class AdminMatchModule extends RouteModule {
  static basePath = "/admin/matches";
  static moduleName = "admin:matches";

  registerRoutes(router) {
    const controller = new MatchAdminController({
      matchAdminService: new MatchAdminService({ matchRepository, userRepository }),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.get("/insights", controller.insights);
  }
}

export default AdminMatchModule;
