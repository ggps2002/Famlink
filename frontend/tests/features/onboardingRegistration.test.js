import { describe, it, expect } from "vitest";
import {
  buildRegistration,
  resolveMemberName,
  familyGoal,
  familyGoalFor,
  REQUIRED_FIELDS,
} from "@features/onboarding/registration";

/**
 * The intake record → register payload step, which is where the family
 * onboarding signup was failing.
 *
 * The shape of that failure is worth stating, because it is why an empty name
 * must be caught here rather than sent:
 *
 *   • `name` is `required: true` on the user schema.
 *   • The create-account screen collects an email, a password and a terms
 *     checkbox. There is no name input.
 *   • So the name can only come from the saved intake record.
 *
 * Send an empty one and the member gets a Mongoose validation error, after a
 * round trip, on a form containing no field they could possibly correct. The
 * location came through fine, which is what made it look like a server problem
 * rather than a missing column.
 */

/** A record shaped the way the intake form writes it. */
const record = (overrides = {}) => ({
  Name: "Priya Raman",
  Email: "priya@example.com",
  "Already have nanny": "no",
  Location: '{"format_location":"Oakland, CA"}',
  parsedLocation: { format_location: "Oakland, CA" },
  ...overrides,
});

const registration = (overrides = {}) =>
  buildRegistration({
    record: record(),
    sheetId: "rec-1",
    email: "priya@example.com",
    password: "hunter2",
    type: "Parents",
    goal: "Looking for a share",
    ...overrides,
  });

describe("family onboarding hands registerThunk a complete payload", () => {
  it("carries every field the server requires", () => {
    const { payload, missing } = registration();

    expect(missing).toBeUndefined();
    for (const field of REQUIRED_FIELDS) {
      expect(payload[field], `${field} is missing`).toBeTruthy();
    }
  });

  it("includes the name, not just the location", () => {
    // The reported bug: location arrived intact and name did not, so the
    // failure looked like anything except a missing name.
    const { payload } = registration();

    expect(payload.name).toBe("Priya Raman");
    expect(payload.location).toEqual({ format_location: "Oakland, CA" });
  });

  it("reports a missing name instead of posting an empty one", () => {
    // Records written before the name was composed, and rows edited by hand,
    // both turn up with this column blank.
    const { payload, missing } = registration({ record: record({ Name: "" }) });

    expect(payload).toBeUndefined();
    expect(missing).toEqual(["name"]);
  });

  it("names every missing field at once, not just the first", () => {
    const { missing } = registration({
      record: record({ Name: "   " }),
      password: "",
    });

    expect(missing).toEqual(["name", "password"]);
  });

  it("treats a whitespace-only name as absent", () => {
    // `required: true` accepts " ", so this would create a member with a blank
    // name rather than fail — worse than the error it replaces.
    const { missing } = registration({ record: record({ Name: "   " }) });

    expect(missing).toEqual(["name"]);
  });

  it("passes flow-specific extras straight through", () => {
    // The caregiver flows add careType and additionalInfo.
    const { payload } = registration({
      type: "Nanny",
      careType: "full-time",
      additionalInfo: '[{"key":"ages"}]',
    });

    expect(payload.careType).toBe("full-time");
    expect(payload.additionalInfo).toBe('[{"key":"ages"}]');
  });
});

describe("resolveMemberName", () => {
  it("uses the composed Name the intake form writes", () => {
    expect(resolveMemberName({ Name: "Priya Raman" })).toBe("Priya Raman");
  });

  it("falls back to the two halves when only those are present", () => {
    // The form collects First Name and Last Name separately and joins them
    // before writing; a record that skipped that step still has both.
    expect(resolveMemberName({ "First Name": "Priya", "Last Name": "Raman" })).toBe(
      "Priya Raman"
    );
  });

  it("copes with only one half", () => {
    expect(resolveMemberName({ "First Name": "Priya" })).toBe("Priya");
    expect(resolveMemberName({ "Last Name": "Raman" })).toBe("Raman");
  });

  it("prefers the composed name when both forms are present", () => {
    expect(
      resolveMemberName({ Name: "Priya Raman", "First Name": "Stale" })
    ).toBe("Priya Raman");
  });

  it("trims, so a padded cell is not treated as a name", () => {
    expect(resolveMemberName({ Name: "  Priya Raman  " })).toBe("Priya Raman");
  });

  it("returns an empty string when the record has no name at all", () => {
    expect(resolveMemberName({})).toBe("");
    expect(resolveMemberName(null)).toBe("");
    expect(resolveMemberName({ Name: "" })).toBe("");
  });
});

describe("the record is the only source of the name", () => {
  // Deliberately: the create-account screen collects an email, a password and a
  // terms tickbox. The name arrives from the intake form the same way the
  // location and the email do, and is not asked for a second time.
  it("takes the name straight from the record", () => {
    const { payload } = registration();

    expect(payload.name).toBe("Priya Raman");
  });

  it("says so rather than posting a blank one", () => {
    // Reachable only for records written before the name composition was fixed
    // — see tests/shared/formName.test.js for what was writing them.
    expect(registration({ record: record({ Name: "" }) }).missing).toEqual(["name"]);
  });
});

describe("familyGoal", () => {
  it("maps an explicit no to looking for a share", () => {
    expect(familyGoal({ "Already have nanny": "no" })).toBe("Looking for a share");
  });

  it("ignores case and padding, which a hand-edited sheet has plenty of", () => {
    expect(familyGoal({ "Already have nanny": " No " })).toBe("Looking for a share");
  });

  it("treats anything else, including a blank cell, as having a nanny", () => {
    for (const answer of ["yes", "Yes", "", undefined]) {
      expect(familyGoal({ "Already have nanny": answer })).toBe(
        "Has a Nanny, Looking for a share"
      );
    }
  });

  it("gives the email and Google signups the same answer", () => {
    // They had drifted: the Google path wrote "Looking to share nanny", a
    // string that appears nowhere else and matches no badge or filter. Which
    // goal a family ended up with depended on which button they pressed.
    for (const answer of ["no", "yes", ""]) {
      expect(familyGoalFor(answer)).toBe(familyGoal({ "Already have nanny": answer }));
    }
    expect(familyGoalFor("yes")).not.toBe("Looking to share nanny");
  });
});
