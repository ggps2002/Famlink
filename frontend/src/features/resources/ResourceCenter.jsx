import React, { useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import Header from "@app/layout/Header";
import Footer from "@app/layout/Footer";
import FAQ from "@features/marketing/home/FAQ";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { resourceCenterMeta } from "@shared/seo/routeMeta";
import CostEstimation from "@features/nanny-share/landing/CostEstimation";
import Button from "@shared/ui/Button";
import { RESOURCES } from "@features/resources/resourcesData";
import LeadMagnetModal from "@features/resources/LeadMagnetModal";
import { Section, SectionHeading, CardGrid, Card } from "@shared/ui/Section";
import HeroBand from "@shared/ui/HeroBand";

const STEPS = [
  {
    n: "1",
    t: "Compare the costs",
    d: "Use the calculator to see what a share saves your family versus a solo nanny.",
  },
  {
    n: "2",
    t: "Match with a family",
    d: "Find a nearby family on a similar schedule so care lines up for everyone.",
  },
  {
    n: "3",
    t: "Put it in writing",
    d: "Use the agreement template and payroll guide to set it up cleanly from day one.",
  },
];

// Category 4.2 — The Nanny Share Resource Center. A public, top-of-funnel hub
// that captures high-intent "research phase" visitors with three lead magnets:
// an interactive cost calculator (rendered inline) plus two gated downloads that
// open the email-capture modal.
export default function ResourceCenter() {
  const [activeResource, setActiveResource] = useState(null);
  const calculatorRef = useRef(null);

  const handleCardCta = (resource) => {
    if (resource.type === "tool") {
      calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setActiveResource(resource);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <SEOMetaData {...resourceCenterMeta()} />

      <Header />

      <HeroBand
        eyebrow="Nanny Share Resource Center"
        eyebrowIcon={<Sparkles size={14} />}
        title="Everything you need to set up a nanny share"
        lede="Free calculators, templates, and guides — built with families who've done it. No fluff, no account required."
        actions={
          <Button
            btnText="Explore the resources"
            className="bg-accent text-ink hover:bg-accent-strong px-7 py-3.5 transition-colors"
            action={() =>
              document.getElementById("resources-grid")?.scrollIntoView({ behavior: "smooth" })
            }
          />
        }
      />

      <Section tone="canvas" id="resources-grid">
        <SectionHeading
          align="center"
          title="Free nanny share resources"
          lede="Whether you're comparing costs or drawing up an agreement, start here."
        />

        <CardGrid cols={3} className="max-w-5xl mx-auto">
          {RESOURCES.map((resource) => {
            const Icon = resource.icon;
            return (
              <Card key={resource.slug} interactive className="flex flex-col">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 shrink-0"
                  style={{ background: resource.accent.bg }}
                >
                  <Icon size={26} style={{ color: resource.accent.fg }} />
                </div>
                <p className="fl-eyebrow mb-1.5" style={{ color: resource.accent.fg }}>
                  {resource.eyebrow}
                </p>
                <h3 className="fl-h3 text-ink mb-2">{resource.title}</h3>
                <p className="fl-small flex-1">{resource.description}</p>
                <button
                  type="button"
                  onClick={() => handleCardCta(resource)}
                  className="mt-6 inline-flex items-center gap-1.5 font-livvic-bold text-ink hover:gap-2.5 transition-all self-start"
                >
                  {resource.cta} <ArrowRight size={18} />
                </button>
              </Card>
            );
          })}
        </CardGrid>
      </Section>

      {/* Embedded interactive calculator */}
      <Section
        tone="white"
        size="tight"
        ref={calculatorRef}
        id="calculator"
        className="scroll-mt-20"
      >
        <div className="bg-canvas rounded-3xl overflow-hidden">
          <CostEstimation />
        </div>
      </Section>

      <Section tone="white">
        <SectionHeading
          align="center"
          title="How a nanny share works"
          lede="Three steps from idea to first day."
        />
        <CardGrid cols={3} className="max-w-4xl mx-auto">
          {STEPS.map((step) => (
            <div key={step.n} className="bg-canvas rounded-2xl p-6">
              <div className="w-10 h-10 rounded-full bg-accent text-ink font-livvic-bold flex items-center justify-center mb-4">
                {step.n}
              </div>
              <h3 className="fl-h3 text-ink mb-2">{step.t}</h3>
              <p className="fl-small">{step.d}</p>
            </div>
          ))}
        </CardGrid>
        <div className="text-center mt-12">
          <a href="/find-nanny-share">
            <Button
              btnText="Find your nanny share match"
              size="lg"
              className="bg-blossom hover:bg-blossom-strong text-blossom-ink"
            />
          </a>
        </div>
      </Section>

      <FAQ />
      <Footer />

      {activeResource && (
        <LeadMagnetModal resource={activeResource} onClose={() => setActiveResource(null)} />
      )}
    </div>
  );
}
