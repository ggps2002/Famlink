import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { ShareService } from "./share.service.js";
import { ShareLinkService } from "./shareLink.service.js";
import { profileRepository } from "../profile/profile.repository.js";
import { userRepository } from "../user/user.repository.js";
import { matchRepository } from "../match/match.repository.js";
import { escapeRegex } from "../admin/admin.middleware.js";

class ShareController extends BaseController {
  constructor({ shareService, shareLinkService }) {
    super();
    this.shareService = shareService;
    this.shareLinkService = shareLinkService;
  }

  async browse(req, res) {
    const { data, pagination } = await this.shareService.browse({
      userId: req.userId,
      criteria: req.body || {},
    });

    return this.ok(res, { status: 200, pagination, data });
  }

  async ownProfile(req, res) {
    return this.ok(res, {
      status: 200,
      data: await this.shareService.ownProfile(req.userId),
    });
  }

  async adminList(req, res) {
    const { data, pagination } = await this.shareService.listAllForAdmin({
      adminId: req.userId,
      query: req.query,
    });

    return this.ok(res, { status: 200, pagination, data });
  }

  async adminFilters(req, res) {
    return this.ok(res, {
      status: 200,
      data: await this.shareService.filterOptionsForAdmin(req.userId),
    });
  }

  async myShareLink(req, res) {
    return this.sendData(res, await this.shareLinkService.mintForOwner(req.userId));
  }

  async publicProfile(req, res) {
    return this.sendData(res, await this.shareLinkService.resolvePublic(req.params.token));
  }
}

export class ShareModule extends RouteModule {
  static basePath = "/share";
  static moduleName = "share";

  registerRoutes(router) {
    const controller = new ShareController({
      shareService: new ShareService({
        profileRepository,
        userRepository,
        matchRepository,
        escapeRegex,
      }),
      shareLinkService: new ShareLinkService({ profileRepository }),
    });

    // Public, and the only route in this module that is. This is what a
    // stranger loads after following a link someone pasted into a group chat.
    router.get("/public/:token", controller.publicProfile);

    router.use(authenticate);

    router.post("/show-profiles", controller.browse);
    router.get("/current-user-profile", controller.ownProfile);
    router.get("/my-share-link", controller.myShareLink);

    router.get("/admin/all-profiles", controller.adminList);
    router.get("/admin/profile-filters", controller.adminFilters);
  }
}

export default ShareModule;
