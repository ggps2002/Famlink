import ChatInterface from "@features/chat/components/ChatInterface";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { getSubscriptionStatusThunk } from "@features/subscription/store/cardSlice";

export default function MessageFrame() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const subscription = useSelector(
    (state) => state.cardData.subscriptionStatus
  );
  const isSubscribed = subscription?.active;

  // 🔁 Fetch subscription status on component mount
  useEffect(() => {
    dispatch(getSubscriptionStatusThunk());
  }, [dispatch]);

  return (
    <div className="relative h-full">
      {/* Blurred overlay when unsubscribed */}
      {/* {!isSubscribed && (
        <div className="absolute top-0 left-0 w-full h-full backdrop-blur-[4px] bg-white/50 z-20 flex items-center justify-center rounded-xl">
             <div className="bg-white shadow-xl rounded-2xl p-8 w-[90%] max-w-md text-center">
            <h2 className="text-2xl Livvic-SemiBold text-[#050A30] mb-3">
              Subscribe to Unlock
            </h2>
            <p className="text-gray-600 mb-6">
              Unlock messaging to contact this caregiver
            </p>
            <button
              onClick={() => navigate("/dashboard/setting?option=Subscription")}
              className="bg-[#AEC4FF] hover:opacity-90 text-white Livvic-Medium py-2 px-6 rounded-full transition-all"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )} */}

      <div className="bg-white relative z-0 h-full">
          <ChatInterface />
      </div>
    </div>
  );
}
