import { BaseService } from "../../core/http/BaseService.js";
import { ConflictError, NotFoundError, ValidationError } from "../../core/errors/index.js";

/**
 * Phone verification by SMS one-time code.
 *
 * Structurally the twin of the email OTP flow in AuthService, with one extra
 * rule: a verified number may only belong to one account, so the same phone
 * cannot be used to make a second "verified" identity.
 *
 * SMS send failures are logged and swallowed, preserved from the original. The
 * code is already stored by then, so a Twilio outage leaves the user able to
 * complete verification if the message eventually arrives — and failing the
 * request would lose the stored code without clearing it.
 */
export class PhoneVerificationService extends BaseService {
  /**
   * Load the caller and confirm they still need verifying.
   *
   * @param {"send"|"verify"} stage — the original answered 404 for an
   *   already-verified user on the send path and 400 on the others. Both are
   *   preserved rather than unified, because the client branches on status.
   */
  async #requireUnverifiedUser(userId, stage) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (user.verified?.phoneVer) {
      throw stage === "send"
        ? new NotFoundError("User already varified")
        : new ValidationError("User already verified");
    }

    return user;
  }

  /**
   * A missing phone number is a 400, not a 500.
   *
   * The original wrote a 500 body here without returning, so execution
   * continued and the handler went on to send a second response — an
   * ERR_HTTP_HEADERS_SENT crash rather than the error it meant to report. That
   * is a bug rather than a behaviour worth preserving, so it is fixed.
   */
  static #requirePhone(phoneNo) {
    if (!phoneNo) throw new ValidationError("Failed to find a phone number");
    return phoneNo;
  }

  async sendCode({ userId, phoneNo }) {
    PhoneVerificationService.#requirePhone(phoneNo);
    const user = await this.#requireUnverifiedUser(userId, "send");

    // A verified number belongs to exactly one account. Without this the same
    // phone could verify any number of identities.
    const claimedElsewhere = await this.userRepository.exists({
      _id: { $ne: userId },
      phoneNo,
      "verified.phoneVer": true,
    });
    if (claimedElsewhere) {
      throw new NotFoundError("Verified phone number already exist");
    }

    await this.#issueCode(user, phoneNo);
  }

  async resendCode({ userId, phoneNo }) {
    PhoneVerificationService.#requirePhone(phoneNo);
    const user = await this.#requireUnverifiedUser(userId, "verify");

    // The only throttle: a new code cannot be requested while the previous one
    // is still valid.
    if (user.otpExpiry && new Date() < new Date(user.otpExpiry)) {
      throw new ValidationError(
        "OTP is still valid, please wait before requesting a new one."
      );
    }

    await this.#issueCode(user, phoneNo);
  }

  async #issueCode(user, phoneNo) {
    const { code, expiresAt } = this.credentials.generateOtp();

    user.otp = code;
    user.otpExpiry = expiresAt;
    await user.save();

    try {
      await this.smsService.sendOtpSMS(phoneNo, code);
    } catch (error) {
      console.error("[sms] send failed:", error?.message || error);
    }
  }

  /**
   * Consume the code, record the number, and hand back a fresh session —
   * verifying is treated as a sign-in.
   */
  async verifyCode({ userId, oneTimePass, phoneNo }) {
    PhoneVerificationService.#requirePhone(phoneNo);
    const user = await this.#requireUnverifiedUser(userId, "verify");

    if (user.otp !== oneTimePass) throw new ValidationError("Invalid OTP");
    if (this.credentials.isOtpExpired(user.otpExpiry)) {
      throw new ValidationError("OTP expired");
    }

    user.verified.phoneVer = true;
    user.phoneNo = phoneNo;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const tokens = await this.tokenService.issuePair(user._id.toString());
    return { user, tokens };
  }
}

export default PhoneVerificationService;
