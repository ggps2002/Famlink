#!/usr/bin/env node
/**
 * Lists source files that nothing can reach from a real entry point.
 *
 *   node scripts/find-unreachable.mjs           # report
 *   node scripts/find-unreachable.mjs --delete  # report, then remove them
 *
 * Reachability is computed by following imports outward from every entry the
 * product actually has, not just index.html:
 *
 *   src/main.jsx      the browser bundle
 *   api/**            Vercel serverless functions, deployed separately
 *   scripts/**        the build step
 *   tests/**          the suite, which may import a module nothing else does
 *
 * Missing an entry point is how this kind of tool deletes live code, so each one
 * is listed explicitly rather than inferred.
 *
 * A file is reported only when nothing in that closure imports it. That is a
 * stronger claim than "no one mentions its name" — a component can be imported
 * by a file that is itself dead, and grep would find that reference and call the
 * component alive. Both are reported here, because the walk starts from entries
 * rather than from names.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const ENTRY_FILES = ["src/main.jsx"];
const ENTRY_DIRS = ["api", "scripts", "tests"];

const ALIASES = [
  ["@app", path.join(SRC, "app")],
  ["@features", path.join(SRC, "features")],
  ["@shared", path.join(SRC, "shared")],
  ["@", SRC],
];

const EXTENSIONS = ["", ".js", ".jsx", ".mjs"];
const INDEXES = ["index.js", "index.jsx"];

const sourceFilesUnder = (dir) => {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|jsx|mjs)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
};

const resolveFile = (candidate) =>
  [
    ...EXTENSIONS.map((extension) => candidate + extension),
    ...INDEXES.map((index) => path.join(candidate, index)),
  ].find((variant) => fs.existsSync(variant) && fs.statSync(variant).isFile()) ?? null;

const resolveSpecifier = (fromFile, specifier) => {
  for (const [name, base] of ALIASES) {
    if (specifier === name || specifier.startsWith(`${name}/`)) {
      return resolveFile(path.join(base, specifier.slice(name.length + 1)));
    }
  }
  if (specifier.startsWith(".")) {
    return resolveFile(path.resolve(path.dirname(fromFile), specifier));
  }
  return null; // a package
};

// import/export/require position, static and dynamic. Comments are stripped
// first so a commented-out import cannot keep a dead file alive.
const SPECIFIER =
  /(?:(?:^|[\s;{}(,])(?:import|export)(?:\s+[\w*{}\s,$]*?\s+)?from\s*|(?:^|[\s;{}(,=])(?:import|require)\s*\(\s*)["']([^"']+)["']/g;

const specifiersIn = (file) => {
  const source = fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [...source.matchAll(SPECIFIER)].map((match) => match[1]);
};

const reachable = new Set();
const queue = [
  ...ENTRY_FILES.map((file) => path.join(ROOT, file)),
  ...ENTRY_DIRS.flatMap(sourceFilesUnder),
].filter((file) => fs.existsSync(file));

for (const file of queue) reachable.add(file);

while (queue.length) {
  const file = queue.shift();
  for (const specifier of specifiersIn(file)) {
    const target = resolveSpecifier(file, specifier);
    if (!target || reachable.has(target)) continue;
    reachable.add(target);
    queue.push(target);
  }
}

const unreachable = sourceFilesUnder("src")
  .filter((file) => !reachable.has(file))
  .sort();

const lines = unreachable.map((file) => {
  const relative = path.relative(ROOT, file);
  const size = fs.readFileSync(file, "utf8").split("\n").length;
  return { relative, size };
});

const totalLines = lines.reduce((sum, entry) => sum + entry.size, 0);

console.log(`reachable:   ${[...reachable].filter((f) => f.startsWith(SRC)).length} file(s) under src`);
console.log(`unreachable: ${lines.length} file(s), ${totalLines} lines\n`);
for (const { relative, size } of lines) {
  console.log(`  ${String(size).padStart(5)}  ${relative}`);
}

if (process.argv.includes("--delete")) {
  for (const file of unreachable) fs.rmSync(file);
  console.log(`\ndeleted ${unreachable.length} file(s)`);
}
