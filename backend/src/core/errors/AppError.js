/**
 * The base class for every error this application raises deliberately.
 *
 * Before this existed, a handler that wanted to reject a request wrote
 * `return res.status(403).json({ message: "..." })` inline, which meant the
 * status code and the wording lived in the middle of business logic and could
 * only be produced by code that had a `res` in scope. A service class has no
 * `res` — that is the whole point of separating it from the controller — so it
 * needs a way to say "this is a 403" without touching HTTP. It throws one of
 * these, and the error middleware turns it into the response.
 *
 * `isOperational` is the distinction that matters at the boundary: an
 * operational error is an expected outcome (the caller asked for a user that
 * doesn't exist) and its message is safe to show. Anything else — a TypeError,
 * a driver failure — is a bug, and the middleware replaces its message with a
 * generic one so an internal detail never reaches a client.
 */
export class AppError extends Error {
  /**
   * @param {string} message  Safe to show the caller when isOperational.
   * @param {number} statusCode  HTTP status the error middleware will send.
   * @param {object} [options]
   * @param {string} [options.code]  Stable machine-readable identifier. The
   *   frontend switches on this — e.g. "REFERRAL_REQUIRED" decides whether to
   *   show the referral modal or the subscribe modal — so it must stay stable
   *   even when the human-readable message is reworded.
   * @param {unknown} [options.details]  Field-level context, e.g. validation
   *   failures keyed by field name.
   * @param {Error} [options.cause]  The lower-level error this wraps, kept for
   *   the log without leaking into the response.
   * @param {boolean} [options.expose]  Force whether the message reaches the
   *   caller, overriding the status-based default. Needed for the handful of
   *   5xx responses whose wording is deliberate and safe — "Could not look up
   *   that address" tells the signup form what to render, and replacing it with
   *   a generic message would be a downgrade. Only ever set it for a message
   *   this codebase authored; never for one that came from an upstream service.
   */
  constructor(message, statusCode = 500, { code, details, cause, expose } = {}) {
    super(message, cause ? { cause } : undefined);

    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // A 5xx means "we broke", and we do not describe how. Everything below 500
    // is a decision this code made about a request it understood, so its
    // message was written to be read by the caller.
    this.isOperational = expose ?? statusCode < 500;

    Error.captureStackTrace?.(this, new.target);
  }

  /**
   * The response body for this error. Only ever called by the error middleware.
   * Keys are omitted rather than sent as null so a client can use `in` checks.
   */
  toResponse() {
    const body = { message: this.message };
    if (this.code) body.code = this.code;
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}
