import mongoose from "mongoose";

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "chats",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: Schema.Types.String,
      enum: ['Audio', 'Text'],
    },
    seen: {
      type: Boolean,
      default: false,
      required: true,
    },
    seenAt: {
      type: Date,
      default: null,
    },

    // Set when the content rules fired but the message was still delivered.
    // A display marker only — the record of what happened lives in the
    // `messageflags` collection, which also holds the messages that were
    // blocked and therefore have no document here at all.
    //
    // Never returned to members. The admin thread view reads it so a flagged
    // message is visible in the context of the conversation around it, which
    // is usually what decides whether it meant anything.
    moderation: {
      flagged: { type: Boolean, default: false },
      categories: [{ type: String }],
      severity: { type: String, enum: ["low", "medium", "high"], default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Supports the admin thread view highlighting flagged messages, and answers
// "how much of this conversation was flagged" without scanning it.
messageSchema.index({ chatId: 1, "moderation.flagged": 1 });

const Message = mongoose.model("messages", messageSchema);

export default Message;
