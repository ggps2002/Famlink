import jwt from "jsonwebtoken";
import config from "../../config/index.js";
import { convertToSeconds } from "../../shared/utils/convertToSec.js";
import { UnauthorizedError } from "../../core/errors/index.js";

/**
 * Mints, verifies and rotates the token pair.
 *
 * Isolated from AuthService because token mechanics are the part most likely to
 * be reused (and most dangerous to duplicate): the same pair is issued from
 * four different places — password login, Google login, OTP verification and
 * refresh — and before this each of them re-derived the expiry arithmetic
 * inline. The secrets are read from config, which fails at boot when they are
 * missing rather than silently falling back to a literal.
 */
export class TokenService {
  constructor({ refreshTokenRepository, auth = config.auth } = {}) {
    this.refreshTokenRepository = refreshTokenRepository;

    // Merged over the real config rather than used raw. Callers (and tests)
    // pass a partial `auth` holding just the secrets and lifetimes they care
    // about, and a missing `jwtAlgorithms` would otherwise be an undefined
    // index at signing time — a crash in the one code path that must not have
    // one. Anything supplied still wins.
    this.auth = { ...config.auth, ...auth };
  }

  /** Unix seconds at which a token minted now will expire. */
  #expiryFor(duration) {
    return Math.floor(Date.now() / 1000) + convertToSeconds(duration);
  }

  /**
   * Issue an access/refresh pair for a user.
   *
   * When `previousRefreshToken` is given the stored row is rotated rather than
   * duplicated, so one session stays one row.
   */
  async issuePair(userId, previousRefreshToken = null) {
    // `issuer`/`audience` are stamped on but not yet demanded at verification —
    // tokens minted before this shipped carry neither, and rejecting those
    // would sign every current session out. Once the refresh window has turned
    // over they can be asserted; see the note in core/http/middleware/authenticate.js.
    const claimOptions = {
      algorithm: this.auth.jwtAlgorithms[0],
      issuer: this.auth.jwtIssuer,
      audience: this.auth.jwtAudience,
    };

    const accessToken = jwt.sign({ userId }, this.auth.jwtSecret, {
      ...claimOptions,
      expiresIn: this.auth.jwtExpiresIn,
    });

    const refreshToken = jwt.sign({ userId }, this.auth.refreshSecret, {
      ...claimOptions,
      expiresIn: this.auth.refreshExpiresIn,
    });

    const accessTokenExpiry = this.#expiryFor(this.auth.jwtExpiresIn);
    const refreshTokenExpiry = this.#expiryFor(this.auth.refreshExpiresIn);
    const expiresAt = new Date(refreshTokenExpiry * 1000);

    if (previousRefreshToken) {
      await this.refreshTokenRepository.rotate(previousRefreshToken, {
        token: refreshToken,
        expiresAt,
      });
    } else {
      await this.refreshTokenRepository.issue({ userId, token: refreshToken, expiresAt });
    }

    return { accessToken, refreshToken, accessTokenExpiry, refreshTokenExpiry };
  }

  /**
   * Resolve a refresh token to the user it names.
   *
   * Both halves are required and neither is sufficient. The signature proves we
   * minted it; the stored row proves it has not been rotated away or revoked.
   * Checking only the signature would let a token that was already replaced go
   * on working for its full lifetime.
   */
  async resolveRefreshToken(refreshToken) {
    const stored = await this.refreshTokenRepository.findByToken(refreshToken);
    if (!stored || new Date(stored.expiry) < new Date()) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    let decoded;
    try {
      // Algorithms pinned for the same reason as the access-token path: without
      // it the token's own header decides how it is checked.
      decoded = jwt.verify(refreshToken, this.auth.refreshSecret, {
        algorithms: this.auth.jwtAlgorithms,
      });
    } catch {
      throw new UnauthorizedError("Invalid token");
    }

    if (typeof decoded === "string" || !decoded.userId) {
      throw new UnauthorizedError("Invalid token payload");
    }

    return decoded.userId;
  }

  /**
   * End the one session this refresh token names.
   *
   * No signature check first, on purpose. Deleting the row is what revokes the
   * session, and a row only exists for a token this server minted — so a
   * garbage token deletes nothing, and spending a verification on it before
   * finding that out buys nothing.
   */
  revokeRefreshToken(refreshToken) {
    return this.refreshTokenRepository.revokeByToken(refreshToken);
  }

  /**
   * End every session this user holds.
   *
   * The sessions are the rows, not the JWTs: a refresh token's signature stays
   * valid until it expires, and deleting the row is what makes presenting it
   * fail. That is the whole reason `resolveRefreshToken` insists on both.
   */
  revokeAllForUser(userId) {
    return this.refreshTokenRepository.revokeAllForUser(userId);
  }
}

export default TokenService;
