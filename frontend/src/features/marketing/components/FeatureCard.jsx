import React from "react";
import clsx from "classnames";
import { Card } from "@shared/ui/Section";

/* Icon + title + description card.
 *
 * This exact component was defined twice — once inside
 * marketing/caregivers/WhyJoin.jsx and once inside
 * nanny-share/landing/Features.jsx (there under the misleading name
 * `ServicesCard`, which collided with the unrelated image tile in
 * marketing/components/ServicesCard.jsx). One definition now.
 *
 * `iconBg` is a Tailwind background class for the icon chip; the icon element
 * itself carries its own colour. The multi-hue set is deliberate — each card in
 * a row gets a different accent.
 */
export default function FeatureCard({ title, description, icon, iconBg = "bg-accent-soft" }) {
  return (
    <Card className="border border-gray-100 flex flex-col items-start text-left h-full">
      <div
        className={clsx(
          "w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0",
          iconBg
        )}
      >
        {icon}
      </div>
      <h3 className="fl-h4 text-ink mb-2">{title}</h3>
      <p className="fl-small">{description}</p>
    </Card>
  );
}
