import nodemailer from "nodemailer";
import dns from "node:dns";

/**
 * The SMTP transport, and nothing else.
 *
 * Split out of email.js so that "how a message is composed" and "how a message
 * leaves the building" are separate concerns. The queue dispatcher needs the
 * second without the first, and a future move to a provider HTTP API (SES,
 * Postmark, Resend) is then a rewrite of this one file — every template, every
 * sender and every call site stays exactly as it is.
 */

// Prefer IPv4 for outbound connections. On dual-stack machines Node may connect
// over IPv6, whose address often rotates — which trips provider IP allow-lists
// (e.g. Brevo "Authorised IPs" → 525 5.7.1 Unauthorized IP address). Forcing
// IPv4 makes the source IP predictable so it can be authorized.
if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
}

// Load environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
const EMAIL_USER = process.env.EMAIL_USER || ""; // Your Email address
const EMAIL_PASS = process.env.EMAIL_PASS || ""; // Your Email app password
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587; // 587 = STARTTLS, 465 = implicit SSL
// `secure` must be true for port 465 and false for 587/25 (STARTTLS).
// Set EMAIL_SECURE=true/false to override the port-based default explicitly.
const EMAIL_SECURE = process.env.EMAIL_SECURE
    ? process.env.EMAIL_SECURE === "true"
    : EMAIL_PORT === 465;

// Default "From" address. Must be a sender/domain you've verified with your
// email provider (e.g. Brevo). Format: "Display Name <address@domain>".
const EMAIL_FROM = process.env.EMAIL_FROM || "Famlink <noreply@famlink.care>";

// From / Reply-To for automated (transactional) emails. Falls back to
// EMAIL_FROM so deliverability is never worse than before when the dedicated
// mailbox isn't verified with the provider yet.
const FROM_AUTOMATED = process.env.EMAIL_FROM_AUTOMATED || EMAIL_FROM;
const REPLY_SUPPORT = process.env.EMAIL_REPLY_SUPPORT || "support@famlink.care";

// The founder-voice emails (14 waitlist, 15 feedback request, 16 re-engagement,
// 20 onboarding nudge, 21 feedback received) are sent from here like everything
// else, but they are written and signed by the founder and several of them
// invite a reply. That invitation is real: the ari@famlink.care mailbox is
// monitored, and replies to these are read and answered there.
//
// Reply-To can be any address — the provider doesn't verify it — so it points
// at the founder unconditionally. The From address is the opposite: sending as
// ari@famlink.care only works once that mailbox is verified with the provider,
// and an unverified sender is rejected outright. So From defaults to the
// already-verified automated sender and is opted into via EMAIL_FROM_FOUNDER
// ("Ari Parker <ari@famlink.care>") once the mailbox is set up.
const REPLY_FOUNDER = process.env.EMAIL_REPLY_FOUNDER || "ari@famlink.care";
const FROM_FOUNDER = process.env.EMAIL_FROM_FOUNDER || FROM_AUTOMATED;

// ── Auth mode: Microsoft 365 OAuth2 (app-only) with basic-auth fallback ──
// When the OAuth2 env vars are present, authenticate to Office 365 SMTP with an
// Entra ID app via the client-credentials flow (no password). Otherwise fall
// back to basic auth using EMAIL_USER / EMAIL_PASS.
const OAUTH_TENANT_ID = process.env.EMAIL_OAUTH_TENANT_ID || "";
const OAUTH_CLIENT_ID = process.env.EMAIL_OAUTH_CLIENT_ID || "";
const OAUTH_CLIENT_SECRET = process.env.EMAIL_OAUTH_CLIENT_SECRET || "";
const USE_OAUTH2 = Boolean(OAUTH_TENANT_ID && OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET);

// Cached Office 365 access token (valid ~60 min); refreshed on demand.
let tokenCache = { accessToken: null, expiresAt: 0 };

const fetchM365Token = async () => {
    const now = Date.now();
    // Reuse the cached token until 5 minutes before it expires.
    if (tokenCache.accessToken && tokenCache.expiresAt - now > 5 * 60 * 1000) {
        return tokenCache.accessToken;
    }
    const tokenUrl = `https://login.microsoftonline.com/${OAUTH_TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "https://outlook.office365.com/.default",
    });
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Microsoft 365 OAuth2 token request failed (${response.status}): ${detail}`);
    }
    const data = await response.json();
    tokenCache = {
        accessToken: data.access_token,
        expiresAt: now + Number(data.expires_in || 3600) * 1000,
    };
    return tokenCache.accessToken;
};

// ── Connection pooling and submission rate ───────────────────────────────────
// Without a pool nodemailer opens a fresh TCP connection — and performs a fresh
// SMTP AUTH — for every single message. That costs nothing on the one-off
// transactional sends, but the weekly digests loop over hundreds of recipients:
// on 2026-08-05 the "new users in area" run authenticated 72 times in fourteen
// minutes, Exchange Online throttled the mailbox, and it tarpitted every
// attempt for ~12s before answering `535 5.7.139 Authentication unsuccessful,
// the user credentials were incorrect`. All 72 were lost. The credentials were
// never wrong: single sends went through on the same secrets three hours before
// the run and ten hours after it.
//
// Pooling collapses a whole batch onto one authenticated connection, and the
// rate limiter holds submission under Exchange Online's ceiling of 30
// messages/minute over at most 3 concurrent connections. The limiter now paces
// every sender, so the per-recipient sleeps in Services/cron/* are a floor on
// top of it rather than the thing keeping us inside the limit.
const POOL_OPTIONS = {
    pool: true,
    maxConnections: Number(process.env.EMAIL_MAX_CONNECTIONS) || 1,
    // Recycle the connection periodically — providers cap messages per
    // connection, and a stale long-lived socket is worse than a new one.
    maxMessages: Number(process.env.EMAIL_MAX_MESSAGES) || 50,
    rateDelta: 60 * 1000,
    rateLimit: Number(process.env.EMAIL_RATE_LIMIT) || 25,
};

// Build (and memoize) the underlying nodemailer transport. For OAuth2 we
// recreate it whenever the access token changes.
let _transport = null;
let _transportToken = null;

const getTransport = async () => {
    if (!USE_OAUTH2) {
        if (!_transport) {
            _transport = nodemailer.createTransport({
                host: EMAIL_HOST,
                port: EMAIL_PORT,
                secure: EMAIL_SECURE,
                auth: { user: EMAIL_USER, pass: EMAIL_PASS },
                tls: { rejectUnauthorized: false },
                ...POOL_OPTIONS,
            });
        }
        return _transport;
    }

    const accessToken = await fetchM365Token();
    if (!_transport || _transportToken !== accessToken) {
        // Now that the transport pools, replacing it without closing the old
        // one would leak an authenticated connection per token refresh —
        // straight into the provider's concurrent-connection limit.
        if (_transport) _transport.close();
        _transport = nodemailer.createTransport({
            host: EMAIL_HOST,
            port: EMAIL_PORT,
            secure: EMAIL_SECURE,
            auth: {
                type: "OAuth2",
                user: EMAIL_USER,
                accessToken,
            },
            tls: { rejectUnauthorized: false },
            ...POOL_OPTIONS,
        });
        _transportToken = accessToken;
    }
    return _transport;
};

// Thin proxy so every existing sender (callback- or promise-based) keeps working
// unchanged while auth/token is resolved lazily on each send.
const transporter = {
    async sendMail(mailOptions, callback) {
        try {
            const transport = await getTransport();
            const info = await transport.sendMail(mailOptions);
            if (callback) return callback(null, info);
            return info;
        } catch (error) {
            if (callback) return callback(error);
            throw error;
        }
    },
    async verify(callback) {
        try {
            const transport = await getTransport();
            const result = await transport.verify();
            if (callback) return callback(null, result);
            return result;
        } catch (error) {
            if (callback) return callback(error);
            throw error;
        }
    },
};

/**
 * Check the credentials once, at startup.
 *
 * This used to run as a side effect of importing email.js, which meant any test
 * that touched a template opened a real socket to the mail host. It is now
 * something the process does on purpose: the dispatcher calls it when it
 * starts. A failure is reported and swallowed — a mail host that is unreachable
 * at boot must not stop the app serving traffic, and the queue holds the
 * messages until it comes back.
 */
export const verifyTransport = async () => {
    try {
        await transporter.verify();
        console.log(
            `✅ Email transporter ready (mode=${USE_OAUTH2 ? "OAuth2" : "basic"}, host=${EMAIL_HOST}, port=${EMAIL_PORT}, secure=${EMAIL_SECURE}).`
        );
        return true;
    } catch (error) {
        console.error(
            `❌ Email transporter failed to connect/authenticate ` +
            `(mode=${USE_OAUTH2 ? "OAuth2" : "basic"}, host=${EMAIL_HOST}, port=${EMAIL_PORT}, secure=${EMAIL_SECURE}, user=${EMAIL_USER || "<empty>"}). ` +
            (USE_OAUTH2
                ? `Check EMAIL_OAUTH_TENANT_ID / EMAIL_OAUTH_CLIENT_ID / EMAIL_OAUTH_CLIENT_SECRET, that the app has the Office 365 "SMTP.SendAsApp" application permission with admin consent, that a service principal for it has been granted access to ${EMAIL_USER}, and that SMTP AUTH is enabled for that mailbox. `
                : `Check EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE / EMAIL_USER / EMAIL_PASS. `) +
            `Reason:`,
            error.message
        );
        return false;
    }
};

export { transporter, EMAIL_FROM, FROM_AUTOMATED, FROM_FOUNDER, REPLY_SUPPORT, REPLY_FOUNDER };
