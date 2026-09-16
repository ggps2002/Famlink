import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import config from "../../config/index.js";
import { UnsubscribeService } from "./unsubscribe.service.js";
import { userRepository } from "../user/user.repository.js";
import OnboardingLead from "../lead/onboardingLead.model.js";
import WaitlistEntry from "../waitlist/waitlistEntry.model.js";
import { signUnsubscribe, verifyUnsubscribe } from "../../shared/email/unsubscribeToken.js";
import { sendEmail } from "../../shared/email/email.js";

const APP_URL = config.urls.app || config.urls.client || "https://www.famlink.care";

const templates = {
  confirmUnsubscribe: (url) =>
    `<div style="font-family: Arial, sans-serif; font-size: 15px; color: #374151; line-height: 1.7;">
         <p>You asked to stop receiving FamLink emails.</p>
         <p><a href="${url}" style="color:#001243;font-weight:700;">Click here to confirm and unsubscribe</a></p>
         <p style="color:#9CA3AF;font-size:13px;">If you didn't request this, you can ignore this email — nothing has changed.</p>
       </div>`,
};

class UnsubscribeController extends BaseController {
  constructor({ unsubscribeService }) {
    super();
    this.unsubscribeService = unsubscribeService;
  }

  async unsubscribe(req, res) {
    const { email, token } = req.body;
    await this.unsubscribeService.unsubscribe({ email, token });

    return this.ok(res, {
      message: "You've been unsubscribed from FamLink emails.",
      email,
    });
  }

  async request(req, res) {
    await this.unsubscribeService.requestLink(req.body.email);

    // Identical whether or not the address has an account.
    return this.message(
      res,
      "If that address is on our list, we've just emailed it an unsubscribe link."
    );
  }
}

/** Public throughout — the HMAC in the link is the credential, not a session. */
export class UnsubscribeModule extends RouteModule {
  static basePath = "/unsubscribe";
  static moduleName = "unsubscribe";

  registerRoutes(router) {
    const controller = new UnsubscribeController({
      unsubscribeService: new UnsubscribeService({
        userRepository,
        onboardingLeadRepository: new BaseRepository(OnboardingLead),
        waitlistRepository: new BaseRepository(WaitlistEntry),
        signUnsubscribe,
        verifyUnsubscribe,
        emailService: { sendEmail },
        templates,
        appUrl: APP_URL,
      }),
    });

    router.post("/", controller.unsubscribe);
    router.post("/request", controller.request);
  }
}

export default UnsubscribeModule;
