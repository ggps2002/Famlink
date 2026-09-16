// Reading the two Google Sheets the public forms write to.
//
// The sheets predate the platform's own database and are still where the
// waitlist form and every questionnaire land. The admin console shows them so
// an admin doesn't have to open Google Sheets to answer "who signed up this
// week" — and so the rows can be searched and exported like everything else.
//
// ── Why this goes through our backend ─────────────────────────────────────
//
// The Apps Script reader (frontend/apps-script/sheetReader.gs) is deployed as
// "anyone can access", because that is the only setting that works without a
// Google sign-in. Its rows are names, emails and neighbourhoods, so it is
// guarded by a shared secret.
//
// That secret must never reach a browser. If the admin console called the
// script directly, the token would be in its bundle and the whole waitlist
// would be one view-source away. So the console asks this API, and this API
// asks Google.

const CACHE_TTL_MS = 60 * 1000;

// Sheets are the slowest thing the console reads — an Apps Script round trip is
// a second or two — and the data changes when someone fills in a form, not
// continuously. A short TTL keeps a page of filtering and sorting responsive
// without ever showing something a minute stale.
const cache = new Map(); // key -> { at, payload }

export const SHEET_KEYS = ["waitlist", "forms"];

export const sheetsConfigured = () =>
  Boolean(process.env.GOOGLE_SHEET_READER_URL && process.env.GOOGLE_SHEET_READER_TOKEN);

/**
 * Fetch one sheet, whole.
 *
 * Throws with a message worth showing an admin. "Request failed" tells them
 * nothing they can act on; "the reader script is not deployed" does.
 */
export const fetchSheet = async (key, { force = false } = {}) => {
  if (!SHEET_KEYS.includes(key)) {
    throw new Error(`Unknown sheet "${key}"`);
  }

  if (!sheetsConfigured()) {
    const error = new Error(
      "Google Sheets reading is not set up yet. Add GOOGLE_SHEET_READER_URL and " +
        "GOOGLE_SHEET_READER_TOKEN to the backend environment — see " +
        "frontend/apps-script/sheetReader.gs for how to deploy the reader."
    );
    error.code = "NOT_CONFIGURED";
    throw error;
  }

  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.payload;

  const url = new URL(process.env.GOOGLE_SHEET_READER_URL);
  url.searchParams.set("sheet", key);
  url.searchParams.set("token", process.env.GOOGLE_SHEET_READER_TOKEN);

  let response;
  try {
    // Apps Script 302s to script.googleusercontent.com; fetch follows it.
    // The timeout matters: without one a hung request holds the admin's
    // page open indefinitely with a spinner and no explanation.
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(
      err?.name === "TimeoutError"
        ? "The Google Sheets reader did not respond within 20 seconds."
        : `Could not reach the Google Sheets reader: ${err?.message || err}`
    );
  }

  const text = await response.text();

  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  // A misconfigured or undeployed script answers with an HTML error page, not
  // JSON — and often with HTTP 200, so the status alone cannot be trusted.
  if (!body) {
    const snippet = text.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(
      `The reader answered with something that isn't JSON (HTTP ${response.status}). ` +
        `Check the deployment URL. Body: ${snippet || "(empty)"}`
    );
  }

  if (!body.ok) {
    // "Unauthorized" is the one worth translating: it means the token in the
    // backend env and the one in the script's properties disagree, which is
    // not obvious from the word alone.
    if (body.error === "Unauthorized") {
      throw new Error(
        "The reader rejected our token. GOOGLE_SHEET_READER_TOKEN must match the " +
          "READ_TOKEN script property exactly."
      );
    }
    throw new Error(body.error || "The Google Sheets reader reported a failure.");
  }

  const payload = {
    file: body.file || "",
    tab: body.tab || "",
    headers: Array.isArray(body.headers) ? body.headers : [],
    rows: Array.isArray(body.rows) ? body.rows : [],
    total: Number(body.total) || 0,
    truncated: body.truncated === true,
    tabs: Array.isArray(body.tabs) ? body.tabs : [],
    fetchedAt: new Date().toISOString(),
  };

  cache.set(key, { at: Date.now(), payload });
  return payload;
};

export const clearSheetCache = (key) => {
  if (key) cache.delete(key);
  else cache.clear();
};

/* ──────────────────────────── the account join ──────────────────────────── */

// Where the annotation added by the route lands on each row. Prefixed so it
// cannot collide with a real sheet column — the headers come from the sheet's
// own first row, and somebody adding a column called "Has account" in Google
// Sheets should not silently overwrite this.
export const ACCOUNT_FIELD = "__hasAccount";
export const ACCOUNT_META_FIELDS = ["__accountStatus", "__accountCreatedAt"];

/**
 * Which column holds the email address.
 *
 * The join between a form submission and a platform account is the email and
 * nothing else — a sheet row has no user id, and names are neither unique nor
 * reliably spelled the same twice.
 *
 * Found by heuristic rather than hardcoded because these sheets are edited by
 * people and their headers are not in this repo. Ordered: an exact "email"
 * beats "Email Address" beats anything merely containing the word, so a sheet
 * with both "Email" and "Parent Email" picks the one that means the submitter.
 */
export const findEmailColumn = (headers = []) =>
  headers.find((h) => /^e-?mail$/i.test(String(h).trim())) ||
  headers.find((h) => /^e-?mail\s*(address)?$/i.test(String(h).trim())) ||
  headers.find((h) => /e-?mail/i.test(String(h))) ||
  null;

// Normalise before comparing. Sheet rows are typed by hand into a public form,
// so they arrive with stray whitespace and whatever capitalisation the person
// used; stored emails are saved as typed too (most are lowercase, some are
// not). Lowercasing both sides is what makes "John@Example.com " in the sheet
// match "john@example.com" in the database.
export const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

/* ───────────────────────────── filtering & paging ───────────────────────── */

// Sheets come back whole, so search and paging happen here rather than in the
// query. That is fine at this size and it is the only option — Apps Script has
// no query language — but it is why the row cap in the reader exists.
//
// `signup` filters on the account annotation the route attaches before calling
// this: "none" is the whole point of the feature — people who filled in the
// form and never went on to create an account. Rows whose annotation is
// undefined (no email column, so no join was possible) are excluded from both
// signup filters rather than guessed into one, since "we could not tell" is
// not the same answer as either.
export const filterRows = (rows, { search = "", column = "", value = "", signup = "" } = {}) => {
  let out = rows;

  if (column && value) {
    out = out.filter((row) => String(row[column] ?? "") === value);
  }

  if (signup === "none") out = out.filter((row) => row[ACCOUNT_FIELD] === false);
  if (signup === "joined") out = out.filter((row) => row[ACCOUNT_FIELD] === true);

  const term = String(search || "").trim().toLowerCase();
  if (term) {
    out = out.filter((row) =>
      Object.entries(row)
        // Skip the account annotation. It is not a column anyone can see, and
        // leaving it in the haystack means searching "true" quietly returns
        // every row that has an account — a filter nobody asked for, applied
        // by a search box that claims to search the sheet.
        .filter(([key]) => !key.startsWith("__"))
        .some(([, cell]) => String(cell ?? "").toLowerCase().includes(term))
    );
  }

  return out;
};

/**
 * Newest first, when there is a timestamp to sort by.
 *
 * A sheet is in insertion order, which is usually chronological but is not
 * guaranteed — rows get inserted and sorted by hand. Sorting explicitly means
 * the console's "newest first" claim is true rather than incidental.
 */
export const sortRows = (rows, headers) => {
  const dateColumn = headers.find((h) => /timestamp|date|submitted/i.test(h));
  if (!dateColumn) return rows;

  return [...rows].sort((a, b) => {
    const left = Date.parse(a[dateColumn]);
    const right = Date.parse(b[dateColumn]);
    // Unparseable dates sink rather than scrambling the order around them.
    if (Number.isNaN(left) && Number.isNaN(right)) return 0;
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return right - left;
  });
};

/**
 * One CSV cell.
 *
 * Leading =, +, - and @ are prefixed with a quote. These rows come from a
 * public form, and Excel executes a cell starting with "=" as a formula — so an
 * exported waitlist could run whatever a stranger typed into the name box.
 */
export const csvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const toCsv = (headers, rows) =>
  [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")),
  ].join("\n");
