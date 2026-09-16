#!/usr/bin/env node
/**
 * Repoints every import of a moved module, for use during the refactor.
 *
 *   node scripts/rewrite-imports.mjs src/NewComponents/Button.jsx @shared/ui/Button
 *
 * The first argument is the module's OLD path, relative to the frontend root.
 * The second is the specifier importers should use instead. Add --dry to see
 * the plan without writing.
 *
 * Why this resolves paths instead of matching strings
 * ---------------------------------------------------
 * The obvious implementation matches the tail of a specifier — rewrite anything
 * ending in "NewComponents/Button". It is wrong, and quietly so. A module is
 * referenced by three different spellings depending on who is importing it:
 *
 *   ../../NewComponents/Button   a distant importer
 *   ../Button                    a file one directory down
 *   ./Button                     a sibling
 *
 * Only the first contains the directory name. Tail matching rewrites that one,
 * leaves the other two pointing at a file that is no longer there, and reports
 * success. `vite build` then fails on one of them per run, because it stops at
 * the first unresolved import.
 *
 * So: resolve each relative specifier against the importing file's directory,
 * and compare the result to the module's old location. Spelling stops mattering.
 *
 * Ordering, when moving several files at once
 * -------------------------------------------
 * Specifiers resolve against where the IMPORTER currently sits, so repoint
 * before moving anything whose importers are also moving in the same batch.
 * Move first and a sibling's "./socket" resolves against its new directory,
 * matches nothing, and is silently left pointing at a file that isn't there.
 * tests/architecture/imports.test.js catches it either way.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEARCHED = ["src", "tests", "api", "scripts"];
const SELF = fileURLToPath(import.meta.url);

const [fromArg, to, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry");

if (!fromArg || !to) {
  console.error("usage: rewrite-imports.mjs <old/path/to/module.jsx> <new-specifier> [--dry]");
  process.exit(1);
}

/** Drop a trailing .js/.jsx so "./Button" and "./Button.jsx" compare equal. */
const withoutExtension = (file) => file.replace(/\.(jsx?|mjs)$/, "");

const FROM = withoutExtension(path.resolve(ROOT, fromArg));

const sourceFiles = (dir) => {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|jsx|mjs)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .filter((file) => file !== SELF);
};

/**
 * Quoted specifiers in import/export/require position only.
 *
 * Anchoring to the keyword matters: a bare "any quoted relative path" pattern
 * also matches ordinary strings, and a filesystem path is not a module
 * specifier. It rewrote `path.resolve(here, "../../src/App.jsx")` in the route
 * test's helper into an alias that fs.readFileSync cannot open — turning a
 * passing safety net into one that throws before it asserts anything.
 */
const SPECIFIER =
  /((?:^|[\s;{}(,])(?:import|export)(?:\s+[\w*{}\s,$]*?\s+)?from\s*|(?:^|[\s;{}(,=])(?:import|require)\s*\(\s*)(["'])((?:\.\.?\/)[^"'\n]*)\2/g;

let changedFiles = 0;
let changedSites = 0;

for (const file of SEARCHED.flatMap(sourceFiles)) {
  const before = fs.readFileSync(file, "utf8");
  let hits = 0;

  const after = before.replace(SPECIFIER, (match, keyword, quote, specifier) => {
    const resolved = withoutExtension(path.resolve(path.dirname(file), specifier));
    if (resolved !== FROM) return match;
    hits += 1;
    return `${keyword}${quote}${to}${quote}`;
  });

  if (!hits) continue;
  changedFiles += 1;
  changedSites += hits;

  if (!dryRun) fs.writeFileSync(file, after);
  console.log(`  ${path.relative(ROOT, file)} (${hits})`);
}

console.log(
  `${dryRun ? "[dry] would repoint" : "repointed"} ${changedSites} import(s) ` +
    `in ${changedFiles} file(s): ${fromArg} -> ${to}`
);

if (changedSites === 0) {
  console.log("  (nothing referenced that path — check the path is the OLD one)");
}
