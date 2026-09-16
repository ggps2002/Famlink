import { Send, MessageCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { sentMatchRequestThunk } from "@features/matching/store/matchSlice";
import { increaseMatchRequestSent } from "@features/auth/store/authSlice";

// `onReferralRequired` lets the parent swap this modal for the refer-a-friend
// one when the server turns the request down. That only fires if the client-side
// gate in Config/matchGate.js and the server disagree — a stale user object, or
// a second tab that spent the free match — but the server is authoritative and
// the user needs to be told what to do about it, not just that it failed.
export const MatchRequestFormModal = ({ setIsRequestSubmitModal, senderId, receiverId, onReferralRequired }) => {
    const dispatch = useDispatch();
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleRequest = async () => {
        setLoading(true);
        try {
            // unwrap() so a rejected request actually throws. Without it the
            // catch never ran and every failure — including the 403 paywall —
            // rendered the success screen and burned a match in the local count.
            await dispatch(sentMatchRequestThunk({ senderId, receiverId })).unwrap();
            dispatch(increaseMatchRequestSent());
            setSuccess(true);
        } catch (error) {
            if (error?.code === "REFERRAL_REQUIRED" && onReferralRequired) {
                setIsRequestSubmitModal(false);
                onReferralRequired();
                return;
            }
            fireToastMessage({
                type: "error",
                message: error?.message || "Error while trying to send request",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
            <div className="relative bg-white rounded-3xl shadow-2xl px-7 py-8 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

                {/* Close button */}
                <button
                    type="button"
                    onClick={() => setIsRequestSubmitModal(false)}
                    className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    aria-label="Close"
                >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2L12 12M12 2L2 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>

                {success ? (
                    /* ── Success state ── */
                    <div className="flex flex-col items-center text-center py-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
                        <div className="flex items-center justify-center rounded-full w-16 h-16 bg-green-50 mb-4">
                            <CheckCircle2 className="text-green-400" size={30} />
                        </div>

                        <p className="text-[11px] uppercase tracking-widest text-gray-400 Livvic-SemiBold mb-2">
                            Match request sent
                        </p>

                        <h2 className="text-xl Livvic-Bold text-primary mb-2 leading-snug">
                            Request sent! 🎉
                        </h2>

                        <p className="text-gray-500 Livvic-Medium text-sm mb-6 leading-relaxed">
                            Your match request is on its way.{" "}
                            <span className="Livvic-SemiBold text-gray-700">
                                We'll notify you
                            </span>{" "}
                            once they accept and start chatting.
                        </p>

                        <button
                            type="button"
                            onClick={() => setIsRequestSubmitModal(false)}
                            className="w-full flex items-center justify-center gap-2 bg-[#AEC4FF] hover:opacity-90 transition-opacity rounded-full py-3 text-sm Livvic-Bold text-[#0D134C]"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    /* ── Form state ── */
                    <>
                        {/* Icon */}
                        <div className="flex items-center justify-center rounded-full mb-4 w-16 h-16 bg-blue-50 animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
                            <MessageCircle className="text-blue-400" size={26} />
                        </div>

                        {/* Heading */}
                        <h2 className="text-xl Livvic-Bold text-primary mb-2 leading-snug">
                            Send a Match Request
                        </h2>

                        {/* Body */}
                        <p className="text-gray-500 Livvic-Medium text-sm mb-5 leading-relaxed">
                            Send a match request and start a conversation.{" "}
                            <span className="Livvic-SemiBold text-gray-700">
                                A quick connection can lead to the right match.
                            </span>
                        </p>

                        {/* Input */}
                        {/* <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={4}
                            maxLength={300}
                            placeholder="Hi! I came across your profile and think we'd be a great match. I'd love to connect…"
                            className="w-full rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:outline-none py-3 px-4 text-sm text-gray-700 resize-none shadow-sm transition-colors placeholder:!text-gray-400"
                        /> */}

                        {/* Char count + hint */}
                        {/* <div className="w-full flex items-center justify-between mt-1 mb-4">
                            <p className="text-xs text-gray-400">Be yourself — keep it warm &amp; brief</p>
                            <p className={`text-xs ${text.length >= 300 ? "text-red-400" : "text-gray-400"}`}>
                                {text.length} / 300
                            </p>
                        </div> */}

                        {/* Send button */}
                        <button
                            type="button"
                            onClick={handleRequest}
                            className="w-full flex items-center justify-center gap-2 bg-[#AEC4FF] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity rounded-full py-3 text-sm Livvic-Bold text-[#0D134C]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending…
                                </>
                            ) : (
                                <>
                                    <Send size={15} />
                                    Send Request
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>

            <style>{`
                @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
                @keyframes scaleIn { 0% { transform:scale(0) } 100% { transform:scale(1) } }
            `}</style>
        </div>
    );
};