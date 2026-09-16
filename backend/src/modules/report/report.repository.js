import { BaseRepository } from "../../core/database/BaseRepository.js";
import Report from "./report.model.js";

/**
 * Member-to-member reports, feeding the moderation queue.
 *
 * "Open" means anything not yet resolved. That is the set a moderator still
 * owes an answer on, and the one the suspicious-account scan counts against a
 * member — a resolved report is a question already settled, and counting it
 * again would keep flagging someone who was already cleared.
 */
export class ReportRepository extends BaseRepository {
  constructor(model = Report) {
    super(model);
  }

  /** Open reports per reported member, for a set of accounts. */
  openCountsByReportedUser(userIds) {
    return this.aggregate([
      { $match: { reportedUserId: { $in: userIds }, status: { $ne: "resolved" } } },
      { $group: { _id: "$reportedUserId", count: { $sum: 1 } } },
    ]);
  }

  /**
   * Total and resolved counts per reported member.
   *
   * Unlike `openCountsByReportedUser` this counts everything, because the queue
   * wants "has this person been reported before" — and a resolved complaint is
   * still a complaint that happened.
   */
  countsByReportedUser(userIds) {
    return this.aggregate([
      { $match: { reportedUserId: { $in: userIds } } },
      {
        $group: {
          _id: "$reportedUserId",
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
        },
      },
    ]);
  }

  /** Cases per conversation, for the console's conversation list. */
  countsByChat(chatIds) {
    return this.aggregate([
      { $match: { chatId: { $in: chatIds } } },
      { $group: { _id: "$chatId", reports: { $sum: 1 } } },
    ]);
  }

  /** A member's other cases, most recent first, for the case-context screen. */
  priorFor(reportedUserId, excludeId, limit = 10) {
    return this.find(
      { reportedUserId, _id: { $ne: excludeId } },
      {
        select: "reason status priority createdAt resolution.action",
        sort: { createdAt: -1 },
        limit,
        lean: true,
      }
    );
  }
}

export const reportRepository = new ReportRepository();

export default reportRepository;
