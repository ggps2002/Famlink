#!/usr/bin/env node
/**
 * Moves a batch of modules into their feature folders, in the one order that
 * leaves no dangling import.
 *
 *   node scripts/migrate.mjs manifests/auth.json
 *   node scripts/migrate.mjs manifests/auth.json --dry
 *
 * A manifest is `{ "old/path.jsx": "new/path.jsx", … }`, both relative to the
 * frontend root.
 *
 * Why the phases are separate, and in this order
 * ----------------------------------------------
 * Moving a module breaks imports in two directions at once, and the fixes have
 * opposite prerequisites:
 *
 *   1. REPOINT importers      needs the files still in their OLD places, because
 *                             a specifier is matched by resolving it, and after
 *                             the move it resolves to nothing.
 *   2. MOVE                   git mv, so history follows the file.
 *   3. REBASE the moved files needs the files in their NEW places, because it
 *                             asks which of their own specifiers are now broken.
 *
 * Doing 2 before 1 silently strands every sibling reference: "./step2" resolves
 * against the new directory, matches nothing, and is left pointing at a file
 * that is no longer there. Doing 3 before 2 finds nothing broken yet.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const [manifestPath, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry");

if (!manifestPath) {
  console.error("usage: migrate.mjs <manifest.json> [--dry]");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, manifestPath), "utf8"));
const entries = Object.entries(manifest);

/** src/features/auth/Login.jsx → @features/auth/Login */
const aliasFor = (destination) => {
  const absolute = path.resolve(ROOT, destination);
  const pairs = [
    ["@app", path.join(SRC, "app")],
    ["@features", path.join(SRC, "features")],
    ["@shared", path.join(SRC, "shared")],
    ["@", SRC],
  ];
  for (const [name, base] of pairs) {
    const relative = path.relative(base, absolute);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return `${name}/${relative.split(path.sep).join("/")}`.replace(/\.(jsx?|mjs)$/, "");
    }
  }
  throw new Error(`destination outside src: ${destination}`);
};

const run = (script, args) => {
  const output = execFileSync("node", [path.join(ROOT, "scripts", script), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return output.trim().split("\n").filter(Boolean);
};

// ── Sanity first: a typo in a manifest should stop the batch, not half-apply it.
const missing = entries.filter(([from]) => !fs.existsSync(path.resolve(ROOT, from)));
if (missing.length) {
  console.error("these sources do not exist:");
  for (const [from] of missing) console.error(`  ${from}`);
  process.exit(1);
}

const collisions = entries.filter(([, to]) => fs.existsSync(path.resolve(ROOT, to)));
if (collisions.length) {
  console.error("these destinations already exist:");
  for (const [, to] of collisions) console.error(`  ${to}`);
  process.exit(1);
}

console.log(`${entries.length} module(s) in ${path.basename(manifestPath)}\n`);

// ── 1. Repoint everyone who imports them, while they are still in place.
console.log("1a. repointing relative importers");
let repointed = 0;
for (const [from, to] of entries) {
  const lines = run("rewrite-imports.mjs", [from, aliasFor(to), ...(dryRun ? ["--dry"] : [])]);
  const summary = lines.at(-1) ?? "";
  const count = Number(summary.match(/(\d+) import/)?.[1] ?? 0);
  repointed += count;
}
console.log(`   ${repointed} import site(s)\n`);

/**
 * ── 1b. The same job for importers that already use an alias.
 *
 * rewrite-imports.mjs resolves relative specifiers, so it cannot see
 * "@/Components/Login/login" at all — nothing about that string is relative.
 * Any file whose imports were aliased by an earlier pass is therefore invisible
 * to phase 1a, and App.jsx, the one file that imports nearly every screen, was
 * exactly that. Alias specifiers are plain text, so they are matched as text.
 */
console.log("1b. repointing aliased importers");
const aliasRewrites = entries.map(([from, to]) => {
  const stem = from.replace(/^src\//, "").replace(/\.(jsx?|mjs)$/, "");
  return [new RegExp(`(["'])@/${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\.jsx?)?\\1`, "g"), aliasFor(to)];
});

const searchable = ["src", "tests"].flatMap((dir) =>
  fs.existsSync(path.join(ROOT, dir))
    ? fs
        .readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.(js|jsx|mjs)$/.test(entry.name))
        .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    : []
);

let aliasHits = 0;
for (const file of searchable) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [pattern, replacement] of aliasRewrites) {
    after = after.replace(pattern, (_, quote) => {
      aliasHits += 1;
      return `${quote}${replacement}${quote}`;
    });
  }
  if (after !== before && !dryRun) fs.writeFileSync(file, after);
}
console.log(`   ${aliasHits} import site(s)\n`);

if (dryRun) {
  console.log("2. would move:");
  for (const [from, to] of entries) console.log(`   ${from}\n     -> ${to}`);
  console.log("\n3. would rebase the moved files' own imports");
  process.exit(0);
}

// ── 2. Move.
console.log("2. moving");
for (const [from, to] of entries) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, to)), { recursive: true });
  try {
    execFileSync("git", ["mv", from, to], { cwd: ROOT });
  } catch {
    // Untracked files have no git history to preserve; a plain rename is fine.
    fs.renameSync(path.resolve(ROOT, from), path.resolve(ROOT, to));
  }
}
console.log(`   ${entries.length} file(s)\n`);

// ── 3. Fix the moved files' own imports, now that they are broken.
console.log("3. rebasing their own imports");
let rebased = 0;
for (const [, to] of entries) {
  const lines = run("rebase-imports.mjs", [to]);
  rebased += Number(lines.at(-1)?.match(/rebased (\d+)/)?.[1] ?? 0);
  for (const line of lines.filter((l) => l.includes("unresolved") || l.startsWith("  src") === false)) {
    if (line.includes("→")) console.log(`   ! ${line.trim()}`);
  }
}
console.log(`   ${rebased} import(s)\n`);

// ── Tidy: directories the batch emptied.
const pruneEmpty = (dir) => {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  for (const child of fs.readdirSync(dir)) pruneEmpty(path.join(dir, child));
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    console.log(`   pruned ${path.relative(ROOT, dir)}`);
  }
};
pruneEmpty(path.join(SRC, "Components"));
pruneEmpty(path.join(SRC, "NewComponents"));

console.log("done — run the tests.");
