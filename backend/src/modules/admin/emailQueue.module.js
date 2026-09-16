import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError } from "../../core/errors/index.js";
import { adminOnly, parsePaging, pagingMeta, searchTerm } from "./admin.middleware.js";
import EmailQueue from "../../shared/email/emailQueue.model.js";
import { requeue, queueStats } from "../../shared/email/emailQueue.js";
import { emailDispatcher } from "../../shared/email/emailDispatcher.js";

const STATUSES = ["pending", "sending", "sent", "failed", "cancelled"];

/**
 * The outbound queue, for the admin console.
 *
 * Unlike the email log next door, this one is not read-only, and the write it
 * allows is the entire reason the queue exists: a message that failed can be
 * put back. Before this, "she never got the welcome email" ended with an
 * apology — the message was gone, and the only remedy was to ask the member to
 * do something that would trigger a new one.
 */
export class EmailQueueService extends BaseService {
  async list({ query = {} }) {
    const paging = parsePaging(query);
    const filter = {};

    const { search, type, status, campaign } = query;
    if (search) {
      const term = searchTerm(search);
      filter.$or = [{ to: term }, { subject: term }];
    }
    if (type) filter.type = type;
    if (status && STATUSES.includes(status)) filter.status = status;
    if (campaign) filter.campaign = campaign;

    const [data, totalRecords] = await Promise.all([
      EmailQueue.find(filter)
        // Newest first, but a row waiting to go out is more interesting than
        // one that already went, so pending sorts to the top.
        .sort({ status: 1, createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        // The body is deliberately excluded. It is the only place children's
        // ages and neighbourhood names appear in this collection, and a list
        // endpoint has no use for it.
        .select("-html")
        .lean(),
      EmailQueue.countDocuments(filter),
    ]);

    return { data, pagination: pagingMeta(totalRecords, paging) };
  }

  /** Depth, breaker state and the age of the oldest waiting message. */
  async health() {
    return emailDispatcher.health();
  }

  async stats() {
    return queueStats();
  }

  /**
   * Put one failed or cancelled message back on the queue.
   *
   * Deliberately not available for a `sent` row: resending something the mail
   * server already accepted is a decision to send a second copy, which is a
   * different act and should be a deliberate new send rather than a button
   * labelled "retry".
   */
  async retry({ id }) {
    const ok = await requeue(id);
    if (!ok) {
      throw new NotFoundError(
        "No failed or cancelled message with that id — it may have been sent, retried already, or aged out."
      );
    }
    return { requeued: true, id };
  }

  /**
   * Retry everything that failed, optionally narrowed to one type or campaign.
   *
   * The case this is for: a provider outage or an expired credential failed a
   * few hundred messages over an hour. Once the cause is fixed they should all
   * go, and clicking retry three hundred times is not a plan.
   */
  async retryAll({ type = null, campaign = null, limit = 500 }) {
    const filter = { status: "failed" };
    if (type) filter.type = type;
    if (campaign) filter.campaign = campaign;

    const rows = await EmailQueue.find(filter).select("_id").limit(limit).lean();
    let requeued = 0;
    for (const row of rows) {
      if (await requeue(row._id)) requeued++;
    }
    return { requeued, examined: rows.length };
  }

  /** Run a dispatcher pass now instead of waiting for the next poll. */
  async flush() {
    return emailDispatcher.tick();
  }
}

class EmailQueueController extends BaseController {
  constructor({ emailQueueService }) {
    super();
    this.emailQueueService = emailQueueService;
  }

  async list(req, res) {
    const { data, pagination } = await this.emailQueueService.list({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async health(req, res) {
    return this.sendData(res, await this.emailQueueService.health());
  }

  async stats(req, res) {
    return this.sendData(res, await this.emailQueueService.stats());
  }

  async retry(req, res) {
    return this.sendData(res, await this.emailQueueService.retry({ id: req.params.id }));
  }

  async retryAll(req, res) {
    return this.sendData(
      res,
      await this.emailQueueService.retryAll({
        type: req.body?.type || null,
        campaign: req.body?.campaign || null,
      })
    );
  }

  async flush(req, res) {
    return this.sendData(res, await this.emailQueueService.flush());
  }
}

export class AdminEmailQueueModule extends RouteModule {
  static basePath = "/admin/email-queue";
  static moduleName = "admin:email-queue";

  registerRoutes(router) {
    const controller = new EmailQueueController({
      emailQueueService: new EmailQueueService(),
    });

    router.use(adminOnly);

    router.get("/", controller.list);
    router.get("/health", controller.health);
    router.get("/stats", controller.stats);
    router.post("/flush", controller.flush);
    router.post("/retry-all", controller.retryAll);
    router.post("/:id/retry", controller.retry);
  }
}

export default AdminEmailQueueModule;
