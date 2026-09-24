import React from "react";
import { DollarSign, Heart, Smile, Calendar } from "lucide-react";
import { SectionHeading } from "@shared/ui/Section";
import BentoGrid from "@features/marketing/components/BentoGrid";

/* "Why families love nanny sharing" — a bento grid rather than a 4-up card
 * row. Layout and tile styling live in BentoGrid, shared with /jobSeekers.
 */
const features = [
  {
    icon: DollarSign,
    iconColor: "text-indigo-600",
    title: "Lower Your Childcare Costs",
    description: "Share a nanny and split the cost — without sacrificing quality.",
    span: 2,
  },
  {
    icon: Heart,
    iconColor: "text-pink-600",
    title: "More Personalized Care",
    description: "Smaller group setting means your child gets more attention.",
  },
  {
    icon: Smile,
    iconColor: "text-emerald-600",
    title: "Built-In Playmate",
    description: "Your child gets social interaction in a calm, home-based environment.",
  },
  {
    icon: Calendar,
    iconColor: "text-amber-600",
    title: "Flexible for Your Schedule",
    description: "Coordinate care in a way that works for both families.",
    span: 2,
  },
];

function Features() {
  return (
    <>
      <SectionHeading
        title="Why Families Love Nanny Sharing"
        lede="One nanny, two families, half the cost — with care that stays personal."
      />

      <BentoGrid items={features} />
    </>
  );
}

export default Features;
