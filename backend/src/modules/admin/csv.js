// CSV generation for the console's exports.
//
// The escaping here is a security control, not formatting. Excel and Sheets
// interpret a leading `=`, `+`, `-` or `@` in a cell as a formula — so a name
// an anonymous visitor typed into a public form becomes executable the moment
// somebody opens the export. That is CSV injection, and it is a real path from
// "stranger fills in a waitlist form" to "code runs on an admin's laptop".

/**
 * One CSV cell: neutralised against formula injection and safely quoted.
 *
 * The leading apostrophe makes a spreadsheet treat the value as text. The outer
 * quotes stop commas and newlines from breaking the row, and inner quotes are
 * doubled per RFC 4180.
 */
export const cell = (value) => {
  const str = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
};

/**
 * A complete CSV document, with a UTF-8 byte-order mark.
 *
 * The BOM is what makes Excel read the file as UTF-8; without it, accented
 * names in an export opened on Windows come out as mojibake.
 */
export const toCsvDocument = (headers, rows) =>
  `﻿${headers.map(cell).join(",")}\n${rows.map((row) => row.map(cell).join(",")).join("\n")}`;

export default toCsvDocument;
