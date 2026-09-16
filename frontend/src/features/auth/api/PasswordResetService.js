import { HttpService } from "@shared/api/HttpService";

/**
 * Password recovery.
 *
 * One flow: `requestReset` mails a link carrying a crypto-random token, and
 * `resetWithToken` redeems it.
 *
 * There used to be a second, OTP-based variant here (`forgotPassword` →
 * `resetPassword`). It was removed on 2026-09-12 along with its backend routes:
 * the server looked the user up by the submitted code ALONE, so guessing codes
 * reset whichever account happened to hold the match. No component ever called
 * it. See SECURITY.md.
 */
export class PasswordResetService extends HttpService {
  requestReset(body) {
    return this.post("/auth/request-password-reset", body);
  }

  resetWithToken(body) {
    return this.post("/auth/reset-password-token", body);
  }

  resendEmailOtp(body) {
    return this.post("/auth/email-resend-otp", body);
  }
}

export const passwordResetService = new PasswordResetService();
export default passwordResetService;
