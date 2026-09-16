import React from "react";
import Hero from "@features/marketing/caregivers/Hero";
import Community from "@features/marketing/home/Community";
import FAQ from "@features/marketing/home/FAQ";
import Feedback from "@features/feedback/components/FeedbackForm";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { jobSeekersMeta } from "@shared/seo/routeMeta";
import About from "@features/marketing/caregivers/About";
import HowItWorks from "@features/marketing/caregivers/HowItWorks";
import EarnEstimation from "@features/marketing/caregivers/EarnEstimator";
import WhyJoinFamLink from "@features/marketing/caregivers/WhyJoin";
import NannySharePreview from "@features/nanny-share/landing/NannySharePreview";
import { Section } from "@shared/ui/Section";
import HeroCurve from "@shared/ui/HeroCurve";

/* /jobSeekers — the caregivers landing page.
 *
 * Same contract as FamiliesHome: bands and rhythm here, content in the
 * children. The commented-out imports this file used to carry (JobPreview,
 * ServicesHomePage, Timeline, Testimonial) are dropped rather than kept as dead
 * JSX — git has them if marketing wants a section back.
 */
function Caregivers() {
  return (
    <>
      <SEOMetaData {...jobSeekersMeta()} />

      <Hero />

      {/* Curve transitions the white hero into the beige — see NannyShareLanding. */}
      <Section tone="canvas" className="relative">
        <HeroCurve position="top" />
        <NannySharePreview caregiver />
      </Section>

      <Section tone="white">
        <About />
      </Section>

      <Section tone="canvas">
        <HowItWorks />
      </Section>

      <Section tone="white">
        <WhyJoinFamLink />
      </Section>

      {/* The estimator is an inset white panel so the interactive surface reads
          as distinct from the beige band it sits on. */}
      <Section tone="canvas">
        <div className="fl-panel">
          <EarnEstimation />
        </div>
      </Section>

      <Section tone="mist">
        <Community />
      </Section>

      <FAQ caregiver />
      <Feedback />
    </>
  );
}

export default Caregivers;
