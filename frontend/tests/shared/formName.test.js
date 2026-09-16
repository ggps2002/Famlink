import { describe, it, expect } from "vitest";
import { fullNameFrom } from "@shared/lib/formName";
import { toCamelCase } from "@shared/lib/toCamelCase";

/**
 * The bug this exists to prevent, stated once:
 *
 * `InputDa` registers its Form.Item under `toCamelCase(name)`, and toCamelCase
 * lowercases the first word. `"firstName"` is one word, so the form stores
 * `values.firstname` while five separate signup paths read `values.firstName`
 * and got undefined — composing an empty name, passing validation, and writing
 * a blank into the sheet and the database.
 *
 * `email` and `password` were never affected: an already-lowercase single word
 * survives the transform unchanged. That asymmetry is what made it look like a
 * server problem — the location and the email always arrived.
 */

describe("toCamelCase, the transform underneath the bug", () => {
  it("lowercases a single camelCase word", () => {
    // The whole cause, in one assertion.
    expect(toCamelCase("firstName")).toBe("firstname");
    expect(toCamelCase("lastName")).toBe("lastname");
  });

  it("leaves an already-lowercase word alone", () => {
    // Which is why email and password never broke.
    expect(toCamelCase("email")).toBe("email");
    expect(toCamelCase("password")).toBe("password");
  });
});

describe("fullNameFrom", () => {
  it("reads the key the form actually stores", () => {
    // What Ant Design holds after InputDa registered the fields.
    expect(fullNameFrom({ firstname: "Priya", lastname: "Raman" })).toBe("Priya Raman");
  });

  it("still reads a plainly-registered field", () => {
    // Forms that use Form.Item directly keep the name they were given.
    expect(fullNameFrom({ firstName: "Priya", lastName: "Raman" })).toBe("Priya Raman");
  });

  it("prefers the canonical key when both spellings are present", () => {
    // `fieldKey` preserves identifiers now, so `firstName` is what a form
    // actually writes and the lowercased spelling is the legacy one. Before
    // that fix this preference ran the other way; the reading order changed
    // with it, deliberately.
    expect(fullNameFrom({ firstName: "Priya", firstname: "Legacy", lastName: "Raman" })).toBe(
      "Priya Raman"
    );
  });

  it("copes with only one half filled", () => {
    expect(fullNameFrom({ firstname: "Priya" })).toBe("Priya");
    expect(fullNameFrom({ lastname: "Raman" })).toBe("Raman");
  });

  it("trims, so a padded field is not a name with spaces round it", () => {
    expect(fullNameFrom({ firstname: "  Priya ", lastname: " Raman  " })).toBe("Priya Raman");
  });

  it("returns an empty string when there is nothing to compose", () => {
    expect(fullNameFrom({})).toBe("");
    expect(fullNameFrom(undefined)).toBe("");
    expect(fullNameFrom({ firstname: "   " })).toBe("");
  });

  it("does not leave a stray space between the halves", () => {
    // `${first} ${last}` on a missing half is what produced " Raman" and
    // "Priya " in the records that did get written.
    expect(fullNameFrom({ firstname: "Priya", lastname: "" })).toBe("Priya");
    expect(fullNameFrom({ firstname: "", lastname: "Raman" })).toBe("Raman");
  });

  it("accepts different field labels", () => {
    expect(
      fullNameFrom({ givenname: "Priya", surname: "Raman" }, { first: "givenName", last: "surname" })
    ).toBe("Priya Raman");
  });
});
