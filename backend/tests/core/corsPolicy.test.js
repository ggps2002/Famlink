import { describe, it, expect } from "vitest";
import express from "express";
import cors from "cors";
import request from "supertest";
import { buildCorsOptions, resolveAllowedOrigins } from "#src/core/http/corsPolicy.js";

/**
 * Who may call this API from a browser.
 *
 * This matters more than it did. While the only credential was an
 * `Authorization` header a foreign page could not read, a loose allowlist was
 * untidy; with `credentials: true` and a session cookie, an origin on this list
 * can make authenticated requests as the signed-in member and read the replies.
 */

const NO_EXTRA = { corsOrigins: [] };

/** Whether the policy would serve this origin. */
const allows = (options, origin) => {
  let allowed = null;
  options.origin(origin, (_error, result) => {
    allowed = result;
  });
  return allowed;
};

const appWith = (options) => {
  const app = express();
  app.use(cors(options));
  app.get("/thing", (_req, res) => res.json({ ok: true }));
  return app;
};

describe("production", () => {
  const options = buildCorsOptions({ security: NO_EXTRA, isProduction: true });

  it("serves the frontend on both of its hostnames", () => {
    // A browser sends Origin exactly as the page was loaded, and treats these as
    // two different origins. Allowing only one strands whoever arrived by the
    // other name.
    expect(allows(options, "https://famlink.care")).toBe(true);
    expect(allows(options, "https://www.famlink.care")).toBe(true);
  });

  it("does not serve localhost", () => {
    // A developer's machine is not a production client, and a page on localhost
    // asking production for credentialed data is not a case worth supporting.
    expect(allows(options, "http://localhost:5173")).toBe(false);
  });

  it("does not serve anyone else", () => {
    expect(allows(options, "https://evil.example")).toBe(false);
    // Nor a lookalike that merely contains the real name.
    expect(allows(options, "https://famlink.care.evil.example")).toBe(false);
    // Nor the same host over plain http, which would strip the transport.
    expect(allows(options, "http://famlink.care")).toBe(false);
  });
});

describe("development", () => {
  const options = buildCorsOptions({ security: NO_EXTRA, isProduction: false });

  it("serves the Vite dev server", () => {
    expect(allows(options, "http://localhost:5173")).toBe(true);
    expect(allows(options, "http://127.0.0.1:5173")).toBe(true);
  });

  it("still refuses an unknown origin", () => {
    expect(allows(options, "https://evil.example")).toBe(false);
  });
});

describe("configuration cannot open the door by accident", () => {
  it("keeps the production origins when nothing is configured", () => {
    // The regression the old allow-everything fallback existed to prevent, and
    // which constants remove the possibility of: a deployment with no
    // CORS_ORIGINS set is still able to serve its own frontend.
    const allowed = resolveAllowedOrigins({ security: NO_EXTRA, isProduction: true });

    expect(allowed).toContain("https://famlink.care");
    expect(allowed).toContain("https://www.famlink.care");
  });

  it("treats CORS_ORIGINS as an addition, not a replacement", () => {
    // Previously it replaced the list, so setting it to one staging origin
    // silently revoked the real frontend's access.
    const allowed = resolveAllowedOrigins({
      security: { corsOrigins: ["https://staging.example"] },
      isProduction: true,
    });

    expect(allowed).toContain("https://staging.example");
    expect(allowed).toContain("https://famlink.care");
  });

  it("never resolves to allowing every origin", () => {
    // There is no longer a branch that returns `{ origin: true }`. With
    // credentials enabled that would let any site read authenticated responses.
    for (const isProduction of [true, false]) {
      const options = buildCorsOptions({ security: NO_EXTRA, isProduction });
      expect(options.origin).toBeTypeOf("function");
      expect(allows(options, "https://anything.example")).toBe(false);
    }
  });
});

describe("over HTTP", () => {
  const options = buildCorsOptions({ security: NO_EXTRA, isProduction: true });

  it("sends the credentialed CORS headers to an allowed origin", async () => {
    const response = await request(appWith(options))
      .get("/thing")
      .set("Origin", "https://famlink.care");

    expect(response.headers["access-control-allow-origin"]).toBe("https://famlink.care");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("sends no CORS headers to an origin that is not on the list", async () => {
    // The request still reaches the handler — CORS is enforced by the browser,
    // not the server — but without the header the browser blocks the read.
    const response = await request(appWith(options))
      .get("/thing")
      .set("Origin", "https://evil.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("serves a caller that sends no Origin at all", async () => {
    // Stripe's webhook, fly's health check, curl. CORS cannot police these and
    // refusing them would break integrations while stopping no attack.
    const response = await request(appWith(options)).get("/thing");

    expect(response.status).toBe(200);
  });

  it("answers the preflight the session cookie depends on", async () => {
    const response = await request(appWith(options))
      .options("/thing")
      .set("Origin", "https://famlink.care")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "x-session-transport");

    expect(response.headers["access-control-allow-headers"]).toContain("X-Session-Transport");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});
