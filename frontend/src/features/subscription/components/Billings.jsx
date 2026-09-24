import { useEffect, useState } from "react";
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import { useDispatch, useSelector } from "react-redux";
import {
  saveCardThunk,
  createSubscriptionThunk,
  cancelSubscriptionThunk,
  getSubscriptionStatusThunk,
} from "@features/subscription/store/cardSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { CreditCardIcon } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import { PLAN } from "@features/subscription/subscriptionPlan";

const BillingMethod = () => {
  const dispatch = useDispatch();
  const stripe = useStripe();
  const elements = useElements();

  const [billingMethod, setBillingMethod] = useState("card");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("United States of America");
  const [isLoading, setIsLoading] = useState(false);

  const subscription = useSelector(
    (state) => state.cardData.subscriptionStatus
  );
  const isActive = subscription?.active;
  const isCanceling = subscription?.cancelAtPeriodEnd;
  const periodEnd = subscription?.periodEnd;

  useEffect(() => {
    dispatch(getSubscriptionStatusThunk());
  }, [dispatch]);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setIsLoading(true);
    try {
      const card = elements.getElement(CardNumberElement);
      const expiry = elements.getElement(CardExpiryElement);
      const cvc = elements.getElement(CardCvcElement);

      if (!card || !expiry || !cvc) {
        fireToastMessage({ message: "Card fields missing", type: "error" });
        return;
      }

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card,
        billing_details: {
          address: {
            postal_code: zip,
            country,
          },
        },
      });

      if (error) {
        fireToastMessage({
          message: error.message || "Stripe error",
          type: "error",
        });
        return;
      }

      const saveResult = await dispatch(saveCardThunk(paymentMethod));
      if (saveCardThunk.fulfilled.match(saveResult)) {
        const createResult = await dispatch(
          createSubscriptionThunk({
            paymentMethodId: paymentMethod.id,
            priceId: PLAN.priceId,
          })
        );

        if (createSubscriptionThunk.fulfilled.match(createResult)) {
          fireToastMessage({
            message: "Subscription active!",
            type: "success",
          });
        }
      }
    } catch (err) {
      console.error(err);
      fireToastMessage({ message: "Payment failed", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async () => {
    setIsLoading(true);
    try {
      const result = await dispatch(cancelSubscriptionThunk());
      if (cancelSubscriptionThunk.fulfilled.match(result)) {
        fireToastMessage({
          message: "Subscription cancelled",
          type: "success",
        });
      } else {
        fireToastMessage({ message: "Failed to cancel", type: "error" });
      }
    } catch (err) {
      fireToastMessage({ message: "Something went wrong", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg Livvic-SemiBold mb-4">Add a billing method</h2>

      {/* CARD / PAYPAL SWITCH */}
      <div className="space-y-4 onboarding-box w-full xl:w-1/2 mt-6 flex flex-col">
        {/* Credit Card Option */}
        <div className="flex items-center justify-between space-x-2">
          <label
            htmlFor="card"
            className="Livvic-SemiBold text-md text-primary flex gap-2"
          >
            <CreditCardIcon /> Credit or Debit card
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              id="card"
              name="billing"
              checked={billingMethod === "card"}
              onChange={() => setBillingMethod("card")}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded-full border-4 transition-colors duration-200 ${
                billingMethod === "card"
                  ? "border-[#AEC4FF]"
                  : "border-[#EEEEEE]"
              }`}
            />
          </label>
        </div>

        {billingMethod === "card" && (
          <div className="mt-2 w-full">
            {/* Card Fields */}
            <div className="rounded-[12px] border border-[#EEEEEE]">
              <div className="space-y-2 border-b border-[#EEEEEE] p-2">
                <CardNumberElement
                  options={{
                    placeholder: "Card number",
                    style: {
                      base: {
                        fontSize: "16px",
                        color: "#32325d",
                        "::placeholder": {
                          color: "#555555",
                        },
                      },
                    },
                  }}
                  className="p-3"
                />
              </div>

              <div className="flex">
                <div className="w-1/2 border-r border-r-[#EEEEEE] p-3">
                  <CardExpiryElement className="p-2" />
                </div>
                <div className="w-1/2 p-3">
                  <CardCvcElement className="p-2" />
                </div>
              </div>
            </div>
            {/* ZIP + Country */}
            <div className="space-y-4 flex flex-col mt-4">
              <input
                type="text"
                placeholder="Zip code"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="fl-field w-full"
              />
              <div className="w-full">
                <label htmlFor="billing-country" className="fl-label">Country/Region</label>
                <select
                  id="billing-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="fl-field w-full"
                >
                  <option value="usa">United States of America</option>
                  <option value="canada">Australia</option>
                  <option value="uk">United Kingdom</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* PayPal Option */}
        {/* <div className="flex items-center justify-between space-x-2">
          <label
            htmlFor="paypal"
            className="Livvic-SemiBold text-md text-primary flex items-center gap-2"
          >
            <img src="/paypal-logo.svg" alt="logo" className="w-6 h-6" /> PayPal
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              id="paypal"
              name="billing"
              checked={billingMethod === "paypal"}
              onChange={() => setBillingMethod("paypal")}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded-full border-4 transition-colors duration-200 ${
                billingMethod === "paypal"
                  ? "border-[#AEC4FF]"
                  : "border-[#EEEEEE]"
              }`}
            />
          </label>
        </div> */}

        {/* Billing Status */}
        {isActive && (
          <p className="mt-4 text-sm text-green-600 Livvic-Medium">
            Subscription active
            {isCanceling && periodEnd && (
              <>
                {" "}
                — set to cancel on{" "}
                <strong>
                  {new Date(periodEnd * 1000).toLocaleDateString()}
                </strong>
              </>
            )}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          {/* Cancel Button */}
          {isActive && !isCanceling && (
            <CustomButton
              action={() => cancelSubscription()}
              disabled={isLoading}
              btnText={isLoading ? "Cancelling..." : "Cancel Subscription"}
              className="text-[#555555] border border-[#EEEEEE]"
            />
          )}
          {/* Submit Button */}
          {!isActive && !isCanceling && (
            <CustomButton
              action={billingMethod === "card" ? handleSubmit : undefined}
              disabled={isLoading}
              btnText={
                isLoading
                  ? "Processing..."
                  : billingMethod === "paypal"
                  ? "Continue with PayPal"
                  : "Confirm Payment"
              }
              className="bg-[#AEC4FF]"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingMethod;
