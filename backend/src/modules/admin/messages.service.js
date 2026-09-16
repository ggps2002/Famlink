import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta, searchTerm } from "./admin.middleware.js";
import { CATEGORY_TO_REPORT_REASON } from "../messaging/messageModeration.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const PARTICIPANT_FIELDS = "name email type imageUrl status";

/** How long a stated reason has to be before it counts as one. */
const MIN_REASON = 10;

export const NO_CONTENT_NOTICE =
  "Message content is not included in this list. Open a conversation to read it — doing so is logged.";

/**
 * Message monitoring, for investigating harassment, scams and inappropriate
 * content.
 *
 * ── This is the most invasive capability in the console ────────────────────
 * Members write to each other here about their children, their homes and their
 * money, with a reasonable expectation that nobody else is reading. The
 * requirement is legitimate — a harassment report that cannot be investigated
 * is useless — but "an admin can read anything at any time" is a much larger
 * power than that requirement needs.
 *
 * Three constraints are built in, none of which prevent an investigation:
 *
 *   1. THE CONVERSATION LIST CARRIES NO MESSAGE BODIES. Only participants,
 *      counts and timestamps. Finding the right conversation never requires
 *      reading any others — note that `lastMessage`, which the chat document
 *      stores denormalised, is deliberately not selected.
 *   2. READING A THREAD IS AUDITED, and the row is written before the response
 *      goes out. If the trail cannot record the access, the access does not
 *      happen.
 *   3. A REASON IS REQUIRED TO OPEN A THREAD. Not a meaningful barrier to
 *      someone determined, and not meant to be — it is what makes "I was
 *      investigating report #482" the normal case and idle browsing the
 *      conspicuous one.
 *
 * There is deliberately NO full-text search across all messages. Searching
 * every private conversation on the platform for a keyword is a different power
 * from investigating a specific complaint, and nothing asks for it.
 */
export class AdminMessagesService extends BaseService {
  #requireObjectId(id, field) {
    if (!mongoose.isValidObjectId(id)) throw new ValidationError(`Invalid ${field}`);
    return id;
  }

  #requireReason(raw, message) {
    const reason = String(raw || "").trim();
    if (reason.length < MIN_REASON) throw new ValidationError(message);
    return reason;
  }

  /** Metadata only — no message bodies. */
  async listConversations({ query = {} }) {
    const paging = parsePaging(query);
    const filter = {};
    const { search, userId } = query;

    if (userId && mongoose.isValidObjectId(userId)) {
      filter.participants = userId;
    } else if (search) {
      const term = searchTerm(search);
      const users = await this.userRepository.findIdsMatching(
        { $or: [{ name: term }, { email: term }] },
        500
      );
      filter.participants = { $in: users.map((user) => user._id) };
    }

    const [chats, totalRecords] = await Promise.all([
      this.chatRepository.find(filter, {
        populate: { path: "participants", select: PARTICIPANT_FIELDS },
        // `lastMessage` is absent on purpose — it is message content.
        select: "participants createdAt updatedAt type",
        sort: { updatedAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.chatRepository.count(filter),
    ]);

    const chatIds = chats.map((chat) => chat._id);

    // Counts and report flags for the whole page in two queries.
    const [counts, reported] = await Promise.all([
      this.messageRepository.countsByChat(chatIds),
      this.reportRepository.countsByChat(chatIds),
    ]);

    const countMap = new Map(counts.map((row) => [String(row._id), row]));
    const reportMap = new Map(reported.map((row) => [String(row._id), row.reports]));

    return {
      data: chats.map((chat) => {
        const stats = countMap.get(String(chat._id));
        return {
          _id: chat._id,
          participants: chat.participants,
          messageCount: stats?.messageCount || 0,
          lastMessageAt: stats?.lastAt || chat.updatedAt,
          createdAt: chat.createdAt,
          openReports: reportMap.get(String(chat._id)) || 0,
        };
      }),
      pagination: pagingMeta(totalRecords, paging),
      notice: NO_CONTENT_NOTICE,
    };
  }

  /** The thread itself. Requires a stated reason; the caller must audit it. */
  async readConversation({ chatId, query = {} }) {
    this.#requireObjectId(chatId, "conversation id");

    const reason = this.#requireReason(
      query.reason,
      "Reading a private conversation requires a reason of at least 10 characters " +
        "(for example, the report you are investigating). It is recorded in the audit log."
    );

    const chat = await this.chatRepository.findById(chatId, {
      populate: { path: "participants", select: PARTICIPANT_FIELDS },
      lean: true,
    });
    if (!chat) throw new NotFoundError("Conversation not found");

    const paging = parsePaging({ ...query, limit: query.limit || 100 });

    const [messages, totalRecords] = await Promise.all([
      this.messageRepository.find(
        { chatId },
        {
          populate: { path: "sender", select: "name email type imageUrl" },
          sort: { createdAt: 1 },
          skip: paging.skip,
          limit: paging.limit,
          lean: true,
        }
      ),
      this.messageRepository.count({ chatId }),
    ]);

    return {
      reason,
      chat,
      totalRecords,
      payload: {
        chat: {
          _id: chat._id,
          participants: chat.participants,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
        messages: messages.map((message) => ({
          _id: message._id,
          sender: message.sender,
          content: message.content,
          type: message.type || "Text",
          seen: message.seen,
          createdAt: message.createdAt,
          // Shown inline so a moderator reading a thread sees which messages
          // tripped a rule without cross-referencing the flagged queue by
          // timestamp.
          flagged: Boolean(message.moderation?.flagged),
          flagCategories: message.moderation?.categories || [],
        })),
      },
      pagination: pagingMeta(totalRecords, paging),
    };
  }

  /* ═══════════════════════════ the flagged queue ════════════════════════════
   * A different screen from the one above in a way worth stating: BROWSING IT
   * IS NOT AUDITED AND NEEDS NO REASON.
   *
   * Not an oversight. The constraint above exists because those are private
   * messages nobody has raised a concern about. These are messages that broke a
   * stated rule — the sender was told so at the time for the blocked ones.
   * Making a moderator justify looking at the abuse queue is friction with no
   * privacy gained, and friction on the safety path is how a queue stops being
   * read.
   *
   * The thread AROUND a flagged message is still behind the reason prompt:
   * seeing what someone sent is not the same as reading the conversation they
   * sent it in. */

  async listFlagged({ query = {} }) {
    const paging = parsePaging(query);
    const filter = {};
    const { category, severity, action, reviewed, userId } = query;

    if (category) filter.categories = category;
    if (["low", "medium", "high"].includes(severity)) filter.severity = severity;
    if (["flagged", "blocked"].includes(action)) filter.action = action;
    if (userId && mongoose.isValidObjectId(userId)) filter.senderId = userId;

    // Defaults to the work: things nobody has looked at yet. Cleared flags stay
    // reachable with ?reviewed=true rather than disappearing — "what did we
    // decide about this last month" needs to be answerable.
    if (reviewed === "true") filter.reviewed = true;
    else if (reviewed !== "all") filter.reviewed = false;

    const [flags, totalRecords] = await Promise.all([
      this.messageFlagRepository.find(filter, {
        populate: [
          { path: "senderId", select: PARTICIPANT_FIELDS },
          { path: "recipientId", select: PARTICIPANT_FIELDS },
          { path: "reviewedBy", select: "name email" },
        ],
        sort: { severity: -1, createdAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.messageFlagRepository.count(filter),
    ]);

    // Prior offences per sender, in one aggregate rather than per row. Same
    // reasoning as the reports queue: a first hit and a ninth hit are different
    // situations, and an admin should not have to go looking to find out which.
    const senderIds = flags.map((flag) => flag.senderId?._id).filter(Boolean);
    const priors = senderIds.length
      ? await this.messageFlagRepository.countsBySender(senderIds)
      : [];
    const priorMap = new Map(priors.map((row) => [String(row._id), row]));

    return {
      data: flags.map((flag) => {
        const prior = priorMap.get(String(flag.senderId?._id));
        return {
          ...flag,
          senderTotalFlags: prior?.total || 1,
          senderBlockedCount: prior?.blocked || 0,
        };
      }),
      pagination: pagingMeta(totalRecords, paging),
    };
  }

  async flaggedStats({ now = Date.now() } = {}) {
    const dayAgo = new Date(now - DAY_MS);

    const [byAction, byCategory, unreviewed, last24h, topSenders] = await Promise.all([
      this.messageFlagRepository.aggregate([
        { $group: { _id: "$action", count: { $sum: 1 } } },
      ]),
      this.messageFlagRepository.aggregate([
        { $match: { reviewed: false } },
        { $unwind: "$categories" },
        { $group: { _id: "$categories", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.messageFlagRepository.count({ reviewed: false }),
      this.messageFlagRepository.count({ createdAt: { $gte: dayAgo } }),
      // Repeat offenders. The most actionable number on the screen: a queue of
      // 200 flags is usually four people, and this is what says so.
      this.messageFlagRepository.aggregate([
        { $match: { reviewed: false } },
        { $group: { _id: "$senderId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const senders = await this.userRepository.find(
      { _id: { $in: topSenders.map((row) => row._id) } },
      { select: "name email", lean: true }
    );
    const senderMap = new Map(senders.map((user) => [String(user._id), user]));
    const actionMap = Object.fromEntries(byAction.map((row) => [row._id, row.count]));

    return {
      blocked: actionMap.blocked || 0,
      flagged: actionMap.flagged || 0,
      unreviewed,
      last24h,
      byCategory,
      topSenders: topSenders.map((row) => ({
        userId: row._id,
        count: row.count,
        // A sender whose account has since been deleted still has flags; the
        // row stays rather than vanishing from the count.
        name: senderMap.get(String(row._id))?.name || "Deleted account",
        email: senderMap.get(String(row._id))?.email || null,
      })),
    };
  }

  /**
   * Clear one flag off the queue.
   *
   * No sanction, no email, nothing happens to the account — this is "I looked
   * at it, it was nothing". Deliberately the cheapest action on the screen,
   * because most flags are noise and a queue whose only exits are heavyweight
   * is a queue that never empties.
   */
  async reviewFlag({ id, note, adminId }) {
    this.#requireObjectId(id, "flag id");

    const flag = await this.messageFlagRepository.updateById(id, {
      $set: {
        reviewed: true,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: String(note || "").slice(0, 1000),
      },
    });

    if (!flag) throw new NotFoundError("Flag not found");
    return flag;
  }

  /**
   * Turn a flag into a tracked case in the reports queue.
   *
   * The content snapshot travels with it so the evidence survives. The flag is
   * marked reviewed at the same time — it has left this queue for the other
   * one, and leaving it in both means two people work the same incident.
   */
  async escalateFlag({ id, details, adminId }) {
    this.#requireObjectId(id, "flag id");

    const flag = await this.messageFlagRepository.findById(id);
    if (!flag) throw new NotFoundError("Flag not found");
    if (flag.reportId) throw new ValidationError("This flag has already been escalated.");

    const primary = flag.categories?.[0];

    const report = await this.reportRepository.create({
      // No reporterId: this did not come from a member complaint.
      reporterId: null,
      reportedUserId: flag.senderId,
      targetType: "message",
      messageId: flag.messageId,
      chatId: flag.chatId,
      reason: CATEGORY_TO_REPORT_REASON[primary] || "inappropriate_content",
      details:
        String(details || "").slice(0, 2000) ||
        `Escalated from the flagged queue. Categories: ${(flag.categories || []).join(", ")}. ` +
          `The message was ${flag.action}.`,
      evidenceSnapshot: String(flag.content || "").slice(0, 2000),
      status: "reviewing",
      priority: flag.severity === "high" ? "high" : "normal",
      assignedTo: adminId,
    });

    flag.reportId = report._id;
    flag.reviewed = true;
    flag.reviewedBy = adminId;
    flag.reviewedAt = new Date();
    await flag.save();

    return { report, flag };
  }

  /* ═════════════════════════════ moderation ══════════════════════════════ */

  /**
   * Load a message for deletion, with everything the audit row needs.
   *
   * The caller writes the audit entry BEFORE the delete, so the evidence
   * survives the removal — which is what makes deleting promptly safe rather
   * than something to do after an investigation concludes.
   */
  async findMessageForRemoval({ messageId, reason: rawReason }) {
    this.#requireObjectId(messageId, "message id");

    const reason = this.#requireReason(
      rawReason,
      "A reason of at least 10 characters is required."
    );

    const message = await this.messageRepository.findById(messageId, { lean: true });
    if (!message) throw new NotFoundError("Message not found");

    return { message, reason };
  }

  /**
   * Remove a single message.
   *
   * Hard delete: unlike an account, a message is not referenced by anything
   * else, and leaving abusive content behind a "deleted" flag means it is still
   * in the database and one forgotten filter away from being served.
   */
  async deleteMessage(message) {
    await this.messageRepository.deleteById(message._id);

    // The chat's denormalised `lastMessage` may now quote text that no longer
    // exists — which would leave the deleted content visible in both members'
    // conversation lists. Repoint it at whatever is now last.
    const latest = await this.messageRepository.findOne(
      { chatId: message.chatId },
      { sort: { createdAt: -1 }, select: "content", lean: true }
    );

    await this.chatRepository.updateById(message.chatId, {
      $set: { lastMessage: latest?.content || "" },
    });
  }

  /**
   * Load a conversation for deletion.
   *
   * `confirm: true` is required on top of the reason: this destroys both
   * people's copy of a thread that may be the only record of an arrangement
   * they made, and it is not undoable.
   */
  async findConversationForRemoval({ chatId, reason: rawReason, confirm }) {
    this.#requireObjectId(chatId, "conversation id");

    const reason = this.#requireReason(
      rawReason,
      "A reason of at least 10 characters is required."
    );

    if (confirm !== true) {
      throw new ValidationError(
        "Deleting a conversation removes it for both people and cannot be undone. " +
          "Re-send with confirm:true to proceed."
      );
    }

    const chat = await this.chatRepository.findById(chatId, { lean: true });
    if (!chat) throw new NotFoundError("Conversation not found");

    return { chat, reason, messageCount: await this.messageRepository.count({ chatId }) };
  }

  async deleteConversation(chatId) {
    await this.messageRepository.deleteMany({ chatId });
    await this.chatRepository.deleteById(chatId);
  }

  /**
   * Open a case from a message an admin found while investigating.
   *
   * Snapshots the content so it survives the sender deleting it.
   */
  async reportMessage({ messageId, reason, details, adminId }) {
    this.#requireObjectId(messageId, "message id");

    const message = await this.messageRepository.findById(messageId, { lean: true });
    if (!message) throw new NotFoundError("Message not found");

    return this.reportRepository.create({
      // No reporterId: an admin opening a case from their own review is not a
      // member complaint, and recording them as the reporter would
      // misrepresent where the concern came from.
      reporterId: null,
      reportedUserId: message.sender,
      targetType: "message",
      messageId: message._id,
      chatId: message.chatId,
      reason: reason || "inappropriate_content",
      details: String(details || "").slice(0, 2000),
      evidenceSnapshot: String(message.content || "").slice(0, 2000),
      status: "reviewing",
      priority: "high",
      assignedTo: adminId,
    });
  }
}

export default AdminMessagesService;
