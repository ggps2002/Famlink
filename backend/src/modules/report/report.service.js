import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";

/** The reasons the form offers. Anything else is filed as "other". */
export const REPORT_REASONS = [
  "harassment",
  "scam",
  "inappropriate_content",
  "fake_profile",
  "spam",
  "safety_concern",
  "other",
];

/**
 * Member-to-member reporting — the front door to the moderation queue.
 *
 * Two rules shape every method here:
 *
 *   THE REPORTER'S IDENTITY IS NEVER SHOWN TO THE PERSON REPORTED. Nothing in
 *   the admin flow surfaces it either: the deactivation email is deliberately
 *   generic, and moderator notes are in the admin-only field tier.
 *
 *   A REPORTER LEARNS ONLY ABOUT THEIR OWN REPORT. Whether anyone else has
 *   reported an account is not a member's business — an endpoint that leaked it
 *   would be a way to check a stranger's standing before meeting them.
 */
export class ReportService extends BaseService {
  async submit({ reporterId, reportedUserId, reason, details, messageId, chatId }) {
    if (!mongoose.isValidObjectId(reportedUserId)) {
      throw new ValidationError("Please choose who you are reporting.");
    }
    if (String(reportedUserId) === String(reporterId)) {
      throw new ValidationError("You cannot report yourself.");
    }

    const reported = await this.userRepository.findById(reportedUserId, {
      select: "_id status",
      lean: true,
    });
    if (!reported) throw new NotFoundError("That account no longer exists.");

    const { evidenceSnapshot, resolvedChatId } = await this.#captureEvidence({
      messageId,
      chatId,
      reportedUserId,
    });

    // Safety and harassment arrive at the top of the queue unread. Everything
    // else is triaged by a human; these two are the ones where waiting for
    // triage is itself the harm.
    const isSafetyConcern = reason === "safety_concern" || reason === "harassment";

    return this.reportRepository.create({
      reporterId,
      reportedUserId,
      targetType: messageId ? "message" : "user",
      messageId: messageId && mongoose.isValidObjectId(messageId) ? messageId : null,
      chatId: resolvedChatId,
      reason: REPORT_REASONS.includes(reason) ? reason : "other",
      details: String(details || "").slice(0, 2000),
      evidenceSnapshot,
      status: "open",
      priority: isSafetyConcern ? "high" : "normal",
    });
  }

  /**
   * Snapshot the reported message now, at the moment of the report.
   *
   * This is the whole reason `evidenceSnapshot` exists on the schema: someone
   * who realises they have been reported can delete what they wrote, and the
   * complaint would then be one person's word against an empty chat.
   */
  async #captureEvidence({ messageId, chatId, reportedUserId }) {
    let evidenceSnapshot = "";
    let resolvedChatId = chatId && mongoose.isValidObjectId(chatId) ? chatId : null;

    if (!messageId || !mongoose.isValidObjectId(messageId)) {
      return { evidenceSnapshot, resolvedChatId };
    }

    const message = await this.messageRepository.findById(messageId, {
      select: "content sender chatId",
      lean: true,
    });

    // Only accept the message if the person being reported actually wrote it.
    // Otherwise a report could attach someone else's message — including the
    // reporter's own — as evidence against them.
    if (message && String(message.sender) === String(reportedUserId)) {
      evidenceSnapshot = String(message.content || "").slice(0, 2000);
      resolvedChatId = message.chatId;
    }

    return { evidenceSnapshot, resolvedChatId };
  }

  /**
   * Has this member already reported that one?
   *
   * The chat header shows "Reported" instead of a report button once they have.
   * Without it the button resets on every refresh, which reads as the report
   * having been lost and invites a duplicate to make sure it stuck.
   */
  async statusFor({ reporterId, reportedUserId }) {
    if (!mongoose.isValidObjectId(reportedUserId)) {
      throw new ValidationError("Invalid user id");
    }

    const existing = await this.reportRepository.findOne(
      { reporterId, reportedUserId },
      { select: "createdAt status", sort: { createdAt: -1 }, lean: true }
    );

    return {
      reported: Boolean(existing),
      reportedAt: existing?.createdAt || null,
    };
  }

  /**
   * What this member has reported, and how far it got.
   *
   * Status only — never the moderator's notes or what happened to the other
   * account. "We acted on this" is what a reporter is entitled to know; "we
   * suspended them for 14 days" is not, and telling them turns a report into a
   * way of learning about someone else's account.
   */
  async listMine(reporterId) {
    const reports = await this.reportRepository.find(
      { reporterId },
      {
        select: "reason status createdAt targetType",
        sort: { createdAt: -1 },
        limit: 50,
        lean: true,
      }
    );

    return reports.map((report) => ({
      _id: report._id,
      reason: report.reason,
      submittedAt: report.createdAt,
      // Collapsed to two states. The internal distinction between "open" and
      // "reviewing" describes our workflow, not theirs.
      status: report.status === "resolved" ? "reviewed" : "under_review",
    }));
  }
}

export default ReportService;
