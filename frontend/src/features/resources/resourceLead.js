import { api } from "@shared/api/client";

// Capture a Resource Center lead (Category 4.2). A top-of-funnel visitor gives
// us their email, neighborhood, and care timeline in exchange for a free
// download. The backend records the lead, emails the link, and returns it for
// immediate access.
//
// Returns { ok, downloadUrl }. Never throws — the caller drives its own UI off
// `ok` and shows an error toast rather than crashing the modal.
export const captureResourceLead = async ({
  email,
  name,
  neighborhood,
  careTimeline,
  resource,
}) => {
  try {
    const { data } = await api.post("/resource-leads/capture", {
      email,
      name: name || "",
      neighborhood: neighborhood || "",
      careTimeline: careTimeline || "",
      resource,
    });
    return { ok: true, downloadUrl: data?.downloadUrl || "" };
  } catch (error) {
    console.error("Resource lead capture failed:", error);
    return { ok: false, downloadUrl: "" };
  }
};
