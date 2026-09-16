import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta, searchTerm } from "./admin.middleware.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUSES = ["new", "in_progress", "resolved", "closed"];
const OPEN_STATUSES = ["new", "in_progress"];
const PRIORITIES = ["low", "normal", "high"];

/** How much of a note is kept. Long enough for context, bounded for storage. */
const MAX_NOTE_LENGTH = 5000;

const daysSince = (date) => Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS);

/**
 * The support and feedback queue, over the existing Feedback collection.
 *
 * The collection already held every in-app submission; what it lacked was any
 * notion of a submission being WORKED. Status, assignee and internal notes were
 * added to the schema rather than built as a separate ticket model, so every
 * item ever submitted joins the queue automatically instead of the queue
 * starting empty with the history living somewhere else.
 *
 * The cost of that choice is visible below: rows predating those fields have no
 * status, so `new` is applied on read rather than by a migration.
 */
export class SupportService extends BaseService {
  async list({ query = {}, adminId }) {
    const paging = parsePaging(query);
    const filter = {};

    const { status, category, assigned, search, priority } = query;

    // Defaults to open work. Resolved and closed items stay reachable by filter
    // but do not bury the things that still need doing.
    if (status && STATUSES.includes(status)) {
      filter.status = status;
    } else if (status !== "all") {
      filter.status = { $in: OPEN_STATUSES };
    }

    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    if (assigned === "me") filter.assignedTo = adminId;
    if (assigned === "unassigned") filter.assignedTo = null;

    if (search) {
      const term = searchTerm(search);
      filter.$or = [{ message: term }, { email: term }];
    }

    const [items, totalRecords] = await Promise.all([
      this.feedbackRepository.find(filter, {
        populate: [
          { path: "assignedTo", select: "name email" },
          { path: "notes.authorId", select: "name email" },
          { path: "resolvedBy", select: "name email" },
        ],
        sort: { priority: -1, createdAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.feedbackRepository.count(filter),
    ]);

    const submitters = await this.#linkSubmitters(items);

    return {
      data: items.map((item) => ({
        ...item,
        // Older rows predate these fields entirely. Defaulted on read so the
        // queue shows them as work rather than as blanks.
        status: item.status || "new",
        priority: item.priority || "normal",
        submitter: submitters.get(String(item.email || "").toLowerCase()) || null,
        ageDays: daysSince(item.createdAt),
      })),
      pagination: pagingMeta(totalRecords, paging),
    };
  }

  /**
   * Link each submission to an account where the address matches one.
   *
   * The form captures only an email, so this is what lets an admin see who they
   * are actually replying to — and whether the complaint is from a member who
   * has been reported three times.
   *
   * Matched case-insensitively. Stored addresses are saved as typed, so the
   * previous lowercased `$in` silently failed to link anyone whose address has
   * a capital in it: their ticket showed no account, no history, no status.
   */
  async #linkSubmitters(items) {
    const emails = [
      ...new Set(items.map((item) => String(item.email || "").toLowerCase())),
    ].filter(Boolean);

    if (!emails.length) return new Map();

    const users = await this.userRepository.findByEmailsInsensitive(
      emails,
      "_id name email type status premium createdAt"
    );

    return new Map(users.map((user) => [user.email.toLowerCase(), user]));
  }

  async stats() {
    const [byStatus, byCategory, oldestOpen, resolvedLast7Days] = await Promise.all([
      this.feedbackRepository.aggregate([
        { $group: { _id: { $ifNull: ["$status", "new"] }, count: { $sum: 1 } } },
      ]),
      this.feedbackRepository.aggregate([
        // `null` is included on purpose — see the note about older rows above.
        { $match: { status: { $in: [...OPEN_STATUSES, null] } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.feedbackRepository.findOne(
        { status: { $in: [...OPEN_STATUSES, null] } },
        { sort: { createdAt: 1 }, select: "createdAt", lean: true }
      ),
      this.feedbackRepository.count({
        status: "resolved",
        resolvedAt: { $gte: new Date(Date.now() - 7 * DAY_MS) },
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));

    return {
      new: statusMap.new || 0,
      inProgress: statusMap.in_progress || 0,
      resolved: statusMap.resolved || 0,
      closed: statusMap.closed || 0,
      byCategory,
      // The number that says whether the queue is being kept up with.
      oldestOpenDays: oldestOpen ? daysSince(oldestOpen.createdAt) : null,
      resolvedLast7Days,
    };
  }

  /**
   * Update a ticket.
   *
   * One method for every field, because working an item is usually several
   * changes at once — pick it up, set a priority, leave a note — and splitting
   * those across three requests leaves a half-updated ticket whenever one fails.
   */
  async update({ id, body = {}, adminId }) {
    if (!mongoose.isValidObjectId(id)) throw new ValidationError("Invalid ticket id");

    const item = await this.feedbackRepository.findById(id);
    if (!item) throw new NotFoundError("Ticket not found");

    const { status, priority, assignToMe, note } = body;
    const changed = {};

    if (status && STATUSES.includes(status)) {
      item.status = status;
      changed.status = status;

      if (status === "resolved" || status === "closed") {
        item.resolvedAt = new Date();
        item.resolvedBy = adminId;
      } else {
        // Reopening clears the resolution, so a ticket that comes back does not
        // still claim it was closed last Tuesday.
        item.resolvedAt = null;
        item.resolvedBy = null;
      }
    }

    if (PRIORITIES.includes(priority)) {
      item.priority = priority;
      changed.priority = priority;
    }

    if (assignToMe === true) {
      item.assignedTo = adminId;
      changed.assignedTo = String(adminId);
      // Picking something up implies working it, unless it is already resolved.
      if (item.status === "new") item.status = "in_progress";
    }
    if (assignToMe === false) {
      item.assignedTo = null;
      changed.assignedTo = null;
    }

    if (note && String(note).trim()) {
      item.notes.push({
        body: String(note).trim().slice(0, MAX_NOTE_LENGTH),
        authorId: adminId,
        createdAt: new Date(),
      });
      changed.noteAdded = true;
    }

    if (!Object.keys(changed).length) throw new ValidationError("Nothing to change.");

    await item.save();

    return { changed, item };
  }

  /** Re-read with authors resolved, for the response after an update. */
  findPopulated(id) {
    return this.feedbackRepository.findById(id, {
      populate: [
        { path: "assignedTo", select: "name email" },
        { path: "notes.authorId", select: "name email" },
      ],
      lean: true,
    });
  }

  async categories() {
    const categories = await this.feedbackRepository.model.distinct("category").exec();
    return categories.filter(Boolean).sort();
  }
}

export default SupportService;
