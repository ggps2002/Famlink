import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { EmailVerificationService } from "./emailVerification.service.js";
import { EmailOtpStore } from "./EmailOtpStore.js";
import { CredentialsService } from "./credentials.service.js";
import { sendOtpEmail } from "../../shared/email/email.js";

class EmailVerificationController extends BaseController {
  constructor({ emailVerificationService }) {
    super();
    this.emailVerificationService = emailVerificationService;
  }

  async sendOtp(req, res) {
    await this.emailVerificationService.issue(req.body.email, "send");
    return this.message(res, "OTP sent successfully");
  }

  async resendOtp(req, res) {
    await this.emailVerificationService.issue(req.body.email, "resend");
    return this.message(res, "OTP resent successfully");
  }

  async verifyOtp(req, res) {
    await this.emailVerificationService.verify(req.body);
    return this.ok(res, { message: "Email verified successfully", verified: true });
  }
}

/**
 * Public by necessity: this runs during signup, before the visitor has an
 * account or a token.
 */
export class EmailVerificationModule extends RouteModule {
  static basePath = "/email-verification";
  static moduleName = "email-verification";

  registerRoutes(router) {
    const controller = new EmailVerificationController({
      emailVerificationService: new EmailVerificationService({
        store: new EmailOtpStore(),
        credentials: new CredentialsService(),
        emailService: { sendOtpEmail },
      }),
    });

    router.post("/send-otp", controller.sendOtp);
    router.post("/resend-otp", controller.resendOtp);
    router.post("/verify-otp", controller.verifyOtp);
  }
}

export default EmailVerificationModule;
