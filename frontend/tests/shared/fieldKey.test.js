import { describe, it, expect } from "vitest";
import { fieldKey } from "@shared/lib/fieldKey";
import { toCamelCase } from "@shared/lib/toCamelCase";

/**
 * `InputDa` stores a field under this key, and getting it wrong is invisible:
 * the member fills the field, validation passes, and the value is written
 * somewhere nobody reads.
 *
 * That is what happened when a single `name="name"` input was split into
 * `firstName` and `lastName` — both became `firstname`/`lastname`, every caller
 * read the camelCase spelling, and five signup paths recorded people with no
 * name while their email and location arrived intact.
 */

describe("fieldKey", () => {
  it("leaves a camelCase identifier exactly as written", () => {
    // The bug, in one assertion.
    expect(fieldKey("firstName")).toBe("firstName");
    expect(fieldKey("lastName")).toBe("lastName");
    expect(fieldKey("customCertifications")).toBe("customCertifications");
  });

  it("leaves a plain lowercase name alone", () => {
    // These never broke, which is why the failure looked selective.
    for (const name of ["email", "password", "name", "zipCode"]) {
      expect(fieldKey(name)).toBe(name);
    }
  });

  it("still converts a human label into a key", () => {
    // Several screens pass the visible label as the name and depend on this.
    expect(fieldKey("Location of Work")).toBe("locationOfWork");
    expect(fieldKey("Reason for Leaving (Optional)")).toBe("reasonForLeavingOptional");
  });

  it("keeps every existing label mapping unchanged", () => {
    // Anything that is not a bare identifier must resolve exactly as it did
    // before, or forms start reading keys that no longer exist.
    for (const label of [
      "Location of Work",
      "1 Child",
      "5 Child or more",
      "Family Identifier/Nickname (Optional)",
      "Describe Skills",
    ]) {
      expect(fieldKey(label)).toBe(toCamelCase(label));
    }
  });

  it("copes with nothing at all", () => {
    expect(fieldKey(undefined)).toBe("");
    expect(fieldKey("")).toBe("");
  });

  it("is idempotent, so a key survives being passed through twice", () => {
    for (const name of ["firstName", "email", "Location of Work"]) {
      expect(fieldKey(fieldKey(name))).toBe(fieldKey(name));
    }
  });
});

describe("what it deliberately does not change", () => {
  it("leaves toCamelCase alone for option values", () => {
    // A dozen call sites turn option labels into stored answers with
    // toCamelCase. Preserving identifiers THERE would repoint saved data:
    // "Yes" is a valid identifier, and must keep becoming "yes".
    expect(toCamelCase("Yes")).toBe("yes");
    expect(toCamelCase("firstName")).toBe("firstname");
  });
});
