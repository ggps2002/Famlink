import React, { useState } from "react";
import { Input, Select } from "antd";
import { X, Download, CheckCircle2 } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import { fireToastMessage } from "@shared/ui/toast";
import { captureResourceLead } from "@features/resources/resourceLead";
import { CARE_TIMELINE_OPTIONS } from "@features/resources/resourcesData";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email-capture gate for a downloadable Resource Center lead magnet.
 *
 * Collects email (required) plus neighborhood and care timeline (optional, but
 * they're the data that makes the lead useful for the drip sequence). On submit
 * it records the lead and, on success, swaps to a "your download is ready" state
 * with a button that opens the printable resource.
 *
 * Props:
 *   resource  — one of RESOURCES ({ slug, title, ... })
 *   onClose   — called to dismiss the modal
 */
export default function LeadMagnetModal({ resource, onClose }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [careTimeline, setCareTimeline] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");

  const done = Boolean(downloadUrl);

  const handleSubmit = async () => {
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      fireToastMessage({ type: "error", message: "Please enter a valid email address." });
      return;
    }
    setSubmitting(true);
    const { ok, downloadUrl: url } = await captureResourceLead({
      email: address,
      name,
      neighborhood,
      careTimeline,
      resource: resource.slug,
    });
    setSubmitting(false);

    if (!ok || !url) {
      fireToastMessage({
        type: "error",
        message: "Something went wrong. Please try again.",
      });
      return;
    }
    setDownloadUrl(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-[550px] mx-auto p-6 sm:p-8"
        style={{ animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={22} />
        </button>

        {done ? (
          /* ── Success: reveal the download ── */
          <div className="text-center pt-2">
            <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <CheckCircle2 className="text-green-600" size={34} />
            </div>
            <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">
              Your download is ready! 🎉
            </h2>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              We've also emailed a copy to <span className="Livvic-SemiBold text-gray-700">{email.trim()}</span> so
              you can find it later.
            </p>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <CustomButton
                btnText={
                  <span className="flex items-center justify-center gap-2">
                    <Download size={18} /> Open {resource.title}
                  </span>
                }
                className="bg-[#AEC4FF] w-full py-3.5 text-gray-900"
              />
            </a>
            <CustomButton
              type="button"
              onClick={onClose}
              className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors px-0 py-0 rounded-none Livvic"
            >
              Close
            </CustomButton>
          </div>
        ) : (
          /* ── Capture form ── */
          <>
            <div className="mb-5">
              <p className="text-xs Livvic-Bold uppercase tracking-wider text-[#185FA5] mb-1">
                {resource.eyebrow || "Free download"}
              </p>
              <h2 className="text-xl sm:text-2xl Livvic-Bold text-gray-900 leading-snug">
                {resource.title}
              </h2>
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                Tell us where to send it. We'll email your copy and open it right away — free, no account needed.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Input
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="p-3 rounded-xl border-2"
              />
              <Input
                type="email"
                placeholder="Email address *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onPressEnter={handleSubmit}
                className="p-3 rounded-xl border-2"
              />
              <Input
                placeholder="Neighborhood or city (e.g. Rockridge, Oakland)"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="p-3 rounded-xl border-2"
              />
              <Select
                placeholder="When do you need care?"
                value={careTimeline}
                onChange={setCareTimeline}
                options={CARE_TIMELINE_OPTIONS.map((o) => ({ label: o, value: o }))}
                className="w-full h-[46px] text-left"
                size="large"
              />
            </div>

            <CustomButton
              btnText="Get my free download"
              className="bg-[#AEC4FF] w-full py-3.5 mt-5 text-gray-900"
              action={handleSubmit}
              isLoading={submitting}
              loadingBtnText="Preparing your download…"
            />

            <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
              We'll occasionally email nanny-share tips and matches in your area. Unsubscribe any time.
            </p>
            
            <hr className="my-4 border-gray-200" />
            
            <p className="text-xs text-gray-400 text-center leading-relaxed px-2">
              These resources are for general informational purposes only and are not legal or tax advice. Laws vary by state. You are responsible for determining what applies to your situation, and FamLink is not responsible for how you use these resources.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes popIn { 0% { opacity:0; transform:scale(0.9); } 100% { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}
