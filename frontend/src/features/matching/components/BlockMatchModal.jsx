import { Ban, Loader2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { blockMatchThunk } from "@features/matching/store/matchSlice";

import CustomButton from "@shared/ui/Button";
// Rendered from ChatView, which sits under three stacked `overflow-hidden`
// ancestors (PageLayout's h-screen shell, ChatInterface, then ChatView). A
// fixed overlay escapes those clip boxes only while its containing block is
// the viewport, and anything in that chain picking up a transform, filter or
// backdrop-filter ends that — the dialog then gets cut off against the chat
// panel's top edge. Portalling to document.body keeps it independent of chat
// layout. See ReportMatchModal, which has the same arrangement.
const BlockMatchModal = ({ matchId, name, setIsBlockModal, onBlocked }) => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const handleBlock = async () => {
        setLoading(true);
        try {
            await dispatch(blockMatchThunk({ matchId })).unwrap();
            fireToastMessage({ type: "success", message: "Profile blocked" });
            onBlocked?.();
            setIsBlockModal(false);
        } catch (error) {
            fireToastMessage({
                type: "error",
                message: error?.message || "Server error",
            });
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[999] overflow-y-auto overscroll-contain backdrop-blur-md bg-black/35">
            {/* min-h-full + items-center rather than centring in a fixed-height
                box: on a short viewport the wrapper grows and the overlay
                scrolls, instead of the card overflowing off both edges with
                its top half unreachable. */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white rounded-3xl shadow-2xl px-7 py-8 flex flex-col items-center text-center max-w-sm w-full animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setIsBlockModal(false)}
                        className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        aria-label="Close"
                    >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2L12 12M12 2L2 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>

                    {/* Icon */}
                    <div className="flex items-center justify-center rounded-full mb-4 w-16 h-16 bg-red-50">
                        <Ban className="text-red-500" size={28} />
                    </div>

                    {/* Label */}
                    <p className="text-[11px] uppercase tracking-widest text-gray-400 Livvic-SemiBold mb-2">
                        Block profile
                    </p>

                    {/* Heading */}
                    <h2 className="text-xl Livvic-Bold text-primary mb-2 leading-snug">
                        Block {name || "this profile"}?
                    </h2>

                    {/* Body */}
                    <p className="text-gray-500 Livvic-Medium text-sm mb-6 leading-relaxed">
                        They won't be able to message you and your conversation will be
                        paused. You can{" "}
                        <span className="Livvic-SemiBold text-gray-700">unblock anytime</span>{" "}
                        from the chat.
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-col gap-2.5 w-full">
                        <CustomButton
                            type="button"
                            onClick={handleBlock}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full py-3 text-sm Livvic-Bold text-white px-0"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Blocking…
                                </>
                            ) : (
                                <>
                                    <Ban size={16} />
                                    Yes, block
                                </>
                            )}
                        </CustomButton>

                        <CustomButton
                            type="button"
                            onClick={() => setIsBlockModal(false)}
                            className="w-full py-3 rounded-full border-2 border-gray-200 hover:border-gray-300 text-sm Livvic-Bold text-gray-700 transition-colors px-0"
                        >
                            Cancel
                        </CustomButton>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
      `}</style>
        </div>,
        document.body
    );
};

export default BlockMatchModal;
