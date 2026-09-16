import { BaseRepository } from "../../core/database/BaseRepository.js";
import MatchRequest from "./matchRequest.model.js";

/**
 * Queries against match requests.
 *
 * `findBetween` is the one worth naming: a match is symmetric but stored
 * directionally, so "is there a match between these two people" is an `$or`
 * over both orderings. Written inline it is easy to check only one direction,
 * which reads as "no match" and silently re-opens a conversation the other
 * party blocked.
 */
export class MatchRepository extends BaseRepository {
  constructor(model = MatchRequest) {
    super(model);
  }

  findSentBy(senderId, options = {}) {
    return this.find({ senderId }, options);
  }

  findReceivedBy(receiverId, options = {}) {
    return this.find({ receiverId }, options);
  }

  /**
   * The senders of every request still waiting on this member's answer.
   *
   * Ids rather than requests, and only the senders: the caller counts them, and
   * pulling the whole document for a badge would read the entire inbox to
   * produce one number.
   */
  async pendingSenderIdsFor(receiverId) {
    const requests = await this.find(
      { receiverId, status: "pending" },
      { select: "senderId", lean: true }
    );

    return requests.map((request) => String(request.senderId));
  }

  /** A request in an expected state — the guard every status transition uses. */
  findByIdWithStatus(id, status, options = {}) {
    return this.findOne({ _id: id, status }, options);
  }

  /** The most recent match between two members, in whichever direction it was made. */
  findBetween(userId, otherUserId, options = {}) {
    return this.findOne(
      {
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  /**
   * Every member this user has a request with, in either direction, as a Set of
   * id strings.
   *
   * One query for the whole relationship graph of a single user. The share
   * browse needs to know "have I already acted on this person" for a page of
   * profiles at a time; asking per profile is an N+1 that grows with the size
   * of the browse result rather than the page.
   *
   * Strings rather than ObjectIds because a Set of ObjectIds compares by
   * identity — two ObjectIds with the same value are different Set members, so
   * `has()` would always miss.
   */
  /* ─────────────────────────── console reporting ──────────────────────────── */

  /** One page of requests with both parties resolved to an identity. */
  async findAdminPage(filter, { sort, skip, limit, select }) {
    const [requests, totalRecords] = await Promise.all([
      this.find(filter, {
        populate: [
          { path: "senderId", select },
          { path: "receiverId", select },
        ],
        sort,
        skip,
        limit,
        lean: true,
      }),
      this.count(filter),
    ]);

    return { requests, totalRecords };
  }

  /** Requests sent, grouped by sender. Used by the suspicious-account scan. */
  countsBySender(senderIds, extra = {}) {
    return this.aggregate([
      { $match: { senderId: { $in: senderIds }, ...extra } },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
    ]);
  }

  countsByStatusSince(since) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
  }

  distinctSendersSince(since) {
    return this.model.distinct("senderId", { createdAt: { $gte: since } }).exec();
  }

  distinctReceiversSince(since) {
    return this.model.distinct("receiverId", { createdAt: { $gte: since } }).exec();
  }

  /**
   * Average time from request to acceptance.
   *
   * Only rows carrying `respondedAt` contribute. Every request predating that
   * field has none, and treating a missing timestamp as an instant response
   * would report a time-to-match of zero for the entire back catalogue.
   */
  async averageResponseTimeSince(since) {
    const [row] = await this.aggregate([
      {
        $match: {
          status: "accepted",
          createdAt: { $gte: since },
          respondedAt: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: { $subtract: ["$respondedAt", "$createdAt"] } },
          measured: { $sum: 1 },
        },
      },
    ]);

    return row ?? null;
  }

  dailyCountsSince(since) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          requests: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async counterpartyIds(userId) {
    const requests = await this.find(
      { $or: [{ senderId: userId }, { receiverId: userId }] },
      { select: "senderId receiverId", lean: true }
    );

    const ids = new Set();
    const self = String(userId);

    for (const request of requests) {
      const other =
        String(request.senderId) === self ? String(request.receiverId) : String(request.senderId);
      ids.add(other);
    }

    return ids;
  }
}

export const matchRepository = new MatchRepository();

export default matchRepository;
