import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { AuthController } from "#src/modules/auth/auth.controller.js";
import { errorHandler } from "#src/core/http/middleware/errorHandler.js";
import config from "#src/config/index.js";

/**
 * The refresh token's transport, end to end over HTTP.
 *
 * Driven through supertest rather than by calling the controller with fake
 * `req`/`res` objects, because the thing under test IS the HTTP surface: which
 * Set-Cookie attributes are written, what the JSON body does and does not
 * contain, and whether a cookie sent by a browser is honoured. A fake `res`
 * would let every one of those be wrong and still pass.
 */

const TOKENS = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  accessTokenExpiry: 1893456000,
  refreshTokenExpiry: 1893456000,
};

const USER = { _id: "user-1", name: "Sam", email: "sam@example.com", reviews: [] };

const COOKIE = config.auth.refreshCookie.name;

const appWith = (authService) => {
  const controller = new AuthController({ authService });
  const app = express();

  app.use(express.json());
  app.post("/auth/login", controller.login);
  app.post("/auth/refreshToken", controller.refreshToken);
  app.post("/auth/logout", controller.logout);
  app.use(errorHandler);

  return app;
};

const fakeAuthService = (over = {}) => ({
  login: vi.fn().mockResolvedValue({ user: USER, tokens: TOKENS }),
  refresh: vi.fn().mockResolvedValue({ user: USER, tokens: TOKENS }),
  logout: vi.fn().mockResolvedValue(undefined),
  ...over,
});

/** The Set-Cookie line for the refresh cookie, or undefined. */
const refreshCookieHeader = (response) =>
  (response.headers["set-cookie"] ?? []).find((line) => line.startsWith(`${COOKIE}=`));

describe("sign-in with the cookie transport", () => {
  it("puts the refresh token in an httpOnly cookie and not in the body", async () => {
    // The whole point: after this response, no script on the page can reach the
    // seven-day credential, because it was never handed to one.
    const app = appWith(fakeAuthService());

    const response = await request(app)
      .post("/auth/login")
      .set("X-Session-Transport", "cookie")
      .send({ email: "sam@example.com", password: "secret" });

    expect(response.status).toBe(200);
    expect(response.body.refreshToken).toBeUndefined();

    const cookie = refreshCookieHeader(response);
    expect(cookie).toContain(`${COOKIE}=${TOKENS.refreshToken}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/auth");
  });

  it("still returns the access token and the session's remaining life", async () => {
    // Neither is a long-lived credential, and the app needs both: one to make
    // requests, the other to know when to renew.
    const app = appWith(fakeAuthService());

    const response = await request(app)
      .post("/auth/login")
      .set("X-Session-Transport", "cookie")
      .send({ email: "sam@example.com", password: "secret" });

    expect(response.body.accessToken).toBe(TOKENS.accessToken);
    expect(response.body.accessTokenExpiry).toBe(TOKENS.accessTokenExpiry);
    expect(response.body.refreshTokenExpiry).toBe(TOKENS.refreshTokenExpiry);
  });

  it("answers a client that did not ask for a cookie exactly as it did before", async () => {
    // The admin console is a separate application calling the same endpoint.
    // Changing the response out from under it would leave it with a two-hour
    // session and no way to renew.
    const app = appWith(fakeAuthService());

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "sam@example.com", password: "secret" });

    expect(response.body.refreshToken).toBe(TOKENS.refreshToken);
    expect(refreshCookieHeader(response)).toBeUndefined();
  });
});

describe("renewing a session", () => {
  it("reads the refresh token from the cookie", async () => {
    const authService = fakeAuthService();
    const app = appWith(authService);

    await request(app)
      .post("/auth/refreshToken")
      .set("X-Session-Transport", "cookie")
      .set("Cookie", `${COOKIE}=cookie-token`)
      .send();

    expect(authService.refresh).toHaveBeenCalledWith("cookie-token");
  });

  it("ignores the cookie when the opt-in header is absent", async () => {
    // This is the CSRF defence, not a quirk. A cross-site form post carries the
    // cookie automatically and cannot set a custom header, so a forged request
    // has to be treated as presenting nothing at all.
    const authService = fakeAuthService({
      refresh: vi.fn().mockResolvedValue({ user: USER, tokens: TOKENS }),
    });
    const app = appWith(authService);

    await request(app)
      .post("/auth/refreshToken")
      .set("Cookie", `${COOKIE}=cookie-token`)
      .send();

    expect(authService.refresh).toHaveBeenCalledWith(undefined);
  });

  it("falls back to the posted token for a client that has no cookie", async () => {
    const authService = fakeAuthService();
    const app = appWith(authService);

    const response = await request(app)
      .post("/auth/refreshToken")
      .send({ refreshToken: "posted-token" });

    expect(authService.refresh).toHaveBeenCalledWith("posted-token");
    expect(response.body.refreshToken).toBe(TOKENS.refreshToken);
  });

  it("rotates the cookie rather than leaving the spent token in the browser", async () => {
    // Refreshing invalidates the old token server-side. A cookie still holding
    // it would be presented on the next renewal and rejected.
    const app = appWith(fakeAuthService());

    const response = await request(app)
      .post("/auth/refreshToken")
      .set("X-Session-Transport", "cookie")
      .set("Cookie", `${COOKIE}=old-token`)
      .send();

    expect(refreshCookieHeader(response)).toContain(`${COOKIE}=${TOKENS.refreshToken}`);
    expect(response.body.refreshToken).toBeUndefined();
  });
});

describe("signing out", () => {
  it("revokes the presented session and clears the cookie", async () => {
    const authService = fakeAuthService();
    const app = appWith(authService);

    const response = await request(app)
      .post("/auth/logout")
      .set("X-Session-Transport", "cookie")
      .set("Cookie", `${COOKIE}=cookie-token`)
      .send();

    expect(response.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith("cookie-token");
    // An immediate expiry is how a Set-Cookie deletes one.
    expect(refreshCookieHeader(response)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("succeeds when there is nothing to revoke", async () => {
    // Someone whose session already expired is still entitled to sign out, and
    // an error here would leave them staring at a failure on the way out.
    const authService = fakeAuthService();
    const app = appWith(authService);

    const response = await request(app).post("/auth/logout").send();

    expect(response.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith(undefined);
  });
});

describe("cookie parsing", () => {
  it("finds the token alongside other cookies", async () => {
    const authService = fakeAuthService();
    const app = appWith(authService);

    await request(app)
      .post("/auth/refreshToken")
      .set("X-Session-Transport", "cookie")
      .set("Cookie", `_ga=GA1.1.99; ${COOKIE}=wanted; other=x`)
      .send();

    expect(authService.refresh).toHaveBeenCalledWith("wanted");
  });

  it("does not match a cookie whose name merely ends with the same letters", async () => {
    const authService = fakeAuthService();
    const app = appWith(authService);

    await request(app)
      .post("/auth/refreshToken")
      .set("X-Session-Transport", "cookie")
      .set("Cookie", `not_${COOKIE}=decoy`)
      .send();

    expect(authService.refresh).toHaveBeenCalledWith(undefined);
  });
});
