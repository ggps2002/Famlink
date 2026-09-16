/**
 * One typed view over process.env.
 *
 * The reason this exists rather than reading `process.env.X` at each use site:
 * those reads were scattered across ~40 files, several with their own
 * fallback (`process.env.JWT_SECRET || "your_jwt_secret_key"`), which meant a
 * missing secret in production did not fail — it silently signed tokens with a
 * literal that is committed to the repository. Reads happen here, once, and a
 * secret with no safe default is required at boot instead.
 *
 * Grouping is by concern, not by prefix, so a module can take exactly the slice
 * it needs (`config.email`) instead of the whole environment.
 */
import "dotenv/config";
import { LOCAL_DB_URI, isLocalMongoUri } from "./mongoUri.js";

const str = (key, fallback) => process.env[key] ?? fallback;

const int = (key, fallback) => {
  const parsed = parseInt(process.env[key], 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const bool = (key, fallback = false) => {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
};

const nodeEnv = str("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

/**
 * Secrets with no defensible default. Missing any of these in production is a
 * boot failure rather than a runtime surprise: an app that starts without a
 * database URI only fails on the first request, by which time it is serving
 * traffic and reporting healthy.
 *
 * Left as a warning outside production so a contributor can run the test suite
 * or open the project without a full `.env`.
 */
const REQUIRED = ["MONGO_DB_URI", "JWT_SECRET", "REFRESH_TOKEN_SECRET"];

export const assertRequiredEnv = ({ exitOnFailure = isProduction } = {}) => {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length === 0) return [];

  const detail = `Missing required environment variables: ${missing.join(", ")}`;
  if (exitOnFailure) throw new Error(detail);
  console.warn(`[config] ${detail}. Falling back to development defaults.`);
  return missing;
};

/**
 * Development connects to a local database, whatever `.env` says.
 *
 * `.env` on a developer's machine holds the deployed `MONGO_DB_URI`, because
 * that is the same file the deployed environment uses. So `npm run dev` opened
 * a connection to the production cluster and every local experiment — a seed
 * script, a half-finished migration, a debugger stepping through a delete —
 * ran against real member data.
 *
 * Precedence outside production:
 *
 *   1. MONGO_DB_URI_DEV      an explicit development database, always honoured
 *   2. MONGO_DB_URI          only if it is local, or ALLOW_REMOTE_DB is set
 *   3. mongodb://127.0.0.1…  the default (see `npm run db:up`)
 *
 * ALLOW_REMOTE_DB exists because pointing a local process at a staging cluster
 * is occasionally the right thing to do. It has to be typed on purpose.
 */
const allowRemoteDb = bool("ALLOW_REMOTE_DB");

const resolveDbUri = () => {
  const configured = str("MONGO_DB_URI");
  if (isProduction) return configured;

  const devOverride = str("MONGO_DB_URI_DEV");
  if (devOverride) return devOverride;

  if (configured && (isLocalMongoUri(configured) || allowRemoteDb)) return configured;

  return LOCAL_DB_URI;
};

export const config = {
  env: nodeEnv,
  isProduction,
  isTest: nodeEnv === "test",
  port: int("PORT", 3000),

  db: {
    uri: resolveDbUri(),
    // Read by Database.connect(), which refuses a remote URI outside production
    // unless this is set — including one passed straight to the constructor.
    allowRemote: allowRemoteDb,
  },

  auth: {
    jwtSecret: str("JWT_SECRET", isProduction ? undefined : "dev_jwt_secret"),
    refreshSecret: str(
      "REFRESH_TOKEN_SECRET",
      isProduction ? undefined : "dev_refresh_secret"
    ),
    // These two defaults are load-bearing and match the pre-refactor values
    // exactly. Lengthening either silently extends how long a blocked or
    // suspended account keeps working: the status gate runs on sign-in and on
    // refresh, so the access-token lifetime is the worst-case delay before a
    // suspension takes hold, and the refresh lifetime is how long a session
    // survives without either.
    jwtExpiresIn: str("JWT_EXPIRES_IN", "2h"),
    refreshExpiresIn: str("REFRESH_TOKEN_EXPIRES_IN", "7d"),
    bcryptSaltRounds: int("BCRYPT_SALT_ROUNDS", 10),

    // Pinned into every token we sign and checked on every token we verify.
    //
    // The algorithm list is the load-bearing one. `jwt.verify` without it
    // honours whatever `alg` the token's own header claims, which is the
    // algorithm-confusion family of attacks — the classic being a token that
    // says `alg: none`. jsonwebtoken v9 closes the worst of these on its own;
    // naming the algorithm anyway costs nothing and does not depend on the
    // library's defaults staying that way.
    //
    // `issuer`/`audience` mean a token minted for something else — another
    // service sharing this secret, a password-reset link — cannot be replayed
    // as a session token here.
    jwtAlgorithms: ["HS256"],
    jwtIssuer: str("JWT_ISSUER", "famlink"),
    jwtAudience: str("JWT_AUDIENCE", "famlink-app"),

    // The cookie the refresh token now travels in, instead of being handed to
    // the browser's JavaScript and written to localStorage.
    //
    // `sameSite` is the one setting that has to be chosen per deployment rather
    // than fixed here, because it depends on where the API lives relative to the
    // frontend:
    //
    //   Today  famlink.care → backend-bitter-shape-3085.fly.dev is CROSS-SITE,
    //          so the cookie is only sent at all with `SameSite=None`, which in
    //          turn requires `Secure`. That combination provides no CSRF
    //          protection of its own — see refreshCookie.js, where the custom
    //          request header that replaces it is enforced.
    //
    //   Later  once the API is on `api.famlink.care` the two become same-site
    //          and this becomes `REFRESH_COOKIE_SAMESITE=strict`, which is the
    //          arrangement SECURITY.md §4 recommends. Nothing else changes.
    //
    // Development defaults to `lax`: localhost:5173 → localhost:3000 is
    // same-site (SameSite ignores the port), so `lax` already works there and
    // avoids requiring HTTPS locally.
    refreshCookie: (() => {
      const sameSite = str(
        "REFRESH_COOKIE_SAMESITE",
        isProduction ? "none" : "lax"
      ).toLowerCase();

      return {
        name: str("REFRESH_COOKIE_NAME", "famlink_rt"),
        sameSite,
        // Not independently configurable when `sameSite` is `none`: a browser
        // rejects `SameSite=None` without `Secure` outright, which would mean
        // no cookie at all and nobody able to stay signed in.
        secure: sameSite === "none" ? true : bool("REFRESH_COOKIE_SECURE", isProduction),
        // Left undefined unless set, so the cookie is host-only — narrower than
        // a domain cookie, and correct while the API has its own hostname.
        domain: str("REFRESH_COOKIE_DOMAIN") || undefined,
        // Scoped to the only routes that read it: /auth/refreshToken and
        // /auth/logout. Every other endpoint receives no cookie at all, so the
        // refresh token is not attached to two hundred ordinary API calls.
        path: "/auth",
      };
    })(),
  },

  security: {
    // Origins the browser may call this API from.
    //
    // Was `origin: "*"`, which tells every browser that any website may read
    // authenticated responses from this API. That is survivable while the only
    // credential is a Bearer token a foreign page cannot read — and stops being
    // survivable the moment anything moves to a cookie, which is exactly the
    // direction the refresh-token hardening points.
    //
    // Comma-separated in CORS_ORIGINS. Falls back to the frontend URL this
    // deployment already knows about, plus the Vite dev server, so a correctly
    // configured environment needs no new variable.
    corsOrigins: str("CORS_ORIGINS", "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),

    // Minimum password length. Deliberately a length floor rather than a
    // composition rule ("one uppercase, one symbol"): length is what actually
    // resists guessing, and composition rules reliably produce `Password1!`.
    // NIST SP 800-63B says the same.
    passwordMinLength: int("PASSWORD_MIN_LENGTH", 8),

    // How many times a one-time code may be guessed before it is burned.
    otpMaxAttempts: int("OTP_MAX_ATTEMPTS", 5),
  },

  urls: {
    app: str("APP_URL"),
    client: str("CLIENT_URL"),
    frontend: str("FRONTEND_URL"),
    backend: str("BACKEND_URL"),
    shareLinkBase: str("SHARE_LINK_BASE_URL"),
  },

  email: {
    host: str("EMAIL_HOST"),
    port: int("EMAIL_PORT", 587),
    secure: bool("EMAIL_SECURE", false),
    user: str("EMAIL_USER"),
    pass: str("EMAIL_PASS"),
    from: str("EMAIL_FROM"),
    fromAutomated: str("EMAIL_FROM_AUTOMATED"),
    fromFounder: str("EMAIL_FROM_FOUNDER"),
    replyFounder: str("EMAIL_REPLY_FOUNDER"),
    replySupport: str("EMAIL_REPLY_SUPPORT"),
    assetBase: str("EMAIL_ASSET_BASE"),
    rateLimit: int("EMAIL_RATE_LIMIT", 0),
    maxConnections: int("EMAIL_MAX_CONNECTIONS", 0),
    maxMessages: int("EMAIL_MAX_MESSAGES", 0),
    sendAttempts: int("EMAIL_SEND_ATTEMPTS", 3),
    sendBackoffMs: int("EMAIL_SEND_BACKOFF_MS", 1000),
    breakerThreshold: int("EMAIL_BREAKER_THRESHOLD", 5),
    breakerCooldownMs: int("EMAIL_BREAKER_COOLDOWN_MS", 60000),
    oauth: {
      tenantId: str("EMAIL_OAUTH_TENANT_ID"),
      clientId: str("EMAIL_OAUTH_CLIENT_ID"),
      clientSecret: str("EMAIL_OAUTH_CLIENT_SECRET"),
    },

    // The queue and its dispatcher. Every default is deliberately usable
    // as-is; these exist so a provider's limits can be matched without a
    // deploy. See shared/email/emailDispatcher.js for what each one paces.
    queue: {
      pollIntervalMs: int("EMAIL_POLL_INTERVAL_MS", 5000),
      batchSize: int("EMAIL_BATCH_SIZE", 20),
      lockTimeoutMs: int("EMAIL_LOCK_TIMEOUT_MS", 120000),
      backoffBaseMs: int("EMAIL_BACKOFF_BASE_MS", 60000),
      backoffFactor: int("EMAIL_BACKOFF_FACTOR", 5),
      backoffMaxMs: int("EMAIL_BACKOFF_MAX_MS", 7200000),
      // Terminal rows hold a rendered body, so they are dropped by a TTL index
      // rather than kept. The bodiless history lives in emaillogs forever.
      purgeDays: int("EMAIL_QUEUE_PURGE_DAYS", 30),
    },
  },

  redis: {
    host: str("REDIS_HOST"),
    port: int("REDIS_PORT", 6379),
    username: str("REDIS_USERNAME"),
    password: str("REDIS_PASSWORD"),
  },

  stripe: {
    secretKey: str("STRIPE_SECRET_KEY"),
    webhookSecret: str("STRIPE_WEBHOOK_SECRET"),
  },

  twilio: {
    accountSid: str("TWILIO_ACCOUNT_SID"),
    authToken: str("TWILIO_AUTH_TOKEN"),
    phone: str("TWILIO_PHONE"),
  },

  google: {
    mapsApiKey: str("GOOGLE_MAPS_API_KEY"),
    // Mixed-case name, kept as-is because it is what the deployed environment
    // actually sets. Separate from mapsApiKey: this one is spent by the public
    // geocode proxy on the signup form, which no token guards.
    geocodeKey: str("Location_Key"),
    sheetReaderUrl: str("GOOGLE_SHEET_READER_URL"),
    sheetReaderToken: str("GOOGLE_SHEET_READER_TOKEN"),
  },

  openai: {
    apiKey: str("OPENAI_API_KEY"),
  },

  slack: {
    botToken: str("SLACK_BOT_TOKEN"),
    channelId: str("SLACK_CHANNEL_ID"),
    webhooks: {
      bpn: str("SLACK_WEBHOOK_BPN"),
      craigslist: str("SLACK_WEBHOOK_CRAIGSLIST"),
      facebookGroups: str("SLACK_WEBHOOK_FB_GROUPS"),
      nextdoor: str("SLACK_WEBHOOK_NEXTDOOR"),
      peanut: str("SLACK_WEBHOOK_PEANUT"),
    },
  },

  cloudinary: {
    secret: str("CLOUDINARY_SECRET"),
  },

  tokens: {
    unsubscribeSecret: str("UNSUBSCRIBE_SECRET"),
    analyticsSalt: str("ANALYTICS_SALT_SECRET"),
  },

  messaging: {
    emailWindowMs: int("MESSAGE_EMAIL_WINDOW_MS", 0),
  },
};

export default config;
