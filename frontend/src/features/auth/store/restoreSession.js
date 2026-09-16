import { refreshTokenThunk, logout } from "@features/auth/store/authSlice";

/**
 * Turn the refresh cookie back into a signed-in session, once per page load.
 *
 * ── Why a reload needs this at all ───────────────────────────────────────────
 *
 * The access token is held in Redux and nowhere else — not in localStorage, so
 * a reload does not bring one back. What does survive is the httpOnly refresh
 * cookie, which the browser still has and this code cannot read. Trading it for
 * a fresh access token is the whole of "staying signed in" now, and it has to
 * happen before the app starts making requests: the gate in @shared/api/client
 * holds them until this resolves.
 *
 * ── When it does nothing ─────────────────────────────────────────────────────
 *
 * Two cases, and skipping them matters. A token already in the store means this
 * is not a reload — the member signed in a moment ago — and refreshing would
 * rotate a perfectly good session for no reason. No persisted user means nobody
 * was signed in, and a refresh call from every visitor reading a marketing page
 * would be a request per page load that can only ever 401.
 *
 * ── Which failures end the session ───────────────────────────────────────────
 *
 * Any 4xx. The server has looked at what the browser presented and declined to
 * renew it, and the persisted user object is then the last trace of a session
 * that no longer exists — clearing it is what stops the app rendering a
 * dashboard for someone the server does not recognise.
 *
 * Deliberately the whole 4xx range rather than 401 alone, because the commonest
 * case is **400**, not 401. With no cookie at all there is no credential to
 * reject, so the server never reaches that judgement and answers
 * `No token provided` instead. That is exactly what a member meets on their
 * first load after the cookie migration, and on any load after the cookie has
 * expired or been cleared — and treating it as transient left them rendered as
 * signed-in holding no token, every request 401ing until the response
 * interceptor reached the same conclusion the long way round.
 *
 * Anything else — a timeout, a 502, the API briefly down — is not evidence that
 * the session ended, and signing everyone out during a blip is a far worse
 * failure than waiting.
 */

/**
 * Whether the server's answer settles it.
 *
 * A missing status means the request never got a response — no network, DNS, a
 * timeout — which says nothing about the session either way.
 */
const endsTheSession = (status) => status >= 400 && status < 500;

export const restoreSession = async (store) => {
  const auth = store.getState()?.auth;

  if (auth?.accessToken) return;
  if (!auth?.user?._id) return;

  try {
    await store.dispatch(refreshTokenThunk()).unwrap();
  } catch (error) {
    if (endsTheSession(error?.httpStatus)) store.dispatch(logout());
  }
};

export default restoreSession;
