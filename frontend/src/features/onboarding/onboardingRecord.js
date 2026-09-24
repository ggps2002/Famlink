import { api } from "@shared/api/client";

/* The onboarding forms' answers, stored in our own database
 * (backend: /onboarding-records) instead of the Google Sheet they used to post
 * to through an Apps Script.
 *
 * Same protocol the sheet used, so the forms barely changed:
 *   save   { action: "create" | "update", Id, ...columns }
 *   fetch  → { status: "success", record: { Id, ...columns } }
 *          | { status: "error", message }
 * Id is the UUID the first form generates and carries in the URL. */

export async function saveOnboardingRecord(payload) {
  const { data } = await api.post("/onboarding-records", payload);
  return data;
}

// Never throws — every caller already branches on `status`, exactly as it did
// on the sheet script's reply.
export async function fetchOnboardingRecord(recordId) {
  try {
    const { data } = await api.get(`/onboarding-records/${encodeURIComponent(recordId)}`);
    return data;
  } catch (error) {
    return {
      status: "error",
      message: error?.response?.data?.message || "Could not load saved data",
    };
  }
}
