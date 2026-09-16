import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { sendEmailConfirmation } from "../../shared/email/email.js";
import { NewsletterService } from "./newsletter.service.js";
import { userRepository } from "../user/user.repository.js";
import { escapeRegex } from "../admin/admin.middleware.js";
import Subscription from "./subscription.model.js";

export const subscriptionRepository = new BaseRepository(Subscription);

class NewsletterController extends BaseController {
  constructor({ newsletterService }) {
    super();
    this.newsletterService = newsletterService;
  }

  async subscribe(req, res) {
    await this.newsletterService.requestSubscription(req.body.email);
    return this.message(res, "Confirmation Email Sent!");
  }

  /** Returns a page, not JSON — this URL is opened from a mail client. */
  async confirm(req, res) {
    const { status, html } = await this.newsletterService.confirmSubscription(req.params.token);
    return res.status(status).send(html);
  }

  async list(req, res) {
    const { data, pagination } = await this.newsletterService.listSubscribers({
      adminId: req.userId,
      query: req.query,
    });

    return this.ok(res, { status: 200, data, pagination });
  }
}

export class NewsletterModule extends RouteModule {
  static basePath = "/subscribe";
  static moduleName = "subscribe";

  registerRoutes(router) {
    const controller = new NewsletterController({
      newsletterService: new NewsletterService({
        subscriptionRepository,
        userRepository,
        sendEmailConfirmation,
        escapeRegex,
      }),
    });

    // Both public: the sign-up form is on the marketing site, and the
    // confirmation link is followed from an inbox with no session.
    router.post("/news-letter", controller.subscribe);
    router.get("/verify-email/:token", controller.confirm);

    router.get("/", authenticate, controller.list);
  }
}

export default NewsletterModule;
