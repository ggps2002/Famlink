import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, Star, Loader2 } from "lucide-react";
import {
  getSubscriptionStatusThunk,
  cancelSubscriptionThunk,
  createCheckoutThunk,
} from "@features/subscription/store/cardSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { SwalFireDelete } from "@shared/ui/swalFire";
import { PLAN } from "@features/subscription/subscriptionPlan";
import { BTN_PRIMARY, BTN_SECONDARY } from "@shared/ui/buttonStyles";
import TermsNotice from "@features/legal/components/TermsNotice";

import CustomButton from "@shared/ui/Button";
/* Settings → Subscription. Shown to nannies and families alike: there is a
   single plan, so nothing here branches on the user's profile type. */
export default function SubscriptionSettings() {
  const dispatch = useDispatch();
  const subscription = useSelector((s) => s.cardData.subscriptionStatus);

  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setFetching(true);
      await dispatch(getSubscriptionStatusThunk());
      if (mounted) setFetching(false);
    })();
    return () => {
      mounted = false;
    };
  }, [dispatch]);

  const isActive = subscription?.active;
  const isCanceling = subscription?.cancelAtPeriodEnd;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd * 1000).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const handleUpgrade = async () => {
    setBusy(true);
    try {
      const { data, status } = await dispatch(
        createCheckoutThunk({ priceId: PLAN.priceId })
      ).unwrap();
      if (status === 200 && data?.url) {
        window.location.href = data.url;
      } else {
        fireToastMessage({
          message: "Sorry, we are unable to create checkout",
          type: "error",
        });
      }
    } catch (err) {
      console.error(err);
      fireToastMessage({
        message: "Sorry, we are unable to create checkout",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    SwalFireDelete({
      title: `Cancel your ${PLAN.name} subscription?`,
      handleDelete: async () => {
        setBusy(true);
        try {
          const result = await dispatch(cancelSubscriptionThunk());
          if (cancelSubscriptionThunk.fulfilled.match(result)) {
            fireToastMessage({
              message: "Subscription cancelled successfully",
              type: "success",
            });
            dispatch(getSubscriptionStatusThunk());
          } else {
            fireToastMessage({
              message: result.payload?.message || "Failed to cancel subscription",
              type: "error",
            });
          }
        } catch (err) {
          console.error(err);
          fireToastMessage({ message: "Something went wrong", type: "error" });
        } finally {
          setBusy(false);
        }
      },
    });
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="Livvic-Medium">Loading subscription…</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h2 className="Livvic-SemiBold text-2xl text-[#0D134C] mb-1">Subscription</h2>
      <p className="Livvic text-sm text-gray-400 mb-6">
        Manage your {PLAN.name} plan.
      </p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Plan header */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-[#EBF0FF] flex items-center justify-center shrink-0">
              <Star size={20} fill={isActive ? "#0D134C" : "none"} color="#0D134C" />
            </span>
            <div>
              <p className="Livvic-Bold text-[#0D134C] text-lg leading-tight">
                {isActive ? PLAN.name : "Free plan"}
              </p>
              <p className="Livvic text-sm text-gray-400">
                {isActive ? `$${PLAN.price}/month` : "No active subscription"}
              </p>
            </div>
          </div>
          <span
            className={`Livvic-SemiBold text-xs px-3 py-1 rounded-full ${
              isActive
                ? "bg-[#EAF5ED] text-[#2E7D32]"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isActive ? (isCanceling ? "Cancelling" : "Active") : "Inactive"}
          </span>
        </div>

        {/* Feature list */}
        <div className="space-y-2.5 mb-6">
          {PLAN.features.map((f) => (
            <div key={f} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-[#D6FB9A] flex items-center justify-center shrink-0">
                <Check size={12} className="text-[#025747]" strokeWidth={3} />
              </span>
              <span className="Livvic-Medium text-sm text-[#0D134C]">{f}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {isActive ? (
          isCanceling ? (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="Livvic-SemiBold text-sm text-red-600">
                Scheduled to cancel on {periodEnd}
              </p>
              <p className="Livvic text-xs text-red-500 mt-0.5">
                You'll keep {PLAN.name} access until this date.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {periodEnd && (
                <p className="Livvic text-sm text-gray-400">
                  Renews on <span className="text-[#0D134C] Livvic-SemiBold">{periodEnd}</span>
                </p>
              )}
              <CustomButton
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className={`text-sm ${BTN_SECONDARY}`}
              >
                {busy ? "Please wait…" : "Cancel Subscription"}
              </CustomButton>
            </div>
          )
        ) : (
          <CustomButton
            type="button"
            onClick={handleUpgrade}
            disabled={busy}
            className={`w-full ${BTN_PRIMARY}`}
          >
            {busy ? "Redirecting…" : `Upgrade to ${PLAN.name}`}
          </CustomButton>
        )}
      </div>

      {/* Sits outside the card so it reads as a standing notice for the whole
          section, not a caption on whichever action is currently rendered. */}
      <TermsNotice action="subscribing" className="mt-4" />
    </div>
  );
}
