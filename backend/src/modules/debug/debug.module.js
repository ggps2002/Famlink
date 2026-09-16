import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { sendWelcomeEmail, sendReferralRewardEmail } from "../../shared/email/email.js";
import { creditReferrerForProfileCompletion } from "../referral/referral.util.js";
import { DebugService } from "./debug.service.js";
import { userRepository } from "../user/user.repository.js";
import config from "../../config/index.js";

/**
 * Operator tooling for diagnosing referral payouts and mail delivery.
 *
 * Outside production the referral routes skip the token so they can be opened
 * straight from a browser during development; in production they demand a valid
 * token *and* an admin. The service enforces the second half — see
 * `assertAllowed` — so loosening the middleware cannot on its own make any of
 * this readable by a member.
 */
const debugAuthenticate = (req, res, next) => {
  if (!config.isProduction) return next();
  return authenticate(req, res, next);
};

class DebugController extends BaseController {
  constructor({ debugService }) {
    super();
    this.debugService = debugService;
  }

  async referral(req, res) {
    return this.ok(
      res,
      await this.debugService.inspectReferral({
        requesterId: req.userId,
        email: req.query.email,
        code: req.query.code,
      })
    );
  }

  async recredit(req, res) {
    return this.ok(
      res,
      await this.debugService.recreditReferral({
        requesterId: req.userId,
        email: req.body?.email,
      })
    );
  }

  async emailTest(req, res) {
    return this.ok(
      res,
      await this.debugService.sendTestEmail({
        requesterId: req.userId,
        to: req.body?.email,
        name: req.body?.name,
      })
    );
  }
}

export class DebugModule extends RouteModule {
  static basePath = "/debug";
  static moduleName = "debug";

  registerRoutes(router) {
    const controller = new DebugController({
      debugService: new DebugService({
        userRepository,
        creditReferrer: creditReferrerForProfileCompletion,
        sendReferralRewardEmail,
        sendWelcomeEmail,
      }),
    });

    router.get("/referral", debugAuthenticate, controller.referral);
    router.post("/referral/recredit", debugAuthenticate, controller.recredit);

    // Always authenticated, in every environment: this one sends real mail.
    router.post("/email-test", authenticate, controller.emailTest);
  }
}

export default DebugModule;
