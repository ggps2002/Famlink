import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_JSX } from "./extractRoutes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");

/**
 * Every lazily-loaded route resolves to an export that actually exists.
 *
 * This is the one class of routing mistake nothing else here catches. A build
 * only proves the module resolves, not that it exports what the caller asked
 * for:
 *
 *   lazy(() => import("./Screen"))                  needs a default export
 *   lazyNamed(() => import("./Screen"), "Screen4")  needs `export const Screen4`
 *
 * Get either wrong and the chunk downloads fine, `default` is undefined, and
 * React throws when the route renders. The build passes, the tests pass, and one
 * page in the app is a white screen. Roughly a dozen screens here export a const
 * rather than a default, so the two forms genuinely are mixed.
 */

const ALIASES = [
  ["@app", path.join(SRC, "app")],
  ["@features", path.join(SRC, "features")],
  ["@shared", path.join(SRC, "shared")],
  ["@", SRC],
];

const resolveModule = (specifier) => {
  for (const [name, base] of ALIASES) {
    if (!specifier.startsWith(`${name}/`)) continue;
    const stem = path.join(base, specifier.slice(name.length + 1));
    return (
      [".jsx", ".js", "/index.jsx", "/index.js"]
        .map((suffix) => stem + suffix)
        .find((candidate) => fs.existsSync(candidate)) ?? null
    );
  }
  return null;
};

const source = fs.readFileSync(APP_JSX, "utf8");

const LAZY_DEFAULT = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\("([^"]+)"\)\s*\)/g;
const LAZY_NAMED =
  /const\s+(\w+)\s*=\s*lazyNamed\(\s*\(\)\s*=>\s*import\("([^"]+)"\)\s*,\s*"(\w+)"\s*\)/g;

const defaultRoutes = [...source.matchAll(LAZY_DEFAULT)].map(([, local, specifier]) => ({
  local,
  specifier,
}));
const namedRoutes = [...source.matchAll(LAZY_NAMED)].map(([, local, specifier, exported]) => ({
  local,
  specifier,
  exported,
}));

describe("lazily-loaded routes", () => {
  it("splits a substantial number of screens", () => {
    // Guards the regexes: if they stopped matching, every assertion below would
    // pass over an empty list.
    //
    // A floor, not a census. It sat at 50 and the count is now exactly 50 after
    // the unreachable job-funnel routes were removed — a deliberate deletion
    // failing a guard against accidental zero is the guard being too tight, not
    // the deletion being wrong. Set well clear of the real count so the next
    // route removed doesn't trip it either; a broken regex still reads 0.
    expect(defaultRoutes.length + namedRoutes.length).toBeGreaterThan(30);
  });

  it("resolves every lazy import to a real module", () => {
    const broken = [...defaultRoutes, ...namedRoutes]
      .filter((route) => !resolveModule(route.specifier))
      .map((route) => `${route.local} → ${route.specifier}`);

    expect(broken).toEqual([]);
  });

  it("imports a default export only where one exists", () => {
    const missing = defaultRoutes
      .filter((route) => {
        const body = fs.readFileSync(resolveModule(route.specifier), "utf8");
        return !/^export\s+default/m.test(body);
      })
      .map((route) => `${route.local} (${route.specifier}) has no default export`);

    expect(missing).toEqual([]);
  });

  it("names an export that the module really declares", () => {
    const missing = namedRoutes
      .filter((route) => {
        const body = fs.readFileSync(resolveModule(route.specifier), "utf8");
        // Deliberately tolerant of spacing: one of these is written
        // `export const  FamilyOnboarding` with two spaces.
        const declared = new RegExp(
          `^export\\s+(?:const|let|function|class)\\s+${route.exported}\\b`,
          "m"
        );
        return !declared.test(body) && !new RegExp(`^export\\s*\\{[^}]*\\b${route.exported}\\b`, "m").test(body);
      })
      .map((route) => `${route.specifier} does not export "${route.exported}"`);

    expect(missing).toEqual([]);
  });

  it("keeps the layout and the landing page eager", () => {
    // PageLayout renders the Suspense boundary, so it cannot sit behind one, and
    // "/" is the commonest cold entry — splitting it puts a spinner in front of
    // the first page most visitors see.
    expect(source).toMatch(/^import PageLayout from "@app\/PageLayout";$/m);
    expect(source).toMatch(
      /^import NannyShare from "@features\/nanny-share\/pages\/NannyShareLanding";$/m
    );
  });
});
