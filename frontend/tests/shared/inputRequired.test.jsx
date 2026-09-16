import { describe, it, expect } from "vitest";

/**
 * The rule `InputDa` builds for Ant Design's Form.Item.
 *
 * Mirrored here rather than rendered, because rendering the component pulls in
 * the store, the OTP flow and an axios client for a two-line decision. The
 * decision is the part that was wrong.
 *
 * Two things about it are easy to get backwards, and both did:
 *
 *   • `req` reads like "required" and means the opposite — passing it makes a
 *     field OPTIONAL.
 *   • `required` was never a prop at all, so two call sites that passed
 *     `required={true}` were passing it into the void. Harmless there, since
 *     the default is already required; a `required={false}` written the same
 *     way would have silently kept the field mandatory.
 */
const ruleFor = ({ required, req, labelText = "" } = {}) => ({
  required: required ?? !req,
  message: labelText ? `${labelText} is required` : "This field is required",
});

describe("InputDa's required rule", () => {
  it("requires the field by default", () => {
    // Every existing call site depends on this: they pass neither prop and
    // expect a mandatory field.
    expect(ruleFor().required).toBe(true);
  });

  it("honours required={false}", () => {
    expect(ruleFor({ required: false }).required).toBe(false);
  });

  it("honours required={true}", () => {
    // Previously ignored entirely.
    expect(ruleFor({ required: true }).required).toBe(true);
  });

  it("keeps the legacy inverted prop working", () => {
    // `req` marks a field optional. Changing that would quietly make every
    // field that uses it mandatory.
    expect(ruleFor({ req: true }).required).toBe(false);
    expect(ruleFor({ req: false }).required).toBe(true);
  });

  it("lets required win over req when both are given", () => {
    expect(ruleFor({ required: true, req: true }).required).toBe(true);
  });

  it("says which field is missing", () => {
    // An empty message renders a red border and no text: the member knows
    // something is wrong, not what.
    expect(ruleFor({ labelText: "First Name" }).message).toBe("First Name is required");
    expect(ruleFor().message).toBe("This field is required");
  });
});
