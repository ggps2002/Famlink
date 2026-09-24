import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { parsePaging, pagingMeta } from "./admin.middleware.js";
import {
  SHEET_KEYS,
  filterRows,
  sortRows,
  clearSheetCache,
  toCsv,
  findEmailColumn,
  normalizeEmail,
  ACCOUNT_FIELD,
} from "../../shared/integrations/sheetReader.js";

/** What each sheet is, in the console's words. */
export const SHEET_META = {
  waitlist: {
    label: "Waitlist sheet",
    description:
      "Everyone who joined the waitlist through the website — the standalone waitlist page, " +
      "the family match form, and both caregiver questionnaires.",
  },
  forms: {
    label: "Form responses",
    description:
      "Submissions from the match and questionnaire forms, including people who started " +
      "onboarding but never finished creating an account.",
  },
};

export const NOT_CONFIGURED_MESSAGE =
  "Google Sheets reading isn't set up yet. The reader script needs deploying and " +
  "GOOGLE_SHEET_READER_URL / GOOGLE_SHEET_READER_TOKEN adding to the backend environment.";

const resolveKey = (raw) => (SHEET_KEYS.includes(String(raw)) ? String(raw) : null);

/**
 * The Google Sheets the public forms still write to, shown in the console.
 *
 * Read-only by construction: the reader deployment behind this has no write
 * path at all. The forms' own scripts are untouched, which matters because
 * eighteen files on the public site post to one of them and its source is not
 * in this repository.
 */
export class SheetsService extends BaseService {
  /**
   * Attach account state to every row, in place.
   *
   * ── Why this join exists ──────────────────────────────────────────────────
   * These sheets are the top of the funnel: somebody answered the onboarding
   * questions on the public site, which writes a row here, and only afterwards
   * (if at all) went on to register. The gap between the two is the most
   * actionable list on the platform — people who showed real intent and then
   * stopped — and it was invisible, because the sheet knows nothing about the
   * database and the database knows nothing about the sheet.
   *
   * The join is the email address and can only be the email address: a sheet
   * row carries no user id, and names are neither unique nor spelled the same
   * twice.
   *
   * ── Two things it cannot see ──────────────────────────────────────────────
   *   1. Someone who registered with a DIFFERENT email than they gave the form
   *      reads as "never signed up". Nothing in either record links them.
   *   2. A deleted account has had its email overwritten, so someone who joined
   *      and was later removed also reads as "never signed up".
   *
   * Both err the same way — toward over-reporting the gap — which is the safer
   * direction for a list whose purpose is "consider following these people up".
   *
   * @returns the email column used, or null when the sheet has none.
   */
  async #annotateAccounts(rows, headers) {
    const emailColumn = findEmailColumn(headers);
    if (!emailColumn) return null;

    const emails = [
      ...new Set(rows.map((row) => normalizeEmail(row[emailColumn])).filter(Boolean)),
    ];

    if (!emails.length) {
      for (const row of rows) row[ACCOUNT_FIELD] = false;
      return emailColumn;
    }

    const accounts = await this.userRepository.findByEmailsInsensitive(emails);
    const byEmail = new Map(accounts.map((user) => [normalizeEmail(user.email), user]));

    for (const row of rows) {
      const account = byEmail.get(normalizeEmail(row[emailColumn]));
      row[ACCOUNT_FIELD] = Boolean(account);
      row.__accountStatus = account?.status || null;
      row.__accountCreatedAt = account?.createdAt || null;
    }

    return emailColumn;
  }

  /**
   * Totals across the WHOLE sheet, not the current page.
   *
   * "412 of 1,200 never signed up" is the number worth showing; the same figure
   * scoped to 25 visible rows is noise that changes every time you page.
   */
  #accountTotals(rows) {
    let joined = 0;
    let neverSignedUp = 0;

    for (const row of rows) {
      if (row[ACCOUNT_FIELD] === true) joined += 1;
      else if (row[ACCOUNT_FIELD] === false) neverSignedUp += 1;
    }

    return { joined, neverSignedUp };
  }

  /** Fetch, annotate, filter and sort — the shared half of list and export. */
  async #prepare(key, query, { force = false } = {}) {
    const sheet = await this.fetchSheet(key, { force });

    // Annotated before filtering, because `signup` filters on the annotation —
    // and counted before filtering too, so the headline totals describe the
    // sheet rather than whatever the admin has narrowed it to.
    const emailColumn = await this.#annotateAccounts(sheet.rows, sheet.headers);
    const totals = emailColumn ? this.#accountTotals(sheet.rows) : null;

    const filtered = filterRows(sheet.rows, {
      search: query.search,
      column: query.column,
      value: query.value,
      signup: emailColumn ? query.signup : "",
    });

    return { sheet, emailColumn, totals, ordered: sortRows(filtered, sheet.headers) };
  }

  resolveKey(raw) {
    const key = resolveKey(raw);
    if (!key) throw new NotFoundError("Unknown sheet");
    return key;
  }

  get configured() {
    return this.sheetsConfigured();
  }

  /** Per sheet: "forms" is database-backed and always readable. */
  isConfigured(key) {
    return this.sheetsConfigured(key);
  }

  /**
   * The "not set up yet" response.
   *
   * A configuration gap is not a server error — it is a setup step nobody has
   * done. 200 with `configured: false` lets the screen say so calmly instead of
   * rendering a red failure over a feature that was never switched on.
   */
  notConfigured(key) {
    return {
      configured: false,
      data: [],
      pagination: pagingMeta(0, { page: 1, limit: 50, skip: 0 }),
      meta: { key, ...SHEET_META[key], headers: [], file: "", tab: "", fetchedAt: null },
      message: NOT_CONFIGURED_MESSAGE,
    };
  }

  async list({ key, query = {} }) {
    const paging = parsePaging(query);
    const { sheet, emailColumn, totals, ordered } = await this.#prepare(key, query, {
      force: query.refresh === "1",
    });

    return {
      configured: true,
      data: ordered.slice(paging.skip, paging.skip + paging.limit),
      pagination: pagingMeta(ordered.length, paging),
      meta: {
        key,
        ...SHEET_META[key],
        headers: sheet.headers,
        file: sheet.file,
        tab: sheet.tab,
        tabs: sheet.tabs,
        fetchedAt: sheet.fetchedAt,
        totalRows: sheet.total,
        // Null when the sheet has no email column: there is nothing to join on,
        // so the console hides the filter instead of offering one that can only
        // ever return nothing.
        emailColumn,
        accountTotals: totals,
        // Set when the sheet is longer than the reader's row cap, so the
        // console can say the totals are a floor rather than quietly
        // under-reporting a spreadsheet that outgrew it.
        truncated: sheet.truncated,
      },
    };
  }

  /**
   * Export what the filters currently select, not the whole sheet — an admin
   * who filtered to one city and clicked export meant that city.
   */
  async export({ key, query = {} }) {
    if (!this.isConfigured(key)) {
      throw new ValidationError("Google Sheets reading isn't set up yet.");
    }

    const { sheet, emailColumn, ordered } = await this.#prepare(key, query);

    // The account column is appended when the join was possible.
    //
    // Filtering to "never signed up" and exporting otherwise produces a file
    // indistinguishable from any other export — same columns, no trace of what
    // it was narrowed to. Someone opening it a week later would have no way to
    // know it is a follow-up list rather than the whole sheet.
    const headers = emailColumn ? [...sheet.headers, "Created an account"] : sheet.headers;
    const rows = emailColumn
      ? ordered.map((row) => ({
          ...row,
          "Created an account": row[ACCOUNT_FIELD] ? "Yes" : "No",
        }))
      : ordered;

    return {
      filename: `${key}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: toCsv(headers, rows),
      rowCount: ordered.length,
      label: SHEET_META[key].label,
    };
  }

  refresh(key) {
    clearSheetCache(key);
  }
}

export default SheetsService;
