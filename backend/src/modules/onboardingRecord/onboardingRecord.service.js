import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";

// The browser mints record ids with crypto.randomUUID(). Anything else is not a
// record we issued, and refusing it keeps this endpoint from being used as a
// free-form key/value store.
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generous for any real form — the family questionnaire's final save flattens
// every answer into columns (~70, the weekly schedule alone is 21) plus a JSON
// copy of the lot — and small enough that an anonymous caller can't park
// megabytes in a document.
const MAX_FIELDS = 200;
const MAX_KEY_LENGTH = 80;
const MAX_VALUE_LENGTH = 20000;

// Protocol words, not answers.
const RESERVED = new Set(["action", "Id", "id", "recordId"]);

const ADMIN_ROW_CAP = 5000;

export const isRecordId = (value) => typeof value === "string" && RECORD_ID.test(value);

/**
 * Column name → a safe Mongo field name. `$` would read as an operator and `.`
 * as a path, so neither survives; everything else ("Number of children",
 * "Child 1 age") is kept as the forms wrote it.
 */
const cleanKey = (key) =>
  String(key).trim().replace(/^\$+/, "").replace(/\./g, "_").slice(0, MAX_KEY_LENGTH);

/** Answers are text, as they were in the sheet. Objects arrive JSON-encoded. */
const cleanValue = (value) => {
  if (value === undefined || value === null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.slice(0, MAX_VALUE_LENGTH);
};

export class OnboardingRecordService extends BaseService {
  /**
   * Save what a form sent: `{ action, Id, ...columns }`.
   *
   * "create" and "update" behave the same — merge into the record, creating it
   * if it isn't there. A form that re-sends its first step, or an update that
   * lands before the create, both end up with one correct record.
   */
  async save(body = {}) {
    const recordId = body.Id ?? body.recordId;
    if (!isRecordId(recordId)) throw new ValidationError("Invalid record id");

    const fields = {};
    for (const [rawKey, rawValue] of Object.entries(body)) {
      if (RESERVED.has(rawKey)) continue;
      const key = cleanKey(rawKey);
      if (!key) continue;
      fields[key] = cleanValue(rawValue);
      if (Object.keys(fields).length > MAX_FIELDS) {
        throw new ValidationError("Too many fields");
      }
    }

    const email = typeof fields.Email === "string" ? fields.Email.trim().toLowerCase() : "";

    await this.onboardingRecordRepository.mergeFields(recordId, fields, { email });
    return { recordId };
  }

  /** The answers for one record, flattened to a sheet row: `{ Id, ...columns }`. */
  async get(recordId) {
    if (!isRecordId(recordId)) throw new ValidationError("Invalid record id");

    const doc = await this.onboardingRecordRepository.findByRecordId(recordId);
    if (!doc) throw new NotFoundError("Record not found");

    return OnboardingRecordService.toRow(doc);
  }

  static toRow(doc) {
    return {
      Timestamp: doc.fields?.Timestamp || (doc.createdAt ? new Date(doc.createdAt).toISOString() : ""),
      ...(doc.fields || {}),
      Id: doc.recordId,
    };
  }

  /**
   * Every record as a sheet, for the admin console's "Form responses" view —
   * the same `{ headers, rows }` payload the Google Sheets reader returns, so
   * the console needed no change when the forms moved off the sheet.
   *
   * Headers are every column any record has, Timestamp and Id first, then in
   * the order they first appear (newest record first).
   */
  async asSheet() {
    const docs = await this.onboardingRecordRepository.listRecent(ADMIN_ROW_CAP + 1);
    const truncated = docs.length > ADMIN_ROW_CAP;
    const rows = docs.slice(0, ADMIN_ROW_CAP).map(OnboardingRecordService.toRow);

    const headers = ["Timestamp", "Id"];
    for (const row of rows) {
      for (const column of Object.keys(row)) {
        if (!headers.includes(column)) headers.push(column);
      }
    }

    return {
      file: "Database",
      tab: "onboarding records",
      headers,
      rows,
      total: rows.length,
      truncated,
      tabs: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * The database records plus the rows still in the old Google Sheet, as one
 * sheet. Records written since the move exist only in the database; everything
 * before it exists only in the sheet. Where the same Id is in both, the
 * database copy wins — it is the one the forms are still updating.
 */
export const mergeWithSheet = (db, sheet) => {
  const seen = new Set(db.rows.map((row) => row.Id));
  const older = (sheet.rows || []).filter((row) => !seen.has(row.Id));

  const headers = [...db.headers];
  for (const column of sheet.headers || []) {
    if (!headers.includes(column)) headers.push(column);
  }

  return {
    ...db,
    file: sheet.file ? `Database + ${sheet.file}` : db.file,
    headers,
    rows: [...db.rows, ...older],
    total: db.rows.length + older.length,
    truncated: db.truncated || sheet.truncated === true,
  };
};

export default OnboardingRecordService;
