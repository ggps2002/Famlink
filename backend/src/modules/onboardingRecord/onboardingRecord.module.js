import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { rateLimit } from "../../core/http/middleware/rateLimit.js";
import { onboardingRecordRepository } from "./onboardingRecord.repository.js";
import { OnboardingRecordService } from "./onboardingRecord.service.js";

export const onboardingRecordService = new OnboardingRecordService({ onboardingRecordRepository });

class OnboardingRecordController extends BaseController {
  constructor({ service }) {
    super();
    this.service = service;
  }

  async save(req, res) {
    const { recordId } = await this.service.save(req.body || {});
    // `status: "success"` is the Google Sheet script's reply shape, kept so the
    // forms that check it didn't need to change.
    return this.ok(res, { status: "success", recordId });
  }

  async get(req, res) {
    const record = await this.service.get(req.params.recordId);
    return this.ok(res, { status: "success", record });
  }
}

/**
 * The onboarding forms' answers, stored in our database instead of a Google
 * Sheet. Public: every call here comes from someone who doesn't have an account
 * yet. A record is reachable only by its random UUID, which is carried in that
 * visitor's own onboarding URLs — the same exposure the sheet script had.
 */
export class OnboardingRecordModule extends RouteModule {
  static basePath = "/onboarding-records";
  static moduleName = "onboarding-records";

  registerRoutes(router) {
    const controller = new OnboardingRecordController({ service: onboardingRecordService });

    // A full onboarding is ~10 saves and a few reads; these ceilings are far
    // above that and far below what scripted abuse needs.
    const writeLimit = rateLimit({
      name: "onboarding-record-write",
      limit: 60,
      windowSec: 3600,
      message: "Too many form submissions. Please try again later.",
    });
    const readLimit = rateLimit({
      name: "onboarding-record-read",
      limit: 120,
      windowSec: 3600,
      message: "Too many requests. Please try again later.",
    });

    router.post("/", writeLimit, controller.save);
    router.get("/:recordId", readLimit, controller.get);
  }
}

export default OnboardingRecordModule;
