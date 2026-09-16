import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { AdminUsersService } from "./users.service.js";
import { adminActionRepository } from "./auditLog.module.js";
import { emailLogRepository } from "./emailLog.repository.js";
import { messageRepository } from "./reports.module.js";
import { userRepository } from "../user/user.repository.js";
import { profileRepository } from "../profile/profile.repository.js";
import { matchRepository } from "../match/match.repository.js";
import { chatRepository } from "../messaging/chat.repository.js";
import { reportRepository } from "../report/report.repository.js";
import { sendAccountDeactivatedEmail } from "../../shared/email/email.js";

class AdminUsersController extends BaseController {
  constructor({ usersService }) {
    super();
    this.usersService = usersService;
  }

  async list(req, res) {
    const { data, pagination, pageFiltered } = await this.usersService.list({ query: req.query });
    return this.ok(res, { data, pagination, pageFiltered });
  }

  async detail(req, res) {
    return this.sendData(res, await this.usersService.detail(req.params.id));
  }

  async block(req, res) {
    const { user, reason, previousStatus } = await this.usersService.block({
      id: req.params.id,
      adminId: req.admin._id,
      reason: req.body?.reason,
    });

    await logAdminAction({
      req,
      action: "user.block",
      targetUserId: user._id,
      targetType: "user",
      reason,
      metadata: { previousStatus },
    });

    // Generic copy on purpose — `reason` is the moderator's own wording and can
    // identify whoever reported them. Non-blocking: a mail failure must not
    // leave the account unblocked after the write already succeeded.
    if (user.email) {
      sendAccountDeactivatedEmail(
        user.email,
        user.name,
        "a violation of our community guidelines"
      ).catch((error) => console.error("Deactivation email failed:", error?.message || error));
    }

    return this.message(res, "Account blocked.");
  }

  async suspend(req, res) {
    const { user, reason, days, until, previousStatus } = await this.usersService.suspend({
      id: req.params.id,
      adminId: req.admin._id,
      days: req.body?.days,
      reason: req.body?.reason,
    });

    await logAdminAction({
      req,
      action: "user.suspend",
      targetUserId: user._id,
      targetType: "user",
      reason,
      metadata: { days, until, previousStatus },
    });

    return this.ok(res, {
      message: `Account suspended until ${until.toDateString()}.`,
      until,
    });
  }

  async reinstate(req, res) {
    const { user, action, reason, previousStatus } = await this.usersService.reinstate({
      id: req.params.id,
      adminId: req.admin._id,
      reason: req.body?.reason,
    });

    await logAdminAction({
      req,
      action,
      targetUserId: user._id,
      targetType: "user",
      reason,
      metadata: { previousStatus },
    });

    return this.message(res, "Account reinstated.");
  }

  async deleteProfile(req, res) {
    const { user, reason, profile } = await this.usersService.deleteProfile({
      id: req.params.id,
      adminId: req.admin._id,
      reason: req.body?.reason,
    });

    await logAdminAction({
      req,
      action: "user.delete_profile",
      targetUserId: user._id,
      targetType: "nannyProfile",
      targetId: profile?._id || null,
      reason,
      // The token is recorded so it stays knowable which public URL stopped
      // resolving, if someone asks why a link in a Facebook group went dead.
      metadata: { hadProfile: Boolean(profile), shareToken: profile?.shareToken || null },
    });

    return this.message(res, "Profile deleted. The account is still active.");
  }

  async deleteAccount(req, res) {
    const { user, reason, originalEmail, cancelledPendingRequests } =
      await this.usersService.deleteAccount({
        id: req.params.id,
        adminId: req.admin._id,
        reason: req.body?.reason,
      });

    await logAdminAction({
      req,
      action: "user.delete_account",
      targetUserId: user._id,
      targetType: "user",
      reason,
      // The original address lives here and nowhere else once the record is
      // tombstoned — it is how a deletion can be traced back to a person who
      // asks about it later.
      metadata: {
        originalEmail,
        name: user.name,
        cancelledRequests: cancelledPendingRequests,
        softDelete: true,
      },
    });

    return this.ok(res, {
      message: "Account deleted.",
      details: {
        softDelete: true,
        cancelledPendingRequests,
        note: "Message and match history is preserved for the other people involved.",
      },
    });
  }

  async flag(req, res) {
    const { suspicious } = await this.usersService.flag({
      id: req.params.id,
      adminId: req.admin._id,
      suspicious: req.body?.suspicious,
      reason: req.body?.reason,
    });

    return this.message(res, suspicious ? "Account flagged for review." : "Flag cleared.");
  }
}

export class AdminUsersModule extends RouteModule {
  static basePath = "/admin/users";
  static moduleName = "admin:users";

  registerRoutes(router) {
    const controller = new AdminUsersController({
      usersService: new AdminUsersService({
        userRepository,
        profileRepository,
        matchRepository,
        chatRepository,
        messageRepository,
        reportRepository,
        emailLogRepository,
        adminActionRepository,
      }),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.get("/:id", controller.detail);

    router.put("/:id/block", controller.block);
    router.put("/:id/suspend", controller.suspend);
    router.put("/:id/reinstate", controller.reinstate);
    router.put("/:id/flag", controller.flag);

    // Two segments, so it cannot be shadowed by "/:id" — registered ahead of it
    // anyway so the ordering does not become load-bearing.
    router.delete("/:id/profile", controller.deleteProfile);
    router.delete("/:id", controller.deleteAccount);
  }
}

export default AdminUsersModule;
