import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { ShareLinksService } from "./shareLinks.service.js";
import { profileRepository } from "../profile/profile.repository.js";
import { userRepository } from "../user/user.repository.js";

class ShareLinksController extends BaseController {
  constructor({ shareLinksService }) {
    super();
    this.shareLinksService = shareLinksService;
  }

  async list(req, res) {
    const { data, pagination } = await this.shareLinksService.list({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async generate(req, res) {
    const { token, url, enabled, alreadyExisted, profile } =
      await this.shareLinksService.generate({
        userId: req.params.userId,
        adminId: req.admin._id,
      });

    // Only the first mint is an event worth recording. Re-requesting an
    // existing link changes nothing, and logging it would fill the trail with
    // entries that describe no action.
    if (!alreadyExisted) {
      await logAdminAction({
        req,
        action: "share_link.generate",
        targetUserId: req.params.userId,
        targetType: "nannyProfile",
        targetId: profile._id,
        reason: "Share link generated from admin console",
      });
    }

    return this.sendData(res, { token, url, enabled, alreadyExisted });
  }

  async preview(req, res) {
    return this.sendData(res, await this.shareLinksService.preview(req.params.userId));
  }

  async toggle(req, res) {
    const { enabled, profileId, token, url, message } = await this.shareLinksService.toggle({
      userId: req.params.userId,
      enabled: req.body?.enabled,
      adminId: req.admin._id,
    });

    await logAdminAction({
      req,
      action: "share_link.toggle",
      targetUserId: req.params.userId,
      targetType: "nannyProfile",
      targetId: profileId,
      reason: req.body?.reason || (enabled ? "Share link enabled" : "Share link disabled"),
      metadata: { enabled },
    });

    return this.ok(res, { message, data: { enabled, token, url } });
  }
}

export class AdminShareLinksModule extends RouteModule {
  static basePath = "/admin/share-links";
  static moduleName = "admin:share-links";

  registerRoutes(router) {
    const controller = new ShareLinksController({
      shareLinksService: new ShareLinksService({ profileRepository, userRepository }),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.post("/:userId/generate", controller.generate);
    router.get("/:userId/preview", controller.preview);
    router.put("/:userId/toggle", controller.toggle);
  }
}

export default AdminShareLinksModule;
