import { Flag, Loader2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { reportUserThunk } from "@features/matching/store/reportSlice";

import CustomButton from "@shared/ui/Button";
// The report dialog, opened from the chat header next to Block.
//
// Two fields, and both earn their place. The CATEGORY is what routes the case —
// the backend puts harassment and safety concerns at the top of the moderation
// queue unread, and a free-text-only form would mean a child safety report
// waiting behind a complaint about spam. The REASON is what makes it
// actionable: "inappropriate" tells a moderator nothing they can decide on,
// where "kept asking me to move to WhatsApp and send a deposit" is the whole
// case in one line.
//
// The reason is required rather than optional for that reason. It is the
// difference between a report a moderator can resolve and one they have to
// come back to the reporter about.
//
// LAYOUT: seven categories plus a textarea is taller than a phone, so the card
// is three regions — a fixed header, a scrolling middle, and a pinned footer —
// rather than one long scroll. Scrolling the whole card put Submit and Cancel
// below the fold, which is the one thing in a report form that must always be
// reachable. The card is capped in dvh, not vh, so mobile browser chrome does
// not push the footer off-screen.
//
// PORTAL: it renders into document.body rather than in place. The chat screen
// nests this component under three stacked `overflow-hidden` ancestors
// (PageLayout's h-screen shell, ChatInterface, then ChatView). A fixed element
// only escapes those because its containing block is the viewport, and that
// stops being true the moment anything in the chain picks up a transform,
// filter or backdrop-filter — at which point the clip boxes apply and the top
// of the dialog is cut off against the chat panel's edge. Portalling out of
// the subtree makes the dialog's position independent of chat layout.

const REASONS = [
  {
    value: "harassment",
    label: "Harassment or abuse",
    hint: "Threats, insults, or unwanted contact after being asked to stop",
  },
  {
    value: "inappropriate_content",
    label: "Inappropriate or sexual content",
    hint: "Explicit messages, images, or sexual advances",
  },
  {
    value: "scam",
    label: "Scam or fraud",
    hint: "Asked for money, bank details, or sent a suspicious payment",
  },
  {
    value: "fake_profile",
    label: "Fake profile",
    hint: "Pretending to be someone else, or details that don't add up",
  },
  {
    value: "spam",
    label: "Spam",
    hint: "Advertising, repeated unsolicited messages, or bot-like behaviour",
  },
  {
    value: "safety_concern",
    label: "Safety concern",
    hint: "Anything that made you worry about a child's or someone's safety",
  },
  { value: "other", label: "Something else", hint: "Tell us what happened" },
];

// Long enough that "bad" or "creepy" won't submit, short enough that a real
// sentence clears it without the counter becoming an obstacle.
const MIN_DETAILS = 15;

const ReportMatchModal = ({
  reportedUserId,
  name,
  chatId,
  messageId,
  setIsReportModal,
  onReported,
}) => {
  const dispatch = useDispatch();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const trimmed = details.trim();
  const canSubmit = Boolean(reason) && trimmed.length >= MIN_DETAILS && !loading;

  const handleReport = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await dispatch(
        reportUserThunk({ reportedUserId, reason, details: trimmed, chatId, messageId })
      ).unwrap();

      fireToastMessage({
        type: "success",
        message: result?.message || "Report submitted. Our team will review it.",
      });
      onReported?.();
      setIsReportModal(false);
    } catch (error) {
      fireToastMessage({
        type: "error",
        message: error?.message || "Could not submit the report",
      });
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] overflow-y-auto overscroll-contain backdrop-blur-md bg-black/40">
      {/* min-h-full + items-center is the one centring that cannot clip: if the
          card ever outgrows the viewport the wrapper grows with it and the
          overlay scrolls, instead of the card overflowing equally off the top
          and bottom where the top half is unreachable. */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="report-modal-card relative bg-white rounded-3xl shadow-2xl flex flex-col w-full max-w-md overflow-hidden animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

          {/* Close button — above the scroll area so it never slides away */}
          <button
            type="button"
            onClick={() => setIsReportModal(false)}
            className="absolute top-3.5 right-3.5 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* ── Header: fixed ── */}
          <div className="shrink-0 px-6 pt-6 pb-3 text-center">
            <div className="flex items-center justify-center rounded-full mb-3 w-12 h-12 bg-amber-50 mx-auto">
              <Flag className="text-amber-500" size={22} />
            </div>

            <h2 className="text-lg Livvic-Bold text-primary leading-snug">
              Report {name || "this profile"}
            </h2>

            <p className="text-gray-500 Livvic-Medium text-xs mt-1 leading-relaxed">
              Our team reviews every report.{" "}
              <span className="Livvic-SemiBold text-gray-700">
                They will never be told who reported them.
              </span>
            </p>
          </div>

          {/* ── Body: the only part that scrolls ── */}
          <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar px-6 py-3">
            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm Livvic-SemiBold text-gray-700 mb-2">
                What's happening?
              </label>
              <div className="flex flex-col gap-1.5">
                {REASONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReason(option.value)}
                    className={`text-left px-3.5 py-2 rounded-2xl border-2 transition-colors ${
                      reason === option.value
                        ? "border-[#AEC4FF] bg-[#AEC4FF]/10"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="block text-sm Livvic-SemiBold text-gray-800 leading-snug">
                      {option.label}
                    </span>
                    <span className="block text-[11px] Livvic text-gray-500 leading-snug">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label
                htmlFor="report-details"
                className="block text-sm Livvic-SemiBold text-gray-700 mb-2"
              >
                Tell us what happened
              </label>
              <textarea
                id="report-details"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                placeholder="What did they say or do? Include anything that would help our team understand."
                className="fl-field w-full resize-none"
              />
              <p className="text-xs Livvic text-gray-400 mt-1.5">
                {trimmed.length < MIN_DETAILS
                  ? `${MIN_DETAILS - trimmed.length} more characters needed`
                  : `${trimmed.length}/2000`}
              </p>
            </div>
          </div>

          {/* ── Footer: pinned, so Submit and Cancel are always in reach ── */}
          <div className="shrink-0 border-t border-gray-100 bg-white px-6 pt-3 pb-4">
            <div className="flex gap-3">
              <CustomButton
                type="button"
                onClick={() => setIsReportModal(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-full border-2 border-gray-200 hover:border-gray-300 disabled:opacity-50 text-sm Livvic-Bold text-gray-700 transition-colors px-0"
              >
                Cancel
              </CustomButton>

              <CustomButton
                type="button"
                onClick={handleReport}
                disabled={!canSubmit}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full py-2.5 text-sm Livvic-Bold text-white px-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Flag size={16} />
                    Submit report
                  </>
                )}
              </CustomButton>
            </div>

            {/* If someone is in danger, a moderation queue is the wrong tool and
                saying so costs one line. It lives in the pinned footer rather
                than the scroll area so it cannot be scrolled past unseen. */}
            <p className="text-[11px] Livvic text-gray-400 mt-2.5 text-center leading-relaxed">
              If someone is in immediate danger, contact your local emergency
              services first.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
        /* Two declarations, same rule: dvh wins where it is supported, and the
           vh line is what older browsers land on instead of no cap at all. */
        .report-modal-card { max-height: calc(100vh - 2rem); max-height: calc(100dvh - 2rem); }
      `}</style>
    </div>,
    document.body
  );
};

export default ReportMatchModal;
