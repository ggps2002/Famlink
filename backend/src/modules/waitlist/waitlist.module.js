import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { WaitlistService } from "./waitlist.service.js";
import { ConfirmationThrottle } from "../../shared/throttle/ConfirmationThrottle.js";
import { recordWaitlistEntry } from "./waitlist.util.js";
import { sendWaitlistConfirmationEmail } from "../../shared/email/email.js";

class WaitlistController extends BaseController {
  constructor({ waitlistService }) {
    super();
    this.waitlistService = waitlistService;
  }

  async confirmation(req, res) {
    const { message, sent } = await this.waitlistService.confirm({
      ...(req.body || {}),
      ip: req.ip,
    });

    return this.ok(res, { message, sent });
  }
}

export class WaitlistModule extends RouteModule {
  static basePath = "/waitlist";
  static moduleName = "waitlist";

  registerRoutes(router) {
    const controller = new WaitlistController({
      waitlistService: new WaitlistService({
        recordWaitlistEntry,
        throttle: new ConfirmationThrottle(),
        emailService: { sendWaitlistConfirmationEmail },
      }),
    });

    // Public: this fires before the visitor has an account.
    router.post("/confirmation", controller.confirmation);
  }
}

export default WaitlistModule;
