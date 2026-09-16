import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const RequestMatchDenied = ({ onSubscribe, setIsMatchRequestDenied }) => {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
      <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

        {/* Close button */}
        <button
          type="button"
          onClick={() => setIsMatchRequestDenied((prev) => !prev)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center rounded-full mb-5 w-[72px] h-[72px] bg-blue-50 animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
          {/* <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="13" cy="13" r="7" fill="#dbe6ff" stroke="#AEC4FF" strokeWidth="1.8" />
            <circle cx="23" cy="13" r="7" fill="#dbe6ff" stroke="#AEC4FF" strokeWidth="1.8" />
            <path d="M6 28c0-4 3.1-7 7-7h10c3.9 0 7 3 7 7" stroke="#AEC4FF" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M22 20.5l1.5 1.5 3-3" stroke="#5b8cff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg> */}
          <Coins/>
        </div>

        {/* Badge */}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-4 bg-blue-50 border border-blue-100">
          <span className="inline-block rounded-full w-[7px] h-[7px] bg-[#AEC4FF]" />
          <span className="text-xs Livvic-SemiBold text-[#AEC4FF]">Free match used</span>
        </div>

        {/* Heading */}
        <h2 className="text-2xl Livvic-SemiBold text-primary mb-2 leading-snug">
          Keep the matches coming
        </h2>

        {/* Body */}
        <p className="text-gray-500 text-base mb-6 leading-relaxed">
          Your <span className="Livvic-SemiBold text-gray-700">first free match</span> has been used.
          Subscribe to a plan to continue connecting with{" "}
          <span className="Livvic-SemiBold text-gray-700">families and caregivers</span> that fit your needs.
        </p>

        {/* Subscribe button */}
        <button
          type="button"
          onClick={() => {
            navigate("/dashboard/setting?option=Subscription");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="w-full flex items-center justify-center gap-2 text-center bg-[#D6FB9A] transition-colors rounded-full py-3 text-base Livvic-Bold text-[#075B49] mb-3"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L10.2 5.5L15 6.2L11.5 9.6L12.4 14.4L8 12L3.6 14.4L4.5 9.6L1 6.2L5.8 5.5Z" fill="#075B49" fillOpacity="0.7" />
          </svg>
          Subscribe &amp; Keep Matching
        </button>
      </div>

      <style>{`
        @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
        @keyframes scaleIn { 0% { transform:scale(0) } 100% { transform:scale(1) } }
      `}</style>
    </div>
  );
};