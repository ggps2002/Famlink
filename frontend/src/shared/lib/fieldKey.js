import { toCamelCase } from "@shared/lib/toCamelCase";

/**
 * The key a form field is stored under, given the `name` a screen passes it.
 *
 * `InputDa` accepts two very different kinds of name, and used to run both
 * through `toCamelCase`:
 *
 *   a label     "Location of Work"  →  needs converting  →  locationOfWork
 *   a key       "firstName"         →  needs nothing     →  firstName
 *
 * toCamelCase lowercases the first word of its input, and a single word IS the
 * first word — so `"firstName"` came back as `"firstname"`. The field was then
 * stored under a key no caller read. `values.firstName` was undefined, the
 * composed full name was `""`, and validation still passed because the field
 * the member typed into was filled. Every intake form that split its name into
 * two camelCase inputs silently recorded people with no name.
 *
 * `"email"`, `"password"` and the old single `"name"` were never affected: an
 * already-lowercase single word survives the transform unchanged. That is the
 * whole reason the failure looked selective — the email and the location always
 * arrived, only the name went missing.
 *
 * So: a name that is already a usable identifier is left exactly as written,
 * and only genuine labels are converted. Labels are unaffected, because a label
 * contains spaces or punctuation and never matches the identifier test.
 *
 * This is deliberately NOT a change to toCamelCase itself, which a dozen other
 * call sites use to turn option labels into stored values — `toCamelCase("Yes")`
 * must keep returning `"yes"`, and preserving identifiers there would silently
 * repoint saved answers.
 */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const fieldKey = (name) => {
  const text = String(name ?? "");
  return IDENTIFIER.test(text) ? text : toCamelCase(text);
};

export default fieldKey;
