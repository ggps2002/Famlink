/**
 * The error vocabulary services throw.
 *
 * Each subclass fixes a status code so that call sites read as intent
 * ("this user isn't allowed to do that") rather than as protocol ("403"). The
 * default messages are deliberately bland: several of them are returned on
 * paths where a more specific message would confirm something to someone
 * probing — see NotFoundError's use for deleted accounts in the auth module.
 */
import { AppError } from "./AppError.js";

export { AppError };

/** 400 — the request itself is malformed or fails validation. */
export class ValidationError extends AppError {
  constructor(message = "Invalid request", options = {}) {
    super(message, 400, { code: "VALIDATION_ERROR", ...options });
  }
}

/** 401 — no usable credentials. The caller may retry after signing in. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", options = {}) {
    super(message, 401, { code: "UNAUTHORIZED", ...options });
  }
}

/**
 * 403 — the caller is known but not permitted. Distinct from Unauthorized
 * because retrying with a fresh token will not help.
 */
export class ForbiddenError extends AppError {
  constructor(message = "Access denied", options = {}) {
    super(message, 403, { code: "FORBIDDEN", ...options });
  }
}

/** 404 — the addressed resource does not exist, or the caller may not know it does. */
export class NotFoundError extends AppError {
  constructor(message = "Not found", options = {}) {
    super(message, 404, { code: "NOT_FOUND", ...options });
  }
}

/** 409 — the request conflicts with current state, e.g. an email already registered. */
export class ConflictError extends AppError {
  constructor(message = "Already exists", options = {}) {
    super(message, 409, { code: "CONFLICT", ...options });
  }
}

/** 429 — the caller is over a rate limit or a plan quota. */
export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", options = {}) {
    super(message, 429, { code: "RATE_LIMITED", ...options });
  }
}

/**
 * 502 — a third party we depend on failed. Separate from a 500 because the
 * cause is outside this codebase: Stripe, Twilio, Cloudinary, the mail host.
 *
 * `expose` defaults true because the message here is always one we wrote about
 * our own dependency ("Could not look up that address"), and the client needs
 * it to render something useful. The upstream's own error text must never be
 * passed in as this message — it can echo a request URL, and a request URL can
 * contain our API key. Pass it as `cause` instead, which reaches the log only.
 */
export class UpstreamServiceError extends AppError {
  constructor(message = "Upstream service unavailable", options = {}) {
    super(message, 502, { code: "UPSTREAM_ERROR", expose: true, ...options });
  }
}
