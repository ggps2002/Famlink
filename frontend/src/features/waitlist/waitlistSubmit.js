// The one way into the waitlist sheet.
//
// Four forms feed it — the standalone waitlist page, the parent match form, and
// both caregiver questionnaires — and they each used to build their own payload.
// They drifted: two of them posted a JSON.stringify'd Google place object into
// the Location column, and three sent field names the sheet had no header for,
// which the Apps Script silently dropped on the floor. Same failure mode that
// ALLOWED_ZIPCODES was pulled into serviceArea.js to stop. One copy lives here
// now — import it, don't fork it.
//
// The sheet is deliberately narrow: eight fixed columns every form shares, plus
// a Details column holding whatever that particular form asked. Adding a
// question to a form must not mean adding a column to the sheet.

// Column order is owned by the sheet's header row; this is only what we send.
// The Apps Script looks each name up in the live header, so a field the sheet
// has no column for is dropped — keep these in sync with HEADERS in the script.
const SHEET_FIELDS = [
  "Timestamp",
  "Id",
  "Source",
  "Name",
  "Email",
  "Location",
  "City",
  "Neighborhood",
  "Details",
];

// Which form a row came from. Written to the Source column, so keep the strings
// stable — they are what you filter the sheet on.
export const WAITLIST_SOURCE = {
  WAITLIST_PAGE: "Waitlist page",
  FAMILY_MATCH: "Family match form",
  CAREGIVER_SHARE: "Caregiver – share",
  CAREGIVER_JOB: "Caregiver – job",
};

/* A location reaches us as a Google place object, as raw typed text, or not at
   all. The sheet wants readable strings, never a serialised object — split it
   into the three columns and let the caller pass a display fallback for when
   the place object never resolved. */
export const splitLocation = (location, fallback = "") => {
  if (!location) return { Location: fallback, City: "", Neighborhood: "" };

  if (typeof location === "string") {
    return { Location: location, City: "", Neighborhood: "" };
  }

  return {
    Location: location.format_location || fallback,
    City: location.city || "",
    Neighborhood: location.neighborhood || "",
  };
};

/* Pack a form's own answers into the Details column as "Label: value | Label:
   value". Pairs with no answer are dropped rather than written as an empty
   label, so a half-filled form doesn't produce "Care needed:  | Together: ". */
export const buildDetails = (pairs) =>
  pairs
    .filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && String(value).trim() !== "";
    })
    .map(([label, value]) => `${label}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(" | ");

/* Record a waitlist signup. Throws when the row did not land, so callers show
   an error instead of a success modal — a silent failure here is invisible for
   days, which is exactly how it went unnoticed before.

   Posts form-urlencoded on purpose: that is a "simple request", so the browser
   skips the CORS preflight an Apps Script web app cannot answer. Send JSON
   instead and every submission dies on an unanswered OPTIONS. */
export const submitWaitlistEntry = async ({
  source,
  name,
  email,
  location,
  locationText = "",
  details = "",
}) => {
  const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_WAITLIST_URL;
  if (!scriptUrl) {
    // Not a warning. With no endpoint the signup is lost, and the caller needs
    // to say so rather than congratulate someone for joining nothing.
    throw new Error("VITE_GOOGLE_SCRIPT_WAITLIST_URL is not set");
  }

  const payload = {
    action: "create",
    Timestamp: new Date().toISOString(),
    // The client mints the id so a retry after a flaky response replays the
    // same one and the script can skip it instead of writing a duplicate.
    Id: crypto.randomUUID(),
    Source: source,
    Name: name || "",
    Email: email || "",
    ...splitLocation(location, locationText),
    Details: details,
  };

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  // Apps Script 302s to script.googleusercontent.com and fetch follows it, so a
  // transport-level failure still lands here as a non-ok status. A misconfigured
  // or undeployed script answers with an HTML error page, not JSON.
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  if (!response.ok || !body || !body.ok) {
    // The script's own error when it sent one. Otherwise say what actually came
    // back: "failed (HTTP 200)" on its own is undebuggable, and a 200 that is
    // not JSON is the interesting case — it means something other than the Apps
    // Script answered. A blocked cross-origin request, an extension returning a
    // stub, or a URL that fell through to the SPA rewrite all land here, and
    // they are told apart by the body and the final URL, not the status.
    if (body && body.error) throw new Error(body.error);

    const where = response.redirected ? ` via ${response.url}` : "";
    const snippet = text.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(
      `Waitlist write failed (HTTP ${response.status}, ` +
        `${body ? "JSON without ok" : "response was not JSON"})${where} — ` +
        `body: ${snippet || "(empty)"}`
    );
  }

  return body;
};

export { SHEET_FIELDS };
