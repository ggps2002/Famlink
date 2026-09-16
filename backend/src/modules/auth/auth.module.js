import { RouteModule } from "../../core/http/RouteModule.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { rateLimit } from "../../core/http/middleware/rateLimit.js";
import { upload } from "../../core/http/middleware/upload.js";
import uploadImage from "../../shared/storage/uploadImage.js";
import capitalizeUsername from "../../shared/utils/capitalize.js";
import config from "../../config/index.js";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";
import { AccountPolicy } from "./account.policy.js";
import { CredentialsService } from "./credentials.service.js";
import { refreshTokenRepository } from "./refreshToken.repository.js";
import { userRepository } from "../user/user.repository.js";
import { assignReferralCode, findReferrerByCode } from "../referral/referral.util.js";
import { recordWaitlistEntry } from "../waitlist/waitlist.util.js";
import { leadService } from "../lead/lead.module.js";
import {
  sendOtpEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../../shared/email/email.js";

/**
 * The auth feature and its object graph.
 *
 * Base URL of the frontend, used for the reset link. Falls through the same
 * three env names the original did, in the same order, so an environment that
 * only sets one of them keeps working.
 */
const CLIENT_URL =
  config.urls.client || config.urls.frontend || config.urls.app || "https://www.famlink.care";

/**
 * Link a new account to whoever referred it.
 *
 * Deliberately non-fatal in every branch: a bad, unknown or self-referring code
 * must never fail a registration, so each failure just leaves the user
 * un-referred.
 */
const applyReferral = async (user, referredByCode) => {
  try {
    await assignReferralCode(user._id);
    if (!referredByCode) return;

    const referrer = await findReferrerByCode(referredByCode);
    if (!referrer) return;

    // Self-referral would let anyone mint themselves a month with a second
    // email. There is no defence beyond the email uniqueness we already have,
    // but the trivial version — pasting your own code — is free to block.
    if (String(referrer._id) === String(user._id)) return;

    await userRepository.updateById(user._id, { $set: { referredBy: referrer._id } });
  } catch (error) {
    console.error("[auth] failed to apply referral:", error);
  }
};

/**
 * The ceilings on the auth endpoints.
 *
 * None of these existed: every route below was unlimited, so password guessing,
 * code guessing, account enumeration and mail-bombing a stranger's inbox were
 * all bounded only by how fast a script could send requests.
 *
 * The numbers are chosen to be invisible to a person and ruinous to a script.
 * A real member logs in once or twice and mistypes occasionally; ten attempts
 * in five minutes is already a bad day. A credential-stuffing run needs
 * thousands per minute to be worth running.
 *
 * Windows are per the shared limiter in core/http/middleware/rateLimit.js:
 * Redis-backed so the ceiling holds across every machine, falling back to a
 * per-process counter if Redis is down — a limit that only holds per machine
 * being far better than none.
 */
const emailFromBody = (req) => {
  const email = req.body?.email;
  return typeof email === "string" && email.trim()
    ? `email:${email.trim().toLowerCase()}`
    : null;
};

const limits = {
  // Sign-in, per machine and per account. The per-account one is the lower of
  // the two because an account legitimately receives far fewer attempts than a
  // shared office NAT does.
  loginByIp: rateLimit({
    name: "auth-login-ip",
    limit: 20,
    windowSec: 300,
    message: "Too many sign-in attempts. Please wait a few minutes and try again.",
  }),
  loginByEmail: rateLimit({
    name: "auth-login-email",
    limit: 10,
    windowSec: 300,
    identify: emailFromBody,
    message: "Too many sign-in attempts for this account. Please wait a few minutes.",
  }),

  // Account creation. Generous enough for a family filling the form in twice,
  // tight enough that nobody scripts thousands of accounts to farm referrals.
  register: rateLimit({
    name: "auth-register",
    limit: 10,
    windowSec: 3600,
    message: "Too many accounts created from here. Please try again later.",
  }),

  // The enumeration oracle the signup form needs. Cannot be removed without
  // breaking "this email is already registered", so it is priced instead: a
  // person checks their own address once, a script cannot walk a list.
  checkUser: rateLimit({
    name: "auth-check-user",
    limit: 30,
    windowSec: 600,
    message: "Too many lookups. Please try again shortly.",
  }),

  // Each of these sends an email to an address the CALLER chose. Unlimited,
  // they are a way to flood someone else's inbox using our mail reputation.
  otpSend: rateLimit({
    name: "auth-otp-send",
    limit: 5,
    windowSec: 900,
    message: "Too many codes requested. Please wait before asking for another.",
  }),
  passwordReset: rateLimit({
    name: "auth-password-reset",
    limit: 5,
    windowSec: 900,
    message: "Too many reset requests. Please wait before trying again.",
  }),

  // Code submission. The per-account attempt counter in AuthService is the real
  // bound; this stops a script from burning through accounts looking for one
  // with a code in flight.
  otpVerify: rateLimit({
    name: "auth-otp-verify",
    limit: 10,
    windowSec: 300,
    message: "Too many attempts. Please request a new code.",
  }),

  // Refresh is called legitimately on a schedule by every open tab, so this is
  // loose — it is here to stop a loop, not to shape normal traffic.
  refresh: rateLimit({
    name: "auth-refresh",
    limit: 60,
    windowSec: 300,
    message: "Too many token refreshes. Please try again shortly.",
  }),

  // Its own budget rather than sharing the refresh one: a client stuck in a
  // sign-out loop must not be able to exhaust the allowance that keeps everyone
  // else's open tabs signed in.
  logout: rateLimit({
    name: "auth-logout",
    limit: 30,
    windowSec: 300,
    message: "Too many sign-out attempts. Please try again shortly.",
  }),
};

export class AuthModule extends RouteModule {
  static basePath = "/auth";
  static moduleName = "auth";

  registerRoutes(router) {
    const credentials = new CredentialsService();

    const controller = new AuthController({
      authService: new AuthService({
        userRepository,
        accountPolicy: new AccountPolicy({ userRepository }),
        tokenService: new TokenService({ refreshTokenRepository }),
        credentials,
        emailService: { sendOtpEmail, sendWelcomeEmail, sendPasswordResetEmail },
        capitalizeUsername,
        uploadImage,
        applyReferral,
        recordWaitlistEntry,
        // Registration retires the abandoned-onboarding lead so the nudge email
        // can never chase someone who already signed up.
        retireOnboardingLead: (email) => leadService.retireOnboardingLead(email),
        clientUrl: CLIENT_URL,
      }),
    });

    router.post("/check-user", limits.checkUser, controller.checkUser);
    // upload.any() parses the multipart body registration is submitted as.
    router.post("/register", limits.register, upload.any(), controller.register);

    // Two limiters, deliberately. The first caps how fast one machine can
    // guess; the second caps how many guesses one ACCOUNT can receive from
    // anywhere, which is what a distributed credential-stuffing run defeats.
    router.post("/login", limits.loginByIp, limits.loginByEmail, controller.login);

    router.post("/refreshToken", limits.refresh, controller.refreshToken);

    // Unauthenticated on purpose. The refresh token IS the credential here, and
    // it arrives in an httpOnly cookie the browser attaches by itself — so
    // requiring an access token as well would mean a member whose access token
    // had already expired could no longer sign out, which is the moment it
    // matters most.
    router.post("/logout", limits.logout, controller.logout);

    router.post("/send-otp", limits.otpSend, authenticate, controller.sendOtp);
    router.post("/verify-otp", limits.otpVerify, authenticate, controller.verifyOtp);
    router.post("/resend-otp", limits.otpSend, authenticate, controller.resendOtp);

    // /forgot-password and /reset-password (the OTP reset pair) are GONE. The
    // second looked a user up by the submitted code alone, so guessing codes
    // reset whichever account happened to hold the match — unauthenticated
    // takeover. See the block comment in auth.service.js. The two routes below
    // are the link-based flow, which is what the frontend has always called.
    router.post("/email-resend-otp", limits.otpSend, controller.emailResendOtp);
    router.post("/request-password-reset", limits.passwordReset, controller.requestPasswordReset);
    router.post("/reset-password-token", limits.passwordReset, controller.resetPasswordToken);
  }
}

export default AuthModule;
