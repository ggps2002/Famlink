import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { ReviewService } from "./review.service.js";
import * as templates from "./review.templates.js";
import Booking from "../booking/booking.model.js";
import { userRepository } from "../user/user.repository.js";
import { matchRepository } from "../match/match.repository.js";
import { sendEmail } from "../../shared/email/email.js";

export const bookingRepository = new BaseRepository(Booking);

class ReviewController extends BaseController {
  constructor({ reviewService }) {
    super();
    this.reviewService = reviewService;
  }

  async submit(req, res) {
    // `userId` is spread over LAST on purpose. With it first, a body carrying
    // its own `userId` overrode the authenticated one — and since the service
    // uses that id both to authorise the review and to sign it, a caller could
    // post a review as somebody else. It is the reviewer's identity, so it
    // comes from the token and nowhere else.
    await this.reviewService.submit({ ...req.body, userId: req.userId });
    return this.message(res, "Review submitted and email sent successfully");
  }

  async listForUser(req, res) {
    const data = await this.reviewService.listFor(req.params.uid);
    return this.ok(res, { success: true, data });
  }
}

export class ReviewModule extends RouteModule {
  static basePath = "/reviews";
  static moduleName = "reviews";

  registerRoutes(router) {
    const controller = new ReviewController({
      reviewService: new ReviewService({
        userRepository,
        bookingRepository,
        // A review without a bookingId is authorised by an accepted match
        // instead — see ReviewService's class comment.
        matchRepository,
        emailService: { sendEmail },
        templates,
      }),
    });

    router.post("/", authenticate, controller.submit);
    // Public: reviews are shown on a profile to anyone who can see the profile.
    router.get("/:uid", controller.listForUser);
  }
}

export default ReviewModule;
