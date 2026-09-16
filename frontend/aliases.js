import path from "node:path";

/**
 * Import aliases, defined once and shared by every tool that resolves modules.
 *
 * vite.config.js, vitest.config.js and jsconfig.json all need the same map. When
 * they were separate copies, a build could resolve an import that a test run
 * could not — a failure that looks like a broken test rather than a broken
 * config, and costs an hour to see. There is one copy now; jsconfig.json cannot
 * import JavaScript, so tests/architecture/aliases.test.js asserts it agrees.
 *
 * IMPORTANT: these only exist inside the Vite/Vitest module graph. `api/` runs
 * on Vercel's Node runtime and `scripts/` runs under plain node, and neither
 * resolves aliases. Both import files out of `src/` by relative path, so those
 * files must stay reachable that way — see aliases.test.js, which pins them.
 */

const src = (segment = ".") => path.resolve(import.meta.dirname, "src", segment);

/**
 * Prefix matching is exact-or-followed-by-slash, so "@" claims only "@/…" and
 * never shadows "@app/…" or a scoped package like "@reduxjs/toolkit".
 */
export const alias = {
  "@": src(),
  "@app": src("app"),
  "@features": src("features"),
  "@shared": src("shared"),
};

export default alias;
