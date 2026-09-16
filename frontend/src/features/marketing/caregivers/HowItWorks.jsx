import React from "react";
import HowItWorks from "@features/marketing/components/HowItWorks";

/* The caregiver-facing walkthrough on /jobSeekers. Everything but the CTA
 * destination is shared — see marketing/components/HowItWorks.jsx. */
export default function CaregiverHowItWorks() {
  return <HowItWorks ctaTo="/caregiver/nannyshare" />;
}
