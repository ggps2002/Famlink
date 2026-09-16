import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { upload } from "../../core/http/middleware/upload.js";
import uploadImage from "../../shared/storage/uploadImage.js";
import { sendEmail } from "../../shared/email/email.js";
import { IdentityVerificationService } from "./identity.service.js";
import Verify from "../auth/verificationCode.model.js";
import { userRepository } from "../user/user.repository.js";

export const verificationRepository = new BaseRepository(Verify);

class IdentityVerificationController extends BaseController {
  constructor({ identityService }) {
    super();
    this.identityService = identityService;
  }

  async submit(req, res) {
    const status = await this.identityService.submit({
      userId: req.userId,
      files: req.files,
    });

    return this.ok(res, {
      message: `Your data for verification in ${status}`,
      data: status,
    });
  }

  async show(req, res) {
    return this.sendData(
      res,
      await this.identityService.findForUser({ adminId: req.userId, userId: req.params.id })
    );
  }

  async approve(req, res) {
    await this.identityService.approve({ adminId: req.userId, verificationId: req.params.id });
    return this.message(res, "User verification done successfully");
  }

  async revert(req, res) {
    await this.identityService.revert({ adminId: req.userId, verificationId: req.params.id });
    return this.message(res, "User unverified request submit successfully");
  }
}

export class IdentityVerificationModule extends RouteModule {
  static basePath = "/verify";
  static moduleName = "verify";

  registerRoutes(router) {
    const controller = new IdentityVerificationController({
      identityService: new IdentityVerificationService({
        userRepository,
        verificationRepository,
        imageUploader: uploadImage,
        sendEmail,
      }),
    });

    router.use(authenticate);

    router.post(
      "/",
      upload.fields([
        { name: "frontImage", maxCount: 1 },
        { name: "backImage", maxCount: 1 },
      ]),
      controller.submit
    );

    // `/unverify/:id` is two path segments, so it cannot be shadowed by
    // `/:id` — but it is registered first anyway, so the ordering does not
    // become load-bearing if either path changes.
    router.put("/unverify/:id", controller.revert);

    // `:id` means two different things here, inherited from the original
    // routes: on GET it is the *member's* id, on PUT it is the *verification
    // record's* id. Preserved because the console calls both.
    router.get("/:id", controller.show);
    router.put("/:id", controller.approve);
  }
}

export default IdentityVerificationModule;
