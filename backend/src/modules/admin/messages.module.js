import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { AdminMessagesService } from "./messages.service.js";
import { userRepository } from "../user/user.repository.js";
import { chatRepository } from "../messaging/chat.repository.js";
import { reportRepository } from "../report/report.repository.js";
import Message from "../messaging/message.model.js";
import MessageFlag from "../messaging/messageFlag.model.js";

/** Grouped counts the conversation list needs. */
class AdminMessageRepository extends BaseRepository {
  countsByChat(chatIds) {
    return this.aggregate([
      { $match: { chatId: { $in: chatIds } } },
      { $group: { _id: "$chatId", messageCount: { $sum: 1 }, lastAt: { $max: "$createdAt" } } },
    ]);
  }
}

class AdminMessageFlagRepository extends BaseRepository {
  /** Prior offences per sender, for the flagged queue. */
  countsBySender(senderIds) {
    return this.aggregate([
      { $match: { senderId: { $in: senderIds } } },
      {
        $group: {
          _id: "$senderId",
          total: { $sum: 1 },
          blocked: { $sum: { $cond: [{ $eq: ["$action", "blocked"] }, 1, 0] } },
        },
      },
    ]);
  }
}

export const adminMessageRepository = new AdminMessageRepository(Message);
export const adminMessageFlagRepository = new AdminMessageFlagRepository(MessageFlag);

class AdminMessagesController extends BaseController {
  constructor({ messagesService }) {
    super();
    this.messagesService = messagesService;
  }

  async listConversations(req, res) {
    const { data, pagination, notice } = await this.messagesService.listConversations({
      query: req.query,
    });

    return this.ok(res, { data, pagination, notice });
  }

  /**
   * Reading a thread. The audit row is written and AWAITED before the response
   * goes out: if the trail cannot record the access, the access does not
   * happen — otherwise the one case where reading goes unrecorded is a database
   * problem nobody notices.
   */
  async readConversation(req, res) {
    const { reason, chat, totalRecords, payload, pagination } =
      await this.messagesService.readConversation({
        chatId: req.params.chatId,
        query: req.query,
      });

    await logAdminAction({
      req,
      action: "conversation.flag",
      targetType: "chat",
      targetId: chat._id,
      targetUserId: chat.participants?.[0]?._id || null,
      reason: `Viewed conversation: ${reason}`,
      metadata: {
        access: "read",
        participants: chat.participants?.map((participant) => String(participant._id)),
        messageCount: totalRecords,
      },
    });

    return this.ok(res, { data: payload, pagination, audited: true });
  }

  async listFlagged(req, res) {
    const { data, pagination } = await this.messagesService.listFlagged({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async flaggedStats(req, res) {
    return this.sendData(res, await this.messagesService.flaggedStats());
  }

  async reviewFlag(req, res) {
    const flag = await this.messagesService.reviewFlag({
      id: req.params.id,
      note: req.body?.note,
      adminId: req.admin._id,
    });

    return this.sendData(res, flag, { message: "Marked as reviewed." });
  }

  async escalateFlag(req, res) {
    const { report, flag } = await this.messagesService.escalateFlag({
      id: req.params.id,
      details: req.body?.details,
      adminId: req.admin._id,
    });

    await logAdminAction({
      req,
      action: "message.escalate",
      targetType: "message",
      targetId: flag.messageId || flag._id,
      targetUserId: flag.senderId,
      reason: `Escalated a ${flag.action} message to the reports queue`,
      metadata: {
        categories: flag.categories,
        severity: flag.severity,
        reportId: report._id,
      },
    });

    return res.status(201).json({
      message: "Case opened in the reports queue.",
      data: { reportId: report._id },
    });
  }

  async deleteMessage(req, res) {
    const { message, reason } = await this.messagesService.findMessageForRemoval({
      messageId: req.params.messageId,
      reason: req.body?.reason,
    });

    // Snapshotted BEFORE the delete, so the evidence survives the removal.
    await logAdminAction({
      req,
      action: "message.delete",
      targetType: "message",
      targetId: message._id,
      targetUserId: message.sender,
      reason,
      metadata: {
        chatId: message.chatId,
        sentAt: message.createdAt,
        messageType: message.type,
        // Truncated: enough to identify what was removed without turning the
        // audit collection into a second copy of the message table.
        contentSnapshot: String(message.content || "").slice(0, 500),
      },
    });

    await this.messagesService.deleteMessage(message);

    return this.message(res, "Message deleted.");
  }

  async deleteConversation(req, res) {
    const { chat, reason, messageCount } =
      await this.messagesService.findConversationForRemoval({
        chatId: req.params.chatId,
        reason: req.body?.reason,
        confirm: req.body?.confirm,
      });

    await logAdminAction({
      req,
      action: "conversation.delete",
      targetType: "chat",
      targetId: chat._id,
      targetUserId: chat.participants?.[0] || null,
      reason,
      metadata: {
        participants: chat.participants?.map(String),
        messageCount,
        createdAt: chat.createdAt,
      },
    });

    await this.messagesService.deleteConversation(chat._id);

    return this.message(res, `Conversation deleted (${messageCount} messages removed).`);
  }

  async reportMessage(req, res) {
    const report = await this.messagesService.reportMessage({
      messageId: req.params.messageId,
      reason: req.body?.reason,
      details: req.body?.details,
      adminId: req.admin._id,
    });

    return res.status(201).json({ message: "Case opened.", data: { reportId: report._id } });
  }
}

export class AdminMessagesModule extends RouteModule {
  static basePath = "/admin/messages";
  static moduleName = "admin:messages";

  registerRoutes(router) {
    const controller = new AdminMessagesController({
      messagesService: new AdminMessagesService({
        userRepository,
        chatRepository,
        reportRepository,
        messageRepository: adminMessageRepository,
        messageFlagRepository: adminMessageFlagRepository,
      }),
    });

    router.use(adminOnly);

    // Literal prefixes first. "/:messageId" would otherwise swallow
    // "/conversations" and "/flagged" on the same method.
    router.get("/conversations", controller.listConversations);
    router.get("/conversations/:chatId", controller.readConversation);
    router.delete("/conversations/:chatId", controller.deleteConversation);

    router.get("/flagged", controller.listFlagged);
    router.get("/flagged/stats", controller.flaggedStats);
    router.put("/flagged/:id/review", controller.reviewFlag);
    router.post("/flagged/:id/escalate", controller.escalateFlag);

    router.delete("/:messageId", controller.deleteMessage);
    router.post("/:messageId/report", controller.reportMessage);
  }
}

export default AdminMessagesModule;
