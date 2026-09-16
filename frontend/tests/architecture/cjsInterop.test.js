import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");

/**
 * No source file imports a dependency's CommonJS build when an ESM build exists.
 *
 * redux-persist@6 ships `lib/` (CommonJS) beside `es/` (ESM). Its CommonJS
 * files mark themselves with a plain `exports.__esModule = true` assignment
 * rather than `Object.defineProperty`, which Vite 8's interop does not read as
 * an ES module. A default import of `redux-persist/lib/storage` then resolves
 * to the module record — `{ __esModule, default }` — rather than the storage
 * engine, and redux-persist throws "getItem is not a function" from
 * getStoredState on the first rehydrate. The app dies at boot.
 *
 * This is a static check on specifiers, not a runtime one, because a runtime
 * assertion cannot see the bug: Vitest transforms CommonJS through a different
 * path than a production build, so `lib/storage` imports *correctly* under the
 * test runner and incorrectly in the bundle. Only `vite build` reproduces it,
 * and it fails silently there — the build succeeds, and the first symptom is a
 * white screen in production.
 *
 * Bare `redux-persist` and `redux-persist/integration/react` are safe and stay
 * allowed: both carry a `module` field pointing at `es/`, so the bundler never
 * sees the CommonJS files. Only deep paths without that redirect can regress.
 */

/** Specifier prefixes that must not appear, and what to use instead. */
const FORBIDDEN = [
  {
    prefix: "redux-persist/lib/",
    instead: "redux-persist/es/",
    why: "CommonJS build; Vite 8 interop yields a module record, not the export",
  },
];

const sourceFiles = () =>
  fs
    .readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|jsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));

const IMPORT =
  /(?:^|[\s;])(?:import|export)(?:[\s\S]*?)from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const specifiersIn = (file) => {
  const source = fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [...source.matchAll(IMPORT)].map((match) => match[1] ?? match[2]);
};

describe("CommonJS deep imports", () => {
  it("are not used where the package ships an ESM build", () => {
    const offences = [];

    for (const file of sourceFiles()) {
      for (const specifier of specifiersIn(file)) {
        const rule = FORBIDDEN.find((entry) => specifier.startsWith(entry.prefix));
        if (!rule) continue;
        offences.push(
          `${path.relative(ROOT, file)}\n` +
            `    imports ${specifier}\n` +
            `    ${rule.why}\n` +
            `    use    ${specifier.replace(rule.prefix, rule.instead)}`,
        );
      }
    }

    expect(offences, `\n${offences.join("\n\n")}\n`).toEqual([]);
  });
});
