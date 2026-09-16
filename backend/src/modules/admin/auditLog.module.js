import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { BaseService } from "../../core/http/BaseService.js";
import { adminOnly, parsePaging, pagingMeta, dateRange } from "./admin.middleware.js";
import AdminAction from "./adminAction.model.js";

export const adminActionRepository = new BaseRepository(AdminAction);

/**
 * The admin audit trail. Read-only, and deliberately so.
 *
 * There is no method here that edits or deletes an entry, and there should
 * never be one. A trail an admin can edit answers no question that matters —
 * the whole value of "who deleted this family's account" is that the answer
 * cannot be changed by whoever deleted it.
 */
export class AuditLogService extends BaseService {
  async list({ query = {} }) {
    const paging = parsePaging(query);
    const filter = {};

    const { action, adminId, targetUserId } = query;
    if (action) filter.action = action;
    if (adminId) filter.adminId = adminId;
    if (targetUserId) filter.targetUserId = targetUserId;

    const createdAt = dateRange(query);
    if (createdAt) filter.createdAt = createdAt;

    const [data, totalRecords] = await Promise.all([
      this.adminActionRepository.find(filter, {
        populate: [
          { path: "adminId", select: "name email" },
          { path: "targetUserId", select: "name email type status" },
        ],
        sort: { createdAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.adminActionRepository.count(filter),
    ]);

    return { data, pagination: pagingMeta(totalRecords, paging) };
  }

  /** The distinct action names, for the console's filter menu. */
  async actions() {
    const actions = await this.adminActionRepository.model.distinct("action").exec();
    return actions.sort();
  }
}

class AuditLogController extends BaseController {
  constructor({ auditLogService }) {
    super();
    this.auditLogService = auditLogService;
  }

  async list(req, res) {
    const { data, pagination } = await this.auditLogService.list({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async actions(req, res) {
    return this.sendData(res, await this.auditLogService.actions());
  }
}

export class AdminAuditLogModule extends RouteModule {
  static basePath = "/admin/audit-log";
  static moduleName = "admin:audit-log";

  registerRoutes(router) {
    const controller = new AuditLogController({
      auditLogService: new AuditLogService({ adminActionRepository }),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.get("/actions", controller.actions);
  }
}

export default AdminAuditLogModule;
