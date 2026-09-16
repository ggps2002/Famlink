import crypto from "node:crypto";
import { clientIp } from "../../core/http/middleware/rateLimit.js";

// Ingest-side helpers for first-party web analytics.
//
// Everything that turns a raw beacon into a src/modules/analytics/pageView.model.js row lives here:
// visitor hashing, path normalisation, source classification. The route stays a
// thin validator so the interesting decisions are all in one testable place.

/* ─────────────────────── visitor identity (and its limits) ─────────────────── */

// Salt for the visitor hash, rotated daily.
//
// The rotation is the privacy property, not the hashing. A hash of an IP with a
// fixed salt is a stable pseudonym: an address space small enough to enumerate
// (IPv4 is 2^32, minutes of work) means a fixed-salt hash can be reversed by
// brute force, and even without reversing it, the same visitor is linkable
// across months. Rotating daily caps both — yesterday's salt is gone, so
// yesterday's rows cannot be joined to today's even by us.
//
// The cost is real and worth stating: unique-visitor counts are only meaningful
// within a single day. A 30-day range sums 30 daily figures and will
// double-count anyone who returns. That is the honest number this design can
// produce, and it is reported as "unique visitors per day, summed" rather than
// dressed up as a monthly unique count.
const SALT_SECRET =
  process.env.ANALYTICS_SALT_SECRET || process.env.JWT_SECRET || "famlink-analytics";

const dailySalt = () => {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  return crypto.createHash("sha256").update(`${SALT_SECRET}:${day}`).digest("hex");
};

// The stored visitor identifier. Built from the IP and user-agent so two people
// behind one household NAT are usually still one visitor each, then truncated —
// 16 hex characters is 64 bits, far beyond collision range at our volume, and
// no more of the digest than is needed.
//
// The raw IP is used here and never stored.
export const visitorIdFor = (req) => {
  const ip = clientIp(req);
  const ua = req.headers["user-agent"] || "";
  return crypto
    .createHash("sha256")
    .update(`${dailySalt()}:${ip}:${ua}`)
    .digest("hex")
    .slice(0, 16);
};

/* ───────────────────────────── path normalisation ──────────────────────────── */

// Query strings are discarded here, before anything is written.
//
// This is not tidiness. Marketing and transactional links routinely carry an
// email address or a token in the query — ?email=, our own signed unsubscribe
// links, password-reset URLs — and a visitor whose browser reports one would
// otherwise put it in the analytics table, which is exactly the collection
// designed to hold no personal data. The utm_* trio is read out separately
// before this runs; nothing else survives.
export const normalizePath = (raw) => {
  let path = String(raw || "/");

  // The client sends a pathname, but a full URL turns up often enough (a
  // hand-rolled beacon, a server-side call) to be worth handling.
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    /* not a URL — treat as a path */
  }

  path = path.split("?")[0].split("#")[0].trim().toLowerCase();
  if (!path.startsWith("/")) path = `/${path}`;
  // Collapse repeated slashes and drop the trailing one, so /pricing and
  // /pricing/ are one row rather than two.
  path = path.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";

  // Cap the length: a path is a URL component and an attacker controls it, so
  // it must not become an unbounded write.
  return path.slice(0, 300);
};

/* ──────────────────────────── source classification ────────────────────────── */

const SEARCH_ENGINES = [
  "google.", "bing.", "duckduckgo.", "yahoo.", "ecosia.", "baidu.",
  "yandex.", "brave.", "search.",
];

const SOCIAL_NETWORKS = [
  "facebook.", "fb.", "instagram.", "twitter.", "x.com", "t.co",
  "linkedin.", "lnkd.in", "pinterest.", "reddit.", "nextdoor.",
  "tiktok.", "youtube.", "whatsapp.", "threads.",
];

// Host only. The full referring URL is never stored: it belongs to another site
// and can itself carry that site's query parameters, which is somebody else's
// personal data ending up in our database.
export const referrerHostOf = (referrer) => {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

/**
 * How this visit arrived.
 *
 * utm_* wins over the referrer when present: a campaign link clicked from
 * Facebook is a campaign visit, and attributing it to social instead is how a
 * paid channel silently disappears from the numbers.
 */
export const classifySource = ({ referrerHost, campaign, selfHost }) => {
  if (campaign?.source || campaign?.medium) return "campaign";
  if (!referrerHost) return "direct";
  if (selfHost && referrerHost === String(selfHost).toLowerCase().replace(/^www\./, "")) {
    return "internal";
  }
  if (SEARCH_ENGINES.some((engine) => referrerHost.includes(engine))) return "organic";
  if (SOCIAL_NETWORKS.some((network) => referrerHost.includes(network))) return "social";
  return "referral";
};

// utm_source / utm_medium / utm_campaign, read from the query string the client
// sends alongside the path. Short-capped: these are attacker-controllable and
// end up in a grouped aggregation.
export const parseCampaign = (query = {}) => {
  const clean = (value) => {
    const str = String(value ?? "").trim().slice(0, 100);
    return str || null;
  };
  return {
    source: clean(query.utm_source),
    medium: clean(query.utm_medium),
    name: clean(query.utm_campaign),
  };
};

/* ───────────────────────────────── device ──────────────────────────────────── */

// Coarse buckets from the user-agent. Deliberately crude — a real device
// database would be a fingerprinting surface, and the dashboard only needs to
// answer "is our mobile experience the one that matters".
export const deviceFrom = (userAgent) => {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|windows phone|webos/.test(ua)) return "mobile";
  return "desktop";
};

/* ─────────────────────────────── bot filtering ─────────────────────────────── */

const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|preview|monitor|pingdom|uptime|lighthouse|headless|curl|wget|python-requests|axios|node-fetch|postman/i;

// Crawler traffic is dropped rather than stored and filtered later.
//
// It matters more here than on most sites: the share links exist to be pasted
// into Facebook groups, and Facebook fetches every URL before attaching it to a
// post. Counting those would make a link that nobody clicked look popular, and
// the whole point of the share view counter is telling the founder which
// listings are actually working.
export const isBot = (userAgent) => BOT_PATTERN.test(String(userAgent || ""));
