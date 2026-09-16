import React from "react";
import { Clock, Users, MapPin, Calendar } from "lucide-react";
import FeatureCard from "@features/marketing/components/FeatureCard";
import { SectionHeading, CardGrid } from "@shared/ui/Section";

const features = [
  {
    icon: <Clock className="w-5 h-5 text-indigo-600" />,
    iconBg: "bg-indigo-50",
    title: "Earn More",
    description: "Nanny share caregivers typically earn 20–30% more than single-family positions.",
  },
  {
    icon: <Users className="w-5 h-5 text-orange-600" />,
    iconBg: "bg-orange-50",
    title: "One Job, Two Families",
    description: "Work with two families on a consistent schedule instead of juggling multiple jobs.",
  },
  {
    icon: <MapPin className="w-5 h-5 text-emerald-600" />,
    iconBg: "bg-emerald-50",
    title: "Real Matches Nearby",
    description: "Connect with families already looking for a nanny share in your area.",
  },
  {
    icon: <Calendar className="w-5 h-5 text-purple-600" />,
    iconBg: "bg-purple-50",
    title: "Consistent Work",
    description: "Many nanny shares are structured for long-term, reliable care with stable hours.",
  },
];

export default function WhyJoinFamLink() {
  return (
    <>
      <SectionHeading
        title="Why Join Famlink?"
        lede="We make it easier to earn more, find great families, and build long-term nanny share relationships."
      />

      <CardGrid cols={4}>
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </CardGrid>
    </>
  );
}
