import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { PhoneVerificationService } from "./phoneVerification.service.js";
import { CredentialsService } from "./credentials.service.js";
import { TokenService } from "./token.service.js";
import { refreshTokenRepository } from "./refreshToken.repository.js";
import { toSessionPayload } from "./auth.presenter.js";
import { userRepository } from "../user/user.repository.js";
import { sendOtpSMS } from "../../shared/sms/sms.js";

class PhoneVerificationController extends BaseController {
  constructor({ phoneVerificationService }) {
    super();
    this.phoneVerificationService = phoneVerificationService;
  }

  async sendOtp(req, res) {
    await this.phoneVerificationService.sendCode({
      userId: req.userId,
      phoneNo: req.body.phoneNo,
    });

    return this.message(res, "OTP sent successfully.");
  }

  async resendOtp(req, res) {
    await this.phoneVerificationService.resendCode({
      userId: req.userId,
      phoneNo: req.body.phoneNo,
    });

    return this.message(res, "OTP resent successfully");
  }

  async verifyOtp(req, res) {
    const { user, tokens } = await this.phoneVerificationService.verifyCode({
      userId: req.userId,
      oneTimePass: req.body.oneTimePass,
      phoneNo: req.body.phoneNo,
    });

    return this.ok(res, {
      message: "Phone number verified successfully",
      ...toSessionPayload(user, tokens),
    });
  }
}

export class PhoneVerificationModule extends RouteModule {
  static basePath = "/sms-verification";
  static moduleName = "sms-verification";

  registerRoutes(router) {
    const controller = new PhoneVerificationController({
      phoneVerificationService: new PhoneVerificationService({
        userRepository,
        credentials: new CredentialsService(),
        tokenService: new TokenService({ refreshTokenRepository }),
        smsService: { sendOtpSMS },
      }),
    });

    router.use(authenticate);

    router.post("/send-otp", controller.sendOtp);
    router.post("/resend-otp", controller.resendOtp);
    router.post("/verify-otp", controller.verifyOtp);
  }
}

export default PhoneVerificationModule;
