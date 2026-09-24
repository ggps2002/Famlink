import React from "react";
import Hero from "@features/nanny-share/landing/Hero";
import NannySharePreview from "@features/nanny-share/landing/NannySharePreview";
import About from "@features/nanny-share/landing/About";
import HowItWorks from "@features/nanny-share/landing/HowItWorks";
import Features from "@features/nanny-share/landing/Features";
import CostEstimation from "@features/nanny-share/landing/CostEstimation";
import Community from "@features/marketing/home/Community";
import FAQ from "@features/marketing/home/FAQ";
import Feedback from "@features/feedback/components/FeedbackForm";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { homeMeta } from "@shared/seo/routeMeta";
import { Section } from "@shared/ui/Section";
import HeroCurve from "@shared/ui/HeroCurve";

/* / — the nanny-share landing page, the site's front door.
 *
 * Bands and rhythm here, content in the children. The nest of unstyled wrapper
 * divs this file used to have (`<div className=""><div className="rounded-2xl">
 * <div className="pt-12">`) is gone — that was where the one-off pt-12 lived
 * that made About sit closer to HowItWorks here than on any other page.
 */
function NannyShare() {
  return (
    <>
      <SEOMetaData {...homeMeta()} />

      <Hero />

      {/* The hero sits on white, so this band brings the scoop that transitions
          into the beige. The curve used to live inside NannySharePreview. */}
      <Section tone="canvas" className="relative">
        <HeroCurve position="top" />
        <NannySharePreview />
      </Section>

      {/* Bands alternate white/beige down the page so adjacent sections read as
          separate. Two whites in a row merge into one long undifferentiated
          stretch, which is what this page had. */}
      <Section tone="white">
        <About />
      </Section>

      <Section tone="canvas">
        <HowItWorks />
      </Section>

      <Section tone="white">
        <Features />
      </Section>

      {/* Inset white panel on the beige band, matching the estimator on
          /jobSeekers and the calculator on /nanny-share-resources. */}
      <Section tone="canvas" size="tight">
        <div className="fl-panel">
          <CostEstimation />
        </div>
      </Section>

      <Section className="bg-[#DDF9FD]">
        <Community />
      </Section>

      <FAQ />
      <Feedback />
    </>
  );
}

export default NannyShare;
