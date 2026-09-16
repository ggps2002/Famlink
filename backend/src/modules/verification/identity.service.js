import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import { approvedEmail, revertedEmail } from "./identity.templates.js";

/**
 * The states an ID check moves through.
 *
 * Stored as strings, not booleans — an older schema decision that has to be
 * respected everywhere, because `verified.nationalIDVer` holding the string
 * `"false"` is truthy. Comparing it loosely is how a rejected member reads as
 * verified. The constants exist so no call site writes the literal again.
 */
export const ID_STATUS = {
  none: "false",
  pending: "underprocess",
  verified: "true",
};

/**
 * Government-ID verification: a member submits document photos, an admin
 * approves or reverts them.
 *
 * The member-facing half and the admin half are in one service because they are
 * a single state machine over one field — splitting them would mean two places
 * that both have to agree on which transitions are legal.
 */
export class IdentityVerificationService extends BaseService {
  /**
   * Submit the two sides of an ID document.
   *
   * Refused unless the member is in the `none` state, so a submission cannot
   * overwrite one already in review, and a verified member cannot quietly
   * replace the document their badge was granted for.
   */
  async submit({ userId, files = {} }) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found.");

    if (user.verified.nationalIDVer !== ID_STATUS.none) {
      throw new ForbiddenError(
        user.verified.nationalIDVer === ID_STATUS.pending
          ? "Your verification is underprocess"
          : "Your id is already verified"
      );
    }

    const front = files.frontImage?.[0];
    const back = files.backImage?.[0];
    if (!front || !back) {
      throw new ValidationError("Both front and back images are required.");
    }

    // Uploaded before either record is written, so a storage failure leaves the
    // member in `none` and able to try again rather than stuck in review with
    // no documents attached.
    const [frontsideImage, backsideImage] = await Promise.all([
      this.imageUploader(front.buffer, user.email, "front_image_"),
      this.imageUploader(back.buffer, user.email, "back_image_"),
    ]);

    user.verified.nationalIDVer = ID_STATUS.pending;
    await user.save();
    await this.verificationRepository.create({ user: userId, frontsideImage, backsideImage });

    return user.verified.nationalIDVer;
  }

  async #requireAdmin(adminId) {
    const admin = await this.userRepository.findById(adminId, { select: "type", lean: true });
    if (!admin) throw new NotFoundError("User not found");
    if (admin.type !== "Admin") {
      throw new ForbiddenError("Access denied. Only Admins can access this");
    }
    return admin;
  }

  /** The submitted documents for one member, for the review screen. */
  async findForUser({ adminId, userId }) {
    await this.#requireAdmin(adminId);

    const record = await this.verificationRepository.findOne({ user: userId });
    if (!record) throw new NotFoundError("Verification record not found");

    return record;
  }

  /**
   * Approve a submission.
   *
   * Only from `underprocess`: approving a member who never submitted anything
   * would grant the badge with no document behind it.
   */
  async approve({ adminId, verificationId }) {
    await this.#requireAdmin(adminId);

    const { record, targetUser } = await this.#loadSubmission(verificationId);

    if (targetUser.verified?.nationalIDVer === ID_STATUS.verified) {
      throw new ValidationError("User is already verified");
    }
    if (targetUser.verified?.nationalIDVer !== ID_STATUS.pending) {
      throw new ValidationError(
        "Verification cannot proceed. Please submit the required documents"
      );
    }

    await this.userRepository.updateById(record.user, {
      "verified.nationalIDVer": ID_STATUS.verified,
    });

    this.#notify(targetUser, approvedEmail(targetUser.name));
  }

  /**
   * Revert a verification, deleting the stored documents with it.
   *
   * The record is removed rather than kept: the member has to submit again, and
   * holding photographs of a government ID for a check that was reverted is
   * data we have no reason to keep.
   */
  async revert({ adminId, verificationId }) {
    await this.#requireAdmin(adminId);

    const record = await this.verificationRepository.deleteById(verificationId);
    if (!record) throw new NotFoundError("Verification record not found");

    const targetUser = await this.userRepository.findById(record.user);
    if (!targetUser) throw new NotFoundError("Target user not found");

    if (targetUser.verified?.nationalIDVer === ID_STATUS.none) {
      throw new ValidationError(
        "Verification cannot proceed. Please submit the required documents"
      );
    }

    await this.userRepository.updateById(record.user, {
      "verified.nationalIDVer": ID_STATUS.none,
    });

    this.#notify(targetUser, revertedEmail(targetUser.name));
  }

  async #loadSubmission(verificationId) {
    const record = await this.verificationRepository.findById(verificationId);
    if (!record) throw new NotFoundError("Verification record not found");

    const targetUser = await this.userRepository.findById(record.user);
    if (!targetUser) throw new NotFoundError("Target user not found");

    return { record, targetUser };
  }

  /**
   * Tell the member what an admin decided.
   *
   * Fire-and-forget: the decision is already recorded, and a mail outage must
   * not make the admin think the review failed and repeat it.
   */
  #notify(user, { subject, body }) {
    this.sendEmail(user.email, subject, body).catch((error) =>
      console.error("Failed to send verification email:", error)
    );
  }
}

export default IdentityVerificationService;
