import { fieldKey } from "@shared/lib/fieldKey";
import { toCamelCase } from "@shared/lib/toCamelCase";

/**
 * The full name from a form's first/last inputs.
 *
 * Exists because reading `values.firstName` does not work, and fails in the
 * quietest possible way.
 *
 * `InputDa` registers its Form.Item as `toCamelCase(name)`, and toCamelCase
 * lowercases the first word of its input. A single word IS the first word, so
 * `"firstName"` becomes `"firstname"` — the form stores `values.firstname`
 * while every caller reads `values.firstName` and gets undefined. The composed
 * name is then `""`, and:
 *
 *   • validation passes, because the field the member actually typed into is
 *     filled and required;
 *   • `email` and `password` are unaffected, because toCamelCase leaves an
 *     already-lowercase single word alone.
 *
 * So the form looks correct, submits correctly, and writes a blank name — which
 * is how five separate signup paths came to record people with no name while
 * their email and location arrived intact.
 *
 * `fieldKey` now preserves identifiers, so `values.firstName` is what a new
 * submission actually holds. This still reads the old lowercased spelling too:
 * a form built before that fix, or one that passes its label as the name, both
 * keep working. Belt and braces on the path that silently lost people's names.
 */
export const fullNameFrom = (values, { first = "firstName", last = "lastName" } = {}) => {
  // The transformed key is what InputDa writes; the raw key covers forms that
  // register their fields with a plain Form.Item instead.
  const read = (label) =>
    String(
      values?.[fieldKey(label)] ?? values?.[toCamelCase(label)] ?? values?.[label] ?? ""
    ).trim();

  return `${read(first)} ${read(last)}`.trim();
};

export default fullNameFrom;
