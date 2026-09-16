import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { SupportService } from "./support.service.js";
import { userRepository } from "../user/user.repository.js";
import Feedback from "../feedback/feedback.model.js";

export const feedbackTicketRepository = new BaseRepository(Feedback);

class SupportController extends BaseController {
  constructor({ supportService }) {
    super();
    this.supportService = supportService;
  }

  async list(req, res) {
    const { data, pagination } = await this.supportService.list({
      query: req.query,
      adminId: req.admin._id,
    });

    return this.ok(res, { data, pagination });
  }

  async stats(req, res) {
    return this.sendData(res, await this.supportService.stats());
  }

  async categories(req, res) {
    return this.sendData(res, await this.supportService.categories());
  }

  async update(req, res) {
    const { changed, item } = await this.supportService.update({
      id: req.params.id,
      body: req.body,
      adminId: req.admin._id,
    });

    await logAdminAction({
      req,
      action: "support.update",
      targetType: "feedback",
      targetId: item._id,
      reason: `Support ticket updated: ${Object.keys(changed).join(", ")}`,
      // The note BODY is deliberately not copied into the audit metadata. It is
      // an internal comment that can quote a member's complaint verbatim, and
      // duplicating it into a second collection is copying personal data for no
      // benefit — the ticket itself already holds it.
      metadata: changed,
    });

    return this.sendData(res, await this.supportService.findPopulated(req.params.id), {
      message: "Ticket updated.",
    });
  }
}

export class AdminSupportModule extends RouteModule {
  static basePath = "/admin/support";
  static moduleName = "admin:support";

  registerRoutes(router) {
    const controller = new SupportController({
      supportService: new SupportService({
        feedbackRepository: feedbackTicketRepository,
        userRepository,
      }),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.get("/stats", controller.stats);
    router.get("/categories", controller.categories);
    router.put("/:id", controller.update);
  }
}

export default AdminSupportModule;
