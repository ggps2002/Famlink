import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { ReportsAdminService } from "./reports.service.js";
import { reportRepository } from "../report/report.repository.js";
import { userRepository } from "../user/user.repository.js";
import { chatRepository } from "../messaging/chat.repository.js";
import { sendAccountDeactivatedEmail } from "../../shared/email/email.js";
import Message from "../messaging/message.model.js";
import MessageFlag from "../messaging/messageFlag.model.js";

/** Content-rule hits, summarised per sender. */
class MessageFlagRepository extends BaseRepository {
  summaryForSender(senderId) {
    return this.aggregate([
      { $match: { senderId: this.toObjectId(senderId, "sender id") } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          blocked: { $sum: { $cond: [{ $eq: ["$action", "blocked"] }, 1, 0] } },
          categories: { $addToSet: "$categories" },
        },
      },
    ]);
  }
}

export const messageRepository = new BaseRepository(Message);
export const messageFlagRepository = new MessageFlagRepository(MessageFlag);

class ReportsAdminController extends BaseController {
  constructor({ reportsService }) {
    super();
    this.reportsService = reportsService;
  }

  async list(req, res) {
    const { data, pagination } = await this.reportsService.list({
      query: req.query,
      adminId: req.admin._id,
    });

    return this.ok(res, { data, pagination });
  }

  async stats(req, res) {
    return this.sendData(res, await this.reportsService.stats());
  }

  async assign(req, res) {
    const { report, update } = await this.reportsService.assign({
      id: req.params.id,
      body: req.body,
      adminId: req.admin._id,
    });

    await logAdminAction({
      req,
      action: "report.assign",
      targetType: "report",
      targetId: report._id,
      targetUserId: report.reportedUserId,
      reason: "Report triaged",
      metadata: update,
    });

    return this.ok(res, { message: "Report updated.", data: report });
  }

  async resolve(req, res) {
    const { report, target, outcome, sanction, note } = await this.reportsService.resolve({
      id: req.params.id,
      body: req.body,
      adminId: req.admin._id,
    });

    await logAdminAction({
      req,
      action: "report.resolve",
      targetType: "report",
      targetId: report._id,
      targetUserId: target._id,
      reason: note,
      metadata: { outcome, sanction, reportReason: report.reason },
    });

    return this.ok(res, {
      message: `Report resolved (${outcome}).`,
      data: { reportId: report._id, outcome, sanction },
    });
  }

  /**
   * Reading private messages is logged, always.
   *
   * Fewer messages is still private messages, and the trail is what keeps
   * "I opened it because of report #482" checkable rather than merely claimed.
   */
  async context(req, res) {
    const { payload, chat, reportedId, messagesShown, reportReason, reportId } =
      await this.reportsService.context(req.params.id);

    await logAdminAction({
      req,
      action: "report.context",
      targetType: "report",
      targetId: reportId,
      targetUserId: reportedId || null,
      reason: `Viewed the last ${messagesShown} messages while working report ${reportId}`,
      metadata: {
        access: "read",
        chatId: chat?._id || null,
        messagesShown,
        reportReason,
      },
    });

    return this.ok(res, { data: payload, audited: true });
  }

  async byUser(req, res) {
    return this.sendData(res, await this.reportsService.byUser(req.params.userId));
  }
}

export class AdminReportsModule extends RouteModule {
  static basePath = "/admin/reports";
  static moduleName = "admin:reports";

  registerRoutes(router) {
    const controller = new ReportsAdminController({
      reportsService: new ReportsAdminService({
        reportRepository,
        userRepository,
        chatRepository,
        messageRepository,
        messageFlagRepository,
        sendAccountDeactivatedEmail,
      }),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.get("/stats", controller.stats);
    // Two segments, so it cannot be shadowed by "/:id/..." — but registered
    // ahead of the parameterised routes by habit.
    router.get("/user/:userId", controller.byUser);

    router.put("/:id/assign", controller.assign);
    router.post("/:id/resolve", controller.resolve);
    router.get("/:id/context", controller.context);
  }
}

export default AdminReportsModule;
