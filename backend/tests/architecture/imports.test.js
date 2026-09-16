import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const sourceFiles = () =>
  execFileSync("git", ["ls-files", "*.js", "*.mjs"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.startsWith("node_modules/"))
    .filter((f) => fs.existsSync(path.join(ROOT, f)));

/** Every relative specifier in a file, with the line it appears on. */
const relativeImportsIn = (relPath) => {
  const contents = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  const found = [];

  // Static `from "..."`, side-effect `import "..."`, and dynamic `import("...")`.
  const patterns = [
    /\bfrom\s+["'](\.[^"']+)["']/g,
    /\bimport\s+["'](\.[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) {
      const line = contents.slice(0, match.index).split("\n").length;
      found.push({ specifier: match[1], line });
    }
  }

  return found;
};

describe("import graph", () => {
  /**
   * The failure this catches: a file moved during the refactor while something
   * still imports its old path. Node only reports it when that module is first
   * loaded, which for a rarely-hit route means the first report is a 500 in
   * production. Resolving statically finds all of them at once.
   */
  it("has no relative import pointing at a file that does not exist", () => {
    const broken = [];

    for (const relPath of sourceFiles()) {
      const dir = path.dirname(path.join(ROOT, relPath));

      for (const { specifier, line } of relativeImportsIn(relPath)) {
        const target = path.resolve(dir, specifier);

        // ESM requires the extension, but tolerate a directory with index.js
        // and an extensionless specifier so the check does not produce false
        // positives on either convention.
        const candidates = [
          target,
          `${target}.js`,
          `${target}.mjs`,
          path.join(target, "index.js"),
        ];

        const resolved = candidates.some(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        );

        if (!resolved) broken.push(`${relPath}:${line} → ${specifier}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it("has no import still pointing at the retired Schema/ directory", () => {
    const stragglers = [];

    for (const relPath of sourceFiles()) {
      for (const { specifier, line } of relativeImportsIn(relPath)) {
        if (/\/Schema\//.test(specifier)) stragglers.push(`${relPath}:${line} → ${specifier}`);
      }
    }

    expect(stragglers).toEqual([]);
  });
});
