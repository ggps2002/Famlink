import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { NannyShareService } from "./nannyShare.service.js";
import { nannyShareRepository } from "./nannyShare.repository.js";
import { userRepository } from "../user/user.repository.js";
import * as templates from "./nannyShare.templates.js";
import { sendAutoEmail } from "../../shared/email/email.js";

/**
 * Response bodies are reproduced field for field from Routes/nannyShare.js,
 * including the `status: 200` that the two list endpoints carry inside the body
 * as well as in the HTTP status. Six Redux slices read these shapes; the
 * refactor's contract is that the API does not change.
 */
class NannyShareController extends BaseController {
  constructor({ nannyShareService }) {
    super();
    this.shares = nannyShareService;
  }

  async create(req, res) {
    const job = await this.shares.create(req.userId, req.body);
    return res.status(201).json({ message: "Nanny Share job posted successfully", job });
  }

  async remove(req, res) {
    await this.shares.remove(req.userId, req.params.id);
    return this.message(res, "Nanny Share job deleted successfully");
  }

  async update(req, res) {
    const job = await this.shares.update(req.userId, req.params.id, req.body);
    return res.status(200).json({ message: "Nanny Share job updated successfully", job });
  }

  async browse(req, res) {
    const { pagination, data } = await this.shares.browse(req.userId, req.query);
    return res.status(200).json({ status: 200, pagination, data });
  }

  async adminList(req, res) {
    const { admin, data, pagination } = await this.shares.adminList(req.userId, req.query);
    return res.status(200).json({ admin, data, pagination });
  }

  async detail(req, res) {
    const data = await this.shares.detail(req.params.id);
    return this.sendData(res, data);
  }

  async listByCity(req, res) {
    const { pagination, data } = await this.shares.listByCity(req.params.city, req.query);
    return res.status(200).json({ status: 200, pagination, data });
  }

  async sendQuestionnaireEmail(req, res) {
    await this.shares.sendQuestionnaireEmail(req.body);
    return this.message(res, "Questionnaire email sent successfully");
  }
}

export class NannyShareModule extends RouteModule {
  static basePath = "/nannyShare";
  static moduleName = "nannyShare";

  registerRoutes(router) {
    const controller = new NannyShareController({
      nannyShareService: new NannyShareService({
        nannyShareRepository,
        userRepository,
        emailService: { sendAutoEmail },
        templates,
      }),
    });

    router.post("/", authenticate, controller.create);
    router.delete("/:id", authenticate, controller.remove);
    router.patch("/:id", authenticate, controller.update);
    router.get("/", authenticate, controller.browse);

    // MUST stay above GET "/:id". Express matches in registration order, and
    // "/:id" would otherwise claim "/allData" and look up a share whose id is
    // the literal string "allData".
    router.get("/allData", authenticate, controller.adminList);

    // Was unauthenticated before the refactor, and served the poster's email
    // address and full stored location — street address and exact coordinates —
    // to anyone holding an id. The dashboard already sent a token.
    router.get("/:id", authenticate, controller.detail);

    // Public: the programmatic /nanny-share/:city landing pages, which are meant
    // to be crawlable and are fetched before anyone signs in.
    router.get("/nanny-share-opportunities/city/:city", controller.listByCity);
    router.post("/send-questionnaire-email", controller.sendQuestionnaireEmail);
  }
}

export default NannyShareModule;
