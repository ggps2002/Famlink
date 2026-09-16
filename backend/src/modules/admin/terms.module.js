import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { TermsAdminService } from "./terms.service.js";
import { termsRepository } from "../legal/terms.repository.js";
import { userRepository } from "../user/user.repository.js";

class TermsAdminController extends BaseController {
  constructor({ termsService }) {
    super();
    this.termsService = termsService;
  }

  async read(req, res) {
    return this.sendData(res, await this.termsService.read({ slug: req.query.slug }));
  }

  async readVersion(req, res) {
    return this.sendData(res, await this.termsService.readVersion(req.params.id));
  }

  async publish(req, res) {
    const { published, version, slug, previousVersion, content } =
      await this.termsService.publish({ body: req.body, adminId: req.admin._id });

    await logAdminAction({
      req,
      action: "terms.publish",
      targetType: "terms",
      targetId: published._id,
      reason: req.body?.changeSummary || `Published ${slug} v${version}`,
      metadata: {
        slug,
        version,
        previousVersion,
        requiresReacceptance: published.requiresReacceptance,
        // The length, not the text: the document itself is already stored, and
        // copying a full legal document into every audit row would bloat the
        // trail without adding a fact it does not already have.
        contentLength: content.length,
      },
    });

    return res.status(201).json({
      message: `Published version ${version}. It is live everywhere on the platform.`,
      data: published,
    });
  }

  async restore(req, res) {
    const { restored, source } = await this.termsService.restore({
      id: req.params.id,
      adminId: req.admin._id,
    });

    await logAdminAction({
      req,
      action: "terms.publish",
      targetType: "terms",
      targetId: restored._id,
      reason: `Restored ${source.slug} from v${source.version}`,
      metadata: {
        slug: source.slug,
        restoredFrom: source.version,
        newVersion: restored.version,
      },
    });

    return this.ok(res, {
      message: `Restored version ${source.version} as version ${restored.version}.`,
      data: restored,
    });
  }

  async preview(req, res) {
    return this.sendData(res, this.termsService.preview(req.body?.content));
  }
}

export class AdminTermsModule extends RouteModule {
  static basePath = "/admin/terms";
  static moduleName = "admin:terms";

  registerRoutes(router) {
    const controller = new TermsAdminController({
      termsService: new TermsAdminService({ termsRepository, userRepository }),
    });

    router.use(adminOnly);

    router.get("/", controller.read);
    router.get("/version/:id", controller.readVersion);

    // "/preview" before "/:id/restore" is not strictly required — one segment
    // versus two — but keeps the literal ahead of the parameter by habit.
    router.post("/preview", controller.preview);
    router.post("/", controller.publish);
    router.post("/:id/restore", controller.restore);
  }
}

export default AdminTermsModule;
