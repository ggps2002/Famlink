import { BaseService } from "../../core/http/BaseService.js";
import { parsePaging, pagingMeta, parseSort, dateRange, searchTerm } from "./admin.middleware.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const STORED_STATUSES = ["pending", "accepted", "rejected", "blocked"];

/**
 * Identity only.
 *
 * An admin reading a list of who-requested-whom needs names, not two complete
 * user documents per row including the other party's contact details and
 * Stripe id.
 */
const PARTY_FIELDS = "name email type imageUrl status location.city";

/**
 * Match and connection reporting for the console.
 *
 * The status vocabulary differs between the database and the console, and the
 * mapping is the thing to understand before reading anything else here. Stored
 * values are pending / accepted / rejected / blocked. The console shows
 * Pending / Mutual / Connected, and those are not three states of one field:
 *
 *   Pending   — sent, not yet answered.       (status: pending)
 *   Connected — accepted, so a chat exists.   (status: accepted)
 *   Mutual    — BOTH people independently sent each other a request. Not a
 *               stored status at all; a pair of rows pointing in opposite
 *               directions, which has to be derived.
 */
export class MatchAdminService extends BaseService {
  async list({ query = {} }) {
    const paging = parsePaging(query);
    const { status, search, connection } = query;
    const filter = {};

    if (status && STORED_STATUSES.includes(status)) filter.status = status;

    // The console's vocabulary, mapped onto storage. "mutual" cannot be
    // expressed here — it is a property of a pair, not a row — so it is applied
    // after the derivation below.
    if (connection === "pending") filter.status = "pending";
    if (connection === "connected") filter.status = "accepted";

    const createdAt = dateRange(query);
    if (createdAt) filter.createdAt = createdAt;

    if (search) {
      // Searching by person means resolving users first, then matching either
      // side of the request against them. Capped, because the result becomes
      // an `$in`.
      const term = searchTerm(search);
      const users = await this.userRepository.findIdsMatching(
        { $or: [{ name: term }, { email: term }] },
        500
      );
      const ids = users.map((user) => user._id);
      filter.$or = [{ senderId: { $in: ids } }, { receiverId: { $in: ids } }];
    }

    const { requests, totalRecords } = await this.matchRepository.findAdminPage(filter, {
      sort: parseSort(query.sort, ["createdAt"], { createdAt: -1 }),
      skip: paging.skip,
      limit: paging.limit,
      select: PARTY_FIELDS,
    });

    const reverses = await this.#reverseRequests(requests);

    let data = requests.map((request) => this.#toRow(request, reverses));

    // Applied to the page rather than the query, so the total below counts the
    // unfiltered set. `pageFiltered` says so out loud instead of quietly
    // returning a total that does not match the rows.
    let pageFiltered = false;
    if (connection === "mutual") {
      data = data.filter((row) => row.isMutual);
      pageFiltered = true;
    }

    return { data, pagination: pagingMeta(totalRecords, paging), pageFiltered };
  }

  /**
   * Every request that is the reverse of a row on this page, keyed for lookup.
   *
   * One query for the whole page rather than one per row.
   */
  async #reverseRequests(requests) {
    const pairs = requests
      .filter((request) => request.senderId && request.receiverId)
      .map((request) => ({
        senderId: request.receiverId._id,
        receiverId: request.senderId._id,
      }));

    if (pairs.length === 0) return new Map();

    const found = await this.matchRepository.find(
      { $or: pairs },
      { select: "senderId receiverId status createdAt", lean: true }
    );

    return new Map(found.map((row) => [`${row.senderId}:${row.receiverId}`, row]));
  }

  #toRow(request, reverses) {
    const senderId = request.senderId?._id;
    const receiverId = request.receiverId?._id;
    const reverse =
      senderId && receiverId ? reverses.get(`${receiverId}:${senderId}`) : null;

    // Order matters: a pair who both reached out AND connected is reported as
    // connected, because that is the outcome. "mutual" only adds information
    // while they are still separate requests.
    const connectionType =
      request.status === "accepted"
        ? "connected"
        : reverse
          ? "mutual"
          : request.status === "pending"
            ? "pending"
            : request.status;

    return {
      _id: request._id,
      sender: request.senderId || null,
      receiver: request.receiverId || null,
      status: request.status,
      connectionType,
      isMutual: Boolean(reverse),
      message: request.message || null,
      blockedBy: request.blockedBy || null,
      createdAt: request.createdAt,
      // Null once answered — the age of a settled request is not a number
      // anyone acts on.
      pendingForDays:
        request.status === "pending"
          ? Math.floor((Date.now() - new Date(request.createdAt).getTime()) / DAY_MS)
          : null,
    };
  }

  /**
   * Search and match quality: how many people are getting matches, how many
   * requests go unanswered, and how long a mutual match takes to happen.
   */
  async insights({ days: requestedDays } = {}) {
    const days = Math.min(365, Math.max(7, parseInt(requestedDays, 10) || 90));
    const since = new Date(Date.now() - days * DAY_MS);

    const [statusCounts, senders, receivers, responseTime, activeUsers, daily] =
      await Promise.all([
        this.matchRepository.countsByStatusSince(since),
        this.matchRepository.distinctSendersSince(since),
        this.matchRepository.distinctReceiversSince(since),
        this.matchRepository.averageResponseTimeSince(since),
        this.userRepository.count({ status: "Active", type: { $in: ["Parents", "Nanny"] } }),
        this.matchRepository.dailyCountsSince(since),
      ]);

    const counts = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
    const total = statusCounts.reduce((sum, row) => sum + row.count, 0);

    // Everyone who received at least one request. The denominator that matters
    // for "is the marketplace working" — a platform where 90% of requests are
    // aimed at the same ten profiles has a discovery problem that a headline
    // acceptance rate hides completely.
    const receiving = new Set(receivers.map(String)).size;
    const sending = new Set(senders.map(String)).size;

    const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

    return {
      windowDays: days,
      totalRequests: total,
      pending: counts.pending || 0,
      accepted: counts.accepted || 0,
      rejected: counts.rejected || 0,
      blocked: counts.blocked || 0,

      successRate: share(counts.accepted || 0, total),
      // Still waiting, as a share of everything sent — whether the other side
      // of the marketplace is responsive.
      unansweredRate: share(counts.pending || 0, total),

      usersSendingRequests: sending,
      usersReceivingRequests: receiving,
      activeUsers,
      reachRate: share(receiving, activeUsers),

      // Measured only over requests carrying `respondedAt`, which was added
      // with this console — so it is null until some requests have been
      // answered since. The sample size ships alongside it so the console can
      // say "based on 12 matches" rather than presenting an average of three as
      // if it were settled.
      avgTimeToMatchHours: responseTime?.avgMs
        ? Math.round((responseTime.avgMs / HOUR_MS) * 10) / 10
        : null,
      avgTimeToMatchSample: responseTime?.measured || 0,
      avgTimeToMatchNote: responseTime?.measured
        ? null
        : "No matches with a recorded response time yet — this starts filling in as requests are answered.",

      daily,
    };
  }
}

export default MatchAdminService;
