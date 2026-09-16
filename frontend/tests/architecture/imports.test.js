import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alias } from "../../aliases.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");

/**
 * Every import in src/ resolves to a file that exists.
 *
 * `vite build` proves this too, but it stops at the first failure and takes
 * ~30s to get there. During a refactor that turns one broken move into one
 * build per broken file. This reports all of them in under a second.
 *
 * The failure it exists to catch: moving a file out of a directory breaks two
 * different kinds of importer, and only one is obvious. Distant importers say
 * "../../Config/api" and are easy to find by searching for the directory name.
 * Siblings say "./api" — no directory name anywhere — so a search for
 * "Config/api" misses them completely, and they are invisible until something
 * tries to resolve them.
 */

const EXTENSIONS = ["", ".js", ".jsx", ".mjs", ".json", ".css"];
const INDEXES = ["index.js", "index.jsx"];

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

/** Turn an alias-prefixed specifier into an absolute path, or return null. */
const resolveAlias = (specifier) => {
  for (const [name, target] of Object.entries(alias)) {
    if (specifier === name) return target;
    if (specifier.startsWith(`${name}/`)) {
      return path.join(target, specifier.slice(name.length + 1));
    }
  }
  return null;
};

const existsAsFile = (candidate) => {
  const variants = [
    ...EXTENSIONS.map((extension) => candidate + extension),
    ...INDEXES.map((index) => path.join(candidate, index)),
  ];
  return variants.some(
    (variant) => fs.existsSync(variant) && fs.statSync(variant).isFile()
  );
};

const brokenImports = () => {
  const broken = [];

  for (const file of sourceFiles()) {
    for (const specifier of specifiersIn(file)) {
      const aliased = resolveAlias(specifier);
      const target = aliased ?? (specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null);

      if (target === null) continue; // bare specifier: a package, not our problem
      if (existsAsFile(target)) continue;
      // Asset imports (?url, ?raw) and CSS side-effect imports carry suffixes.
      if (/[?#]/.test(specifier)) continue;

      broken.push(`${path.relative(ROOT, file)} → "${specifier}"`);
    }
  }

  return broken.sort();
};

describe("module resolution across src", () => {
  it("resolves every relative and aliased import", () => {
    expect(brokenImports()).toEqual([]);
  });

  it("actually inspects the tree", () => {
    // Guards the walker: a regex that stopped matching would make the check
    // above pass over nothing at all.
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(200);
    expect(files.flatMap(specifiersIn).length).toBeGreaterThan(1000);
  });
});
