import { X, UserX, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { rejectIncomingRequestThunk } from "@features/matching/store/matchSlice";

const RejectMatchModal = ({ matchId, setIsRejectModal }) => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const handleRequestReject = async () => {
        setLoading(true);
        try {
            await dispatch(rejectIncomingRequestThunk({ matchId: matchId })).unwrap();
            setIsRejectModal(false)
        } catch (error) {
            fireToastMessage({
                type: "error",
                message: "Server error"
            })
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[999] w-screen h-screen flex items-center justify-center backdrop-blur-md bg-black/35">
            <div className="relative bg-white rounded-3xl shadow-2xl px-7 py-8 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

                {/* Close button */}
                <button
                    type="button"
                    onClick={() => setIsRejectModal(false)}
                    className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    aria-label="Close"
                >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2L12 12M12 2L2 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>

                {/* Icon */}
                <div className="flex items-center justify-center rounded-full mb-4 w-16 h-16 bg-red-50">
                    <UserX className="text-red-500" size={28} />
                </div>

                {/* Label */}
                <p className="text-[11px] uppercase tracking-widest text-gray-400 Livvic-SemiBold mb-2">
                    Reject match request
                </p>

                {/* Heading */}
                <h2 className="text-xl Livvic-Bold text-primary mb-2 leading-snug">
                    Not the right fit?
                </h2>

                {/* Body */}
                <p className="text-gray-500 Livvic-Medium text-sm mb-6 leading-relaxed">
                    You're about to decline this match request.{" "}
                    <span className="Livvic-SemiBold text-gray-700">
                        This cannot be undone
                    </span>{" "}
                    and the sender won't be notified of the reason.
                </p>

                {/* Buttons */}
                <div className="flex flex-col gap-2.5 w-full">
                    <button
                        type="button"
                        onClick={() => handleRequestReject()}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full py-3 text-sm Livvic-Bold text-white"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Rejecting…
                            </>
                        ) : (
                            <>
                                <X size={16} />
                                Yes, reject request
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsRejectModal(false)}
                        className="w-full py-3 rounded-full border-2 border-gray-200 hover:border-gray-300 text-sm Livvic-Bold text-gray-700 transition-colors"
                    >
                        Keep considering
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
      `}</style>
        </div>
    );
};

export default RejectMatchModal;