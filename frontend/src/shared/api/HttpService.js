import { api } from "@shared/api/client";

/**
 * Base class for a feature's API service.
 *
 * A service owns the URLs of one feature and nothing else: no Redux, no React,
 * no toasts. That keeps the endpoints greppable in one file per feature and
 * makes them testable without a store — a service is constructed with a client,
 * so a test passes a fake one instead of mocking a module.
 *
 * Two things deliberately do NOT belong in subclasses:
 *
 *   Authorization headers.  The client's request interceptor attaches the
 *                           session to every request, reading it from the store
 *                           so there is no window after login where it is stale.
 *                           Fifty-seven call sites used to rebuild that header
 *                           by hand; every one of them was reimplementing the
 *                           interceptor with no way to benefit from its fix.
 *
 *   Error shaping.          Callers catch what axios threw, unchanged, so
 *                           existing `error.response.data` handling keeps
 *                           working. The one adjustment is below.
 */
export class HttpService {
  /**
   * @param {import("axios").AxiosInstance} client  swapped for a fake in tests
   */
  constructor(client = api) {
    this.client = client;
  }

  /**
   * Issue a request and hand back the two fields callers actually read.
   *
   * Returning `{ data, status }` rather than the whole axios response keeps the
   * thunks that call these methods identical to how they were written.
   *
   * The two axios call shapes are kept in separate methods on purpose. axios
   * spells them `get(url, config)` but `post(url, data, config)`, and a single
   * helper that tries to serve both has to guess from arity — which is exactly
   * how `api.post("/auth/send-otp", config)` came to post the caller's headers
   * as the request body. Here a config can never land in a body position,
   * because the body-taking methods always pass three arguments.
   */
  async #settle(call) {
    try {
      const response = await call();
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.#withResponse(error);
    }
  }

  /**
   * Guarantee `error.response.data` exists before rethrowing.
   *
   * Most thunks in this app read `error.response.data` with no optional
   * chaining. That is fine for a 4xx, which carries a response — but a dropped
   * connection or a timeout produces an axios error with `response` undefined,
   * so the catch block itself throws a TypeError. The rejected thunk never
   * settles with a useful value and the UI is left on its loading state with
   * nothing on screen to explain it.
   *
   * The original error object is preserved and only filled in, so anything
   * reading `error.code`, `error.message` or a real response sees no change.
   */
  #withResponse(error) {
    if (error?.response?.data !== undefined) return error;

    const message =
      error?.code === "ECONNABORTED"
        ? "That request timed out. Please try again."
        : "We couldn't reach the server. Check your connection and try again.";

    error.response = { ...(error.response ?? {}), data: { message } };
    return error;
  }

  // ── No body: axios reads the second argument as config. ────────────────────
  get(url, config) {
    return this.#settle(() => this.client.get(url, config));
  }

  delete(url, config) {
    return this.#settle(() => this.client.delete(url, config));
  }

  // ── Body in the second position, config always in the third. ───────────────
  post(url, body = null, config) {
    return this.#settle(() => this.client.post(url, body, config));
  }

  put(url, body = null, config) {
    return this.#settle(() => this.client.put(url, body, config));
  }

  patch(url, body = null, config) {
    return this.#settle(() => this.client.patch(url, body, config));
  }
}

export default HttpService;
