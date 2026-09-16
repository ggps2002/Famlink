import { Router } from "express";
import { RouteModule } from "./RouteModule.js";

/**
 * Mounts feature modules onto a single API router.
 *
 * Registration order is preserved and matters in one place: Express matches
 * layers in the order they were added, so a module whose basePath is a prefix
 * of another's would shadow it. The registry refuses duplicate basePaths for
 * the same reason — two modules claiming "/admin" is not a merge, it is one of
 * them never being reached, and that is a failure worth having at boot rather
 * than in production.
 */
export class ModuleRegistry {
  #modules = [];

  /**
   * @param {RouteModule[]} [modules] Instances to register immediately.
   */
  constructor(modules = []) {
    modules.forEach((module) => this.register(module));
  }

  /** @param {RouteModule} module */
  register(module) {
    if (!(module instanceof RouteModule)) {
      throw new TypeError(
        `ModuleRegistry.register expects a RouteModule, received ${module?.constructor?.name ?? typeof module}.`
      );
    }

    const existing = this.#modules.find((m) => m.basePath === module.basePath);
    if (existing) {
      throw new Error(
        `Duplicate basePath "${module.basePath}": ${existing.name} and ${module.name} cannot both mount there.`
      );
    }

    this.#modules.push(module);
    return this;
  }

  get modules() {
    return [...this.#modules];
  }

  /**
   * Build the router carrying every registered module.
   *
   * By default this is the modules that parse their body normally. Modules that
   * declare `static rawBody = true` are excluded, because the application has to
   * mount them before `express.json()` — see `createRawBodyRouter`.
   */
  createRouter() {
    const router = Router();
    for (const module of this.#modules) {
      if (module.needsRawBody) continue;
      router.use(module.basePath, module.router);
    }
    return router;
  }

  /**
   * The modules that must be mounted ahead of the body parser, or null if there
   * are none. Kept separate so the ordering requirement is expressed once, in
   * Application.build(), rather than by each caller remembering it.
   */
  createRawBodyRouter() {
    const raw = this.#modules.filter((module) => module.needsRawBody);
    if (raw.length === 0) return null;

    const router = Router();
    for (const module of raw) {
      router.use(module.basePath, module.router);
    }
    return router;
  }

  /**
   * The full route table across all modules, sorted for stable comparison.
   * This is what the parity test snapshots.
   */
  describe() {
    return this.#modules
      .flatMap((module) => module.describe())
      .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  }
}

export default ModuleRegistry;
