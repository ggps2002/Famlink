import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, Copy, Gift, Loader2, Share2 } from "lucide-react";
import { getMyReferralThunk } from "@features/referral/store/referralSlice";
import { fireToastMessage } from "@shared/ui/toast";

import CustomButton from "@shared/ui/Button";
// Caregivers (Nanny + hasFamily false) have no subscription. Their first match
// request is free; after that they keep matching by referring a friend — each
// signup through their link grants a calendar month. This is the wall they hit,
// and it doubles as the share sheet: the point is to get the link copied, so
// the code and the copy button are the loudest things on it.
//
// Shown in place of RequestMatchDenied (the family paywall) for that audience.

const SHARE_TEXT =
  "I'm using FamLink to find a nanny share — join with my link and we both get matched faster:";

export const ReferAFriendModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const {
    code,
    link,
    referralCount,
    pendingCount,
    matchingUntil,
    hasActiveMatching,
    isLoading,
  } = useSelector((s) => s.referral);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dispatch(getMyReferralThunk());
  }, [dispatch]);

  // Reset the "Copied!" confirmation so a second copy still reads as an action.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // clipboard is blocked on insecure origins and in some in-app browsers —
      // the link is on screen and selectable, so say that rather than failing
      // silently.
      fireToastMessage({
        type: "error",
        message: "Couldn't copy — select the link and copy it manually",
      });
    }
  };

  // The native share sheet is the shortest path to a text message, which is how
  // caregivers actually pass this on. Desktop browsers mostly lack it, so it's
  // an addition to the copy button rather than a replacement.
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleShare = async () => {
    try {
      await navigator.share({ title: "Join me on FamLink", text: SHARE_TEXT, url: link });
    } catch {
      /* the user dismissed the sheet — nothing to report */
    }
  };

  const untilLabel = matchingUntil
    ? new Date(matchingUntil).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35 p-4">
      <div className="relative bg-white rounded-3xl shadow-2xl px-7 py-9 flex flex-col items-center text-center max-w-md w-full animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center rounded-full mb-5 w-[72px] h-[72px] bg-[#F0FBE2] animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
          <Gift className="text-[#075B49]" size={32} />
        </div>

        {/* Badge */}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-4 bg-[#F0FBE2] border border-[#D6FB9A]">
          <span className="inline-block rounded-full w-[7px] h-[7px] bg-[#075B49]" />
          <span className="text-xs Livvic-SemiBold text-[#075B49]">
            {hasActiveMatching ? "Matching active" : "Free match used"}
          </span>
        </div>

        <h2 className="text-2xl Livvic-SemiBold text-primary mb-2 leading-snug">
          Refer a friend, match free for a month
        </h2>

        <p className="text-gray-500 text-[15px] mb-6 leading-relaxed">
          Caregivers never pay on FamLink. When a friend joins with your link and
          sets up their profile, you get{" "}
          <span className="Livvic-SemiBold text-gray-700">
            another month of unlimited matching
          </span>
          {" "}— refer one a month and it never runs out.
        </p>

        {/* Share link */}
        <div className="w-full mb-3">
          {isLoading && !link ? (
            <div className="flex items-center justify-center gap-2 h-[52px] rounded-2xl bg-gray-50 border border-gray-200 text-gray-400">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-sm">Getting your link…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
                <span className="flex-1 text-left text-sm text-gray-600 truncate" title={link || ""}>
                  {link || "Link unavailable"}
                </span>
                <CustomButton
                  type="button"
                  onClick={handleCopy}
                  disabled={!link}
                  className="shrink-0 flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3 py-1.5 text-xs Livvic-SemiBold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </CustomButton>
              </div>
              {code && (
                <p className="mt-2 text-xs text-gray-400">
                  Or share your code{" "}
                  <span className="Livvic-SemiBold text-gray-600 tracking-wide">{code}</span>
                </p>
              )}
            </>
          )}
        </div>

        {canShare && link && (
          <CustomButton
            type="button"
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 text-center bg-[#D6FB9A] transition-colors rounded-full py-3 text-base Livvic-Bold text-[#075B49] mb-3 px-0"
          >
            <Share2 size={16} />
            Share Your Link
          </CustomButton>
        )}

        {/* Status footer — only meaningful once they've actually referred someone */}
        {(referralCount > 0 || pendingCount > 0) && (
          <p className="text-xs text-gray-500 leading-relaxed">
            {referralCount > 0 && (
              <>
                <span className="Livvic-SemiBold text-gray-700">
                  {referralCount} {referralCount === 1 ? "friend has" : "friends have"} joined
                </span>
                {hasActiveMatching && untilLabel
                  ? ` · free matching until ${untilLabel}`
                  : " · refer another to reactivate matching"}
              </>
            )}
            {/* A signup that hasn't finished its profile hasn't paid out yet.
                Saying so is both honest and actionable — the referrer can go
                nudge them. */}
            {pendingCount > 0 && (
              <span className="block mt-1 text-gray-400">
                {pendingCount} {pendingCount === 1 ? "friend has" : "friends have"} signed up but
                {pendingCount === 1 ? " hasn't" : " haven't"} finished setting up —
                your month starts when {pendingCount === 1 ? "they do" : "they do"}.
              </span>
            )}
          </p>
        )}
      </div>

      <style>{`
        @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
        @keyframes scaleIn { 0% { transform:scale(0) } 100% { transform:scale(1) } }
      `}</style>
    </div>
  );
};

export default ReferAFriendModal;
