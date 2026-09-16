import React from "react";
import clsx from "classnames";
import { Section } from "@shared/ui/Section";

/* The navy top-of-funnel hero: pill eyebrow, centred display heading, lede, and
 * a row of CTAs.
 *
 * nanny-share/search/CityHero.jsx and the hero inside
 * resources/ResourceCenter.jsx were hand-maintained copies of each other.
 * CityHero even carried a comment saying they were "deliberately the same
 * design … so the two top-of-funnel page types read as one family" — but
 * nothing enforced it, so keeping them in step was down to whoever edited one
 * of them remembering the other existed. This is that enforcement.
 *
 * The Header is fixed, so `size="hero"` (fl-hero-y) is what keeps the eyebrow
 * clear of the nav — there is no spacer element.
 */
export default function HeroBand({
  eyebrow,
  /* A lucide icon element, e.g. <MapPin size={14} />. Optional. */
  eyebrowIcon,
  title,
  lede,
  /* CTA buttons. Wrap in a fragment; they're laid out here. */
  actions,
  className = "",
}) {
  return (
    <Section tone="ink" size="hero" className={clsx("text-center", className)}>
      {eyebrow && (
        <p className="fl-eyebrow inline-flex items-center gap-2 bg-white/10 text-accent px-4 py-1.5 rounded-full mb-6">
          {eyebrowIcon}
          {eyebrow}
        </p>
      )}

      <h1 className="fl-display text-white mx-auto max-w-heading">{title}</h1>

      {lede && (
        <p className="fl-lede text-white/60 mt-5 mx-auto max-w-prose">{lede}</p>
      )}

      {actions && (
        <div className="mt-8 flex flex-wrap gap-3 justify-center">{actions}</div>
      )}
    </Section>
  );
}
