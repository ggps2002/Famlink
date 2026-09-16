import { BaseService } from "../../core/http/BaseService.js";
import { ValidationError } from "../../core/errors/index.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Wrong guesses allowed before the code is destroyed. */
const MAX_ATTEMPTS = 3;

/**
 * Pre-account email verification.
 *
 * Distinct from the OTP flow in AuthService: that one verifies the address of
 * an existing member and mints a session. This one runs during signup, before
 * any account exists, and only answers "yes, that address is real".
 */
export class EmailVerificationService extends BaseService {
  static #assertValidEmail(email) {
    if (!email) throw new ValidationError("Email address is required");
    if (!EMAIL_RE.test(email)) throw new ValidationError("Invalid email format");
    return email;
  }

  /**
   * Issue a code, refusing while one is still live.
   *
   * @param {"send"|"resend"} stage — the two paths give different wording for
   *   the same condition; preserved because the client shows the message.
   */
  async issue(email, stage = "send") {
    EmailVerificationService.#assertValidEmail(email);

    if (await this.store.read(email)) {
      throw new ValidationError(
        stage === "send"
          ? "OTP already sent. Please wait before requesting another."
          : "OTP is still active. Please wait."
      );
    }

    const { code } = this.credentials.generateOtp();
    await this.store.issue(email, code);
    await this.emailService.sendOtpEmail(email, code);
  }

  async verify({ email, otp }) {
    if (!email || !otp) throw new ValidationError("Email and OTP are required");
    EmailVerificationService.#assertValidEmail(email);

    const stored = await this.store.read(email);
    if (!stored) throw new ValidationError("OTP expired or not found");

    // Burned rather than merely refused: leaving a guessed-at code alive would
    // let an attacker keep trying by requesting nothing and simply waiting.
    if (stored.attempts >= MAX_ATTEMPTS) {
      await this.store.clear(email);
      throw new ValidationError("Too many attempts. Request a new OTP.");
    }

    // Constant-time rather than `!==`: a plain string compare returns as soon
    // as two characters differ, so how long it takes leaks how much of the code
    // was right. Marginal over a network, and free to remove.
    if (!this.credentials.otpMatches(otp, this.credentials.hashOtp(stored.otp))) {
      await this.store.recordFailedAttempt(email, stored);
      throw new ValidationError("Invalid OTP");
    }

    // Single-use: a correct code is destroyed on success.
    await this.store.clear(email);
  }
}

export default EmailVerificationService;
