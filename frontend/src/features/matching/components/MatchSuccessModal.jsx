import { Send, MessageCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { sentMatchRequestThunk } from "@features/matching/store/matchSlice";
import { increaseMatchRequestSent } from "@features/auth/store/authSlice";
import { createChatThunk } from "@features/chat/store/chatSlice";

export const MatchRequestSuccessModal = ({ setIsRequestMatchSuccessModal, chatUserId }) => {
    const { user, accessToken } = useSelector((state) => state.auth);
    const navigate = useNavigate()
    const dispatch = useDispatch();
    const handleMessage = async () => {
        try {
            const participants = [chatUserId, user._id];
            const { status } = await dispatch(
                createChatThunk({ participants }),
            ).unwrap();
            if (status === 201 || status === 200) {
                navigate(`/dashboard/message?chatId=${chatUserId}`);
            }
        } catch (error) {
            // console.log(error);
            fireToastMessage({ type: "error", message: error.message });
        } finally {
            setIsRequestMatchSuccessModal(false)
        }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
            <div className="relative bg-white rounded-3xl shadow-2xl px-7 py-8 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">

                {/* Close button */}
                <button
                    type="button"
                    onClick={() => setIsRequestMatchSuccessModal(false)}
                    className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    aria-label="Close"
                >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2L12 12M12 2L2 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
                {/* Icon */}
                <div className="flex items-center justify-center rounded-full mb-4 w-16 h-16 bg-blue-50 animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
                    <MessageCircle className="text-blue-400" size={26} />
                </div>

                {/* Heading */}
                <h2 className="text-xl Livvic-Bold text-primary mb-2 leading-snug">
                    🎉 You Matched
                </h2>

                {/* Body */}
                <p className="text-gray-500 Livvic-Medium text-sm mb-5 leading-relaxed">
                    You both expressed interest.{" "}
                    <span className="Livvic-SemiBold text-gray-700">
                        Start chatting to discuss schedules, childcare needs, and details.
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
                    onClick={handleMessage}
                    className="w-full flex items-center justify-center gap-2 bg-[#AEC4FF] hover:bg-[#2e9fd4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full py-3 text-sm Livvic-Bold text-white"
                >
                    Open chat
                </button>
            </div>

            <style>{`
                @keyframes popIn { 0% { opacity:0; transform:scale(0.85) } 100% { opacity:1; transform:scale(1) } }
                @keyframes scaleIn { 0% { transform:scale(0) } 100% { transform:scale(1) } }
            `}</style>
        </div>
    );
};