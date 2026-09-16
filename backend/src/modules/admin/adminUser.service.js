import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";

/** The only two statuses this endpoint may set. */
const SETTABLE_STATUSES = ["Active", "Block"];

/**
 * Admin actions against a single member's account.
 *
 * Every method here acts on somebody else's record — blocking them, changing
 * their email, resetting their password, removing their card. The admin check
 * is middleware on the router (see adminUser.module.js) rather than repeated in
 * each method, which is what the original did thirteen times.
 */
export class AdminUserService extends BaseService {
  async #requireTarget(userId, message = "User not found") {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError(message);
    return user;
  }

  /**
   * Block or reactivate an account.
   *
   * The deactivation email gives a generic reason on purpose. The moderator's
   * actual note is an internal field (see INTERNAL_USER_FIELDS in
   * user.privacy.js) and repeating it here would tell the member they were
   * reported, roughly when, and by how many people.
   */
  async setStatus({ userId, status }) {
    if (!SETTABLE_STATUSES.includes(status)) {
      throw new ValidationError("Invalid status value. Must be 'Active' or 'Block'.");
    }

    const user = await this.userRepository.updateById(userId, { status });
    if (!user) throw new NotFoundError("User not found");

    if (status === "Block" && user.email) {
      // Non-blocking: the account is already blocked, and a mail failure must
      // not make an admin think the block did not take and repeat it.
      this.sendAccountDeactivatedEmail(
        user.email,
        user.name,
        "a violation of our community guidelines"
      ).catch((error) => console.error("Failed to send account-deactivated email:", error));
    }

    return user;
  }

  /**
   * Edit a member's identity fields from the console.
   *
   * Note what is missing: changing `email` is not checked for uniqueness and
   * does not clear `verified.emailVer`. Both differ from what the member's own
   * settings screen does (see AccountSettingsService), so an admin edit can
   * produce a second account on an address already in use, and can leave a
   * "verified" badge attached to an address nobody proved they own. Preserved
   * as-is; worth fixing, but it changes what the console can do.
   */
  async edit({ userId, name, email, dob, location, zipCode }) {
    if (!userId) throw new ValidationError("User ID is required");

    const user = await this.#requireTarget(userId);

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (dob !== undefined) {
      const date = new Date(dob);
      if (Number.isNaN(date.getTime())) {
        throw new ValidationError("Invalid date format for dob");
      }
      user.dob = date;
    }
    if (location !== undefined) user.location = location;
    if (zipCode !== undefined) user.zipCode = zipCode;

    await user.save();
    return user;
  }

  /**
   * Set a member's password on their behalf.
   *
   * No current-password check, by design — this is the "member is locked out
   * and contacted support" path. It is also the single most dangerous endpoint
   * in the console: it hands an admin the ability to take over any account
   * silently, and nothing tells the member it happened.
   */
  async setPassword({ userId, password }) {
    const user = await this.#requireTarget(userId, "User not found.");

    if (!password) throw new ValidationError("New password is required.");

    user.password = await this.credentials.hashPassword(password);
    await user.save();
  }

  /* ─────────────────────────────── saved cards ────────────────────────────── */

  async listCards(userId) {
    const user = await this.#requireTarget(userId, "User not found!");

    if (!user.stripeId) throw new NotFoundError("No Cards found for the user!");

    return this.stripe.listCards(user.stripeId);
  }

  /**
   * Remove a member's saved card.
   *
   * As on the member-facing route, the payment method is detached by id without
   * checking it belongs to this customer — the `userId` in the path is only
   * used to confirm a Stripe customer exists. Carried over rather than changed.
   */
  async deleteCard({ userId, paymentMethodId }) {
    const user = await this.#requireTarget(userId, "User not found!");

    if (!user.stripeId) {
      throw new ValidationError("No Stripe customer found for this user.");
    }

    await this.stripe.detachPaymentMethod(paymentMethodId);
  }
}

export default AdminUserService;
