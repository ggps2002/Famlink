import { describe, it, expect } from "vitest";
import { fieldKey } from "@shared/lib/fieldKey";
import { fullNameFrom } from "@shared/lib/formName";

/**
 * The whole path that lost people's names, end to end.
 *
 * Each piece is covered on its own elsewhere; this asserts they fit together,
 * because the bug lived exactly in the join. `InputDa` wrote one key and
 * `onFinish` read another, and nothing in between could tell.
 *
 * The sheet is the record of what went wrong: every submission from the deploy
 * on 2026-08-05 onwards has an Email, a Location, a Care needed and a blank
 * Name. Seven members, whose typed names never left the browser.
 */

/** What Ant Design hands `onFinish`, keyed the way InputDa registered the fields. */
const formValues = (typed) =>
  Object.fromEntries(Object.entries(typed).map(([label, value]) => [fieldKey(label), value]));

/** The Name column NannyShareMatchForm writes. */
const nameColumn = (values) => fullNameFrom(values) || "";

describe("a member typing their name into the match form", () => {
  it("reaches the sheet's Name column", () => {
    const values = formValues({
      firstName: "Priya",
      lastName: "Raman",
      email: "priya@example.com",
    });

    expect(nameColumn(values)).toBe("Priya Raman");
  });

  it("is stored under the key the submit handler reads", () => {
    // The join that broke: InputDa wrote `firstname`, onFinish read `firstName`.
    const values = formValues({ firstName: "Priya", lastName: "Raman" });

    expect(Object.keys(values)).toContain("firstName");
    expect(values.firstName).toBe("Priya");
  });

  it("would have written a blank name before the fix", () => {
    // Pinning the old behaviour so the regression is unmistakable if the
    // transform ever starts lowercasing identifiers again.
    const legacy = { firstname: "Priya", lastname: "Raman" };
    const asOnFinishUsedToRead = `${legacy.firstName || ""} ${legacy.lastName || ""}`.trim();

    expect(asOnFinishUsedToRead).toBe("");
    expect(nameColumn(legacy)).toBe("Priya Raman"); // and is recovered now
  });

  it("keeps the other columns working, as they always did", () => {
    // email and location were never affected — that asymmetry is what made the
    // failure look like a server problem.
    const values = formValues({ email: "priya@example.com", password: "hunter2" });

    expect(values.email).toBe("priya@example.com");
    expect(values.password).toBe("hunter2");
  });

  it("never writes a name that is only a space", () => {
    // `${first} ${last}` on a missing half produced " Raman", which is a name
    // the server accepts and a human would not recognise.
    expect(nameColumn(formValues({ firstName: "Priya" }))).toBe("Priya");
    expect(nameColumn(formValues({ lastName: "Raman" }))).toBe("Raman");
    expect(nameColumn(formValues({}))).toBe("");
  });
});
