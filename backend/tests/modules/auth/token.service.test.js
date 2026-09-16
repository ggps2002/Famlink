import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { TokenService } from "#src/modules/auth/token.service.js";
import { UnauthorizedError } from "#src/core/errors/index.js";

const AUTH = {
  jwtSecret: "test_jwt_secret",
  refreshSecret: "test_refresh_secret",
  jwtExpiresIn: "2h",
  refreshExpiresIn: "7d",
};

const build = (repoOverrides = {}) => {
  const refreshTokenRepository = {
    issue: vi.fn().mockResolvedValue(undefined),
    rotate: vi.fn().mockResolvedValue(undefined),
    findByToken: vi.fn().mockResolvedValue(null),
    ...repoOverrides,
  };

  return {
    service: new TokenService({ refreshTokenRepository, auth: AUTH }),
    refreshTokenRepository,
  };
};

describe("TokenService.issuePair", () => {
  it("mints a verifiable pair carrying the user id", async () => {
    const { service } = build();

    const pair = await service.issuePair("user-1");

    expect(jwt.verify(pair.accessToken, AUTH.jwtSecret).userId).toBe("user-1");
    expect(jwt.verify(pair.refreshToken, AUTH.refreshSecret).userId).toBe("user-1");
  });

  it("signs the two tokens with different secrets", async () => {
    // A refresh token accepted by the access-token verifier would let a
    // long-lived credential be used as a short-lived one.
    const { service } = build();
    const pair = await service.issuePair("user-1");

    expect(() => jwt.verify(pair.refreshToken, AUTH.jwtSecret)).toThrow();
  });

  it("returns expiries in unix seconds matching the configured lifetimes", async () => {
    const { service } = build();
    const now = Math.floor(Date.now() / 1000);

    const pair = await service.issuePair("user-1");

    expect(pair.accessTokenExpiry).toBeGreaterThanOrEqual(now + 7200 - 5);
    expect(pair.accessTokenExpiry).toBeLessThanOrEqual(now + 7200 + 5);
    expect(pair.refreshTokenExpiry).toBeGreaterThanOrEqual(now + 604800 - 5);
  });

  it("stores a new refresh row on first issue", async () => {
    const { service, refreshTokenRepository } = build();

    await service.issuePair("user-1");

    expect(refreshTokenRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" })
    );
    expect(refreshTokenRepository.rotate).not.toHaveBeenCalled();
  });

  it("rotates the existing row rather than inserting another", async () => {
    // Otherwise a long-lived session accumulates one row per refresh.
    const { service, refreshTokenRepository } = build();

    await service.issuePair("user-1", "old-token");

    expect(refreshTokenRepository.rotate).toHaveBeenCalledWith(
      "old-token",
      expect.objectContaining({ token: expect.any(String) })
    );
    expect(refreshTokenRepository.issue).not.toHaveBeenCalled();
  });
});

describe("TokenService.resolveRefreshToken", () => {
  const validToken = () => jwt.sign({ userId: "user-1" }, AUTH.refreshSecret, { expiresIn: "7d" });

  it("accepts a token that is both signed and stored", async () => {
    const token = validToken();
    const { service } = build({
      findByToken: vi.fn().mockResolvedValue({ token, expiry: new Date(Date.now() + 86400000) }),
    });

    await expect(service.resolveRefreshToken(token)).resolves.toBe("user-1");
  });

  it("rejects a validly-signed token that is no longer stored", async () => {
    // The stored row is what makes a session revocable. Trusting the signature
    // alone would let a rotated-away token keep working for its full lifetime.
    const { service } = build({ findByToken: vi.fn().mockResolvedValue(null) });

    await expect(service.resolveRefreshToken(validToken())).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a stored row that has expired", async () => {
    const token = validToken();
    const { service } = build({
      findByToken: vi.fn().mockResolvedValue({ token, expiry: new Date(Date.now() - 1000) }),
    });

    await expect(service.resolveRefreshToken(token)).rejects.toThrow("Invalid or expired token");
  });

  it("rejects a stored token with a forged signature", async () => {
    const forged = jwt.sign({ userId: "attacker" }, "wrong_secret");
    const { service } = build({
      findByToken: vi.fn().mockResolvedValue({ token: forged, expiry: new Date(Date.now() + 1000) }),
    });

    await expect(service.resolveRefreshToken(forged)).rejects.toThrow("Invalid token");
  });

  it("rejects a well-signed token whose payload carries no user", async () => {
    const noUser = jwt.sign({ some: "claim" }, AUTH.refreshSecret);
    const { service } = build({
      findByToken: vi.fn().mockResolvedValue({ token: noUser, expiry: new Date(Date.now() + 1000) }),
    });

    await expect(service.resolveRefreshToken(noUser)).rejects.toThrow("Invalid token payload");
  });
});
