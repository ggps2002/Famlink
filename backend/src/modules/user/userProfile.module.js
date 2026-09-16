import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { upload } from "../../core/http/middleware/upload.js";
import uploadImage from "../../shared/storage/uploadImage.js";
import { sendProfileUpdatedEmail } from "../../shared/email/email.js";
import { UserProfileService } from "./userProfile.service.js";
import { userRepository } from "./user.repository.js";

class UserProfileController extends BaseController {
  constructor({ userProfileService }) {
    super();
    this.userProfileService = userProfileService;
  }

  async updateOwn(req, res) {
    const user = await this.userProfileService.updateOwn({
      userId: req.userId,
      body: req.body,
      files: req.files,
    });

    return this.ok(res, { message: "User updated successfully", user });
  }

  async updateAsAdmin(req, res) {
    const user = await this.userProfileService.updateAsAdmin({
      adminId: req.userId,
      body: req.body,
      files: req.files,
    });

    return this.ok(res, { message: "User updated successfully", user });
  }
}

export class UserProfileModule extends RouteModule {
  static basePath = "/edit";
  static moduleName = "edit";

  registerRoutes(router) {
    const controller = new UserProfileController({
      userProfileService: new UserProfileService({
        userRepository,
        // Injected rather than imported inside the service so a test can edit a
        // profile without a Cloudinary account or an SMTP host.
        imageUploader: uploadImage,
        sendProfileUpdatedEmail,
      }),
    });

    router.use(authenticate);

    // `upload.any()` because the form's file field has been named both
    // `imageUrl` and `file` across app versions, and a named field that does
    // not match makes multer reject the whole request.
    router.put("/user", upload.any(), controller.updateOwn);
    router.put("/admin/user", upload.any(), controller.updateAsAdmin);
  }
}

export default UserProfileModule;
