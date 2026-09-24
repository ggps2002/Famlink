import { api } from "@shared/api/client";

// Which intake form this lead came from. Decides the copy and the resume link
// the nudge email builds, so keep these strings in sync with the `source` enum
// in backend/Schema/onboardingLead.js.
export const ONBOARDING_SOURCE = {
  FAMILY_MATCH: "family-match",
  CAREGIVER_JOB: "caregiver-job",
  CAREGIVER_SHARE: "caregiver-share",
};

// Record someone who has just finished the intake questions but has NOT created
// an account yet.
//
// The answers themselves are saved as an onboarding record (see
// onboardingRecord.js — they used to go to a Google Sheet). This lead is the
// separate, email-keyed copy that makes the drop-off addressable: a cron picks
// it up a few hours later and, if the address still has no account, sends the
// "you're one step away" email. `sheetId` is the onboarding record's id.
//
// Deliberately never throws, and is deliberately not awaited by the forms. It
// is bookkeeping layered on top of the real work — saving the onboarding record
// and getting the visitor into the questionnaire — so a failure here must not stall
// or break the flow the person is in the middle of. Logged and swallowed.
export const captureOnboardingLead = async ({
  email,
  name,
  source,
  sheetId,
  location,
  details,
}) => {
  if (!email) return;
  try {
    await api.post("/onboarding-leads/capture", {
      email,
      name: name || "",
      source: source || ONBOARDING_SOURCE.FAMILY_MATCH,
      sheetId: sheetId || "",
      // Sent as the object the Google autocomplete produced: the backend picks
      // out the coordinates and city it needs to choose nearby families for the
      // email. A location typed by hand (no place object) is still useful — the
      // backend keeps whatever of it is printable.
      location: location || null,
      details: details || "",
    });
  } catch (error) {
    console.error("Onboarding lead capture failed:", error);
  }
};
