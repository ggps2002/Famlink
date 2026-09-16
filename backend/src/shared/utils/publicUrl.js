// Base URL for links that leave the platform.
//
// Most URLs the backend builds are for the person who asked: a password-reset
// mail, an unsubscribe link. Those follow FRONTEND_URL wherever it points, and
// on a dev box http://localhost:5173 is the correct answer — the developer is
// the one clicking it.
//
// Share and referral links are the opposite. They are handed to a stranger, or
// posted into a Facebook group, and opened on a machine that is not this one.
// FRONTEND_URL was being used for those too, so a dev environment minted
// http://localhost:5173/share/<token>. Facebook fetches a URL before attaching
// it to a post, cannot reach localhost, and drops it without saying anything —
// the composer just opens empty, which reads as a broken button rather than a
// misconfigured origin.
//
// So these links resolve through a filter instead of a fallback chain: the first
// candidate the public internet could actually reach wins, and a private or
// malformed one is skipped rather than used.

export const PUBLIC_SITE_URL = "https://famlink.care";

export const isPubliclyReachable = (value) => {
  if (!value) return false;
  try {
    const { protocol, hostname } = new URL(value);
    // Plain http gets downgraded or refused by the platforms doing the fetching,
    // and every real deployment of this is https.
    if (protocol !== "https:") return false;
    if (hostname === "localhost" || hostname.endsWith(".local")) return false;
    if (hostname === "127.0.0.1" || hostname === "::1") return false;
    // RFC1918 space — a staging box behind a VPN is not somewhere Facebook goes.
    if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return false;
    return true;
  } catch {
    return false; // not a URL at all
  }
};

/* The public origin, without a trailing slash. `label` names the caller in the
   startup warning — silently serving the fallback is how the localhost links
   went unnoticed, and in production it means an env var is missing. */
export const resolvePublicBaseUrl = (label) => {
  const candidates = [
    // Set this when the public share domain differs from the app's own.
    process.env.SHARE_LINK_BASE_URL,
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
  ];

  const resolved = candidates.find(isPubliclyReachable);

  if (!resolved && process.env.NODE_ENV === "production") {
    console.warn(
      `${label}: no publicly reachable base URL configured ` +
        `(checked SHARE_LINK_BASE_URL, CLIENT_URL, FRONTEND_URL, APP_URL). ` +
        `Falling back to ${PUBLIC_SITE_URL}.`
    );
  }

  return (resolved || PUBLIC_SITE_URL).replace(/\/$/, "");
};
