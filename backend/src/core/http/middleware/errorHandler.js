import mongoose from "mongoose";
import config from "../../../config/index.js";
import { AppError } from "../../errors/AppError.js";

/**
 * The single place an error becomes a response.
 *
 * Everything upstream — controllers, services, repositories — either returns a
 * value or throws. That is only safe if exactly one thing at the boundary knows
 * how to answer, and this is it.
 *
 * The rule it enforces: a 5xx never describes itself. An operational error
 * (4xx) carries a message written to be read by the caller, so it is sent as
 * written. Anything else is a bug, and its message — a stack-derived string, a
 * driver error naming a collection and an index — is replaced. Getting this
 * backwards is how internal schema details end up in a client's console.
 */

/** Translate the framework/driver errors that shouldn't surface as 500s. */
const normalise = (error) => {
  if (error instanceof AppError) return error;

  // Mongoose could not cast a path — almost always a malformed id in the URL.
  if (error instanceof mongoose.Error.CastError) {
    return new AppError(`Invalid ${error.path}`, 400, { code: "VALIDATION_ERROR" });
  }

  // Schema validation. Reported per field: these are the caller's own inputs,
  // so naming them is useful rather than leaky.
  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(error.errors).map(([field, e]) => [field, e.message])
    );
    return new AppError("Validation failed", 400, {
      code: "VALIDATION_ERROR",
      details,
    });
  }

  // Duplicate key. The field name is echoed but never the value — the classic
  // instance is a duplicate email, and reflecting it back turns a signup form
  // into a membership oracle.
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? "value";
    return new AppError(`That ${field} is already in use`, 409, { code: "CONFLICT" });
  }

  // Bodies that failed to parse. express.json() throws these before any route
  // runs, and untranslated they read as a server fault.
  if (error?.type === "entity.parse.failed") {
    return new AppError("Malformed JSON body", 400, { code: "VALIDATION_ERROR" });
  }

  if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
    return new AppError("Invalid or expired token", 401, { code: "UNAUTHORIZED" });
  }

  // Rejected uploads. Multer throws these from inside the route middleware, so
  // untranslated they surface as a 500 — telling somebody whose holiday photo
  // was too large that the server broke, which invites them to retry the same
  // upload until it does.
  if (error?.name === "MulterError") {
    return new AppError(MULTER_MESSAGES[error.code] ?? "That upload was rejected.", 400, {
      code: "UPLOAD_REJECTED",
      // Which field, when multer knows. Safe to echo: it is the form's own
      // field name, chosen by us, not anything the caller supplied.
      details: error.field ? { field: error.field } : undefined,
    });
  }

  return null;
};

/**
 * What each multer failure means to the person who hit it.
 *
 * Written for the uploader rather than the developer: every one of these is
 * something they can act on, and "LIMIT_FILE_SIZE" is not.
 */
const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: "That file is too large. The maximum is 10MB.",
  LIMIT_FILE_COUNT: "Too many files. Please upload fewer at once.",
  LIMIT_PART_COUNT: "Too many form fields in that request.",
  LIMIT_FIELD_KEY: "One of the form field names is too long.",
  LIMIT_FIELD_VALUE: "One of the form values is too long.",
  LIMIT_FIELD_COUNT: "Too many form fields in that request.",
  LIMIT_UNEXPECTED_FILE: "A file arrived on a field that does not accept one.",
};

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export const errorHandler = (error, req, res, next) => {
  // Something already started writing. Anything further would corrupt the
  // response, so hand it to Express to destroy the socket.
  if (res.headersSent) return next(error);

  const normalised = normalise(error);
  const statusCode = normalised?.statusCode ?? 500;

  // Server faults are logged with the stack; handled 4xx are not, or a bot
  // probing for endpoints fills the log with noise that hides real failures.
  if (statusCode >= 500) {
    console.error(
      `[error] ${req.method} ${req.originalUrl} → ${statusCode}`,
      error?.stack ?? error
    );
  }

  // A 4xx always speaks for itself; a 5xx only when it explicitly opted in.
  if (normalised?.isOperational) {
    return res.status(statusCode).json(normalised.toResponse());
  }

  const body = { message: "Something went wrong", code: "INTERNAL_ERROR" };

  // The real message and stack, but only off production, where the person
  // reading the response is the person who caused the bug.
  if (!config.isProduction) {
    body.debug = { message: error?.message, stack: error?.stack };
  }

  return res.status(500).json(body);
};

/** Terminal 404 for any path no module claimed. Mounted after every route. */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND",
  });
};

export default errorHandler;
