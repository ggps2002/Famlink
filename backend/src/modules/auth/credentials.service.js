import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import config from "../../config/index.js";
import { ValidationError } from "../../core/errors/index.js";

/**
 * The passwords attackers try first.
 *
 * Not a substitute for a real breach corpus (haveibeenpwned's k-anonymity API
 * is the thorough answer, and needs a network call on every password set).
 * This is the cheap 90%: a credential-stuffing run starts with these, and
 * nothing here should ever be allowed through.
 */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789",
  "1234567890", "qwerty123", "qwertyuiop", "letmein1", "welcome1", "admin123",
  "iloveyou", "sunshine", "princess", "football", "baseball", "trustno1",
  "changeme", "starwars", "whatever", "superman", "michael1", "jennifer",
  "abc12345", "monkey123", "dragon123", "master123", "shadow123", "nannyshare",
  "famlink123", "letmein123", "welcome123",
]);

/**
 * Password hashing, one-time codes, and reset tokens.
 *
 * Gathered into one object so the parameters that decide how strong any of it
 * is — cost factor, code length, lifetimes — are visible together instead of
 * being repeated as literals across a 1000-line route file.
 */
export class CredentialsService {
  constructor({
    auth = config.auth,
    security = config.security,
    otpTtlMs = 2 * 60 * 1000,
    resetTtlMs = 60 * 60 * 1000,
  } = {}) {
    // Merged, not replaced, for the same reason as TokenService: callers pass
    // partial objects and a missing key here would surface as an undefined
    // length check rather than an obvious failure.
    this.auth = { ...config.auth, ...auth };
    this.security = { ...config.security, ...security };
    this.otpTtlMs = otpTtlMs;
    this.resetTtlMs = resetTtlMs;
  }

  hashPassword(plaintext) {
    return bcrypt.hash(plaintext, this.auth.bcryptSaltRounds);
  }

  verifyPassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  }

  /**
   * A 6-digit numeric code, its hash, and its expiry.
   *
   * This is now email verification only — the password-reset flow that used to
   * share it has been retired in favour of the link-based one. That matters,
   * because the old flow looked a user up by the code ALONE, so a guessed code
   * reset whoever happened to hold it.
   *
   * Three things changed from the original:
   *
   *   • `crypto.randomInt` instead of `Math.random()`. Math.random is a PRNG
   *     seeded per process and not designed to be unpredictable; observing
   *     enough of its output narrows the next value. A credential must not come
   *     from it.
   *   • Six digits instead of four — 10,000 possibilities became 1,000,000.
   *   • A hash to store beside the raw code to send, exactly as reset tokens
   *     are handled. A code is a short-lived password; a database dump should
   *     not contain live ones.
   *
   * Six digits is still small enough to guess given unlimited tries, so the
   * attempt counter in AuthService and the rate limit on the route are part of
   * this control, not optional extras.
   */
  generateOtp() {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    return {
      code,
      hash: this.hashOtp(code),
      expiresAt: new Date(Date.now() + this.otpTtlMs),
    };
  }

  /**
   * SHA-256, not bcrypt.
   *
   * Deliberate, and the reasoning is different from passwords. Bcrypt's cost is
   * there to make guessing a low-entropy, long-lived secret expensive. A code
   * here lives two minutes, is drawn uniformly from a million values, and is
   * capped at a handful of attempts — so the guessing ceiling comes from those
   * limits rather than from hash cost, and a per-request bcrypt on a
   * verification endpoint is just latency. Same choice the reset tokens make.
   */
  hashOtp(code) {
    return crypto.createHash("sha256").update(String(code)).digest("hex");
  }

  /**
   * Whether a submitted code matches, compared in constant time.
   *
   * `===` on a secret leaks how many leading characters were right through how
   * long the comparison took. Marginal over a network and free to avoid.
   */
  otpMatches(submitted, storedHash) {
    if (!submitted || !storedHash) return false;

    const submittedHash = Buffer.from(this.hashOtp(submitted));
    const expected = Buffer.from(String(storedHash));

    if (submittedHash.length !== expected.length) return false;
    return crypto.timingSafeEqual(submittedHash, expected);
  }

  isOtpExpired(expiry) {
    return !expiry || new Date() > new Date(expiry);
  }

  /**
   * Reject a password that is too weak to be worth hashing.
   *
   * A length floor and a check against the handful of passwords that actually
   * get tried first — not a composition rule. "One uppercase, one digit, one
   * symbol" reliably produces `Password1!`, which is in every cracking list;
   * length is what resists guessing. NIST SP 800-63B reaches the same
   * conclusion and explicitly advises against composition rules.
   *
   * Applied only where a password is SET (registration, reset, change), never
   * on login — an existing account whose password predates this rule must still
   * be able to sign in, or this locks out the very users it is meant to protect.
   */
  assertPasswordAcceptable(password) {
    const minLength = this.security.passwordMinLength;

    if (typeof password !== "string" || password.length < minLength) {
      throw new ValidationError(`Password must be at least ${minLength} characters.`);
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      throw new ValidationError("That password is too common. Please choose another.");
    }
  }

  /**
   * A password-reset token: the raw value for the email link, and the hash to
   * store. Only the hash is persisted, so a leaked database does not hand over
   * working reset links.
   */
  generateResetToken() {
    const raw = crypto.randomBytes(32).toString("hex");
    return {
      raw,
      hash: this.hashResetToken(raw),
      expiresAt: new Date(Date.now() + this.resetTtlMs),
    };
  }

  hashResetToken(raw) {
    return crypto.createHash("sha256").update(raw).digest("hex");
  }
}

export default CredentialsService;
