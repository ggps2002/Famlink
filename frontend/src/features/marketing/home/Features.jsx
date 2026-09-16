import React from "react";
import { SectionHeading, CardGrid, Card } from "@shared/ui/Section";

/* The three hiring tools. Was three copy-pasted divs each pinned to a fixed
 * `w-[25rem]` (400px) in a flex-wrap — which overflowed phones narrower than
 * 400px and left a ragged third column on desktop. Now data + a grid.
 */
const features = [
  {
    icon: "/coins-hand.svg",
    title: "Payroll Management",
    description: "Easily manage payments and stay tax-compliant",
  },
  {
    icon: "/shield-tick.svg",
    title: "Background Checks",
    description: "Ensure your caregivers meet safety and trust standards",
  },
  {
    icon: "/certificate-01.svg",
    title: "Job Contract Templates",
    description: "Create clear expectations with customizable contracts",
  },
];

function Features() {
  return (
    <>
      <SectionHeading
        title="Take the Stress Out of Hiring"
        lede="Hiring someone for your home is a big decision. We provide the tools to help you do it right."
      />

      <CardGrid cols={3}>
        {features.map((feature) => (
          <Card key={feature.title}>
            <img src={feature.icon} alt="" aria-hidden="true" className="w-10 h-10" />
            <h3 className="fl-h3 text-ink mt-4">{feature.title}</h3>
            <p className="fl-small mt-2">{feature.description}</p>
          </Card>
        ))}
      </CardGrid>
    </>
  );
}

export default Features;
