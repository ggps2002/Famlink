import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");

/**
 * Nothing outside shared/lib/bodyScrollLock.js may lock the page.
 *
 * THE BUG THIS PINS
 *
 * Six components used to write `document.body.style.overflow` directly, and two
 * of them did it in an effect with no cleanup. That is correct right up until
 * the component unmounts while the lock is held — which is exactly what a
 * hamburger menu does, because every link in it navigates away. React unmounts
 * the header, the effect never runs again, and `overflow: hidden` stays on the
 * body for the rest of the session. The symptom surfaced three routes later, on
 * a dashboard that had nothing to do with it and no scroll-locking code of its
 * own to suspect.
 *
 * It was mobile-only, which is what made it expensive: the hamburger is
 * `lg:hidden`, so the lock could only ever be taken on a phone.
 *
 * A single correct helper does not prevent the next person from writing the
 * broken three lines again — it is a short, obvious-looking thing to write. So
 * the rule is checked rather than documented.
 *
 * Reads are allowed. FeedbackForm compares against `overflow === "hidden"` to
 * notice when a menu has the page, and observing the lock is not taking one.
 */

const OWNER = path.join(SRC, "shared", "lib", "bodyScrollLock.js");

// `= "hidden"` but never `=== "hidden"`, so a comparison is not a violation.
const ASSIGNS_BODY_OVERFLOW =
  /document\s*\.\s*(?:body|documentElement)\s*\.\s*style\s*\.\s*overflow\w*\s*=(?!=)/;

const sourceFiles = () =>
  fs
    .readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|jsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .filter((file) => file !== OWNER);

/** Comments describe the old code on purpose; only real statements count. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("body scroll locking", () => {
  it("happens only through shared/lib/bodyScrollLock.js", () => {
    const offenders = sourceFiles()
      .filter((file) =>
        ASSIGNS_BODY_OVERFLOW.test(stripComments(fs.readFileSync(file, "utf8")))
      )
      .map((file) => path.relative(ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("has an owner that is actually there to import", () => {
    expect(fs.existsSync(OWNER)).toBe(true);
  });
});
