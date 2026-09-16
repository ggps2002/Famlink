import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { rateLimit } from "../../core/http/middleware/rateLimit.js";
import { ReportService } from "./report.service.js";
import { reportRepository } from "./report.repository.js";
import Message from "../messaging/message.model.js";
import { userRepository } from "../user/user.repository.js";

// Re-exported so callers that already import it from here keep working; the
// definition lives in report.repository.js.
export { reportRepository };

const messageRepository = new BaseRepository(Message);

class ReportController extends BaseController {
  constructor({ reportService }) {
    super();
    this.reportService = reportService;
  }

  async submit(req, res) {
    const report = await this.reportService.submit({
      reporterId: req.userId,
      ...(req.body || {}),
    });

    return this.sendData(
      res,
      { reportId: report._id },
      {
        status: 201,
        message:
          "Thank you — this has been sent to our team. We review every report and will not tell the other person who raised it.",
      }
    );
  }

  async status(req, res) {
    return this.sendData(
      res,
      await this.reportService.statusFor({
        reporterId: req.userId,
        reportedUserId: req.query.userId,
      })
    );
  }

  async mine(req, res) {
    return this.sendData(res, await this.reportService.listMine(req.userId));
  }
}

export class ReportModule extends RouteModule {
  static basePath = "/reports";
  static moduleName = "reports";

  registerRoutes(router) {
    const controller = new ReportController({
      reportService: new ReportService({ reportRepository, userRepository, messageRepository }),
    });

    router.use(authenticate);

    // Five per hour. Enough for someone dealing with a genuinely bad actor
    // across several messages, low enough that the queue cannot be flooded to
    // bury a real complaint.
    const reportLimit = rateLimit({
      name: "user-report",
      limit: 5,
      windowSec: 3600,
      message:
        "You have submitted several reports recently. Please give us time to review them.",
    });

    router.post("/", reportLimit, controller.submit);
    router.get("/status", controller.status);
    router.get("/mine", controller.mine);
  }
}

export default ReportModule;
