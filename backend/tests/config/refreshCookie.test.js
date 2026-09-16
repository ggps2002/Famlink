import { describe, it, expect, vi } from "vitest";

/**
 * How the refresh cookie is configured per environment.
 *
 * Worth its own test because the two attributes here are the difference between
 * a working sign-in and none at all, and neither failure is visible in code
 * review: a browser silently drops `SameSite=None` without `Secure`, and
 * silently declines to send a `SameSite=Lax` cookie to an API on another site.
 * Either way nobody can stay signed in, and nothing logs anything.
 */

const loadConfig = async (env) => {
  vi.resetModules();

  const saved = {};
  for (const [key, value] of Object.entries(env)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    const { default: config } = await import("#src/config/index.js");
    return config.auth.refreshCookie;
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  }
};

const PRODUCTION = {
  NODE_ENV: "production",
  MONGO_DB_URI: "mongodb://example/db",
  JWT_SECRET: "s",
  REFRESH_TOKEN_SECRET: "s",
  REFRESH_COOKIE_SAMESITE: undefined,
  REFRESH_COOKIE_SECURE: undefined,
};

describe("refresh cookie configuration", () => {
  it("is None+Secure in production, because the API is on another site", async () => {
    // famlink.care → backend-bitter-shape-3085.fly.dev is cross-site, and a Lax
    // or Strict cookie is simply not sent on a cross-site request.
    const cookie = await loadConfig(PRODUCTION);

    expect(cookie.sameSite).toBe("none");
    expect(cookie.secure).toBe(true);
  });

  it("is Lax in development, where the frontend and API are same-site", async () => {
    // localhost:5173 → localhost:3000 differ only by port, which SameSite
    // ignores — so Lax works, and not requiring Secure keeps plain http local
    // development working in every browser.
    const cookie = await loadConfig({
      ...PRODUCTION,
      NODE_ENV: "development",
    });

    expect(cookie.sameSite).toBe("lax");
    expect(cookie.secure).toBe(false);
  });

  it("takes Strict once an environment asks for it", async () => {
    // The setting SECURITY.md §4 is aiming at: with the API on
    // api.famlink.care the two become same-site, and this one variable is the
    // whole migration.
    const cookie = await loadConfig({
      ...PRODUCTION,
      REFRESH_COOKIE_SAMESITE: "strict",
    });

    expect(cookie.sameSite).toBe("strict");
    expect(cookie.secure).toBe(true);
  });

  it("cannot be configured into the combination browsers reject", async () => {
    // `SameSite=None` without `Secure` is discarded outright, so REFRESH_COOKIE_SECURE=false
    // alongside it must not be honoured — it would mean no session cookie at all.
    const cookie = await loadConfig({
      ...PRODUCTION,
      REFRESH_COOKIE_SAMESITE: "none",
      REFRESH_COOKIE_SECURE: "false",
    });

    expect(cookie.secure).toBe(true);
  });

  it("scopes the cookie to the routes that read it", async () => {
    // Not "/": the refresh token has no business being attached to the two
    // hundred endpoints that never look at it.
    const cookie = await loadConfig(PRODUCTION);

    expect(cookie.path).toBe("/auth");
  });
});
