import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { upload } from "../../core/http/middleware/upload.js";
import uploadImage from "../../shared/storage/uploadImage.js";
import { sendReferralRewardEmail } from "../../shared/email/email.js";
import { creditReferrerForProfileCompletion } from "../referral/referral.util.js";
import { ProfileService } from "./profile.service.js";
import { profileRepository } from "./profile.repository.js";
import { userRepository } from "../user/user.repository.js";

class ProfileController extends BaseController {
  constructor({ profileService }) {
    super();
    this.profileService = profileService;
  }

  async create(req, res) {
    const profile = await this.profileService.create({
      userId: req.userId,
      body: req.body,
      file: req.file,
    });

    // The pre-refactor response spread the Mongoose document directly, which
    // ships `$__`, `_doc` and `$isNew` rather than the profile's fields — the
    // real data arrived nested under `_doc`. Nothing reads this body (every
    // caller discards the payload), so it now returns the profile itself.
    return this.ok(res, {
      ...profile.toObject(),
      message: "Profile created successfully",
    });
  }

  async update(req, res) {
    const profile = await this.profileService.update({
      userId: req.userId,
      body: req.body,
      file: req.file,
    });

    return this.ok(res, { message: "Profile updated successfully", profile });
  }
}

export class ProfileModule extends RouteModule {
  static basePath = "/nanny";
  static moduleName = "nanny";

  registerRoutes(router) {
    const controller = new ProfileController({
      profileService: new ProfileService({
        profileRepository,
        userRepository,
        // Injected so a test can save a profile without a Cloudinary account,
        // an SMTP host, or a referral ledger.
        imageUploader: uploadImage,
        creditReferrer: creditReferrerForProfileCompletion,
        sendReferralRewardEmail,
      }),
    });

    router.use(authenticate);

    router.post("/nanny-share/profile", upload.single("imageFile"), controller.create);
    router.patch("/nanny-share/profile", upload.single("imageFile"), controller.update);
  }
}

export default ProfileModule;
