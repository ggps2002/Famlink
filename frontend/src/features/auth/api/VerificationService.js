import { HttpService } from "@shared/api/HttpService";

/**
 * Email and SMS verification.
 *
 * The two channels have identical shapes under different prefixes, so they share
 * a class and differ only in the prefix passed to the private helper. Keeping
 * them together makes it obvious that a change to one usually belongs in both —
 * they were separate slices written months apart and had already drifted in
 * their error handling.
 */
export class VerificationService extends HttpService {
  #send(prefix, action, body) {
    return this.post(`/${prefix}-verification/${action}`, body);
  }

  sendEmailOtp(body) {
    return this.#send("email", "send-otp", body);
  }

  verifyEmailOtp(body) {
    return this.#send("email", "verify-otp", body);
  }

  resendEmailOtp(body) {
    return this.#send("email", "resend-otp", body);
  }

  sendSmsOtp(body) {
    return this.#send("sms", "send-otp", body);
  }

  verifySmsOtp(body) {
    return this.#send("sms", "verify-otp", body);
  }

  resendSmsOtp(body) {
    return this.#send("sms", "resend-otp", body);
  }
}

export const verificationService = new VerificationService();
export default verificationService;
