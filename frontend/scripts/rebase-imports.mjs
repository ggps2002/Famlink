#!/usr/bin/env node
/**
 * Rewrites a file's OWN relative imports into aliases.
 *
 *   node scripts/rebase-imports.mjs src/app/App.jsx
 *   node scripts/rebase-imports.mjs src/features/chat        # whole directory
 *
 * The companion to rewrite-imports.mjs, which handles the other direction.
 * Moving a module breaks two sets of paths and they need opposite fixes:
 *
 *   everyone who imported it   → rewrite-imports.mjs (repoint them at the alias)
 *   everything IT imported     → this script (its own "./x" now resolves wrong)
 *
 * Forgetting the second set is easy, because the file itself still looks
 * correct — the specifiers were right where it used to live.
 *
 * Each relative specifier is resolved against the file's CURRENT location, so
 * run this AFTER the move, once the paths are genuinely broken. A specifier that
 * still resolves to a real file is left alone: it is a legitimate intra-feature
 * reference, and collapsing those into aliases would make sibling imports harder
 * to read, not easier.
 *
 * Files that Node loads directly are skipped — see the alias note they carry.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const [target, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry");

if (!target) {
  console.error("usage: rebase-imports.mjs <file-or-directory> [--dry]");
  process.exit(1);
}

/** Longest alias prefix wins, so src/app/store resolves to @app, not @. */
const ALIASES = [
  ["@app", path.join(SRC, "app")],
  ["@features", path.join(SRC, "features")],
  ["@shared", path.join(SRC, "shared")],
  ["@", SRC],
];

const EXTENSIONS = ["", ".js", ".jsx", ".mjs", ".json", ".css"];
const INDEXES = ["index.js", "index.jsx"];

const resolvesToFile = (candidate) =>
  [
    ...EXTENSIONS.map((extension) => candidate + extension),
    ...INDEXES.map((index) => path.join(candidate, index)),
  ].some((variant) => fs.existsSync(variant) && fs.statSync(variant).isFile());

/**
 * The alias for a broken specifier, found by its tail.
 *
 * Resolving the specifier against the file's new directory gives a path that
 * does not exist, and its leading segments are meaningless — "./Components/…"
 * read from src/app/ points at src/app/Components/…, which would name the @app
 * alias and be wrong twice over. What survives a move is the tail: the part
 * after the ./ and ../ hops still names the target relative to src.
 */
const aliasForTail = (specifier) => {
  const tail = specifier.replace(/^(?:\.\.?\/)+/, "");
  if (!tail) return null;

  if (!resolvesToFile(path.join(SRC, tail))) return null;

  const absolute = path.join(SRC, tail);
  for (const [name, base] of ALIASES) {
    const relative = path.relative(base, absolute);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return `${name}/${relative.split(path.sep).join("/")}`.replace(/\.(jsx?|mjs)$/, "");
    }
  }
  return null;
};

const filesUnder = (entry) => {
  const absolute = path.resolve(ROOT, entry);
  if (fs.statSync(absolute).isFile()) return [absolute];
  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((item) => item.isFile() && /\.(js|jsx)$/.test(item.name))
    .map((item) => path.join(item.parentPath ?? item.path, item.name));
};

// Import/export/require position only — see the note in rewrite-imports.mjs
// about why matching any quoted relative path is not safe.
const SPECIFIER =
  /((?:^|[\s;{}(,])(?:import|export)(?:\s+[\w*{}\s,$]*?\s+)?from\s*|(?:^|[\s;{}(,=])(?:import|require)\s*\(\s*)(["'])((?:\.\.?\/)[^"'\n]*)\2/g;

let changedFiles = 0;
let changedSites = 0;
const unresolved = [];

for (const file of filesUnder(target)) {
  const before = fs.readFileSync(file, "utf8");

  if (before.includes("runs in Node as well as")) {
    console.log(`  skipped ${path.relative(ROOT, file)} (loaded by Node, must stay relative)`);
    continue;
  }

  let hits = 0;

  const after = before.replace(SPECIFIER, (match, keyword, quote, specifier) => {
    const absolute = path.resolve(path.dirname(file), specifier);

    // Already correct where it stands — a real sibling or intra-feature import.
    if (resolvesToFile(absolute)) return match;

    // Broken: written relative to wherever the file used to live. Its tail is
    // the part that still names the target.
    const alias = aliasForTail(specifier);
    if (!alias) {
      unresolved.push(`${path.relative(ROOT, file)} → "${specifier}"`);
      return match;
    }

    hits += 1;
    return `${keyword}${quote}${alias}${quote}`;
  });

  if (!hits) continue;
  changedFiles += 1;
  changedSites += hits;
  if (!dryRun) fs.writeFileSync(file, after);
  console.log(`  ${path.relative(ROOT, file)} (${hits})`);
}

console.log(
  `${dryRun ? "[dry] would rebase" : "rebased"} ${changedSites} import(s) in ${changedFiles} file(s)`
);

if (unresolved.length) {
  console.log("\nstill unresolved (outside src, fix by hand):");
  for (const line of unresolved) console.log(`  ${line}`);
}
