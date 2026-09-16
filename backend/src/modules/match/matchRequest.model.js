import mongoose from "mongoose";
const { Schema } = mongoose;

const matchRequestSchema = new Schema({
  senderId: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },

  receiverId: {
    type: Schema.Types.ObjectId,
    ref: "users", // later: separate Family model
  },

  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "blocked"],
    default: "pending",
  },

  // Who initiated a block. Set when status becomes "blocked"; cleared on unblock.
  // Lets the chat screen show "you've blocked" to the blocker vs. a generic
  // unavailable state to the blocked party, and restricts unblocking to the blocker.
  blockedBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },

  message: String, // optional intro message

  // When the receiver answered — accepted or rejected. Null while pending.
  //
  // Status is mutated in place, so without this the moment of the decision was
  // simply not recorded anywhere: "average time to a mutual match" and "how
  // long do requests sit unanswered" were both unanswerable from stored data.
  // Set alongside every status change in src/modules/match/match.service.js.
  //
  // Null on every request that predates this field, which the match-quality
  // report handles by measuring only rows that have it rather than treating a
  // missing timestamp as an instant response.
  respondedAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("matchrequests", matchRequestSchema);