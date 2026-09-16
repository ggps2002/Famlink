import config from "../../config/index.js";

/**
 * The refresh token's transport: an httpOnly cookie, and the header that opts
 * a client into it.
 *
 * ── Why a cookie ─────────────────────────────────────────────────────────────
 *
 * The refresh token used to be returned in the JSON body, kept in Redux and
 * written to localStorage by redux-persist. Any script running on the page
 * could read it, and it stayed valid for seven days — so a single XSS bought an
 * attacker a week of the victim's account, usable from their own machine long
 * after the injected script was gone. `httpOnly` is the only thing that takes
 * that away from JavaScript entirely.
 *
 * ── Why an opt-in header rather than just switching ──────────────────────────
 *
 * `/auth/login` is not called only by this repository's frontend: the admin
 * console is a separate application, and removing `refreshToken` from the
 * response body would strand it with a two-hour session and no way to renew.
 *
 * So the response shape follows what the caller asks for. A client that sends
 * `X-Session-Transport: cookie` gets the cookie and NO token in the body; one
 * that does not gets exactly what it got before. The admin console keeps
 * working unchanged and moves over by sending the same header.
 *
 * This cannot be used to downgrade an attack, which is the obvious worry. The
 * body path only ever hands back a token to a caller that already presented
 * one, and an XSS on the frontend has no token to present — it cannot read the
 * cookie, which is the whole point. Asking without the header therefore gets it
 * nothing.
 *
 * ── Why that header is also the CSRF defence ─────────────────────────────────
 *
 * `Authorization: Bearer` had no CSRF exposure at all: a foreign page cannot
 * set that header. A cookie is sent by the browser automatically, so moving to
 * one introduces CSRF that was not there before — and while the API is
 * cross-site from the frontend the cookie must be `SameSite=None`, which
 * removes the protection `SameSite` would otherwise give.
 *
 * The replacement is the same header: `readRefreshCookie` ignores the cookie
 * unless `X-Session-Transport: cookie` is present. A custom header cannot be
 * set by a cross-site form post, and any fetch/XHR that tries triggers a
 * preflight that the CORS allowlist fails. So a forged cross-site request to
 * /auth/refreshToken or /auth/logout arrives with the cookie attached and is
 * treated as if it had none.
 */

/** Lower-case because Node normalises incoming header names. */
export const SESSION_TRANSPORT_HEADER = "x-session-transport";

/** The one value that means "put the refresh token in a cookie". */
export const COOKIE_TRANSPORT = "cookie";

/**
 * One cookie's value off the raw `Cookie` header.
 *
 * Hand-parsed rather than pulling in `cookie-parser`, which would be a new
 * dependency and a new piece of middleware for one header on two routes. The
 * parsing is deliberately narrow: split on `;`, split each pair on the FIRST
 * `=` (a JWT contains none, but a cookie value in general may), and tolerate a
 * quoted value. Decoding is attempted and falls back to the raw value, because
 * a stray `%` in someone else's cookie must not throw on the way past.
 */
const readCookie = (req, name) => {
  const header = req?.headers?.cookie;
  if (typeof header !== "string" || header === "") return null;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;

    if (pair.slice(0, separator).trim() !== name) continue;

    const raw = pair.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1");
    if (raw === "") return null;

    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  return null;
};

/** Whether this caller wants its session kept in a cookie. */
export const wantsCookieTransport = (req) =>
  req?.headers?.[SESSION_TRANSPORT_HEADER]?.toLowerCase() === COOKIE_TRANSPORT;

/**
 * The refresh token this request presented in its cookie, if any.
 *
 * Returns null when the opt-in header is missing even if the cookie is there —
 * that is the CSRF check described above, not an oversight.
 */
export const readRefreshCookie = (req) => {
  if (!wantsCookieTransport(req)) return null;
  return readCookie(req, config.auth.refreshCookie.name);
};

/** The attributes every Set-Cookie for this token carries. */
const cookieOptions = () => {
  const { secure, sameSite, domain, path } = config.auth.refreshCookie;
  return { httpOnly: true, secure, sameSite, domain, path };
};

/**
 * Write the refresh token to its cookie.
 *
 * `expiresAtUnixSeconds` is the token's own expiry, so the cookie and the
 * credential inside it die together — a cookie outliving its token would leave
 * the browser presenting something the server has already stopped accepting.
 */
export const setRefreshCookie = (res, token, expiresAtUnixSeconds) => {
  res.cookie(config.auth.refreshCookie.name, token, {
    ...cookieOptions(),
    expires: new Date(expiresAtUnixSeconds * 1000),
  });
};

/**
 * Remove the cookie.
 *
 * The attributes have to match the ones it was set with — a browser treats
 * path/domain as part of the cookie's identity, so clearing with a different
 * path silently leaves the original in place. That is why this shares
 * `cookieOptions()` with the setter rather than repeating them.
 */
export const clearRefreshCookie = (res) => {
  res.clearCookie(config.auth.refreshCookie.name, cookieOptions());
};
