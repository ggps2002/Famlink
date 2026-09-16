import { describe, it, expect } from "vitest";
import { cell, toCsvDocument } from "#src/modules/admin/csv.js";

/**
 * These are security tests, not formatting tests.
 *
 * Excel and Sheets execute a cell beginning `=`, `+`, `-` or `@` as a formula.
 * The values here come from public forms an anonymous visitor filled in, so
 * without neutralisation the path from "stranger types into a waitlist form" to
 * "code runs on an admin's laptop" is: they type it, an admin exports, an admin
 * double-clicks the file.
 */
describe("formula injection", () => {
  it.each([
    ["=", '=cmd|\'/c calc\'!A1'],
    ["+", "+1+1"],
    ["-", "-2+3"],
    ["@", "@SUM(1+1)"],
  ])("neutralises a cell starting with %s", (_char, payload) => {
    expect(cell(payload)).toBe(`"'${payload}"`);
  });

  it("neutralises leading tab and carriage return, which also trigger it", () => {
    expect(cell("\t=1+1")).toBe(`"'\t=1+1"`);
    expect(cell("\r=1+1")).toBe(`"'\r=1+1"`);
  });

  it("leaves an ordinary value alone", () => {
    // The apostrophe is a visible change to the data, so it is only applied
    // where it is actually needed.
    expect(cell("Ada Lovelace")).toBe('"Ada Lovelace"');
  });

  it("does not treat a hyphen inside a value as dangerous", () => {
    expect(cell("Anne-Marie")).toBe('"Anne-Marie"');
  });
});

describe("quoting", () => {
  it("doubles inner quotes, per RFC 4180", () => {
    expect(cell('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("keeps a comma from breaking the row", () => {
    expect(cell("Oakland, CA")).toBe('"Oakland, CA"');
  });

  it("keeps a newline from breaking the row", () => {
    expect(cell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("renders null and undefined as empty rather than as the words", () => {
    expect(cell(null)).toBe('""');
    expect(cell(undefined)).toBe('""');
  });

  it("does not lose a legitimate zero", () => {
    expect(cell(0)).toBe('"0"');
  });
});

describe("toCsvDocument", () => {
  it("starts with a UTF-8 BOM", () => {
    // Without it, accented names in an export opened on Windows come out as
    // mojibake.
    expect(toCsvDocument(["Name"], [["Ada"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("writes the header then one line per row", () => {
    const csv = toCsvDocument(["Name", "City"], [
      ["Ada", "Oakland"],
      ["Grace", "Berkeley"],
    ]);

    expect(csv.slice(1).split("\n")).toEqual([
      '"Name","City"',
      '"Ada","Oakland"',
      '"Grace","Berkeley"',
    ]);
  });

  it("escapes header cells too", () => {
    // A column label is as capable of starting with = as a value is.
    expect(toCsvDocument(["=Name"], []).slice(1)).toBe(`"'=Name"\n`);
  });

  it("produces just a header for an empty export", () => {
    expect(toCsvDocument(["Name"], []).slice(1)).toBe('"Name"\n');
  });
});
