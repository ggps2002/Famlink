import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseService } from "../../core/http/BaseService.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { onboardingRepository } from "./onboarding.repository.js";

class OnboardingService extends BaseService {
  save({ email, answers }) {
    return this.onboardingRepository.upsertByEmail(email, answers);
  }
}

class OnboardingController extends BaseController {
  constructor({ onboardingService }) {
    super();
    this.onboardingService = onboardingService;
  }

  async save(req, res) {
    const data = await this.onboardingService.save({
      email: req.body.email,
      answers: req.body,
    });

    // Responds with the bare document, not wrapped in `data` — preserved,
    // because the questionnaire client reads the fields off the top level.
    return this.ok(res, data);
  }
}

export class OnboardingModule extends RouteModule {
  static basePath = "/onboarding";
  static moduleName = "onboarding";

  registerRoutes(router) {
    const controller = new OnboardingController({
      onboardingService: new OnboardingService({ onboardingRepository }),
    });

    router.post("/save", authenticate, controller.save);
  }
}

export default OnboardingModule;
