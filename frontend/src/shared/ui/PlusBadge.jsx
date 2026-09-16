import { Star } from "lucide-react";
import { PLAN } from "@features/subscription/subscriptionPlan";

/**
 * The "Plus" mark shown beside a subscribed member's name.
 *
 * Deliberately a component rather than a snippet of JSX copied to each site.
 * It appears next to a name in several places — the dashboard's own-profile
 * card, the avatar menu — and a badge that is navy in one and lavender in
 * another reads as two different statuses rather than one.
 *
 * Renders nothing unless `active`, so callers can hand it whatever subscription
 * flag they already hold instead of wrapping every use in a conditional.
 *
 * The label comes from PLAN.name ("FamLink Plus") with the product prefix
 * dropped: beside a name there is no doubt about whose product it is, and the
 * full string crowds out the name it is meant to annotate.
 */
export default function PlusBadge({
  active,
  size = "sm",
  tone = "default",
  className = "",
}) {
  if (!active) return null;

  const label = PLAN.name.replace(/^FamLink\s+/i, "");

  // Two sizes because the two homes differ: the profile card sits it beside a
  // 17px heading, the avatar menu beside a larger one.
  const sizing =
    size === "md"
      ? { box: "px-2 py-[3px] text-[11px] gap-1", icon: 11 }
      : { box: "px-1.5 py-[2px] text-[10px] gap-[3px]", icon: 9 };

  // The navy pill disappears against the dark panel the expanded avatar menu
  // draws, so that one inverts to the lime fill instead. Same two brand colours
  // either way — it stays recognisably one badge rather than becoming a
  // different-looking status in the one place it happens to sit on dark.
  const onDark = tone === "onDark";
  const palette = onDark ? "bg-[#D6FB9A] text-[#0D134C]" : "bg-[#0D134C] text-[#D6FB9A]";
  const star = onDark ? "#0D134C" : "#D6FB9A";

  return (
    <span
      // `title` rather than an aria-label: this annotates the name next to it
      // rather than standing on its own, and the text is already readable.
      title={`${PLAN.name} member`}
      className={`inline-flex items-center rounded-full Livvic-Bold leading-none flex-shrink-0 ${palette} ${sizing.box} ${className}`}
    >
      <Star size={sizing.icon} fill={star} strokeWidth={0} />
      {label}
    </span>
  );
}
