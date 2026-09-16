// The one and only FamLink subscription plan.
//
// Every user gets the same plan, whatever their profile type: there is no
// separate Nanny / Family tier and no per-role Stripe price. The upgrade modal
// (SubscriptionModal.jsx), the settings page (SubscriptionSettings.jsx), the
// pricing page (Price/pricing.jsx) and the card form (subComponents/Billings.jsx)
// all read the name, price, features and priceId from here, so a change here is
// a change everywhere. Do not reintroduce a `nanny ? … : …` branch around any
// of these values.

export const PLAN = {
  name: "FamLink Plus",
  price: 35,
  tagline: "Keep matching until you find the right nanny share.",
  features: [
    "Unlock Unlimited matching",
    "Keep matching until you find the right Share",
    "Cancel anytime",
  ],
  // Single Stripe price, shared by nannies and families.
  priceId: import.meta.env.VITE_STRIPE_PLUS_PRICE_ID,
};

export const FREE_PLAN = {
  name: "Free",
  price: 0,
  features: [
    "Create a profile and get discovered",
    "Browse nannies and families near you",
    "One free match request",
    "Receive and reply to messages",
    "Join the FamLink Community",
  ],
};
