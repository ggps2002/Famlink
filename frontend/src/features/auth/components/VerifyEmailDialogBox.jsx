import { useState } from "react";
import { useNavigate } from "react-router-dom";
function VerifyEmailPrompt({ user }) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  if (user?.verified?.emailVer || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full z-[999] animate-bannerSlide">
      <div className="bg-yellow-50 border-b border-yellow-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div
            className="
          flex flex-col sm:flex-row
          sm:items-center
          sm:justify-between
          gap-3 sm:gap-4
        "
          >
            {/* Left */}
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-yellow-600 text-lg shrink-0">⚠️</span>
              <p className="text-lg text-yellow-900 leading-snug">
                Please verify your email to unlock all features and secure your
                account. Click 'Verify Now' then go to 'Email Notifications' tab
              </p>
            </div>

            {/* Right */}
            <div
              className="
            flex flex-col sm:flex-row
            w-full sm:w-auto
            gap-4 sm:gap-6
          "
            >
              <button
                onClick={() => {
                  navigate("setting");
                  setDismissed(true);
                }}
                className="
                bg-yellow-400 hover:bg-yellow-300
                text-black text-lg Livvic-Medium
                px-4 py-2
                rounded-lg transition
                w-full sm:w-auto
              "
              >
                Verify now
              </button>

              <button
                onClick={() => setDismissed(true)}
                className="
                text-yellow-800/70 hover:text-yellow-900
                text-lg
                w-full sm:w-auto
                Livvic-Medium
              "
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPrompt;
