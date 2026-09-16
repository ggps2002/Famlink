import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { optionalAuthenticate } from "../../core/http/middleware/authenticate.js";
import { rateLimit } from "../../core/http/middleware/rateLimit.js";
import { AnalyticsService } from "./analytics.service.js";
import PageView from "./pageView.model.js";

export const pageViewRepository = new BaseRepository(PageView);

/**
 * Both handlers swallow their own failures.
 *
 * A crawler that gets an error will retry, and telling it apart from a person
 * by the response is information it does not need — so a dropped beacon and a
 * failed one look identical from outside: 204.
 */
class AnalyticsController extends BaseController {
  constructor({ analyticsService }) {
    super();
    this.analyticsService = analyticsService;
  }

  async view(req, res) {
    try {
      const result = await this.analyticsService.recordView({
        body: req.body,
        userAgent: req.headers["user-agent"] || "",
        host: req.headers.host,
        // Read opportunistically: a beacon carrying a valid token records the
        // user id so per-user session history works, one without is anonymous.
        // Never REQUIRED — most traffic is logged out, and that is the traffic
        // the marketing screens exist to measure.
        userId: req.userId ?? null,
        req,
      });

      if (!result) return res.status(204).end();

      // The id goes back so the client can close this view out with a duration
      // when the visitor navigates away.
      return res.status(200).json(result);
    } catch (error) {
      console.error("[analytics] beacon failed:", error?.message || error);
      return res.status(204).end();
    }
  }

  async close(req, res) {
    try {
      await this.analyticsService.closeView(req.body || {});
    } catch (error) {
      console.error("[analytics] close failed:", error?.message || error);
    }
    return res.status(204).end();
  }
}

export class AnalyticsModule extends RouteModule {
  static basePath = "/analytics";
  static moduleName = "analytics";

  registerRoutes(router) {
    const controller = new AnalyticsController({
      analyticsService: new AnalyticsService({ pageViewRepository }),
    });

    // 300 beacons per 5 minutes per IP. Comfortably above a real person
    // browsing hard (a view plus an exit beacon each, so ~2 per page), and far
    // below what a script would produce.
    const beaconLimit = rateLimit({
      name: "analytics-beacon",
      limit: 300,
      windowSec: 300,
      message: "Too many analytics events.",
    });

    // A beacon must never fail because a session expired — the visit still
    // happened, so a bad token is treated as no token.
    router.use(optionalAuthenticate);

    router.post("/view", beaconLimit, controller.view);
    router.post("/close", beaconLimit, controller.close);
  }
}

export default AnalyticsModule;
