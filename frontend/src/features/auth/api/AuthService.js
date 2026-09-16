import { HttpService } from "@shared/api/HttpService";

/**
 * Asks the server to keep the refresh token in an httpOnly cookie rather than
 * returning it in the response body.
 *
 * Sent by the four calls that establish, renew or end a session, and by nothing
 * else — a custom header makes a request preflighted, and there is no reason to
 * spend an extra round trip on the two hundred endpoints that never touch the
 * refresh token.
 *
 * It does double duty on the server. `/auth/refreshToken` and `/auth/logout`
 * are authenticated by a cookie the browser attaches automatically, which is
 * the shape a CSRF attack relies on; the server ignores that cookie unless this
 * header is present, and a cross-site page cannot set it. See the backend's
 * modules/auth/refreshCookie.js.
 */
const COOKIE_SESSION = { headers: { "X-Session-Transport": "cookie" } };

/**
 * Every endpoint the auth feature talks to, in one place.
 *
 * The thunks in ../store keep owning Redux state; this owns the URLs. Splitting
 * them that way means an endpoint change is a one-line edit here rather than a
 * hunt through reducers, and the calls can be tested by handing the constructor
 * a fake client instead of standing up a store.
 *
 * No method builds an Authorization header. The client's request interceptor
 * does that from the store — see @shared/api/client — and the hand-rolled
 * headers these calls used to carry were duplicating it.
 */
export class AuthService extends HttpService {
  login(credentials) {
    return this.post("/auth/login", credentials, COOKIE_SESSION);
  }

  register(payload) {
    return this.post("/auth/register", payload);
  }

  checkUser(body) {
    return this.post("/auth/check-user", body);
  }

  /**
   * Takes no argument any more: the token is in a cookie the browser sends, and
   * the app no longer holds a copy to pass.
   *
   * `skipSessionGate` is what stops this deadlocking. Every other request waits
   * for the session restore to finish, and the session restore is this call —
   * see the gate in @shared/api/client.
   */
  refreshToken() {
    return this.post("/auth/refreshToken", null, {
      ...COOKIE_SESSION,
      skipSessionGate: true,
    });
  }

  /**
   * Ends the session on the server and clears the cookie.
   *
   * Signing out used to be entirely a client-side matter — clear Redux, purge
   * localStorage, done. It cannot be now: JavaScript has no way to delete an
   * httpOnly cookie, so without this call the browser would keep presenting a
   * working refresh token after the member had signed out.
   */
  logout() {
    return this.post("/auth/logout", null, {
      ...COOKIE_SESSION,
      skipSessionGate: true,
    });
  }

  editUser(userData) {
    return this.put("/edit/user", userData);
  }

  updateNannyProfile(profileData) {
    return this.patch("/nanny/nanny-share/profile", profileData);
  }

  verifyUser(userData) {
    return this.post("/verify", userData);
  }

  /**
   * These three take no body.
   *
   * They previously read `api.post("/auth/send-otp", config)`, and axios's
   * signature is post(url, data, config) — so the config object became the
   * request body and the access token inside it was posted as payload. The
   * header was set anyway by the interceptor, so the call still worked and the
   * mistake stayed invisible; the only symptom was a token in a place it had no
   * reason to be. Passing no body is both correct and what the server expects.
   */
  sendOtp() {
    return this.post("/auth/send-otp");
  }

  // Carries the transport header because verifying an email mints a fresh pair,
  // and that pair must land in the cookie like every other one. Without it the
  // server would answer this one endpoint the old way and hand the refresh
  // token back to JavaScript.
  verifyOtp(oneTimePass) {
    return this.post("/auth/verify-otp", oneTimePass, COOKIE_SESSION);
  }

  resendOtp() {
    return this.post("/auth/resend-otp");
  }

  /**
   * `/userData/users/:id`, not `/user/:id` — the latter has never existed, so
   * every "delete my account" confirmation 404'd and the modal's .catch()
   * swallowed it to the console. The account was not deleted and the member was
   * told nothing.
   */
  deleteUser(userId) {
    return this.delete(`/userData/users/${userId}`);
  }
}

/** The instance the thunks use. Construct your own in tests with a fake client. */
export const authService = new AuthService();

export default authService;
