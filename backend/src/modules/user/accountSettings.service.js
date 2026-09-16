import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";

/**
 * The only two email categories.
 *
 * Anything else in a request body is ignored rather than written, so a stale
 * client cannot resurrect one of the eight per-topic flags these replaced.
 */
export const EMAIL_CATEGORIES = ["platformUpdates", "newsletter"];

/**
 * Changes a member makes to their own account from the Settings screen.
 *
 * The pattern worth noticing: changing a contact detail invalidates its
 * verification. A new email clears `emailVer`, a new phone clears `phoneVer`
 * *and* switches SMS off — otherwise editing the field would be a way to keep a
 * "verified" badge that was earned by a number you no longer own.
 */
export class AccountSettingsService extends BaseService {
  async #requireUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found.");
    return user;
  }

  /**
   * Change the sign-in address.
   *
   * The current address is required and checked even though the caller is
   * already authenticated: it makes an unattended session unable to silently
   * move an account to an attacker's inbox.
   */
  async changeEmail({ userId, currentEmail, newEmail }) {
    const user = await this.#requireUser(userId);

    if (!currentEmail || !newEmail) {
      throw new ValidationError("Current email and new email are required.");
    }
    if (user.email !== currentEmail) {
      throw new ValidationError("The current email does not match the user's email.");
    }
    if (currentEmail === newEmail) {
      throw new ValidationError("New email must be different from the current email.");
    }
    if (await this.userRepository.exists({ email: newEmail })) {
      throw new ValidationError("New email is already in use.");
    }

    user.email = newEmail;
    // The new address is unproven until it is verified again.
    user.verified.emailVer = false;
    await user.save();
  }

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await this.#requireUser(userId);

    if (!currentPassword || !newPassword) {
      throw new ValidationError("Current password and new password are required.");
    }

    if (!(await this.credentials.verifyPassword(currentPassword, user.password))) {
      throw new ValidationError("Current password is incorrect.");
    }
    if (currentPassword === newPassword) {
      throw new ValidationError("New password must be different from the current password.");
    }

    user.password = await this.credentials.hashPassword(newPassword);
    await user.save();
  }

  async setSmsNotifications({ userId, sms }) {
    const user = await this.#requireUser(userId);

    // Strictly boolean: a truthy string would silently opt someone in.
    if (typeof sms !== "boolean") throw new ValidationError("Invalid sms value");

    user.notifications.sms = sms;
    await user.save();

    return user.notifications.sms;
  }

  /**
   * Change the phone number, and hand back a fresh session.
   *
   * The token pair is reissued because the response carries the updated user
   * document, and the client replaces its whole auth slice from it.
   */
  async changePhone({ userId, phoneNo }) {
    const user = await this.#requireUser(userId);

    if (!phoneNo) throw new ValidationError("Phone number is required");

    user.phoneNo = phoneNo;
    // Both cleared: the badge belonged to the old number, and SMS must not keep
    // going to a number this account has not proven it owns.
    user.verified.phoneVer = false;
    user.notifications.sms = false;
    await user.save();

    const tokens = await this.tokenService.issuePair(user._id.toString());
    return { user, tokens };
  }

  /**
   * Set the email categories that should be ON. Anything absent is switched off.
   *
   * Deliberately not gated on `verified.emailVer`: someone who never confirmed
   * their address is exactly the person most likely to want out, and refusing
   * the opt-out because we cannot prove they own the inbox we are mailing is
   * backwards. Opting *in* carries no risk either — we only ever send to the
   * address already on the account.
   */
  async setEmailNotifications({ userId, notifications }) {
    if (!Array.isArray(notifications)) {
      throw new ValidationError("notifications must be an array of category keys");
    }

    const user = await this.#requireUser(userId);

    user.notifications = user.notifications || {};
    user.notifications.email = Object.fromEntries(
      EMAIL_CATEGORIES.map((key) => [key, notifications.includes(key)])
    );
    // Mongoose does not detect the reassignment of a nested object on its own.
    user.markModified("notifications.email");

    await user.save();

    return { email: user.notifications.email };
  }
}

export default AccountSettingsService;
