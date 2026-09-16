import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError, ValidationError } from "../../core/errors/index.js";

/**
 * Inbound feedback from the contact form.
 *
 * Both notifications are fire-and-forget. The feedback row is already saved by
 * the time either runs, and a mail failure must not turn a successful
 * submission into an error the person sees — they would simply submit again.
 */
export class FeedbackService extends BaseService {
  async submit({ message, category, email }) {
    if (!message || message.trim() === "" || !category || !email) {
      throw new ValidationError("Feedback is required.");
    }

    const feedback = await this.feedbackRepository.create({ message, category, email });

    this.#notifyAdmins(feedback);
    this.#acknowledgeSubmitter(feedback);

    return feedback;
  }

  async listAll(adminUserId) {
    const user = await this.userRepository.findById(adminUserId);
    if (!user || user.type !== "Admin") throw new ForbiddenError("Access denied");

    return this.feedbackRepository.find({}, { sort: { createdAt: -1 } });
  }

  async #notifyAdmins(feedback) {
    try {
      const admins = await this.userRepository.find({ type: "Admin" }, { select: "email" });
      if (admins.length === 0) return;

      const subject = "📢 New Feedback Received";
      const body = this.templates.adminFeedbackNotice(feedback);

      for (const admin of admins) {
        this.emailService.sendEmail(admin.email, subject, body);
      }
    } catch (error) {
      console.error("[feedback] admin notification failed:", error);
    }
  }

  /**
   * Acknowledge the person who wrote in.
   *
   * Until this existed the form notified the admins and told the sender
   * nothing, so from their side feedback went into a void — which is
   * self-defeating given the 30-day email goes out and *asks* for this, and
   * invites a reply.
   */
  async #acknowledgeSubmitter(feedback) {
    try {
      // Personalise when the address belongs to a member. The form only asks
      // for an email, so this is the only way to know a name — and "Hi there"
      // is a perfectly good fallback when it isn't one.
      const user = await this.userRepository.findOne(
        { email: feedback.email },
        { select: "name", lean: true }
      );

      await this.emailService.sendFeedbackReceivedEmail(feedback.email, user?.name, {
        category: feedback.category,
        message: feedback.message,
      });
    } catch (error) {
      console.error("[feedback] acknowledgement failed:", error);
    }
  }
}

export default FeedbackService;
