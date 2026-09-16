import { getShareProfileCopy } from "../../src/features/share-link/shareProfileCopy.js";
import {
  buildShareCardModel,
  buildShareDescription,
  SHARE_TOKEN_PATTERN,
} from "../../src/features/share-link/shareCardModel.js";

// Open Graph rendering for /share/<token>.
//
// The share page itself is React, and its <meta> tags are written by react-helmet
// once the bundle boots. Facebook, WhatsApp and iMessage never boot it — they
// fetch the HTML and read it as text. Without this, every shared link fell
// through Vercel's SPA rewrite to the plain index.html and previewed as the
// generic homepage ad ("Nanny Share Made Simple"), with og:url pointing at
// famlink.care rather than the share. That is the one moment the whole feature
// turns on: the link is sitting in a parents' Facebook group, and it has to read
// as an available nanny share, not as an advert for a product.
//
// So this renders the same shell with the opportunity's own title and
// description substituted in. Humans get byte-identical markup plus better tags
// — the SPA still boots, React Router still renders SharedProfilePage, and
// react-helmet harmlessly rewrites the head it finds. There is no second copy of
// the page to keep in step.
//
// Wired up by the /share/:token rewrite in vercel.json, which must stay ahead of
// the catch-all or this never runs.

// The public origin, not the deployment's own host: a link shared from a preview
// deploy should still advertise the canonical URL, and og:url is what several
// scrapers treat as the thing being shared.
const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://famlink.care").replace(/\/$/, "");

// Vercel exposes every project env var to functions, so the frontend's own
// VITE_ variable works as a fallback and one-variable setups keep working.
const API_BASE = (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const metaBlock = ({ title, description, url, image }) => {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  return `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta property="og:site_name" content="FamLink" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${d}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <!-- Shared profiles stay out of search: a link meant for one parents' group
         has no business being indexed. Social scrapers ignore this and still
         build their preview, which is the point. -->
    <meta name="robots" content="noindex, nofollow" />
`;
};

/* Swap the shell's tags rather than appending ours. Appending would leave two
   og:title tags in the head and let the crawler pick, which in practice means
   the first one — the homepage's. */
const injectMeta = (html, tags) =>
  html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']*["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*\bname=["']twitter:[^"']*["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*\bname=["']description["'][^>]*>/gi, "")
    .replace(/<head([^>]*)>/i, `<head$1>${tags}`);

/* The built index.html, read back over HTTP from this same deployment. Vercel
   checks the filesystem before it applies rewrites, so /index.html resolves to
   the real file and not back through the catch-all into this function. Reading
   it at request time is what keeps the hashed asset filenames correct without
   this function knowing anything about the build. */
const fetchShell = async (origin) => {
  const response = await fetch(`${origin}/index.html`, {
    headers: { "user-agent": "famlink-share-og" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`shell ${response.status}`);
  return response.text();
};

const fetchProfile = async (token) => {
  if (!API_BASE) return null;
  const response = await fetch(`${API_BASE}/share/public/${encodeURIComponent(token)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.data || null;
};

export default async function handler(req, res) {
  const { token } = req.query;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const origin = `${proto}://${host}`;

  let shell;
  try {
    shell = await fetchShell(origin);
  } catch (error) {
    // Without the shell there is no page to serve and no useful fallback that
    // still boots the app, so let Vercel serve its own error rather than
    // shipping a blank document that looks like a dead link.
    console.error("Share OG: could not read index.html:", error);
    return res.status(500).send("Unable to load the page.");
  }

  // Everything past this point is decoration. A bad token, an API that is down
  // or slow, a profile that was deleted — all of it degrades to the unmodified
  // shell, which boots the SPA and shows either the real page or its own "no
  // longer available" state. A preview is never worth failing a page load over.
  let profile = null;
  if (typeof token === "string" && SHARE_TOKEN_PATTERN.test(token)) {
    try {
      profile = await fetchProfile(token);
    } catch (error) {
      console.error(`Share OG: lookup failed for ${token}:`, error);
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!profile) {
    // Not cached at the edge: this branch is usually a transient API failure,
    // and caching it would pin the generic preview onto a live share for the
    // whole TTL — the exact bug this function exists to remove.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(shell);
  }

  const copy = getShareProfileCopy(profile.variant);
  const description = buildShareDescription(buildShareCardModel(profile));

  // Cached at the edge, not in the browser. Crawlers re-scrape on their own
  // schedule and a share's rate or start date can change; five minutes keeps a
  // burst of shares off the API without pinning stale details to a link.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");

  return res.status(200).send(
    injectMeta(
      shell,
      metaBlock({
        title: copy.headline,
        description: description || copy.subheadline,
        url: `${SITE_URL}/share/${encodeURIComponent(token)}`,
        // The card, drawn (api/share-og.js). Absolute and on the canonical
        // origin because a crawler resolves og:image on its own, with no page
        // context to make a relative path work.
        image: `${SITE_URL}/api/share-og?token=${encodeURIComponent(token)}`,
      })
    )
  );
}
