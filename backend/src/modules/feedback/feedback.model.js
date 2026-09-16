// models/Feedback.js
import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
       type: String,
      required: true,
    },
    category: {
       type: String,
      required: true,
    },

    /* -------- SUPPORT QUEUE -------- */
    // Everything below turns the feedback table into a queue an admin can
    // actually work, rather than an append-only list they re-read from the top
    // every morning. Each field is optional and defaulted, so the existing rows
    // and the public POST above are unaffected.

    status: {
      type: String,
      enum: ["new", "in_progress", "resolved", "closed"],
      default: "new",
      index: true,
    },

    // Which admin owns it. An ObjectId rather than a name so the queue survives
    // someone changing theirs.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },

    // Internal thread. INTERNAL means internal: the submitter never sees these,
    // and nothing reads this array onto a member-facing response.
    notes: [
      {
        body: { type: String, trim: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },

    resolvedAt: { type: Date, default: null },

    // Resolved by whom. Kept alongside resolvedAt rather than derived from the
    // last note, because a case can be closed without anyone writing one.
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  { timestamps: true }
);

// The queue's default view: open items, newest first.
feedbackSchema.index({ status: 1, createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);
export default Feedback;
