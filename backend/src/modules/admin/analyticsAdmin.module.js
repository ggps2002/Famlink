import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { adminOnly } from "./admin.middleware.js";
import { AnalyticsAdminService } from "./analyticsAdmin.service.js";
import { countPendingLaunchRecipients } from "../waitlist/waitlist.util.js";
import { userRepository } from "../user/user.repository.js";
import { matchRepository } from "../match/match.repository.js";
import { profileRepository } from "../profile/profile.repository.js";
import { reportRepository } from "../report/report.repository.js";
import Message from "../messaging/message.model.js";
import WaitlistEntry from "../waitlist/waitlistEntry.model.js";
import Feedback from "../feedback/feedback.model.js";

// Counting only — these three are read by the dashboard and nothing else here
// touches them, so a bare BaseRepository is the whole requirement.
export const messageRepository = new BaseRepository(Message);
export const waitlistRepository = new BaseRepository(WaitlistEntry);
export const feedbackRepository = new BaseRepository(Feedback);

class AnalyticsAdminController extends BaseController {
  constructor({ analyticsService }) {
    super();
    this.analyticsService = analyticsService;
  }

  async overview(req, res) {
    return this.sendData(res, await this.analyticsService.overview());
  }

  async growth(req, res) {
    return this.sendData(res, await this.analyticsService.growth({ days: req.query.days }));
  }

  async completeness(req, res) {
    return this.sendData(
      res,
      await this.analyticsService.completeness({ limit: req.query.limit })
    );
  }
}

export class AdminAnalyticsModule extends RouteModule {
  static basePath = "/admin/analytics";
  static moduleName = "admin:analytics";

  registerRoutes(router) {
    const controller = new AnalyticsAdminController({
      analyticsService: new AnalyticsAdminService({
        userRepository,
        matchRepository,
        profileRepository,
        reportRepository,
        messageRepository,
        waitlistRepository,
        feedbackRepository,
        countPendingLaunchRecipients,
      }),
    });

    router.use(adminOnly);

    router.get("/overview", controller.overview);
    router.get("/growth", controller.growth);
    router.get("/completeness", controller.completeness);
  }
}

export default AdminAnalyticsModule;
