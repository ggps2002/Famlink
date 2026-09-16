import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import { USER_IDENTITY_SELECT } from "../user/user.privacy.js";

const { ObjectId } = mongoose.Types;

/**
 * Conversations.
 *
 * Every method here is an ownership check followed by a query, and that is the
 * point: most of these endpoints were originally unauthenticated. Any chat id
 * read the conversation, rewrote its participant list — adding yourself to two
 * other members' chat and reading it from then on — or deleted it outright.
 * The guards are load-bearing, not ceremony, so each one says what it prevents.
 */
export class ChatService extends BaseService {
  /**
   * The caller's conversation list, plus every admin they have not yet messaged.
   *
   * Admins are appended as placeholder rows with a null `_id`, so support is
   * always reachable from the inbox even before a conversation exists.
   */
  async listFor(userId) {
    const [chats, admins] = await Promise.all([
      this.chatRepository.findForUser(userId, {
        populate: { path: "participants", select: USER_IDENTITY_SELECT },
      }),
      this.userRepository.find({ type: "Admin" }, { select: USER_IDENTITY_SELECT }),
    ]);

    const conversations = chats.map((chat) => ({
      _id: chat._id,
      lastMessage: chat.lastMessage,
      // Only the other party is returned; the caller knows who they are.
      otherParticipant: chat.participants.find((p) => p._id.toString() !== userId),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      type: chat.type,
    }));

    const existing = new Set(
      conversations.map((chat) => chat.otherParticipant?._id.toString())
    );

    const unstartedAdminChats = admins
      .filter((admin) => !existing.has(admin._id.toString()))
      .map((admin) => ({
        _id: null, // No chat id — it has not been started.
        lastMessage: null,
        otherParticipant: admin,
        createdAt: null,
        updatedAt: null,
        type: null,
      }));

    return [...conversations, ...unstartedAdminChats];
  }

  /**
   * Open (or reuse) a conversation.
   *
   * @returns {{ chat: object, created: boolean }} `created` decides 201 vs 200.
   */
  async open({ userId, participants }) {
    if (!participants || participants.length < 2) {
      throw new ValidationError(
        "Participants are required and should include at least two users."
      );
    }

    // You can only open a chat you are in. Otherwise this endpoint creates
    // conversations between two other people on their behalf.
    if (!participants.some((p) => String(p) === String(userId))) {
      throw new ForbiddenError("You must be a participant in the chat.");
    }

    const sorted = participants.map((p) => new ObjectId(p)).sort();

    const existing = await this.chatRepository.findOne({
      participants: { $all: sorted, $size: sorted.length },
    });
    if (existing) return { chat: existing, created: false };

    return { chat: await this.chatRepository.create({ participants: sorted }), created: true };
  }

  /**
   * Read one conversation.
   *
   * `userId` in the path decides whose side you are reading from, and there
   * used to be no auth at all — so any chat id plus any user id read that
   * conversation. The caller can now only read from their own side, and only if
   * they are actually in it.
   */
  async read({ callerId, chatId, userId }) {
    if (!ObjectId.isValid(chatId) || !ObjectId.isValid(userId)) {
      throw new ValidationError("Invalid chat or user ID.");
    }

    if (String(userId) !== String(callerId)) {
      throw new ForbiddenError("You can only read your own chats.");
    }

    if (!(await this.chatRepository.isParticipant(chatId, callerId))) {
      // A 404 rather than a 403: whether a chat exists is not something a
      // non-participant should be able to probe for.
      throw new NotFoundError("Chat not found.");
    }

    const chat = await this.chatRepository.findForParticipant(chatId, userId);
    if (!chat) throw new NotFoundError("Chat not found.");

    return chat;
  }

  /**
   * Update a conversation.
   *
   * Restricted to people already in it — unauthenticated, this let anyone
   * rewrite the participant list of any chat.
   *
   * NOTE, preserved: a participant may still replace the participant list
   * wholesale, which lets them add a third party to a private conversation.
   * Narrowing that is a behaviour change rather than a refactor, so it is left
   * as-is and flagged here.
   */
  async update({ userId, chatId, participants }) {
    if (!ObjectId.isValid(chatId)) throw new ValidationError("Invalid chat ID.");

    const chat = await this.chatRepository.findOne({ _id: chatId, participants: userId });
    if (!chat) throw new NotFoundError("Chat not found.");

    if (participants) chat.participants = participants;
    await chat.save();

    return chat;
  }

  /** Delete a conversation and its notifications. Was unauthenticated. */
  async remove({ userId, chatId }) {
    if (!ObjectId.isValid(chatId)) throw new ValidationError("Invalid chat ID.");

    const chat = await this.chatRepository.deleteOwned(chatId, userId);
    if (!chat) throw new NotFoundError("Chat not found.");

    // Otherwise the inbox keeps showing notifications pointing at a
    // conversation that no longer exists.
    await this.notificationRepository.deleteMany({ chatId });
  }
}

export default ChatService;
