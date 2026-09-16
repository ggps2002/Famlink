import { BaseService } from "../../core/http/BaseService.js";
import { AppError, ForbiddenError, NotFoundError } from "../../core/errors/index.js";
import { USER_IDENTITY_SELECT } from "../user/user.privacy.js";

/**
 * Message CRUD.
 *
 * The app itself sends and reads over the socket; this is the REST equivalent,
 * and it was entirely unauthenticated — a bare message id read anyone's
 * message, edited it, or deleted it, and the read populated `sender` with no
 * projection, so the response carried the sender's whole user document.
 *
 * Two rules run through everything here:
 *
 *   A caller must be a participant of the message's chat, and failing that is
 *   reported as 404, identical to a message that does not exist — otherwise the
 *   endpoint is a way to probe which message ids are real.
 *
 *   Every write goes through the same content guard the socket path uses.
 *   Checking only participation here would leave this route as the way to send
 *   exactly the content the app itself refuses to send.
 */
export class MessageService extends BaseService {
  async #assertParticipant(chatId, userId) {
    const id = chatId?._id || chatId;
    const isParticipant = Boolean(id) && (await this.chatRepository.isParticipant(id, userId));

    if (!isParticipant) throw new NotFoundError("Message not found");
  }

  /** Turn a guard refusal into the right HTTP failure. */
  static #guardError(verdict) {
    // 403 for "not yours to post in", 422 for content the rules refused — they
    // are different failures and the caller can tell them apart without
    // parsing the message.
    const status =
      verdict.code === "not_participant" || verdict.code === "blocked" ? 403 : 422;

    return new AppError(verdict.reason, status, { code: verdict.code });
  }

  async send({ userId, chatId, content, type }) {
    const verdict = await this.guardOutgoingMessage({
      chatId,
      senderId: userId,
      content,
      type: type || "Text",
    });

    if (!verdict.ok) throw MessageService.#guardError(verdict);

    // The sender is whoever is signed in — never a value from the body, which
    // would let a caller post messages as somebody else.
    const message = await this.messageRepository.create({
      chatId,
      sender: userId,
      content,
      type: type || "Text",
      ...(verdict.moderation ? { moderation: verdict.moderation } : {}),
    });

    if (verdict.flagId) await this.attachFlagToMessage(verdict.flagId, message._id);

    return message;
  }

  async read({ userId, messageId }) {
    const message = await this.messageRepository.findById(messageId, {
      populate: [{ path: "chatId" }, { path: "sender", select: USER_IDENTITY_SELECT }],
    });
    if (!message) throw new NotFoundError("Message not found");

    await this.#assertParticipant(message.chatId, userId);

    return message;
  }

  /**
   * Edit content and/or read receipts.
   *
   * Read receipts are the recipient's to set; the text is the author's — which
   * is why the ownership check sits inside the `content` branch rather than at
   * the top.
   */
  async update({ userId, messageId, content, seen, seenAt }) {
    const message = await this.messageRepository.findById(messageId);
    if (!message) throw new NotFoundError("Message not found");

    await this.#assertParticipant(message.chatId, userId);

    if (content !== undefined) {
      if (String(message.sender) !== String(userId)) {
        throw new ForbiddenError("You can only edit your own messages.");
      }

      // An edit is a send. Without this, the rules are one clean message and
      // one PUT away from being irrelevant: post "hi", then edit it into
      // whatever you actually wanted to say.
      const verdict = await this.guardOutgoingMessage({
        chatId: message.chatId,
        senderId: userId,
        content,
        type: message.type || "Text",
      });

      if (!verdict.ok) {
        throw new AppError(verdict.reason, 422, { code: verdict.code });
      }

      message.content = content;
      // Reset rather than merge: the previous verdict described text that is
      // no longer there.
      message.moderation = verdict.moderation || {
        flagged: false,
        categories: [],
        severity: null,
      };

      if (verdict.flagId) await this.attachFlagToMessage(verdict.flagId, message._id);
    }

    if (seen !== undefined) message.seen = seen;
    if (seenAt !== undefined) message.seenAt = seenAt;

    await message.save();
    return message;
  }

  async remove({ userId, messageId }) {
    const message = await this.messageRepository.findById(messageId);
    if (!message) throw new NotFoundError("Message not found");

    // Deletion is the author's alone — deliberately a 403 rather than the 404
    // used elsewhere, because the caller already knows the message exists.
    if (String(message.sender) !== String(userId)) {
      throw new ForbiddenError("You can only delete your own messages.");
    }

    await message.deleteOne();
  }
}

export default MessageService;
