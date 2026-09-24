import React from "react";
import Hero from "@features/marketing/home/Hero";
import Services from "@features/marketing/home/Services";
import CaregiverPreview from "@features/marketing/home/CaregiverPreview";
import Metrics from "@features/marketing/home/Metrics";
import NannyShare from "@features/marketing/home/NannyShare";
import Community from "@features/marketing/home/Community";
import Features from "@features/marketing/home/Features";
import FAQ from "@features/marketing/home/FAQ";
import Feedback from "@features/feedback/components/FeedbackForm";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { familiesMeta } from "@shared/seo/routeMeta";
import { Section } from "@shared/ui/Section";
import HeroCurve from "@shared/ui/HeroCurve";

/* /families — the families landing page.
 *
 * The page owns the background bands and the vertical rhythm; each section
 * component owns only its content. That split is what keeps spacing consistent
 * across the marketing pages — previously both the wrapper here AND the child
 * component applied their own py-*, so sections were double-padded by varying
 * amounts. Don't add padding here; pick a <Section size>.
 */
function NewHome() {
  return (
    <>
      <SEOMetaData {...familiesMeta()} />

      {/* Hero band. No z-index on the wrapper — see the note in HeroCurve. */}
      <div className="relative bg-[url('/Hero.webp')] bg-cover bg-center">
        <div className="absolute inset-0 bg-ink/60 z-0" />
        <div className="relative z-10">
          <Hero />
        </div>
        <HeroCurve />
      </div>

      <Section tone="canvas">
        <Services />
      </Section>

      <Section tone="white">
        <CaregiverPreview />
      </Section>

      <Section tone="canvas">
        <Metrics />
      </Section>

      <Section tone="white">
        <NannyShare />
      </Section>

      <Section className="bg-[#DDF9FD]">
        <Community />
      </Section>

      <Section tone="white">
        <Features />
      </Section>

      <FAQ />
      <Feedback />
    </>
  );
}

export default NewHome;
