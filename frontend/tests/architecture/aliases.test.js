import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alias } from "../../aliases.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

/**
 * Two things this suite protects, both of which fail quietly otherwise.
 *
 * 1. The alias map has three consumers — vite, vitest, and the editor — and
 *    only two of them can share a definition. jsconfig.json is JSON, so it is
 *    checked against aliases.js here instead.
 *
 * 2. Not everything that imports from src/ goes through Vite. `api/` is
 *    deployed to Vercel's Node runtime and `scripts/` runs under plain node;
 *    neither resolves "@shared/…". A file in that import graph is pinned to
 *    relative paths, and moving one breaks it in a way the frontend test suite
 *    would never see — the share-card OG image just stops rendering in
 *    production.
 */

describe("the alias map", () => {
  it("is the same map jsconfig.json gives the editor", () => {
    const { paths } = JSON.parse(read("jsconfig.json")).compilerOptions;

    // jsconfig speaks in "@x/*" -> ["src/x/*"] and aliases.js in absolute
    // paths. Normalise both to a bare name -> src-relative directory.
    const fromJsconfig = Object.fromEntries(
      Object.entries(paths).map(([name, [target]]) => [
        name.replace(/\/\*$/, ""),
        target.replace(/\/\*$/, ""),
      ])
    );
    const fromAliases = Object.fromEntries(
      Object.entries(alias).map(([name, target]) => [
        name,
        path.relative(ROOT, target),
      ])
    );

    expect(fromJsconfig).toEqual(fromAliases);
  });

  it("points every alias inside src", () => {
    for (const [name, target] of Object.entries(alias)) {
      expect(path.relative(ROOT, target).startsWith("src"), `${name} -> ${target}`).toBe(true);
    }
  });

  it("never shadows a scoped package", () => {
    // "@" resolves only "@" and "@/…"; anything else keeps its own prefix.
    // If that stopped being true, "@reduxjs/toolkit" would resolve to a
    // directory inside src and fail with a confusing "file not found".
    const claims = (aliasName, specifier) =>
      specifier === aliasName || specifier.startsWith(`${aliasName}/`);

    expect(claims("@", "@reduxjs/toolkit")).toBe(false);
    expect(claims("@", "@ant-design/icons")).toBe(false);
    expect(claims("@", "@app/router")).toBe(false);
    expect(claims("@", "@/Config/api")).toBe(true);
    expect(claims("@app", "@app/router")).toBe(true);
  });
});

/** Entry points that run outside Vite, and so outside the alias map. */
const NODE_ENTRY_POINTS = ["api", "scripts"];

const sourceFilesUnder = (dir) => {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];

  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|mjs|jsx)$/.test(entry.name))
    .map((entry) => path.relative(ROOT, path.join(entry.parentPath ?? entry.path, entry.name)));
};

const IMPORT = /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const specifiersIn = (file) => {
  const source = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...source.matchAll(IMPORT)].map((match) => match[1] ?? match[2]);
};

/**
 * Every file plain node can reach from api/ and scripts/, following relative
 * imports into src/. Walked rather than listed so that adding an import to one
 * of these modules extends the guarantee automatically.
 */
const nodeReachableFiles = () => {
  const queue = NODE_ENTRY_POINTS.flatMap(sourceFilesUnder);
  const seen = new Set(queue);
  const unresolved = [];

  while (queue.length) {
    const file = queue.shift();

    for (const specifier of specifiersIn(file)) {
      if (!specifier.startsWith(".")) continue; // bare = node_modules, node's problem

      const target = path.join(path.dirname(file), specifier);
      const resolved = [target, `${target}.js`, `${target}.mjs`, `${target}.jsx`, path.join(target, "index.js")]
        .find((candidate) => {
          const absolute = path.join(ROOT, candidate);
          return fs.existsSync(absolute) && fs.statSync(absolute).isFile();
        });

      if (!resolved) {
        unresolved.push(`${file} imports "${specifier}", which does not exist`);
        continue;
      }
      if (!seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }

  return { files: [...seen], unresolved };
};

describe("files node loads without Vite", () => {
  const { files, unresolved } = nodeReachableFiles();

  it("resolves every relative import on disk", () => {
    // The one that bites: `npm run build` runs scripts/prerender-meta.mjs, and
    // api/share-og.js is a deployed function. A moved file breaks the first
    // loudly and the second only in production.
    expect(unresolved).toEqual([]);
  });

  it("uses no aliases anywhere in that graph", () => {
    const aliasNames = Object.keys(alias);
    const offenders = files.flatMap((file) =>
      specifiersIn(file)
        .filter((specifier) =>
          aliasNames.some((name) => specifier === name || specifier.startsWith(`${name}/`))
        )
        .map((specifier) => `${file} imports "${specifier}"`)
    );

    expect(offenders).toEqual([]);
  });

  it("still reaches into src at all", () => {
    // Guards the walker: if the regex stopped matching, the two checks above
    // would pass over an empty graph and prove nothing.
    expect(files.filter((file) => file.startsWith("src/")).length).toBeGreaterThan(0);
  });
});
