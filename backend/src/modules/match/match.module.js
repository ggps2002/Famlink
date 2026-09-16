import { RouteModule } from "../../core/http/RouteModule.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { MatchController } from "./match.controller.js";
import { MatchService } from "./match.service.js";
import { matchRepository } from "./match.repository.js";
import { userRepository } from "../user/user.repository.js";
import { profileRepository } from "../profile/profile.repository.js";
import { chatRepository } from "../messaging/chat.repository.js";
import { hasActiveReferralMatching } from "../referral/referral.util.js";
import { sendMatchRequestEmail, sendMatchAcceptedEmail } from "../../shared/email/email.js";

/**
 * The match feature's HTTP surface, and the one place its object graph is
 * assembled.
 *
 * Wiring lives here rather than inside the service so that the service's
 * collaborators stay swappable — the unit tests construct MatchService with
 * fakes and never load this file, which is why they need no database and no
 * mail host.
 *
 * Paths are reproduced exactly as they were, including the ones that take
 * `matchId` as a query parameter on a POST. That is not the shape anyone would
 * choose now, but the frontend already calls them this way.
 */
export class MatchModule extends RouteModule {
  static basePath = "/match";
  static moduleName = "match";

  registerRoutes(router) {
    const controller = new MatchController({
      matchService: new MatchService({
        matchRepository,
        userRepository,
        profileRepository,
        chatRepository,
        emailService: { sendMatchRequestEmail, sendMatchAcceptedEmail },
        referralPolicy: { hasActiveReferralMatching },
      }),
    });

    router.use(authenticate);

    router.post("/request", controller.requestMatch);
    router.get("/get-outgoing-requests", controller.getOutgoingRequests);
    router.get("/get-incoming-requests", controller.getIncomingRequests);
    router.get("/pending-incoming-count", controller.getPendingIncomingCount);
    router.post("/accept-incoming-request", controller.acceptIncomingRequest);
    router.post("/reject-incoming-request", controller.rejectIncomingRequest);
    router.post("/undo-reject-incoming-request", controller.undoRejectedIncomingRequest);
    router.post("/block-match", controller.blockMatch);
    router.post("/unblock-match", controller.unblockMatch);
    router.get("/get-match-with-user", controller.getMatchWithUser);
  }
}

export default MatchModule;
