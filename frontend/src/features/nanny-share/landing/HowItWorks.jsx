import React from "react";
import HowItWorks from "@features/marketing/components/HowItWorks";

/* The family-facing walkthrough on /. Sends families to the match form and
 * keeps the pink CTA; everything else is shared — see
 * marketing/components/HowItWorks.jsx. */
export default function FamilyHowItWorks() {
  return (
    <HowItWorks
      ctaTo="/find-nanny-share"
      ctaClassName="bg-blossom hover:bg-blossom-strong text-blossom-ink"
    />
  );
}
