import { BaseRepository } from "../../core/database/BaseRepository.js";
import { RefreshToken } from "./refreshToken.model.js";

/** Persistence for refresh tokens — the record that makes a session revocable. */
export class RefreshTokenRepository extends BaseRepository {
  constructor(model = RefreshToken) {
    super(model);
  }

  findByToken(token, options = {}) {
    return this.findOne({ token }, options);
  }

  issue({ userId, token, expiresAt }) {
    return this.create({ userId, token, expiry: expiresAt });
  }

  /**
   * Swap a token for its successor in place.
   *
   * Rotation reuses the row rather than inserting a new one, which is what
   * keeps a long-lived session from accumulating a row per refresh.
   */
  rotate(oldToken, { token, expiresAt }) {
    return this.updateOne({ token: oldToken }, { token, expiry: expiresAt });
  }

  /** End one session, identified by the token it last handed out. */
  revokeByToken(token) {
    return this.deleteOne({ token });
  }

  revokeAllForUser(userId) {
    return this.deleteMany({ userId });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();

export default refreshTokenRepository;
