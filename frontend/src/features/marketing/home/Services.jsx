import React from "react";
import ServicesCard from "@features/marketing/components/ServicesCard";
import { SectionHeading, CardGrid } from "@shared/ui/Section";

const services = [
  {
    icon: "/icons/Services/Nanny4.svg",
    title: "Nanny",
    description:
      "Experienced full-time, part-time, or live-in care tailored to your schedule.",
  },
  {
    icon: "/icons/Services/Babysitter.svg",
    title: "Babysitter",
    description: "Reliable care for evenings, weekends, or last-minute help.",
  },
  {
    icon: "/icons/Services/PrivateEducator.svg",
    title: "Private Educator",
    description:
      "One-on-one academic support at home from qualified tutors and educators.",
  },
  {
    icon: "/icons/Services/SpecializedCaregiver.svg",
    title: "Specialized Caregiver",
    description:
      "Doulas, night nurses, or caregivers trained for specific family needs.",
  },
  {
    icon: "/icons/Services/SportCoach.svg",
    title: "Sports Coaches",
    description:
      "Skill-building and athletic development for all ages and experience levels.",
  },
  {
    icon: "/icons/Services/MusicInstructor.svg",
    title: "Music Instructors",
    description:
      "Learn piano, guitar, or other instruments with flexible home or virtual lessons.",
  },
  {
    icon: "/icons/Services/SwimInstructor.svg",
    title: "Swim Instructors",
    description:
      "Safety-focused swimming lessons with certified professionals.",
  },
  {
    icon: "/icons/Services/HouseManager.svg",
    title: "House Managers",
    description:
      "Trusted help with organization, schedules, and household tasks.",
  },
];

/* Renders inside a <Section> — the page supplies the band and the padding.
 * This was an <h1> despite the page's real h1 living in the hero above it. */
function Services() {
  return (
    <>
      <SectionHeading
        title="Care Options That Fit Your Life"
        lede="Every family has different needs. We help you find care that actually fits yours."
      />

      <CardGrid cols={4}>
        {services.map((service) => (
          <ServicesCard
            key={service.title}
            title={service.title}
            description={service.description}
            icon={service.icon}
          />
        ))}
      </CardGrid>
    </>
  );
}

export default Services;
