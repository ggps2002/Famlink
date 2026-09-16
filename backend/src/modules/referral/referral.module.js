import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { ReferralService } from "./referral.service.js";
import { userRepository } from "../user/user.repository.js";
import { profileRepository } from "../profile/profile.repository.js";

class ReferralController extends BaseController {
  constructor({ referralService }) {
    super();
    this.referralService = referralService;
  }

  async me(req, res) {
    return this.sendData(res, await this.referralService.summaryFor(req.userId));
  }

  async friends(req, res) {
    return this.sendData(res, await this.referralService.friendsOf(req.userId));
  }

  async seenReward(req, res) {
    return this.sendData(res, await this.referralService.acknowledgeRewards(req.userId));
  }
}

export class ReferralModule extends RouteModule {
  static basePath = "/referral";
  static moduleName = "referral";

  registerRoutes(router) {
    const controller = new ReferralController({
      referralService: new ReferralService({ userRepository, profileRepository }),
    });

    router.use(authenticate);

    router.get("/me", controller.me);
    router.get("/friends", controller.friends);
    router.post("/seen-reward", controller.seenReward);
  }
}

export default ReferralModule;
