import { BaseRepository } from "../../core/database/BaseRepository.js";
import EmailLog from "../../shared/email/emailLog.model.js";

/** Shared shape for the per-status counters every aggregation below reports. */
const statusCounters = {
  total: { $sum: 1 },
  accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
  failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
  skipped: { $sum: { $cond: [{ $eq: ["$status", "skipped"] }, 1, 0] } },
};

/**
 * Reads over the automated-email log.
 *
 * Every method is scoped to a window, because this collection grows with every
 * email the platform sends and an unbounded aggregation over it is a table scan
 * that gets slower every day.
 */
export class EmailLogRepository extends BaseRepository {
  constructor(model = EmailLog) {
    super(model);
  }

  /** Volume and outcome per template. */
  statsByType(since) {
    return this.aggregate([
      { $match: { sentAt: { $gte: since } } },
      { $group: { _id: "$type", ...statusCounters, lastSentAt: { $max: "$sentAt" } } },
      { $sort: { total: -1 } },
    ]);
  }

  statsByStatus(since) {
    return this.aggregate([
      { $match: { sentAt: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
  }

  dailyStats(since) {
    return this.aggregate([
      { $match: { sentAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$sentAt" } },
          total: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  /** The most recent campaigns. Capped — this feeds a list, not a report. */
  campaignStats(since, limit = 50) {
    return this.aggregate([
      { $match: { sentAt: { $gte: since }, campaign: { $ne: null } } },
      {
        $group: {
          _id: "$campaign",
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          sentAt: { $max: "$sentAt" },
        },
      },
      { $sort: { sentAt: -1 } },
      { $limit: limit },
    ]);
  }
}

export const emailLogRepository = new EmailLogRepository();

export default emailLogRepository;
