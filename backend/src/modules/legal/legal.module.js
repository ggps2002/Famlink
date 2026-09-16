import { RouteModule } from "../../core/http/RouteModule.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { BaseController } from "../../core/http/BaseController.js";
import { LegalService } from "./legal.service.js";
import Terms from "./terms.model.js";
import { userRepository } from "../user/user.repository.js";

export const termsRepository = new BaseRepository(Terms);

class LegalController extends BaseController {
  constructor({ legalService }) {
    super();
    this.legalService = legalService;
  }

  async document(req, res) {
    const doc = await this.legalService.getDocument(req.params.slug);

    // Content is sanitised at write time, so what is stored is what is safe to
    // render. The cache header matches the service's own TTL.
    res.setHeader("Cache-Control", "public, max-age=60");
    return this.sendData(res, doc);
  }

  async version(req, res) {
    return this.sendData(res, await this.legalService.getVersion(req.params.slug));
  }

  async accept(req, res) {
    const result = await this.legalService.accept({
      userId: req.userId,
      slug: req.body?.slug,
      version: req.body?.version,
    });

    return this.sendData(res, result, { message: "Recorded." });
  }

  async status(req, res) {
    return this.sendData(res, await this.legalService.statusFor(req.userId));
  }
}

export class LegalModule extends RouteModule {
  static basePath = "/legal";
  static moduleName = "legal";

  registerRoutes(router) {
    const controller = new LegalController({
      legalService: new LegalService({ termsRepository, userRepository }),
    });

    // Order matters: the literal paths must be registered before "/:slug", or
    // a request for /legal/status/me would be matched as the document with
    // slug "status".
    router.post("/accept", authenticate, controller.accept);
    router.get("/status/me", authenticate, controller.status);

    router.get("/:slug/version", controller.version);
    router.get("/:slug", controller.document);
  }
}

export default LegalModule;
