import express from "express";
import cors from "cors";
import helmet from "helmet";
import { buildCorsOptions } from "./http/corsPolicy.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ModuleRegistry } from "./http/ModuleRegistry.js";
import { errorHandler, notFoundHandler } from "./http/middleware/errorHandler.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Builds the Express application: middleware pipeline, feature modules, error
 * boundary. It deliberately does not listen on a port — that is Server's job.
 *
 * Splitting those two apart is what makes the app testable. A supertest run
 * needs an app object, not a bound socket, and the previous index.js only ever
 * produced the latter as a side effect of being imported. `new Application().build()`
 * gives you the former with no port, no database connection, and no cron jobs.
 */
export class Application {
  /**
   * @param {object} options
   * @param {ModuleRegistry} options.registry  Feature modules to mount.
   * @param {import("express").Router[]} [options.rawBodyRouters]
   *   Routers mounted *before* the JSON body parser, each as `[path, router]`.
   *   Stripe's webhook needs the unparsed body to verify its signature, so
   *   ordering here is load-bearing rather than stylistic: parse first and
   *   every delivery fails its signature check, which means a customer pays
   *   and never gets `premium`.
   * @param {object} [options.cors]  Passed through to the cors middleware.
   * @param {import("express").Router|null} [options.legacyRouter]
   *   The original Routes/ tree, mounted *after* the feature modules while the
   *   migration is in progress. Express matches in registration order, so a
   *   prefix that has moved is answered by its module and never falls through
   *   here — which is what lets both exist without the old file being edited in
   *   lockstep. Null once every module has migrated, and then this parameter
   *   and the Routes/ directory go away together.
   */
  constructor({
    registry = new ModuleRegistry(),
    rawBodyRouters = [],
    legacyRouter = null,
    // Defaults to the allowlist built from config rather than `{ origin: "*" }`.
    // Still overridable, which is what the tests use.
    cors: corsOptions = buildCorsOptions(),
  } = {}) {
    this.registry = registry;
    this.rawBodyRouters = rawBodyRouters;
    this.legacyRouter = legacyRouter;
    this.corsOptions = corsOptions;
    this.app = null;
  }

  /** @returns {import("express").Express} */
  build() {
    const app = express();

    // Ahead of the body parser — see rawBodyRouters above. Modules that declare
    // `static rawBody = true` land here too, so a webhook that signs its payload
    // does not depend on the bootstrap remembering it.
    const rawModules = this.registry.createRawBodyRouter();
    if (rawModules) app.use("/", rawModules);

    for (const [mountPath, router] of this.rawBodyRouters) {
      app.use(mountPath, router);
    }

    // Behind fly.io's proxy, so req.ip / req.protocol are the proxy's unless
    // Express is told to read X-Forwarded-*. Without it `req.secure` is false
    // on every request and req.ip is one address for the whole internet.
    //
    // Note the rate limiter does NOT rely on this — it reads Fly-Client-IP,
    // which the proxy overwrites and a caller therefore cannot forge, and
    // X-Forwarded-For (which is forgeable) only as a fallback. See clientIp().
    app.set("trust proxy", 1);

    // Security response headers. Chiefly: nosniff, frameguard (clickjacking),
    // Referrer-Policy, and HSTS in production.
    //
    // CSP is left off deliberately. This process serves a JSON API plus the
    // uploaded files below — it renders no HTML of its own, so a policy here
    // protects nothing, while a wrong one silently breaks image loading. The
    // CSP that matters belongs on the frontend's own origin.
    //
    // crossOriginResourcePolicy is relaxed to cross-origin because the frontend
    // is served from a different origin and loads member avatars from
    // /assets/uploads; helmet's default of same-origin would block them.
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );

    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use(cors(this.corsOptions));

    this.#mountStatic(app);

    // A liveness probe that does not touch the database, so it answers while
    // the database is down — which is exactly when you need to know the process
    // itself is still up.
    app.get("/health", (_req, res) =>
      res.status(200).json({ status: "ok", uptime: process.uptime() })
    );

    app.use("/", this.registry.createRouter());

    // Strictly after the modules — see the constructor.
    if (this.legacyRouter) app.use("/", this.legacyRouter);

    // Order is fixed: unmatched paths become a 404, then every error — thrown,
    // rejected, or forwarded — converges on the single handler.
    app.use(notFoundHandler);
    app.use(errorHandler);

    this.app = app;
    return app;
  }

  /** User-uploaded files served straight off disk, as before. */
  #mountStatic(app) {
    app.use("/assets/uploads", express.static(path.join(packageRoot, "assets/uploads")));
    app.use("/assets/audio", express.static(path.join(packageRoot, "assets/audio")));
  }

  /** The route table this application serves. Used by the parity test. */
  describeRoutes() {
    return this.registry.describe();
  }
}

export default Application;
