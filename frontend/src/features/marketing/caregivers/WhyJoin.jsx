import React from "react";
import { DollarSign, Users, MapPin, Calendar } from "lucide-react";
import { SectionHeading } from "@shared/ui/Section";
import BentoGrid from "@features/marketing/components/BentoGrid";

/* "Why Join Famlink?" — the same bento grid as "Why Families Love Nanny
 * Sharing" on /, with the caregiver benefits. First and last tiles are wide so
 * the rows zig-zag. The grid's beige tiles need the white band this section
 * sits on in Caregivers.jsx.
 */
const features = [
  {
    icon: DollarSign,
    iconColor: "text-indigo-600",
    title: "Earn More",
    description: "Nanny share caregivers typically earn 20–30% more than single-family positions.",
    span: 2,
  },
  {
    icon: Users,
    iconColor: "text-orange-600",
    title: "One Job, Two Families",
    description: "Work with two families on a consistent schedule instead of juggling multiple jobs.",
  },
  {
    icon: MapPin,
    iconColor: "text-emerald-600",
    title: "Real Matches Nearby",
    description: "Connect with families already looking for a nanny share in your area.",
  },
  {
    icon: Calendar,
    iconColor: "text-purple-600",
    title: "Consistent Work",
    description: "Many nanny shares are structured for long-term, reliable care with stable hours.",
    span: 2,
  },
];

export default function WhyJoinFamLink() {
  return (
    <>
      <SectionHeading
        title="Why Join Famlink?"
        lede="We make it easier to earn more, find great families, and build long-term nanny share relationships."
      />

      <BentoGrid items={features} />
    </>
  );
}
