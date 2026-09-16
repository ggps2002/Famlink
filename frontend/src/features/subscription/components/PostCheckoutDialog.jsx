import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  confirmCheckoutThunk,
  getSubscriptionStatusThunk,
} from "@features/subscription/store/cardSlice";
import { refreshTokenThunk } from "@features/auth/store/authSlice";
import { PLAN } from "@features/subscription/subscriptionPlan";

/* Post-checkout result dialog.
   After Stripe Checkout the user is sent back to /dashboard?status=success
   (or ?status=cancelled). This reads that param, shows the matching
   success / failure modal, refreshes the subscription status on success,
   and strips the param from the URL when dismissed. */
export default function PostCheckoutDialog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id");
  const dispatch = useDispatch();

  // "success" in the URL means Stripe redirected, nothing more. This used to be
  // read as proof of purchase, so the dialog congratulated people who were
  // still on the free tier — the upgrade button, "Free plan" in settings and
  // the missing badge were all telling the truth and the dialog was not.
  //
  //   confirming — asking the server, which asks Stripe
  //   upgraded   — Stripe says paid and the account now holds Plus
  //   pending    — paid, but the subscription is not active yet (rare)
  //   failed     — we could not confirm it; nothing is claimed
  const [outcome, setOutcome] = useState("confirming");

  useEffect(() => {
    if (status) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [status]);

  useEffect(() => {
    if (status !== "success") return;

    let cancelled = false;

    (async () => {
      // Settle the upgrade rather than wait on webhook delivery. Stripe's
      // redirect normally beats its own webhook, and on a laptop the webhook
      // never arrives at all, so without this the purchase silently does
      // nothing. The server re-reads the session from Stripe and refuses one
      // that is not the caller's, so the id in the URL grants nothing by itself.
      const result = sessionId
        ? await dispatch(confirmCheckoutThunk({ sessionId }))
        : null;

      // Re-read the account either way: the webhook may have landed first, in
      // which case `premium` is already true and the store is simply stale.
      await dispatch(refreshTokenThunk());
      dispatch(getSubscriptionStatusThunk());

      if (cancelled) return;

      if (!result) return setOutcome("pending");
      if (confirmCheckoutThunk.rejected.match(result)) return setOutcome("failed");
      setOutcome(result.payload?.premium ? "upgraded" : "pending");
    })();

    return () => {
      cancelled = true;
    };
  }, [status, sessionId, dispatch]);

  if (!status) return null;

  const success = status === "success" && outcome === "upgraded";
  const confirming = status === "success" && outcome === "confirming";
  const pending = status === "success" && (outcome === "pending" || outcome === "failed");

  const close = () => {
    document.body.style.overflow = "unset";
    const params = new URLSearchParams(searchParams);
    params.delete("status");
    setSearchParams(params, { replace: true });
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && close()}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0D134C]/25 backdrop-blur-sm"
    >
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm px-8 py-9 text-center animate-[popIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        {/* Close */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X size={16} className="text-gray-500" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              success ? "bg-[#4CAF50]" : pending || confirming ? "bg-[#AEC4FF]" : "bg-red-500"
            }`}
          >
            {confirming ? (
              <Loader2 className="text-[#0D134C] w-7 h-7 animate-spin" strokeWidth={3} />
            ) : success ? (
              <Check className="text-white w-7 h-7" strokeWidth={3} />
            ) : pending ? (
              <Check className="text-[#0D134C] w-7 h-7" strokeWidth={3} />
            ) : (
              <X className="text-white w-7 h-7" strokeWidth={3} />
            )}
          </div>
        </div>

        {/* Heading */}
        <h2 className="Livvic-Bold text-xl text-[#0D134C] mb-1.5">
          {confirming
            ? "Confirming your payment…"
            : success
              ? `You're now a ${PLAN.name} member!`
              : pending
                ? "Payment received"
                : "Payment not completed"}
        </h2>

        {/* Body. The "pending" wording is careful on purpose: the money has
            moved but the account is not upgraded yet, and promising Plus before
            it holds Plus is the thing that made this confusing to begin with. */}
        <p className="Livvic text-gray-500 text-sm mb-6">
          {confirming
            ? "One moment while we check with Stripe."
            : success
              ? `Congrats 🎉 You're successfully subscribed to ${PLAN.name}.`
              : pending
                ? `Thanks! We're still activating your ${PLAN.name} membership — it should appear within a minute. Refresh if it doesn't.`
                : "Your payment wasn't completed. You can try again anytime."}
        </p>

        <button
          type="button"
          onClick={close}
          disabled={confirming}
          className="w-full bg-[#AEC4FF] hover:bg-[#9db4f7] disabled:opacity-60 disabled:cursor-not-allowed text-[#0D134C] Livvic-Bold py-3 rounded-xl transition-colors"
        >
          {confirming ? "Please wait…" : success || pending ? "Continue" : "Close"}
        </button>
      </div>

      <style>{`@keyframes popIn { 0% { opacity:0; transform:scale(0.9) } 100% { opacity:1; transform:scale(1) } }`}</style>
    </div>
  );
}
