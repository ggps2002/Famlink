import axios from "axios";
import { BACKEND_API_URL } from "@shared/api/url";

export const api = axios.create({
  baseURL: BACKEND_API_URL,
  // Without a timeout a hung request never settles, leaving shared loading
  // flags (e.g. auth.isLoading, which drives the login spinner) stuck on.
  timeout: 30000,
  // The refresh token lives in an httpOnly cookie now, and a cross-origin
  // request does not carry cookies unless it says so. Without this the browser
  // would neither store the cookie the server sets at login nor send it back at
  // refresh, and every session would end when its access token expired.
  //
  // It costs nothing on the other ~200 endpoints: the cookie is scoped to
  // `Path=/auth`, so it is not attached to requests that have no use for it.
  withCredentials: true,
});

/**
 * How the interceptor below finds the current session.
 *
 * This module used to `import { store } from "@app/store"` directly, which made
 * a cycle: store → slices → this module → store. That survived only because
 * `store` was read inside the interceptor, long after every module had
 * finished evaluating — nothing needed the binding at load time.
 *
 * Then a slice imported a service class that does `class X extends HttpService`,
 * which DOES need its import resolved at evaluation time. Entering the cycle at
 * this module left HttpService still in its temporal dead zone when the subclass
 * was declared, and the app failed to boot with "Class extends value undefined".
 *
 * So the dependency is inverted: the store hands its reader to the client
 * (see @app/store), and the client imports nothing from the app. One direction,
 * no cycle, and the lazy read that made the original arrangement work is kept.
 */
let readAccessToken = () => undefined;

export const setAccessTokenReader = (reader) => {
  readAccessToken = reader;
};

/**
 * The gate that holds requests until the session has been restored.
 *
 * ── Why this is needed ───────────────────────────────────────────────────────
 *
 * The access token is no longer written to localStorage, so on every reload the
 * app starts with no token in hand and has to trade the refresh cookie for one.
 * That takes a round trip, and React does not wait: the dashboard's children
 * fire their mount-time requests in the same commit.
 *
 * Letting them go out unauthenticated is not merely wasteful. PageLayout's 401
 * interceptor is installed in an effect, and a parent's effects run AFTER its
 * children's — so the requests fired during that first commit are exactly the
 * ones with no 401 handling behind them. One unauthorized response there is
 * final: no refresh, no retry, and a panel that renders empty until the page is
 * reloaded again.
 *
 * So they wait instead. The delay is one refresh call on a reload and zero on
 * every subsequent request, which is cheaper than the burst of 401s and retries
 * the alternative produces.
 *
 * ── The two escapes ──────────────────────────────────────────────────────────
 *
 * `skipSessionGate` exists for the refresh call itself, which would otherwise
 * be waiting on its own result. Anything else that sets it is a bug.
 *
 * The timeout is the other. A gate that is never opened — storage unavailable,
 * rehydration that never calls back — would hang every request in the app
 * forever, turning a recoverable failure into a blank page. Opening it late and
 * letting the requests take their chances is strictly better than never.
 */
const GATE_TIMEOUT_MS = 10000;

let sessionReady = Promise.resolve();

export const setSessionGate = (promise) => {
  sessionReady = Promise.race([
    // Never rejects: a failed restore means "there is no session", which the
    // requests behind the gate need to find out, not to be blocked by.
    Promise.resolve(promise).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, GATE_TIMEOUT_MS)),
  ]);
};

// Attach the session to every request, taken from the store rather than from
// redux-persist's copy in localStorage.
//
// The persisted copy lags: redux-persist writes "persist:auth" on a timer after
// the reducer runs, so for a beat after login the mirror in storage is still the
// logged-out one. Every request fired in that window — the navbar's referral
// fetch, the dashboard's subscription check, all of them mount-time effects that
// run the instant /dashboard renders — went out with no Authorization header and
// came back 401, and nothing retried them. That's why a nanny's "Upgrade" /
// "Refer a Friend" button stayed missing until the page was reloaded: the CTA
// waits on referral.code, and the only call that sets it had already failed.
// The store is updated synchronously by the login reducer, so there's no window.
//
// The token is read AFTER the gate, never before — the whole point is to read
// the one the restore just put there.
api.interceptors.request.use(
  async (config) => {
    if (!config.skipSessionGate) await sessionReady;

    const accessToken = readAccessToken();

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
