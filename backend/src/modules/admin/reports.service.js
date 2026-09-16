import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta } from "./admin.middleware.js";
import { requireReason } from "./adminAudit.js";
import {
  OUTCOMES,
  MIN_SUSPEND_DAYS,
  MAX_SUSPEND_DAYS,
  sanctionFor,
  isValidSuspendDays,
} from "./moderationSanctions.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PARTY_FIELDS = "name email type imageUrl status createdAt";

/**
 * How much conversation the queue will show around a report.
 *
 * Not a parameter. Whether five is the right number is a judgement about how
 * much context a decision needs; whether the CALLER gets to choose is a
 * question about how much of a private conversation one click should reveal,
 * and the answer to that one is no. An admin who genuinely needs the full
 * history goes to Messages and states why, which is audited there.
 */
const CONTEXT_MESSAGE_COUNT = 5;

const daysSince = (date) => Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS);

/**
 * Reported users and flagged content: the moderation queue.
 *
 * The rule everything below follows from: acting on a report never destroys it.
 * Resolving appends the outcome to the same document, so the history of what
 * was reported and what was done about it survives the account being deleted. A
 * moderation system that forgets its own decisions cannot answer "has this
 * person been reported before" — the single most useful question when a second
 * complaint arrives.
 */
export class ReportsAdminService extends BaseService {
  #requireObjectId(id, field = "report id") {
    if (!mongoose.isValidObjectId(id)) throw new ValidationError(`Invalid ${field}`);
    return id;
  }

  async list({ query = {}, adminId }) {
    const paging = parsePaging(query);
    const filter = {};
    const { status, reason, priority, assigned } = query;

    // The default view is the work: open and in-progress cases. Resolved ones
    // stay reachable by filter but do not clutter the queue.
    if (status && ["open", "reviewing", "resolved"].includes(status)) {
      filter.status = status;
    } else {
      filter.status = { $ne: "resolved" };
    }

    if (reason) filter.reason = reason;
    if (priority) filter.priority = priority;
    if (assigned === "me") filter.assignedTo = adminId;
    if (assigned === "unassigned") filter.assignedTo = null;

    const [reports, totalRecords] = await Promise.all([
      this.reportRepository.find(filter, {
        populate: [
          { path: "reportedUserId", select: PARTY_FIELDS },
          { path: "reporterId", select: PARTY_FIELDS },
          { path: "assignedTo", select: "name email" },
          { path: "resolution.resolvedBy", select: "name email" },
        ],
        // Worst first, then oldest first within a priority — so a high-priority
        // case cannot be buried by newer ones, and nothing sits forever.
        sort: { priority: -1, createdAt: 1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.reportRepository.count(filter),
    ]);

    const priors = await this.#priorCounts(reports);

    const data = reports.map((report) => {
      const prior = priors.get(String(report.reportedUserId?._id));
      return {
        ...report,
        // Excludes this one. A first complaint and a fourth complaint about the
        // same person warrant different responses, and an admin should not have
        // to go looking to find out which this is.
        priorReports: Math.max(0, (prior?.total || 1) - 1),
        priorResolved: prior?.resolved || 0,
        ageDays: daysSince(report.createdAt),
      };
    });

    return { data, pagination: pagingMeta(totalRecords, paging) };
  }

  /** Prior history for every reported account on the page, in one query. */
  async #priorCounts(reports) {
    const ids = reports.map((report) => report.reportedUserId?._id).filter(Boolean);
    if (!ids.length) return new Map();

    const rows = await this.reportRepository.countsByReportedUser(ids);
    return new Map(rows.map((row) => [String(row._id), row]));
  }

  async stats() {
    const [byStatus, byReason, oldestOpen] = await Promise.all([
      this.reportRepository.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      this.reportRepository.aggregate([
        { $match: { status: { $ne: "resolved" } } },
        { $group: { _id: "$reason", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.reportRepository.findOne(
        { status: { $ne: "resolved" } },
        { sort: { createdAt: 1 }, select: "createdAt", lean: true }
      ),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));

    return {
      open: statusMap.open || 0,
      reviewing: statusMap.reviewing || 0,
      resolved: statusMap.resolved || 0,
      byReason,
      // The number that says whether the queue is being kept up with.
      oldestOpenDays: oldestOpen ? daysSince(oldestOpen.createdAt) : null,
    };
  }

  async assign({ id, body = {}, adminId }) {
    this.#requireObjectId(id);

    const update = {};

    if (body.assignToMe === true) {
      update.assignedTo = adminId;
      // Picking a case up moves it out of the unclaimed pool, so two admins do
      // not unknowingly work the same complaint.
      update.status = "reviewing";
    }
    if (body.assignToMe === false) update.assignedTo = null;
    if (["low", "normal", "high"].includes(body.priority)) update.priority = body.priority;

    if (!Object.keys(update).length) throw new ValidationError("Nothing to change.");

    update.updatedAt = new Date();

    const report = await this.reportRepository.updateById(id, { $set: update });
    if (!report) throw new NotFoundError("Report not found");

    return { report, update };
  }

  /**
   * Close a case AND apply the sanction, in one step.
   *
   * The two are deliberately not separate operations: resolving without acting,
   * and acting without recording why, are both states this queue exists to
   * prevent — and doing them as two requests means an interrupted admin leaves
   * a case in one of them.
   */
  async resolve({ id, body = {}, adminId }) {
    this.#requireObjectId(id);

    const { action, suspendDays } = body;
    if (!OUTCOMES.includes(action)) {
      throw new ValidationError(`Action must be one of: ${OUTCOMES.join(", ")}`);
    }

    const note = requireReason(body.note);
    if (!note) {
      throw new ValidationError(
        "A note of at least 10 characters is required so the decision is recorded."
      );
    }

    if (action === "suspended" && !isValidSuspendDays(suspendDays)) {
      throw new ValidationError(
        `Suspension length must be between ${MIN_SUSPEND_DAYS} and ${MAX_SUSPEND_DAYS} days.`
      );
    }

    const report = await this.reportRepository.findById(id);
    if (!report) throw new NotFoundError("Report not found");
    if (report.status === "resolved") {
      throw new ValidationError("This report is already resolved.");
    }

    const target = await this.userRepository.findById(report.reportedUserId, {
      select: "_id name email status",
    });
    if (!target) throw new NotFoundError("The reported account no longer exists.");

    // An admin cannot sanction themselves out of a complaint about themselves.
    if (String(target._id) === String(adminId)) {
      throw new ValidationError("You cannot action a report against your own account.");
    }

    const { update, sanction } = sanctionFor({
      action,
      note,
      userId: target._id,
      suspendDays: Number(suspendDays),
    });

    if (update) await this.userRepository.updateById(target._id, update);

    if (action === "blocked" && target.email) {
      // Generic copy — `note` is the moderator's own wording and can identify
      // the reporter.
      this.sendAccountDeactivatedEmail(
        target.email,
        target.name,
        "a violation of our community guidelines"
      ).catch((error) => console.error("Deactivation email failed:", error?.message || error));
    }

    report.status = "resolved";
    report.resolution = { action, note, resolvedBy: adminId, resolvedAt: new Date() };
    await report.save();

    return { report, target, outcome: action, sanction, note };
  }

  /**
   * Everything needed to decide a case, on one request.
   *
   * A report about a single message is almost never decidable from that
   * message. "You're overreacting" is a shrug or the tail end of something ugly
   * depending entirely on what came before it, and the snapshot on the report
   * carries only the one line. Some surrounding conversation is the difference
   * between an informed decision and a coin flip — but the whole thread is more
   * than the decision needs, so the window is fixed and small.
   */
  async context(id) {
    this.#requireObjectId(id);

    const report = await this.reportRepository.findById(id, {
      populate: [
        {
          path: "reportedUserId",
          select: "name email type imageUrl status createdAt suspendedUntil",
        },
        { path: "reporterId", select: "name email type imageUrl status createdAt" },
      ],
      lean: true,
    });
    if (!report) throw new NotFoundError("Report not found");

    const reportedId = report.reportedUserId?._id;
    const reporterId = report.reporterId?._id;

    const chat = await this.#findChat({ report, reportedId, reporterId });
    const conversation = chat ? await this.#conversation({ chat, report, reportedId }) : null;

    const [priorReports, contentFlags] = await Promise.all([
      reportedId ? this.reportRepository.priorFor(reportedId, report._id) : [],
      reportedId ? this.#flagSummary(reportedId) : { total: 0, blocked: 0, categories: [] },
    ]);

    return {
      chat,
      payload: {
        report: {
          _id: report._id,
          reason: report.reason,
          details: report.details,
          evidenceSnapshot: report.evidenceSnapshot,
          status: report.status,
          priority: report.priority,
          createdAt: report.createdAt,
          targetType: report.targetType,
        },
        // Both parties in full, including email — the console's own contact
        // route for a case, and what the queue row abbreviates.
        reporter: report.reporterId || null,
        reportedUser: report.reportedUserId || null,
        conversation,
        priorReports,
        contentFlags,
      },
      reportedId,
      messagesShown: conversation?.showing || 0,
      reportReason: report.reason,
      reportId: report._id,
    };
  }

  /**
   * The chat recorded on the report, falling back to the one between the two
   * parties — a whole-account report carries no `chatId`, and "there is no
   * conversation attached" should not mean "no context".
   */
  async #findChat({ report, reportedId, reporterId }) {
    if (report.chatId) {
      const attached = await this.chatRepository.findById(report.chatId, {
        select: "_id participants",
        lean: true,
      });
      if (attached) return attached;
    }

    if (!reportedId || !reporterId) return null;

    return this.chatRepository.findOne(
      { participants: { $all: [reportedId, reporterId] } },
      { select: "_id participants", lean: true }
    );
  }

  async #conversation({ chat, report, reportedId }) {
    const [recent, totalMessages] = await Promise.all([
      this.messageRepository.find(
        { chatId: chat._id },
        {
          populate: { path: "sender", select: "name email imageUrl" },
          // Newest first so a long thread yields the most relevant five, then
          // reversed below so the response reads in conversation order.
          sort: { createdAt: -1 },
          limit: CONTEXT_MESSAGE_COUNT,
          lean: true,
        }
      ),
      this.messageRepository.count({ chatId: chat._id }),
    ]);

    const messages = recent.reverse().map((message) => ({
      _id: message._id,
      sender: message.sender,
      // Voice notes are base64 in this field. Returning that would push a
      // megabyte of audio into a queue screen that only wants to show who said
      // what — the console renders a placeholder from `type` instead.
      content: message.type === "Audio" ? "" : message.content,
      type: message.type || "Text",
      createdAt: message.createdAt,
      isReported: String(message._id) === String(report.messageId || ""),
      // Did the content rules fire on it independently of anyone complaining?
      flagged: Boolean(message.moderation?.flagged),
      flagCategories: message.moderation?.categories || [],
      fromReportedUser: String(message.sender?._id) === String(reportedId),
    }));

    return { chatId: chat._id, totalMessages, showing: messages.length, messages };
  }

  /**
   * What the content rules caught independently.
   *
   * A report landing next to six blocked messages is a different case from an
   * isolated complaint.
   */
  async #flagSummary(reportedId) {
    const [row] = await this.messageFlagRepository.summaryForSender(reportedId);
    const stats = row || { total: 0, blocked: 0, categories: [] };

    return {
      total: stats.total,
      blocked: stats.blocked,
      // `$addToSet` over an array field nests it, so flatten and de-duplicate.
      categories: [...new Set((stats.categories || []).flat())],
    };
  }

  /** Every case ever filed about one account. */
  async byUser(userId) {
    this.#requireObjectId(userId, "user id");

    return this.reportRepository.find(
      { reportedUserId: userId },
      {
        populate: [
          { path: "reporterId", select: "name email" },
          { path: "resolution.resolvedBy", select: "name email" },
        ],
        sort: { createdAt: -1 },
        lean: true,
      }
    );
  }
}

export default ReportsAdminService;
