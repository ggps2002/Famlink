import { BaseController } from "../../core/http/BaseController.js";
import { toSessionPayload } from "./auth.presenter.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  wantsCookieTransport,
} from "./refreshCookie.js";

/**
 * The auth endpoints.
 *
 * Response bodies reproduce the originals, including the `status` field
 * duplicated inside several of them — the frontend reads `data.status` in
 * places, so it is part of the contract rather than noise.
 */
export class AuthController extends BaseController {
  constructor({ authService }) {
    super();
    this.authService = authService;
  }

  /**
   * The sign-in response, with the refresh token routed to wherever this client
   * asked for it.
   *
   * Three endpoints mint a session — login, OTP verification and refresh — and
   * before this each shaped its own response. They must not diverge: one of them
   * forgetting to strip `refreshToken` from the body would put a seven-day
   * credential back in reach of any script on the page, and nothing in the
   * response shape would look wrong.
   *
   * See refreshCookie.js for why the caller chooses rather than the server.
   */
  #sessionPayload(req, res, user, tokens) {
    if (!wantsCookieTransport(req)) return toSessionPayload(user, tokens);

    setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiry);

    // `refreshTokenExpiry` stays: it is not a credential, and the client uses it
    // to know how long the session has left. Only the token itself is withheld.
    const { refreshToken: _inCookieInstead, ...withoutRefreshToken } = tokens;
    return toSessionPayload(user, withoutRefreshToken);
  }

  /**
   * Whether an address can be registered.
   *
   * This is an enumeration oracle by construction — it exists to answer "is
   * this email taken", and the signup form needs that answer to tell someone
   * their address is already registered instead of failing opaquely on submit.
   *
   * So the exposure is not removed, it is priced: the route is rate limited
   * (auth.module.js), which is the difference between a person checking their
   * own address and a script walking a list of a million. The response shape is
   * unchanged because the signup form switches on the 400.
   */
  async checkUser(req, res) {
    const available = await this.authService.isEmailAvailable(req.body.email);

    if (!available) {
      return res.status(400).send({ status: 400, message: "Email already exists" });
    }
    return res.status(200).send({ status: 200, message: "Email not exists" });
  }

  async register(req, res) {
    await this.authService.register(req.body);
    return res.status(200).json({ status: 200, message: "User registered successfully" });
  }

  async login(req, res) {
    const { user, tokens } = await this.authService.login(req.body);
    return this.ok(res, this.#sessionPayload(req, res, user, tokens));
  }

  /**
   * Renew a session.
   *
   * The cookie is preferred and the body is the fallback, in that order,
   * because both have to work at once: this repository's frontend presents a
   * cookie and the admin console still posts the token. `readRefreshCookie`
   * returns null unless the opt-in header is present, so a cross-site forgery
   * carrying the cookie automatically is read as having presented nothing.
   */
  async refreshToken(req, res) {
    const presented = readRefreshCookie(req) ?? req.body?.refreshToken;
    const { user, tokens } = await this.authService.refresh(presented);
    return this.ok(res, this.#sessionPayload(req, res, user, tokens));
  }

  /**
   * End this session on the server, not just in the browser.
   *
   * There was no such endpoint, because there was nothing a client could not do
   * for itself: signing out cleared Redux and purged localStorage, and the
   * token went with it. That is no longer true in either direction — the cookie
   * is httpOnly so JavaScript cannot delete it, and the stored row stayed valid
   * for seven days after every "sign out" regardless of what the browser did
   * with its copy.
   *
   * Always 200. A logout that reports failure gives the caller nothing it can
   * act on and leaves a member staring at an error while trying to leave; an
   * unknown or already-revoked token means the session is gone, which is the
   * outcome that was asked for.
   */
  async logout(req, res) {
    const presented = readRefreshCookie(req) ?? req.body?.refreshToken;

    await this.authService.logout(presented);
    clearRefreshCookie(res);

    return this.message(res, "Signed out");
  }

  async sendOtp(req, res) {
    await this.authService.sendEmailOtp(req.userId);
    return this.message(res, "OTP sent to your email.");
  }

  async verifyOtp(req, res) {
    const { user, tokens } = await this.authService.verifyEmailOtp({
      userId: req.userId,
      oneTimePass: req.body.oneTimePass,
    });

    return this.ok(res, {
      message: "Email verified successfully",
      ...this.#sessionPayload(req, res, user, tokens),
    });
  }

  async resendOtp(req, res) {
    await this.authService.resendEmailOtp(req.userId);
    return this.message(res, "OTP resent successfully");
  }

  // forgotPassword / resetPassword (the OTP reset pair) were removed — see the
  // note in auth.service.js. The link-based handlers below are the reset flow.

  async emailResendOtp(req, res) {
    await this.authService.resendEmailOtpByEmail(req.body.email);

    // The same 200 whether or not that address has an unverified account: the
    // service returns silently for an unknown one, and a different answer here
    // would put the oracle back.
    return this.message(res, "If that address needs verifying, a new code is on its way.");
  }

  async requestPasswordReset(req, res) {
    await this.authService.requestPasswordReset(req.body.email);

    // The same 200 whether or not the address has an account — the service
    // returns silently for an unknown one so this cannot be used to discover
    // which emails are members.
    return this.message(
      res,
      "If an account exists for that email, a password reset link is on its way."
    );
  }

  async resetPasswordToken(req, res) {
    await this.authService.resetPasswordWithToken(req.body);
    return this.message(res, "Password reset successfully. You can now log in.");
  }
}

export default AuthController;
