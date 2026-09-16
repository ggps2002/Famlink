import { useEffect, useState } from "react";
import { Star, Check, X, ConciergeBell, Sparkles, ArrowRight } from "lucide-react";
import { useDispatch } from "react-redux";
import { createCheckoutThunk } from "@features/subscription/store/cardSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { PLAN } from "@features/subscription/subscriptionPlan";
import { Link } from "react-router-dom";

/* Subscription upgrade modal ("FamLink Plus").
   Opens from the navbar "Upgrade" button. The CTA runs the same Stripe
   Checkout flow as the pricing page (createCheckoutThunk → redirect).
   Nannies and families see the same plan and buy the same Stripe price. */
export default function SubscriptionModal({ onClose }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  // Lock body scroll + close on Escape while mounted.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleUpgrade = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#0D134C]/25 backdrop-blur-sm"
    >
      <div className="hide-scrollbar relative bg-white rounded-3xl shadow-2xl w-full max-w-[540px] max-h-[90vh] overflow-y-auto px-8 py-9 animate-[popIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X size={16} className="text-gray-500" />
        </button>

        {/* Badge */}
        <span className="inline-flex items-center gap-1.5 bg-[#D6FB9A] text-[#025747] rounded-full px-3 py-1 mb-5 Livvic-Bold text-xs tracking-wide uppercase">
          <Star size={12} fill="#025747" strokeWidth={0} />
          {PLAN.name}
        </span>

        {/* Heading */}
        <h2 className="Livvic-Bold text-2xl text-[#0D134C] mb-1.5">
          Upgrade to {PLAN.name}
        </h2>
        <p className="Livvic text-gray-500 text-sm mb-6">{PLAN.tagline}</p>

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-6">
          <span className="Livvic-Bold text-5xl text-[#0D134C]">
            ${PLAN.price}
          </span>
          <span className="Livvic-Medium text-gray-500 text-base">/month</span>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-7">
          {PLAN.features.map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#D6FB9A] flex items-center justify-center shrink-0">
                <Check size={14} className="text-[#025747]" strokeWidth={3} />
              </span>
              <span className="Livvic-Bold text-[#0D134C] text-[15px]">
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full bg-[#AEC4FF] hover:bg-[#9db4f7] disabled:opacity-60 disabled:cursor-not-allowed text-[#0D134C] Livvic-Bold py-3 rounded-xl transition-colors"
        >
          {loading ? "Redirecting…" : `Upgrade to ${PLAN.name}`}
        </button>

        {/* OR Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="h-[2px] bg-gray-200 flex-1 rounded-full"></div>
          <span className="text-gray-400 text-sm Livvic">or</span>
          <div className="h-[2px] bg-gray-200 flex-1 rounded-full"></div>
        </div>

        {/* Concierge Section */}
        <div className="bg-[#FFF9F0] border border-[#FFE8C2] rounded-2xl p-5 flex items-start gap-4">
          <div className="bg-[#FFE4CC] rounded-full p-2.5 shrink-0 flex items-center justify-center">
            <ConciergeBell className="w-6 h-6 text-[#1A255B]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="Livvic-Bold text-[#0D134C] text-[16px] mb-1 flex items-center gap-1.5">
              Don’t have time to search? <Sparkles className="w-4 h-4 text-[#F9A826]" />
            </h3>
            <p className="Livvic text-gray-600 text-[13px] leading-relaxed mb-3">
              Let our team personally search for compatible families and coordinate introductions on your behalf.
            </p>
            <Link to="/concierge" className="Livvic-Bold text-[#9db4f7] text-sm flex items-center gap-1.5 hover:underline" onClick={onClose}>
              Learn about FamLink Concierge <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center Livvic text-xs text-gray-400 mt-4 pt-3">
          By upgrading, you authorize recurring monthly charges until you cancel.
          <br />
          <Link
            to="/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="Livvic-SemiBold underline hover:text-[#001243] transition-colors"
          >
            Terms & Conditions
          </Link>
          {" "}and{" "}
          <a
            href="#"
            className="Livvic-SemiBold underline hover:text-[#001243] transition-colors"
            onClick={(e) => e.preventDefault()}
          >
            Privacy Policy
          </a>
        </p>
      </div>

      <style>{`@keyframes popIn { 0% { opacity:0; transform:scale(0.9) } 100% { opacity:1; transform:scale(1) } }`}</style>
    </div>
  );
}
