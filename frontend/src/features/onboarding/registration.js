/**
 * Turning a saved intake record into the payload `registerThunk` expects.
 *
 * Three onboarding flows do this — family, caregiver-looking-for-a-job and
 * caregiver-adding-a-share — and until this module existed each did it inline,
 * with three different answers to the same question. One read
 * `record["Name"]`, one read the same thing with `|| "Caregiver"` bolted on,
 * and none of them could say what should happen when the record has no name at
 * all.
 *
 * That matters because `name` is `required: true` on the user schema and the
 * create-account screen has no name input: the value can only come from the
 * record. When it is missing, the register call fails Mongoose validation and
 * the member sees a generic error on a form with nothing to correct.
 */

/** The fields the server rejects a registration without. */
export const REQUIRED_FIELDS = ["name", "email", "password", "type"];

/**
 * The member's name, from whichever column the record actually carries.
 *
 * The intake forms write a single `Name` composed from two inputs, but records
 * predate that and the sheet is edited by hand, so the two halves turn up on
 * their own. Reading both is cheaper than explaining to someone why their
 * signup fails.
 */
export const resolveMemberName = (record) => {
  const text = (value) => String(value ?? "").trim();

  const whole = text(record?.["Name"]);
  if (whole) return whole;

  const first = text(record?.["First Name"] ?? record?.firstName);
  const last = text(record?.["Last Name"] ?? record?.lastName);

  return `${first} ${last}`.trim();
};

/**
 * The payload for `registerThunk`, or a description of what is missing.
 *
 * Returns `{ payload }` or `{ missing: [...] }` rather than throwing, because
 * the caller's job on failure is to tell the member which detail to supply —
 * not to catch an exception and guess.
 *
 * An empty name is reported here rather than sent. Sending it produces a
 * server-side validation error that names a Mongoose path, arrives after a
 * round trip, and leaves the member on a screen with no field to fix.
 */
export const buildRegistration = ({ record, sheetId, email, password, type, goal, ...rest }) => {
  const payload = {
    name: resolveMemberName(record),
    sheetId,
    location: record?.parsedLocation,
    goal,
    email: String(email ?? "").trim(),
    password: password ?? "",
    type,
    ...rest,
  };

  const missing = REQUIRED_FIELDS.filter((field) => !String(payload[field] ?? "").trim());

  return missing.length ? { missing } : { payload };
};

/**
 * What a family's `goal` is, given their answer to "already have a nanny".
 *
 * The sheet stores the answer as free text, so anything that is not exactly
 * "no" has to mean "yes" — a blank cell included.
 *
 * Both spellings live here because the two signup paths had drifted apart: the
 * email flow wrote "Has a Nanny, Looking for a share" and the Google flow wrote
 * "Looking to share nanny", a string that appears nowhere else in the codebase
 * and matches no filter or badge. One condition, two answers, depending only on
 * which button the member pressed.
 */
export const familyGoalFor = (alreadyHasNanny) =>
  String(alreadyHasNanny ?? "").trim().toLowerCase() === "no"
    ? "Looking for a share"
    : "Has a Nanny, Looking for a share";

/** The same, read off a saved intake record. */
export const familyGoal = (record) => familyGoalFor(record?.["Already have nanny"]);
