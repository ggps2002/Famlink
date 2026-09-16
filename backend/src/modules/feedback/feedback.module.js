import { RouteModule } from "../../core/http/RouteModule.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { BaseController } from "../../core/http/BaseController.js";
import { FeedbackService } from "./feedback.service.js";
import * as templates from "./feedback.templates.js";
import Feedback from "./feedback.model.js";
import { userRepository } from "../user/user.repository.js";
import { sendEmail, sendFeedbackReceivedEmail } from "../../shared/email/email.js";

export const feedbackRepository = new BaseRepository(Feedback);

class FeedbackController extends BaseController {
  constructor({ feedbackService }) {
    super();
    this.feedbackService = feedbackService;
  }

  async list(req, res) {
    const feedbacks = await this.feedbackService.listAll(req.userId);
    return this.ok(res, { success: true, count: feedbacks.length, feedbacks });
  }

  async submit(req, res) {
    await this.feedbackService.submit(req.body);
    return this.message(res, "Feedback saved successfully!", 201);
  }
}

export class FeedbackModule extends RouteModule {
  static basePath = "/feedback";
  static moduleName = "feedback";

  registerRoutes(router) {
    const controller = new FeedbackController({
      feedbackService: new FeedbackService({
        feedbackRepository,
        userRepository,
        emailService: { sendEmail, sendFeedbackReceivedEmail },
        templates,
      }),
    });

    router.get("/", authenticate, controller.list);
    // Public: the contact form is reachable without an account.
    router.post("/", controller.submit);
  }
}

export default FeedbackModule;
