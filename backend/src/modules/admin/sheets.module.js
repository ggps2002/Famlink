import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { SheetsService, SHEET_META } from "./sheets.service.js";
import { fetchSheet, sheetsConfigured } from "../../shared/integrations/sheetReader.js";
import { userRepository } from "../user/user.repository.js";
import { UpstreamServiceError } from "../../core/errors/index.js";

/**
 * A sheet read that fails is an upstream failure, not ours.
 *
 * 502 rather than 500, and the reader's own message is passed through: "the
 * script is not deployed" and "the token is wrong" are different problems with
 * different fixes, and a generic 500 makes them identical from the console.
 */
const asUpstream = (error) =>
  new UpstreamServiceError(error.message || "Could not read the sheet.", {
    code: error.code || undefined,
    cause: error,
  });

class SheetsController extends BaseController {
  constructor({ sheetsService }) {
    super();
    this.sheetsService = sheetsService;
  }

  async list(req, res) {
    const key = this.sheetsService.resolveKey(req.params.key);

    if (!this.sheetsService.configured) {
      return this.ok(res, this.sheetsService.notConfigured(key));
    }

    try {
      return this.ok(res, await this.sheetsService.list({ key, query: req.query }));
    } catch (error) {
      throw asUpstream(error);
    }
  }

  async export(req, res) {
    const key = this.sheetsService.resolveKey(req.params.key);

    let result;
    try {
      result = await this.sheetsService.export({ key, query: req.query });
    } catch (error) {
      // A configuration problem is the caller's to fix and already carries its
      // own status; only a reader failure becomes a 502.
      if (error.statusCode && error.statusCode < 500) throw error;
      throw asUpstream(error);
    }

    // Exporting personal data off the platform is worth a record of who did it.
    await logAdminAction({
      req,
      action: "export.sheet",
      targetType: "sheet",
      reason: `Exported ${result.rowCount} rows from the ${result.label}`,
      metadata: {
        key,
        rows: result.rowCount,
        search: req.query.search || null,
        signup: req.query.signup || null,
      },
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.csv);
  }

  async refresh(req, res) {
    const key = this.sheetsService.resolveKey(req.params.key);
    this.sheetsService.refresh(key);

    return this.message(res, "Refreshed. The next load reads the sheet directly.");
  }
}

export class AdminSheetsModule extends RouteModule {
  static basePath = "/admin/sheets";
  static moduleName = "admin:sheets";

  registerRoutes(router) {
    const controller = new SheetsController({
      sheetsService: new SheetsService({
        userRepository,
        // Both reach the Google Apps Script deployment, so they are injected
        // rather than imported into the service.
        fetchSheet,
        sheetsConfigured,
      }),
    });

    router.use(adminOnly);

    // "/:key/export" and "/:key/refresh" are two segments and cannot be
    // shadowed by "/:key", but they are registered first so the ordering does
    // not become load-bearing if either path changes.
    router.get("/:key/export", controller.export);
    router.post("/:key/refresh", controller.refresh);
    router.get("/:key", controller.list);
  }
}

export { SHEET_META };
export default AdminSheetsModule;
