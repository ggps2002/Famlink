import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { TrafficService } from "./traffic.service.js";
import {
  pageViewAnalyticsRepository,
  trafficDailyRepository,
} from "./traffic.repository.js";

/**
 * The rollup job, imported lazily.
 *
 * Importing it eagerly pulls in the whole scheduled-jobs graph at module load,
 * which is what the bootstrap goes out of its way to avoid — see the note on
 * the legacy router there.
 */
const rollupDay = async (target) => {
  const { rollupDay: run } = await import("../../shared/jobs/trafficRollup.js");
  return run(target);
};

class TrafficController extends BaseController {
  constructor({ trafficService }) {
    super();
    this.trafficService = trafficService;
  }

  async overview(req, res) {
    return this.sendData(res, await this.trafficService.overview({ days: req.query.days }));
  }

  async trend(req, res) {
    return this.sendData(res, await this.trafficService.trend({ days: req.query.days }));
  }

  async pages(req, res) {
    const { data, windowDays } = await this.trafficService.pages({
      days: req.query.days,
      limit: req.query.limit,
    });

    return this.ok(res, { data, windowDays });
  }

  async referrers(req, res) {
    return this.sendData(res, await this.trafficService.referrers({ days: req.query.days }));
  }

  async rollup(req, res) {
    const result = await this.trafficService.runRollup({ date: req.body?.date });
    return this.sendData(res, result, { message: "Rollup complete." });
  }
}

export class AdminTrafficModule extends RouteModule {
  static basePath = "/admin/traffic";
  static moduleName = "admin:traffic";

  registerRoutes(router) {
    const controller = new TrafficController({
      trafficService: new TrafficService({
        pageViewRepository: pageViewAnalyticsRepository,
        trafficDailyRepository,
        rollupDay,
      }),
    });

    router.use(adminOnly);

    router.get("/overview", controller.overview);
    router.get("/trend", controller.trend);
    router.get("/pages", controller.pages);
    router.get("/referrers", controller.referrers);
    router.post("/rollup", controller.rollup);
  }
}

export default AdminTrafficModule;
