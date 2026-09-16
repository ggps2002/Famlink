import { Router } from "express";

/**
 * The contract every feature module implements to expose HTTP endpoints.
 *
 * A module declares where it mounts (`basePath`) and what it registers
 * (`registerRoutes`), and the registry does the rest. The value over the old
 * arrangement — a 50-line Routes/index.js listing imports and `router.use`
 * calls that had to be kept in sync by hand — is that mounting is derived from
 * the module itself. Adding an endpoint means touching one folder, and a
 * module that is registered cannot disagree with itself about its own prefix.
 *
 * It also makes the route table readable at runtime, which is what the route
 * parity test asserts against: `describe()` returns every path and method this
 * module serves, so a handler that silently disappears during a refactor fails
 * a test instead of a user's request.
 */
export class RouteModule {
  /**
   * @param {object} [options]
   * @param {import("express").RouterOptions} [options.routerOptions]
   *   `mergeParams` matters for modules mounted under a parameterised prefix.
   */
  constructor({ routerOptions } = {}) {
    if (new.target === RouteModule) {
      throw new Error("RouteModule is abstract — extend it.");
    }

    this.router = Router(routerOptions);
    this.registerRoutes(this.router);
  }

  /**
   * Where this module mounts, e.g. "/match". Subclasses override with a static
   * field; read through the instance so both spellings work.
   */
  get basePath() {
    const declared = this.constructor.basePath;
    if (!declared) {
      throw new Error(`${this.constructor.name} must declare a static basePath.`);
    }
    return declared;
  }

  /** Human-readable module name, used in the boot log and the route manifest. */
  get name() {
    return this.constructor.moduleName ?? this.constructor.name.replace(/Module$/, "");
  }

  /**
   * Whether this module must be mounted ahead of the JSON body parser.
   *
   * True for exactly one kind of endpoint: a webhook whose sender signs the
   * literal bytes of the request. `express.json()` consumes the stream and
   * hands on a parsed object, and re-serialising that object does not reproduce
   * the original bytes — key order and whitespace differ — so the signature
   * never verifies again.
   *
   * Declared by the module rather than listed in the bootstrap so that the
   * requirement travels with the code that has it. A module moved or renamed
   * cannot leave a stale entry behind in a list somewhere else.
   *
   * This flag decides only *where* the module mounts. It still has to bring its
   * own parser — `express.raw({ type: "application/json" })` on the route —
   * because mounting early means no parser has run at all, and `req.body` would
   * otherwise be undefined rather than a Buffer.
   */
  static rawBody = false;

  get needsRawBody() {
    return this.constructor.rawBody === true;
  }

  /**
   * Attach this module's endpoints to `router`.
   * @param {import("express").Router} _router
   * @abstract
   */
  registerRoutes(_router) {
    throw new Error(`${this.constructor.name} must implement registerRoutes(router).`);
  }

  /**
   * Every route this module serves, as `{ method, path }` pairs with the
   * basePath already applied. Walks Express's own router stack, so it reports
   * what is actually mounted rather than what a manifest claims is mounted.
   */
  describe() {
    return RouteModule.describeRouter(this.router, this.basePath).map((route) => ({
      ...route,
      module: this.name,
    }));
  }

  /** Recursively flatten an Express router into `{ method, path }` pairs. */
  static describeRouter(router, prefix = "") {
    const routes = [];

    for (const layer of router.stack ?? []) {
      if (layer.route) {
        const path = `${prefix}${layer.route.path}`.replace(/\/+$/, "") || "/";
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (enabled) routes.push({ method: method.toUpperCase(), path });
        }
        continue;
      }

      // A nested router mounted with router.use(). Express keeps the mount path
      // only as a regexp, so recover the literal prefix from it.
      if (layer.name === "router" && layer.handle?.stack) {
        const mount = RouteModule.#mountPathOf(layer);
        routes.push(...RouteModule.describeRouter(layer.handle, `${prefix}${mount}`));
      }
    }

    return routes;
  }

  /**
   * Recover the literal mount path of a nested router from its layer.
   *
   * Express 4 stores it as a regexp built from the string, so this reverses
   * that encoding. Express 5 exposes it directly; both are handled because the
   * fallback is only a display concern for the manifest.
   */
  static #mountPathOf(layer) {
    if (typeof layer.path === "string") return layer.path;

    const source = layer.regexp?.source ?? "";
    if (source === "^\\/?$" || source === "^\\/?(?=\\/|$)") return "";

    const match = source
      .replace("^", "")
      .replace("\\/?(?=\\/|$)", "")
      .replace("(?=\\/|$)", "")
      .replace(/\$$/, "");

    return match.replace(/\\\//g, "/");
  }
}

export default RouteModule;
