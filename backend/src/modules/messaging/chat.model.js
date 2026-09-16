import mongoose from "mongoose";

const { Schema } = mongoose;

// Define the chat schema
const chatSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: "",
    },
    type: {
      type: Schema.Types.String,
      enum: ['Audio', 'Text'],
    },
  },
  {
    timestamps: true,
  }
);

// Create and export the model
const Chat = mongoose.model("chats", chatSchema);

export default Chat;