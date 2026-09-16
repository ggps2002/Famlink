import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { AccountSettingsService } from "./accountSettings.service.js";
import { userRepository } from "./user.repository.js";
import { CredentialsService } from "../auth/credentials.service.js";
import { TokenService } from "../auth/token.service.js";
import { refreshTokenRepository } from "../auth/refreshToken.repository.js";
import { toSessionPayload } from "../auth/auth.presenter.js";

/**
 * Several of these responses repeat the HTTP status inside the body as
 * `status`. Preserved — the Settings screen reads `data.status` in places.
 */
class AccountSettingsController extends BaseController {
  constructor({ accountSettingsService }) {
    super();
    this.accountSettingsService = accountSettingsService;
  }

  async changeEmail(req, res) {
    await this.accountSettingsService.changeEmail({ userId: req.userId, ...req.body });
    return this.ok(res, {
      status: 200,
      message: "Email changed successfully, verification status reset.",
    });
  }

  async changePassword(req, res) {
    await this.accountSettingsService.changePassword({ userId: req.userId, ...req.body });
    return this.ok(res, { status: 200, message: "Password updated successfully" });
  }

  async setSmsNotifications(req, res) {
    const sms = await this.accountSettingsService.setSmsNotifications({
      userId: req.userId,
      sms: req.body.sms,
    });

    return this.ok(res, {
      message: "Text notification preference updated successfully",
      sms,
    });
  }

  async changePhone(req, res) {
    const { user, tokens } = await this.accountSettingsService.changePhone({
      userId: req.userId,
      phoneNo: req.body.phoneNo,
    });

    return this.ok(res, {
      message: "Phone number updated successfully",
      ...toSessionPayload(user, tokens),
    });
  }

  async setEmailNotifications(req, res) {
    const notifications = await this.accountSettingsService.setEmailNotifications({
      userId: req.userId,
      notifications: req.body.notifications,
    });

    return this.ok(res, {
      message: "Email notifications updated successfully",
      notifications,
    });
  }
}

export class AccountSettingsModule extends RouteModule {
  static basePath = "/update";
  static moduleName = "update";

  registerRoutes(router) {
    const controller = new AccountSettingsController({
      accountSettingsService: new AccountSettingsService({
        userRepository,
        credentials: new CredentialsService(),
        tokenService: new TokenService({ refreshTokenRepository }),
      }),
    });

    router.use(authenticate);

    router.put("/email", controller.changeEmail);
    router.put("/password", controller.changePassword);
    router.put("/text-notifications", controller.setSmsNotifications);
    router.put("/phone", controller.changePhone);
    router.put("/email-notifications", controller.setEmailNotifications);
  }
}

export default AccountSettingsModule;
