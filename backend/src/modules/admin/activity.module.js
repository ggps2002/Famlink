import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { adminOnly } from "./admin.middleware.js";
import { ActivityService } from "./activity.service.js";
import { userRepository } from "../user/user.repository.js";
import { matchRepository } from "../match/match.repository.js";
import { reportRepository } from "../report/report.repository.js";
import Message from "../messaging/message.model.js";
import PageView from "../analytics/pageView.model.js";

/** Grouped counts the suspicious scan needs, and nothing else. */
class MessageStatsRepository extends BaseRepository {
  countsBySenderSince(senderIds, since) {
    return this.aggregate([
      { $match: { sender: { $in: senderIds }, createdAt: { $gte: since } } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]);
  }
}

class PageViewRepository extends BaseRepository {
  /**
   * Visits rolled up into sessions.
   *
   * Capped at 200: this feeds a scrollable list on one member's detail screen,
   * not a report, and a heavy user over a year would otherwise return thousands
   * of rows nobody scrolls to.
   */
  sessionsForUser({ userId, since, limit = 200 }) {
    return this.aggregate([
      { $match: { userId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$sessionId",
          startedAt: { $min: "$createdAt" },
          endedAt: { $max: "$createdAt" },
          pageViews: { $sum: 1 },
          durationSec: { $sum: { $ifNull: ["$durationSec", 0] } },
        },
      },
      { $sort: { startedAt: -1 } },
      { $limit: limit },
    ]);
  }
}

export const messageStatsRepository = new MessageStatsRepository(Message);
export const pageViewRepository = new PageViewRepository(PageView);

class ActivityController extends BaseController {
  constructor({ activityService }) {
    super();
    this.activityService = activityService;
  }

  async overview(req, res) {
    return this.sendData(res, await this.activityService.overview());
  }

  async sessions(req, res) {
    return this.sendData(
      res,
      await this.activityService.sessions({
        userId: req.params.userId,
        days: req.query.days,
      })
    );
  }

  async suspicious(req, res) {
    const { data, pagination, scanned, scanLimited } = await this.activityService.suspicious({
      query: req.query,
    });

    return this.ok(res, { data, pagination, scanned, scanLimited });
  }
}

export class AdminActivityModule extends RouteModule {
  static basePath = "/admin/activity";
  static moduleName = "admin:activity";

  registerRoutes(router) {
    const controller = new ActivityController({
      activityService: new ActivityService({
        userRepository,
        matchRepository,
        messageRepository: messageStatsRepository,
        reportRepository,
        pageViewRepository,
      }),
    });

    router.use(adminOnly);

    router.get("/overview", controller.overview);
    router.get("/sessions/:userId", controller.sessions);
    router.get("/suspicious", controller.suspicious);
  }
}

export default AdminActivityModule;
