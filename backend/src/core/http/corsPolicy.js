// Which origins a browser may call this API from.
//
// This was `{ origin: "*" }`, which tells every browser that any website may
// make requests to this API and read the replies. It then became an allowlist
// derived from environment variables. It is now a fixed list in this file, and
// the change is deliberate: who may call this API is a security decision, and a
// security decision should live in a reviewed file rather than in whatever a
// deployment happens to have set.
//
// Three things follow from that, each of which used to be otherwise:
//
//   1. The production origins cannot be lost. They are constants here, so a
//      missing or mistyped variable cannot quietly narrow the list and take the
//      site off its own API.
//
//   2. Nothing incidental can widen it. The previous version fell back to
//      FRONTEND_URL / CLIENT_URL / APP_URL — variables that exist to build links
//      in outgoing email. Pointing one of them at a campaign domain for a week
//      would have silently granted that domain access to this API, which is not
//      a consequence anyone editing an email template would expect.
//
//   3. There is no "allow everything" case left. See the note below.

import config from "../../config/index.js";

/**
 * The deployed frontend.
 *
 * Both hosts, because a browser treats `famlink.care` and `www.famlink.care` as
 * different origins and sends `Origin` exactly as the page was loaded. Listing
 * only one means whichever half of the userbase arrived by the other name
 * cannot reach the API at all.
 */
const PRODUCTION_ORIGINS = ["https://famlink.care", "https://www.famlink.care"];

/**
 * The local dev servers, added only outside production.
 *
 * 5173 is Vite; 3000 is this API's own port, which matters for anything opened
 * directly against the backend.
 */
const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
];

/** `https://app.example.com/path` → `https://app.example.com`, or null. */
const toOrigin = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
};

/**
 * The full allowlist for this environment.
 *
 * `CORS_ORIGINS` is **added to** the built-in list, never a replacement for it.
 * That is the whole difference from the previous behaviour: setting it can open
 * a door for a staging frontend or a new domain, and forgetting to set it can no
 * longer close the ones that must stay open.
 */
export const resolveAllowedOrigins = ({
  security = config.security,
  isProduction = config.isProduction,
} = {}) => {
  const extra = security.corsOrigins.map(toOrigin).filter(Boolean);

  const origins = isProduction
    ? [...PRODUCTION_ORIGINS, ...extra]
    : [...PRODUCTION_ORIGINS, ...LOCAL_ORIGINS, ...extra];

  return [...new Set(origins)];
};

/**
 * The options object handed to the `cors` middleware.
 *
 * Two decisions worth stating plainly.
 *
 * **A request with NO Origin header is allowed.** Browsers always send one on
 * cross-origin requests, so the header's absence means the caller is not a
 * browser — curl, a health check, a Stripe webhook, a server-to-server call.
 * CORS is a browser mechanism and cannot police those; rejecting them here would
 * break integrations while stopping no attack.
 *
 * **An unknown origin is denied, with nothing to fall back on.** There used to
 * be a branch here that allowed every origin when the allowlist came out empty,
 * on the reasoning that failing closed would take production down over a missing
 * environment variable. That reasoning no longer holds in either direction: the
 * list is built from constants and cannot come out empty by misconfiguration,
 * and `credentials: true` now means that allowing every origin would let any
 * site on the internet make credentialed requests to this API and read the
 * replies. If the list is ever emptied deliberately, the correct outcome is that
 * no browser origin is served — so that is what happens.
 */
export const buildCorsOptions = (overrides = {}) => {
  const allowed = resolveAllowedOrigins(overrides);

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);

      // Not an exception: an unknown origin is a normal thing for a public API
      // to be asked by, and throwing would turn it into a 500 with a stack
      // trace. Denying simply omits the CORS headers, and the browser blocks
      // the read — which is the correct outcome.
      return callback(null, false);
    },
    // Load-bearing now rather than forward-looking: without it the browser
    // neither sends the refresh cookie nor stores the one the server sets.
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // X-Session-Transport is what a client uses to ask for the cookie, and is
    // also the header whose absence makes a cross-site forgery inert — see
    // modules/auth/refreshCookie.js. Omitting it here would fail the preflight
    // and no session could be established at all.
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-Transport"],
  };
};

export default buildCorsOptions;
