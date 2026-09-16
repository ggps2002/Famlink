import { PartyPopper, CalendarCheck } from "lucide-react";

// One-time celebration shown on the dashboard when a referred friend completes
// their profile and the referrer earns a free month. Mounted by the dashboard,
// which fires the ack (marking it seen server-side) as it opens, so it shows
// exactly once per referral. `matchingUntil` and `rewardsCount` come from
// /referral/me.

const formatUntil = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

export const ReferralRewardModal = ({ onClose, matchingUntil, rewardsCount = 1 }) => {
  const until = formatUntil(matchingUntil);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-md bg-black/35 p-4">
      <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

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

        <div className="flex items-center justify-center rounded-full mb-5 w-[76px] h-[76px] bg-[#F0FBE2] animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
          <PartyPopper className="text-[#075B49]" size={34} />
        </div>

        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-4 bg-[#F0FBE2] border border-[#D6FB9A]">
          <span className="inline-block rounded-full w-[7px] h-[7px] bg-[#075B49]" />
          <span className="text-xs Livvic-SemiBold text-[#075B49]">
            {rewardsCount > 1 ? `${rewardsCount} free months earned` : "Free month earned"}
          </span>
        </div>

        <h2 className="text-2xl Livvic-SemiBold text-primary mb-2 leading-snug">
          You've unlocked free matching! 🎉
        </h2>

        <p className="text-gray-500 text-[15px] mb-6 leading-relaxed">
          A friend you referred just finished setting up their profile, so we've
          added{" "}
          <span className="Livvic-SemiBold text-gray-700">
            {rewardsCount > 1 ? `${rewardsCount} months` : "a month"} of unlimited matching
          </span>{" "}
          to your account.
        </p>

        {until && (
          <div className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#F6F3EE] px-4 py-3 mb-6">
            <CalendarCheck size={18} className="text-[#075B49] shrink-0" />
            <span className="text-sm Livvic-Medium text-gray-700">
              Matching active until{" "}
              <span className="Livvic-SemiBold text-primary">{until}</span>
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full text-center bg-[#D6FB9A] transition-colors rounded-full py-3 text-base Livvic-Bold text-[#075B49]"
        >
          Start matching
        </button>
      </div>

      <style>{`
        @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
        @keyframes scaleIn { 0% { transform:scale(0) } 100% { transform:scale(1) } }
      `}</style>
    </div>
  );
};

export default ReferralRewardModal;
