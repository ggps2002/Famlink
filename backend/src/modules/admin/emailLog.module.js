import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseService } from "../../core/http/BaseService.js";
import { adminOnly, parsePaging, pagingMeta, dateRange, searchTerm } from "./admin.middleware.js";
import { emailLogRepository } from "./emailLog.repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUSES = ["accepted", "failed", "skipped"];

/**
 * The automated-email log. Read-only by design.
 *
 * Nothing here edits or deletes a row: the value of the log is that it records
 * what happened rather than what anyone would prefer had happened.
 */
export class EmailLogService extends BaseService {
  async list({ query = {} }) {
    const paging = parsePaging(query);
    const filter = {};

    const { search, type, status, campaign } = query;

    if (search) {
      const term = searchTerm(search);
      filter.$or = [{ recipient: term }, { subject: term }];
    }
    if (type) filter.type = type;
    if (status && STATUSES.includes(status)) filter.status = status;
    if (campaign) filter.campaign = campaign;

    // This collection dates by `sentAt`, not `createdAt`.
    const sentAt = dateRange(query);
    if (sentAt) filter.sentAt = sentAt;

    const [data, totalRecords] = await Promise.all([
      this.emailLogRepository.find(filter, {
        sort: { sentAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        populate: { path: "userId", select: "name email type" },
        lean: true,
      }),
      this.emailLogRepository.count(filter),
    ]);

    return { data, pagination: pagingMeta(totalRecords, paging) };
  }

  async stats({ days: requestedDays } = {}) {
    const days = Math.min(365, Math.max(1, parseInt(requestedDays, 10) || 30));
    const since = new Date(Date.now() - days * DAY_MS);

    const [byType, byStatus, daily, campaigns] = await Promise.all([
      this.emailLogRepository.statsByType(since),
      this.emailLogRepository.statsByStatus(since),
      this.emailLogRepository.dailyStats(since),
      this.emailLogRepository.campaignStats(since),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    const total = byStatus.reduce((sum, row) => sum + row.count, 0);

    return {
      windowDays: days,
      total,
      accepted: statusMap.accepted || 0,
      failed: statusMap.failed || 0,
      skipped: statusMap.skipped || 0,
      // Share of attempts the mail server accepted. NOT an inbox-delivery rate,
      // and named so it cannot be mistaken for one — knowing whether an email
      // actually landed needs provider webhooks we do not consume, and
      // reporting "98% delivered" from this data would be a claim the data
      // cannot support.
      acceptanceRate: total ? Math.round(((statusMap.accepted || 0) / total) * 100) : 0,
      byType,
      daily,
      campaigns,
    };
  }

  /** The distinct template names, for the console's filter menu. */
  async types() {
    const types = await this.emailLogRepository.model.distinct("type").exec();
    return types.sort();
  }
}

class EmailLogController extends BaseController {
  constructor({ emailLogService }) {
    super();
    this.emailLogService = emailLogService;
  }

  async list(req, res) {
    const { data, pagination } = await this.emailLogService.list({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async stats(req, res) {
    return this.sendData(res, await this.emailLogService.stats({ days: req.query.days }));
  }

  async types(req, res) {
    return this.sendData(res, await this.emailLogService.types());
  }
}

export class AdminEmailLogModule extends RouteModule {
  static basePath = "/admin/email-log";
  static moduleName = "admin:email-log";

  registerRoutes(router) {
    const controller = new EmailLogController({
      emailLogService: new EmailLogService({ emailLogRepository }),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.get("/stats", controller.stats);
    router.get("/types", controller.types);
  }
}

export default AdminEmailLogModule;
