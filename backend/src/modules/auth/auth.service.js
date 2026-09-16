import { BaseService } from "../../core/http/BaseService.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../core/errors/index.js";
import { REFERRAL_PROTECTED_FIELDS } from "../referral/referral.util.js";

/**
 * The single answer every failed sign-in gets.
 *
 * One constant rather than the same string typed at three call sites, because
 * the security property here is that the three are indistinguishable — and two
 * strings that must stay identical forever are better as one.
 */
const INVALID_CREDENTIALS = "Invalid email or password";

/**
 * Registration, sign-in, and the credential flows around them.
 *
 * The shape to notice: every path that produces a session goes through
 * `#startSession`, which applies the account status gate and then mints tokens.
 * Previously each of the four entry points did its own version of that, and
 * they disagreed — which is how a blocked account could still sign in through
 * Google or OTP verification.
 */
export class AuthService extends BaseService {
  /**
   * Strip referral fields a client must never set.
   *
   * Registration spreads the request body straight into the new document, so
   * without this a client could sign up already holding a chosen code, a forged
   * `referredBy`, or a `referralMatchingUntil` far in the future and walk
   * straight past the match gate. The code a signup link carried arrives
   * separately as `referredByCode`.
   */
  static #stripReferralFields(userData) {
    for (const field of REFERRAL_PROTECTED_FIELDS) delete userData[field];
    delete userData.referredByCode;
    return userData;
  }

  /** Location arrives as a JSON string from multipart forms, or malformed. */
  static #normaliseLocation(userData) {
    try {
      if (userData.location && typeof userData.location === "string") {
        userData.location = JSON.parse(userData.location);
      }
      if (!userData.location || typeof userData.location !== "object") {
        delete userData.location;
      }
    } catch {
      delete userData.location;
    }
    return userData;
  }

  async isEmailAvailable(email) {
    const existing = await this.userRepository.findOne({ email });
    return !existing;
  }

  /* ─────────────────────────────── registration ─────────────────────────── */

  async register(body) {
    const { email, name, password, registeredVia, imageFile, referredByCode } = body;

    if (await this.userRepository.findOne({ email })) {
      throw new ConflictError("Email already exists");
    }

    const isGoogle = registeredVia === "google";

    const userData = AuthService.#normaliseLocation(
      AuthService.#stripReferralFields({
        ...body,
        name: this.capitalizeUsername(name),
        // A Google account's address is already proven by Google.
        verified: isGoogle ? { emailVer: true } : false,
        ActiveAt: new Date(),
      })
    );

    if (!isGoogle && password && typeof password === "string") {
      // Checked at the one moment it can be: the password is in hand and not
      // yet hashed. Never applied on login — accounts created before this rule
      // existed must still be able to sign in.
      this.credentials.assertPasswordAcceptable(password);
      userData.password = await this.credentials.hashPassword(password);
    }

    if (imageFile && imageFile.length > 0) {
      const buffer = Buffer.from(imageFile.split(",")[1], "base64");
      userData.imageUrl = await this.uploadImage(buffer, userData.email, "new user");
    }

    const user = await this.userRepository.create(userData);

    // Mints this account's own share code and links whoever referred it.
    // Nothing is paid out here — the referrer's free month is granted once this
    // user finishes their profile, so a throwaway signup earns nobody anything.
    await this.applyReferral(user, referredByCode);

    this.#afterRegistration(user, body);

    return user;
  }

  /**
   * Bookkeeping and greetings that must never fail a signup.
   *
   * All three swallow their own errors: the account already exists, and none of
   * this is a reason to tell someone their registration failed. The mail one is
   * now much less likely to fire at all — queueing is one indexed insert, where
   * it used to be a whole SMTP conversation held open inside this call.
   */
  #afterRegistration(user, body) {
    // They converted, so the abandoned-onboarding nudge must never reach them.
    this.retireOnboardingLead(user.email);

    // The waitlist is "everyone who completed onboarding", which includes people
    // who went on to create an account — they are the converted rows, and
    // without this the admin screen would only show the ones who dropped out.
    this.recordWaitlistEntry({
      email: user.email,
      name: user.name,
      userType: user.type,
      location: { ...(user.location?.toObject?.() ?? user.location), zip: user.zipCode },
      source: "registration",
      // Only an explicit true counts. A form that doesn't ask the question must
      // not be read as consent to a marketing email.
      notifyConsent: body?.notifyConsent === true || body?.emailNotifications === true,
      userId: user._id,
      onboardingCompletedAt: user.createdAt || new Date(),
    });

    // Queued on account creation and deliberately NOT gated on email
    // verification: the address exists, so we greet them like any real service.
    //
    // Also queued again when they verify their OTP, because either moment can
    // be the one where the account first becomes usable. The two are reconciled
    // by a dedupe key rather than by picking one — see sendWelcomeEmail.
    //
    // The catch now covers only a failure to *write the row*. A mail host that
    // is down no longer reaches this code at all: the message waits on the
    // queue and the dispatcher delivers it when the host returns.
    this.emailService
      .sendWelcomeEmail(user.email, user.name, user)
      .catch((error) => console.error("[auth] could not queue welcome email:", error));
  }

  /* ──────────────────────────────── sign-in ─────────────────────────────── */

  /** Apply the status gate, mint a pair, and record the sign-in. */
  async #startSession(user, { previousRefreshToken = null, countAsLogin = true } = {}) {
    await this.accountPolicy.assertMaySignIn(user);

    const tokens = await this.tokenService.issuePair(user._id.toString(), previousRefreshToken);

    if (countAsLogin) this.#recordLogin(user);

    return tokens;
  }

  /**
   * Timestamp, lifetime count, and distinct active days.
   *
   * `activeDays` only increments when the previous login was on an earlier
   * calendar day, so six sign-ins on Monday count as one active day rather
   * than six — the difference between "engaged" and "having trouble staying
   * signed in". Fire-and-forget: bookkeeping must not fail a login.
   */
  #recordLogin(user) {
    const now = new Date();
    const previous = user.lastLogin ? new Date(user.lastLogin) : null;
    const isNewDay = !previous || previous.toDateString() !== now.toDateString();

    this.userRepository
      .updateById(user._id, {
        $set: { lastLogin: now },
        $inc: { loginCount: 1, ...(isNewDay ? { activeDays: 1 } : {}) },
      })
      .catch((error) => console.error("[auth] failed to record login:", error));
  }

  async login({ email, password }) {
    const user = await this.userRepository.findOne(
      { email },
      { populate: { path: "reviews.userId", select: "name imageUrl" } }
    );

    // ── One answer for "no such account" and "wrong password" ───────────────
    //
    // This used to 404 "User not found" for an unknown address and 401 "Invalid
    // password" for a known one, which turns the login form into a membership
    // oracle: submit an address with any password and the status code says
    // whether that person has an account here. On a platform whose members are
    // families with young children and the people who care for them, "does this
    // person use FamLink" is not ours to confirm to an anonymous caller.
    //
    // Both cases now produce the same 401 and the same wording.
    if (!user) throw new UnauthorizedError(INVALID_CREDENTIALS);

    // A Google account has no password to check — the identity was established
    // by Google at registration.
    if (user.registeredVia === "google") {
      const tokens = await this.#startSession(user);
      return { user, tokens };
    }

    if (!password) throw new UnauthorizedError(INVALID_CREDENTIALS);

    if (!(await this.credentials.verifyPassword(password, user.password))) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const tokens = await this.#startSession(user);
    return { user, tokens };
  }

  /**
   * Exchange a refresh token for a fresh pair.
   *
   * Runs the same status gate as sign-in — see AccountPolicy for why that is
   * what makes a suspension take effect rather than waiting for the user to
   * choose to log in again.
   */
  async refresh(refreshToken) {
    if (!refreshToken) throw new ValidationError("No token provided");

    const userId = await this.tokenService.resolveRefreshToken(refreshToken);

    const user = await this.userRepository.findById(userId, {
      populate: { path: "reviews.userId", select: "name imageUrl" },
    });
    if (!user) throw new NotFoundError("User not found");

    // Deliberately not counted as a login: a refresh is not a sign-in, and
    // counting it would inflate loginCount for anyone who leaves a tab open.
    // lastLogin is still touched, so someone actively using the app is not
    // chased by the re-engagement email.
    const tokens = await this.#startSession(user, {
      previousRefreshToken: refreshToken,
      countAsLogin: false,
    });

    this.userRepository
      .updateById(user._id, { $set: { lastLogin: new Date() } })
      .catch((error) => console.error("[auth] failed to update lastLogin:", error));

    return { user, tokens };
  }

  /**
   * End the session the given refresh token represents.
   *
   * Deliberately silent about everything. It takes whatever the browser
   * presented — which may be nothing, may be expired, may be a token that was
   * rotated away ten minutes ago — and its only job is to make sure that after
   * it returns, that token names no session. Every one of those cases already
   * satisfies that, so none of them is an error worth raising: the alternative
   * is a "sign out" that fails, which helps nobody and tells an attacker
   * probing tokens which ones were real.
   *
   * One session, not all of them. Signing out on a shared laptop should not
   * close the member's own phone.
   */
  async logout(refreshToken) {
    if (!refreshToken) return;

    try {
      await this.tokenService.revokeRefreshToken(refreshToken);
    } catch (error) {
      console.error("[auth] failed to revoke refresh token on logout:", error);
    }
  }

  /* ──────────────────────── email verification (OTP) ─────────────────────── */

  async sendEmailOtp(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    // Preserved: the original answered 404 here, not 400.
    if (user.verified?.emailVer) throw new NotFoundError("User already varified");

    const { code, hash, expiresAt } = this.credentials.generateOtp();
    // The hash is stored, the raw code is emailed — a database dump must not
    // contain live verification codes.
    user.otp = hash;
    user.otpExpiry = expiresAt;
    user.otpAttempts = 0;
    await user.save();

    this.emailService.sendOtpEmail(user.email, code);
  }

  async verifyEmailOtp({ userId, oneTimePass }) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (user.verified?.emailVer) throw new ValidationError("User already verified");

    // Expiry first: a lapsed code is not a wrong guess, and counting it as one
    // would let someone burn a victim's attempts by waiting.
    if (this.credentials.isOtpExpired(user.otpExpiry)) {
      throw new ValidationError("OTP expired");
    }

    // Six digits is a million possibilities, which is only out of reach if the
    // number of guesses is bounded. Without this the code is brute-forceable in
    // minutes — the route's rate limit slows that down but is per-IP, and IPs
    // are cheap. The counter is per-account, so it holds regardless.
    if ((user.otpAttempts || 0) >= this.credentials.security.otpMaxAttempts) {
      throw new ValidationError(
        "Too many incorrect codes. Please request a new one."
      );
    }

    if (!this.credentials.otpMatches(oneTimePass, user.otp)) {
      // Persisted before throwing, or the counter never survives the request
      // that incremented it.
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      throw new ValidationError("Invalid OTP");
    }

    user.verified.emailVer = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    // Verifying logs the user in — seed lastLogin so a brand-new account has an
    // activity baseline even if it never refreshes.
    user.lastLogin = new Date();
    await user.save();

    // Deduped against the one queued at registration, so verifying does not
    // send a second copy.
    this.emailService
      .sendWelcomeEmail(user.email, user.name, user)
      .catch((error) => console.error("[auth] could not queue welcome email:", error));

    const tokens = await this.#startSession(user, { countAsLogin: false });
    return { user, tokens };
  }

  /** Re-send the verification code, but only once the previous one has lapsed. */
  async resendEmailOtp(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    if (user.verified?.emailVer) throw new ValidationError("User already verified");

    this.#assertOtpCooldownElapsed(user);

    const { code, hash, expiresAt } = this.credentials.generateOtp();
    user.otp = hash;
    user.otpExpiry = expiresAt;
    // A fresh code gets a fresh budget — otherwise a user who genuinely
    // mistyped five times could never recover without support.
    user.otpAttempts = 0;
    await user.save();

    this.emailService.sendOtpEmail(user.email, code);
  }

  /**
   * The only throttle on code issuance: a new one cannot be requested while the
   * previous is still valid.
   */
  #assertOtpCooldownElapsed(user) {
    if (user.otpExpiry && new Date() < new Date(user.otpExpiry)) {
      throw new ValidationError(
        "OTP is still valid, please wait before requesting a new one."
      );
    }
  }

  /**
   * Re-send a verification code to an address, for someone not signed in.
   *
   * Returns silently for an unknown address rather than 404ing. Unauthenticated
   * and takes an arbitrary email, so answering truthfully makes it a membership
   * oracle: anyone could test a list of addresses and learn which belong to
   * families and caregivers on this platform. The caller is told the same thing
   * either way, exactly as `requestPasswordReset` already does.
   */
  async resendEmailOtpByEmail(email) {
    const user = await this.userRepository.findOne({ email });
    if (!user) return;
    if (user.verified?.emailVer) return;

    this.#assertOtpCooldownElapsed(user);

    const { code, hash, expiresAt } = this.credentials.generateOtp();
    user.otp = hash;
    user.otpExpiry = expiresAt;
    user.otpAttempts = 0;
    await user.save();

    this.emailService.sendOtpEmail(user.email, code);
  }

  /* ───────────────────────────── password reset ─────────────────────────── */
  //
  // ── The OTP reset flow has been REMOVED. Do not reintroduce it. ───────────
  //
  // `forgotPassword` / `resetPasswordWithOtp` used to live here. The second one
  // read:
  //
  //     const user = await this.userRepository.findOne({ otp });
  //
  // A lookup by the code ALONE, not scoped to an email. With a 4-digit code
  // that is 10,000 possibilities and no attempt limit, so submitting codes in a
  // loop did not attack one chosen account — it reset whichever account
  // happened to be holding the code that matched. Any user with a reset in
  // flight, including an admin. That is unauthenticated account takeover, and
  // it is not fixable by lengthening the code: the flaw is the unscoped lookup.
  //
  // The link-based flow below already does this correctly — a 32-byte
  // crypto-random token, stored only as a SHA-256 hash, expiring in an hour,
  // and matched against one specific user row. It is also the only one the
  // frontend actually calls: ForgotPassword.jsx uses `requestPasswordReset` and
  // ResetPassword.jsx uses `resetPasswordWithToken`. The OTP endpoints had no
  // caller at all, so they were pure attack surface.
  //
  // Email verification still uses one-time codes (`sendEmailOtp` above). That
  // is a different job — it proves an address is reachable, it is scoped to an
  // already-authenticated user, and it no longer grants anything on its own.

  /**
   * Link-based reset: email a one-time link that expires in an hour.
   *
   * Always succeeds from the caller's point of view, whether or not the address
   * has an account — otherwise the endpoint is an oracle for which emails are
   * members.
   */
  async requestPasswordReset(email) {
    if (!email) throw new ValidationError("Email is required.");

    const user = await this.userRepository.findOne({ email });
    if (!user) return;

    const { raw, hash, expiresAt } = this.credentials.generateResetToken();

    // Only the hash is persisted; the raw value exists solely in the link.
    user.resetPasswordToken = hash;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    const resetUrl = `${this.clientUrl}/reset-password?token=${raw}&email=${encodeURIComponent(
      user.email
    )}`;
    const requestTime = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    // Non-blocking: a send failure must not be reported back to the caller,
    // since that would reintroduce the oracle this endpoint avoids.
    this.emailService
      .sendPasswordResetEmail(user.email, user.name, resetUrl, requestTime)
      .catch((error) => console.error("[auth] password-reset email failed:", error));
  }

  /** Link-based reset: verify the token hash and expiry, then set the password. */
  async resetPasswordWithToken({ token, newPassword }) {
    if (!token || !newPassword) {
      throw new ValidationError("Token and new password are required.");
    }

    const user = await this.userRepository.findOne({
      resetPasswordToken: this.credentials.hashResetToken(token),
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new ValidationError("This reset link is invalid or has expired.");
    }

    this.credentials.assertPasswordAcceptable(newPassword);

    user.password = await this.credentials.hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await this.#revokeAllSessions(user._id);
  }

  /**
   * Drop every refresh token this account holds.
   *
   * Called whenever the password changes, which is the whole point of changing
   * it under duress: someone resetting their password because they think
   * another person is in their account expects that person to be thrown out.
   * Without this they were not — a stolen refresh token stayed valid for its
   * full 7 days, so the reset accomplished nothing against the attacker who
   * already had a session.
   *
   * `revokeAllForUser` has existed on the repository since the refactor and had
   * no callers anywhere in the codebase; this is the caller it was written for.
   *
   * Failure is logged, not thrown: the password has already been changed by the
   * time we get here, and reporting an error would tell the user their reset
   * failed when it did not. A revocation that does not happen is worth an alert,
   * not a lie to the person who just recovered their account.
   */
  async #revokeAllSessions(userId) {
    try {
      await this.tokenService.revokeAllForUser(userId);
    } catch (error) {
      console.error("[auth] failed to revoke sessions after password change:", error);
    }
  }
}

export default AuthService;
