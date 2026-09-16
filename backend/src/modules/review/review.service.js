import { BaseService } from "../../core/http/BaseService.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/index.js";

/**
 * Reviews left about another member.
 *
 * Reviews live on the *reviewed* user's document as an array, not in their own
 * collection — so writing one means loading the target user and pushing onto
 * them. The rules that matter are all about who is entitled to do that, and
 * there are two ways to earn that right:
 *
 *   BOOKING — the original path. `bookingId` identifies the job the two people
 *   worked together on:
 *
 *     * Only a participant of the booking, and each side reviews the other.
 *     * Only once per booking per side, enforced twice over — a flag on the
 *       booking and a scan of the target's existing reviews. Belt and braces,
 *       preserved: the flag is the fast path, the scan catches a booking whose
 *       flag was never set.
 *     * Only after the booking is complete.
 *
 *   MATCH — no booking, `targetUserId` instead. A profile page offers "Leave a
 *   review" to anyone the member has actually matched with, and most matches
 *   never become a booking on the platform: families and caregivers arrange the
 *   work between themselves once they are connected. Requiring a completed
 *   booking would mean the button is offered and then rejected.
 *
 *     * Only with an ACCEPTED match, in either direction. Pending, rejected and
 *       blocked all fail — a rejected request must not become a channel for
 *       leaving someone a one-star review, and neither must a blocked one.
 *     * Once per reviewer per person. Booking reviews are counted separately,
 *       since those are per-job and someone may legitimately have several.
 *     * Never about yourself.
 */
export class ReviewService extends BaseService {
  /**
   * Resolve who is being reviewed, and mark the reviewer's side as done.
   *
   * Mutates the booking in memory only; the caller saves it after the remaining
   * checks pass.
   */
  async #resolveTarget({ booking, userId, userType }) {
    if (userType === "nanny") {
      if (!booking.requestBy._id.equals(userId)) {
        throw new ForbiddenError("Unauthorized to submit review for this booking");
      }
      if (booking.nannyReview) {
        throw new ValidationError("You have already submitted a review for this booking");
      }

      const family = await this.userRepository.findById(booking.jobId.user._id);
      if (!family) throw new NotFoundError("Family user not found");

      booking.nannyReview = true;
      return family;
    }

    if (userType === "family") {
      if (!booking.jobId.user._id.equals(userId)) {
        throw new ForbiddenError("Unauthorized to submit review for this booking");
      }
      if (booking.familyReview) {
        throw new ValidationError("You have already submitted a review for this booking");
      }

      const nanny = await this.userRepository.findById(booking.requestBy._id);
      if (!nanny) throw new NotFoundError("Nanny user not found");

      booking.familyReview = true;
      return nanny;
    }

    throw new ValidationError("Invalid user type");
  }

  /**
   * Resolve the reviewed user from an accepted match rather than a booking.
   *
   * Returns the target only; unlike the booking path there is nothing to mark
   * as done, because the "already reviewed" check for this path reads the
   * target's own reviews (see `submit`).
   */
  async #resolveMatchedTarget({ userId, targetUserId }) {
    if (!targetUserId) {
      throw new ValidationError("Either bookingId or targetUserId is required");
    }
    if (String(targetUserId) === String(userId)) {
      throw new ValidationError("You cannot review yourself");
    }

    // Symmetric: `findBetween` covers both directions, so it does not matter
    // which side sent the request.
    const match = await this.matchRepository.findBetween(userId, targetUserId);
    if (match?.status !== "accepted") {
      throw new ForbiddenError("You can only review someone you have matched with");
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) throw new NotFoundError("User not found");

    return target;
  }

  async submit({ userId, bookingId, rating, msg, userType, targetUserId }) {
    // Both paths reach the same `reviews.unshift`, and the schema requires a
    // 1-5 rating and a message. Checked here so a bad request is a 400 naming
    // the field rather than a mongoose validation error surfacing as a 500.
    const score = Number(rating);
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new ValidationError("Rating must be between 1 and 5");
    }
    if (typeof msg !== "string" || !msg.trim()) {
      throw new ValidationError("Review message is required");
    }

    if (!bookingId) {
      return this.#submitForMatch({ userId, targetUserId, rating: score, msg });
    }

    const booking = await this.bookingRepository.findById(bookingId, {
      populate: [
        { path: "jobId", populate: { path: "user", model: "users" } },
        { path: "requestBy" },
      ],
    });
    if (!booking) throw new NotFoundError("Booking not found");

    const target = await this.#resolveTarget({ booking, userId, userType });

    if (booking.status !== "completed") {
      throw new ValidationError("Review can only be submitted for completed bookings");
    }

    if (!Array.isArray(target.reviews)) target.reviews = [];

    // The second duplicate check — see the class comment. Optional-chained
    // because a match review carries no bookingId, and `.toString()` on the
    // missing field would throw while checking an unrelated review.
    const existing = target.reviews.find((r) => r.bookingId?.toString() === bookingId);
    if (existing) {
      throw new ValidationError("You have already submitted a review for this booking");
    }

    // unshift, not push: reviews render newest-first.
    target.reviews.unshift({ userId, rating: score, msg, bookingId });

    await target.save();
    await booking.save();

    await this.#notify({ userId, target, rating: score, msg });
  }

  async #submitForMatch({ userId, targetUserId, rating, msg }) {
    const target = await this.#resolveMatchedTarget({ userId, targetUserId });

    if (!Array.isArray(target.reviews)) target.reviews = [];

    // Only match reviews count against this limit. A reviewer may hold several
    // booking reviews of the same person — one per job — and those are already
    // deduplicated per booking above.
    const existing = target.reviews.find(
      (r) => !r.bookingId && String(r.userId) === String(userId)
    );
    if (existing) {
      throw new ValidationError("You have already reviewed this member");
    }

    target.reviews.unshift({ userId, rating, msg });

    await target.save();

    await this.#notify({ userId, target, rating, msg });
  }

  /** Tell the reviewed party. Best-effort — the review is already written. */
  async #notify({ userId, target, rating, msg }) {
    try {
      const reviewer = await this.userRepository.findById(userId);
      const notice = this.templates.reviewReceived({ reviewer, rating, msg });
      if (!notice) return;

      this.emailService.sendEmail(target.email, notice.subject, notice.body);
    } catch (error) {
      console.error("[review] notification failed:", error);
    }
  }

  /** A member's reviews, with the average, for their public profile. */
  async listFor(userId) {
    const user = await this.userRepository.findById(userId, {
      populate: { path: "reviews.userId", select: "name imageUrl" },
    });
    if (!user) throw new NotFoundError("User not found");

    const totalRatings = user.reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = user.reviews.length
      ? (totalRatings / user.reviews.length).toFixed(1)
      : 0;

    return {
      reviews: user.reviews.map((review) => ({
        rating: review.rating,
        msg: review.msg,
        createdAt: review.createdAt,
        // Only the reviewer's name and avatar — never the rest of their record.
        reviewer: {
          name: review.userId?.name || "Unknown",
          imageUrl: review.userId?.imageUrl || null,
        },
      })),
      averageRating,
      totalRatings,
    };
  }
}

export default ReviewService;
