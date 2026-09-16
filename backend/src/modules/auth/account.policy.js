import { ForbiddenError, NotFoundError } from "../../core/errors/index.js";

/**
 * Whether an account may hold a session.
 *
 * There are three ways into the app — password login, Google login, and OTP
 * verification — plus token refresh, which is a fourth in every way that
 * matters. The status check originally lived in only one of them, so a blocked
 * account could still get a token through the others. Having it as one object
 * with one entry point is the fix; anything that mints a session calls it.
 *
 * Applying it to refresh as well is what gives a suspension teeth. Without it,
 * blocking someone already signed in does nothing for up to the refresh
 * lifetime: they never hit login again, they just keep refreshing.
 */
export class AccountPolicy {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  /**
   * Throws if this account may not sign in. Returns nothing when it may.
   *
   * Mutates in exactly one case — an expired suspension, which it lifts. That
   * happens here rather than in a nightly job because the only moment the
   * answer matters is when someone tries to get in, and a job would leave a
   * user locked out for up to a day after their suspension ended.
   */
  async assertMaySignIn(user) {
    if (user.status === "Deleted") {
      // Deliberately the same answer a nonexistent account gets. Confirming
      // that a deleted address once had an account is information nobody
      // signing in needs, and exactly what someone probing for a person's
      // membership is looking for.
      throw new NotFoundError("User not found");
    }

    if (user.status === "Block") {
      throw new ForbiddenError(
        "Your account has been blocked. Please contact support."
      );
    }

    if (user.status !== "Suspended") return;

    if (user.suspendedUntil && new Date(user.suspendedUntil) <= new Date()) {
      await this.userRepository.updateById(user._id, {
        $set: {
          status: "Active",
          suspendedUntil: null,
          suspendedAt: null,
          moderationReason: null,
        },
      });
      user.status = "Active";
      return;
    }

    const until = user.suspendedUntil
      ? new Date(user.suspendedUntil).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

    // The reason is never quoted — `moderationReason` is the moderator's own
    // wording and can identify whoever reported them.
    throw new ForbiddenError(
      until
        ? `Your account is suspended until ${until}. Please contact support if you think this is a mistake.`
        : "Your account is suspended. Please contact support."
    );
  }
}

export default AccountPolicy;
