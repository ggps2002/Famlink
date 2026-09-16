import mongoose from "mongoose";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import Chat from "./chat.model.js";

/**
 * Conversations between two members.
 *
 * `findOrCreateBetween` exists because the same "get the 1:1 chat" logic was
 * written twice — once in the chat route and once in the match controller, so
 * that accepting a match opens a conversation immediately. Two copies of a
 * find-or-create is two chances to disagree about identity, and here identity
 * is the sorted participant pair: without the sort, [A,B] and [B,A] are
 * different queries and the same two people end up with two conversations.
 */
export class ChatRepository extends BaseRepository {
  constructor(model = Chat) {
    super(model);
  }

  /** The canonical participant key for a 1:1 conversation. */
  static participantsKey(userIdA, userIdB) {
    return [userIdA, userIdB].map((id) => new mongoose.Types.ObjectId(id)).sort();
  }

  findBetween(userIdA, userIdB, options = {}) {
    const participants = ChatRepository.participantsKey(userIdA, userIdB);
    return this.findOne(
      { participants: { $all: participants, $size: participants.length } },
      options
    );
  }

  async findOrCreateBetween(userIdA, userIdB) {
    const existing = await this.findBetween(userIdA, userIdB);
    if (existing) return existing;

    return this.create({ participants: ChatRepository.participantsKey(userIdA, userIdB) });
  }

  findForUser(userId, options = {}) {
    return this.find({ participants: userId }, options);
  }

  /** Is this user a participant of that chat? The membership check every read uses. */
  isParticipant(chatId, userId) {
    return this.exists({ _id: chatId, participants: userId });
  }

  /** Delete a chat only if the caller is in it. */
  deleteOwned(chatId, userId) {
    return this.model.findOneAndDelete({ _id: chatId, participants: userId }).exec();
  }

  /**
   * One conversation, resolved from the caller's point of view.
   *
   * Done as an aggregation rather than a populate because two of the three
   * fields are relative to *who is asking*: `sender` and `receiver` swap
   * depending on which participant you are, and `unReadMessages` counts only
   * messages the caller did not send. Computing those in JS would mean pulling
   * every message in the conversation back just to count a subset of them.
   *
   * Note the projection at the end: `participants`, `participantsDetails` and
   * `messages` are all dropped. Only the four identity fields of each side
   * survive, so the full user documents the $lookup pulled in never leave here.
   */
  async findForParticipant(chatId, userId) {
    const chatObjectId = this.toObjectId(chatId, "chat id");
    const userObjectId = this.toObjectId(userId, "user id");

    const identity = (participantVar) => ({
      name: `${participantVar}.name`,
      imageUrl: `${participantVar}.imageUrl`,
      type: `${participantVar}.type`,
      _id: `${participantVar}._id`,
    });

    const [chat] = await this.aggregate([
      { $match: { _id: chatObjectId } },
      {
        $lookup: {
          from: "users",
          localField: "participants",
          foreignField: "_id",
          as: "participantsDetails",
        },
      },
      {
        $lookup: {
          from: "messages",
          localField: "_id",
          foreignField: "chatId",
          as: "messages",
        },
      },
      {
        $addFields: {
          // The other party: index 1 when the caller is index 0, else index 0.
          receiver: {
            $let: {
              vars: {
                participantIndex: {
                  $cond: {
                    if: { $eq: [{ $arrayElemAt: ["$participants", 0] }, userObjectId] },
                    then: { $cond: { if: { $gt: [{ $size: "$participants" }, 1] }, then: 1, else: 0 } },
                    else: { $cond: { if: { $gt: [{ $size: "$participants" }, 0] }, then: 0, else: null } },
                  },
                },
              },
              in: {
                $let: {
                  vars: {
                    participant: { $arrayElemAt: ["$participantsDetails", "$$participantIndex"] },
                  },
                  in: identity("$$participant"),
                },
              },
            },
          },
          sender: {
            $let: {
              vars: { participantIndex: { $indexOfArray: ["$participants", userObjectId] } },
              in: {
                $let: {
                  vars: {
                    participant: { $arrayElemAt: ["$participantsDetails", "$$participantIndex"] },
                  },
                  in: identity("$$participant"),
                },
              },
            },
          },
          // Unread means: not seen, and not sent by the caller.
          unReadMessages: {
            $size: {
              $filter: {
                input: "$messages",
                as: "message",
                cond: {
                  $and: [
                    { $eq: ["$$message.seen", false] },
                    { $ne: ["$$message.sender", userObjectId] },
                  ],
                },
              },
            },
          },
        },
      },
      { $project: { participants: 0, participantsDetails: 0, messages: 0 } },
    ]);

    return chat ?? null;
  }
}

export const chatRepository = new ChatRepository();

export default chatRepository;
