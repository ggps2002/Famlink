import React from "react";
import { DollarSign, Heart, Smile, Calendar } from "lucide-react";
import clsx from "classnames";
import { SectionHeading } from "@shared/ui/Section";

/* "Why families love nanny sharing" — a bento grid rather than a 4-up card row.
 *
 * The four benefits are peers, so they share one type treatment; the grid
 * geometry is what gives the section its rhythm. Rows alternate wide/narrow so
 * the eye zig-zags down instead of scanning four identical boxes.
 *
 *   lg (3 cols)          sm (2 cols)      base
 *   ┌───────────┬─────┐  ┌─────┬─────┐    ┌─────┐
 *   │  costs    │ care│  │costs│ care│    │ …×4 │
 *   ├─────┬─────┴─────┤  ├─────┼─────┤    └─────┘
 *   │ play│ schedule  │  │ play│sched│
 *   └─────┴───────────┘  └─────┴─────┘
 *
 * `span: 2` is the wide tile. It only spans at lg — at sm every tile is one
 * column wide, which is what keeps the squares square at every step.
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

/* Tiles sit on the beige `canvas`, which is the section's white band inverted —
 * the same relationship the inset `fl-panel` has on a beige band. The icon chip
 * is white rather than the tinted `bg-*-50` the FeatureCard row uses: a 50-step
 * tint is invisible against #F6F3EE, so the hue moves to the glyph.
 */
function BentoTile({ icon: Icon, iconColor, title, description, span }) {
  return (
    <div
      className={clsx(
        "bg-canvas rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6",
        /* A min-height rather than `aspect-square`: at lg the column is ~530px,
           so a square tile is 530px tall and these four short benefits sit in a
           sea of empty beige. Grid rows stretch, so the tiles in a row still
           match each other — the wide/narrow rhythm survives, the dead space
           doesn't. Mobile stays content-height; nothing to fill there. */
        "sm:min-h-[15rem] lg:min-h-[17rem]",
        span === 2 && "lg:col-span-2"
      )}
    >
      <span className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
        <Icon className={clsx("w-5 h-5", iconColor)} aria-hidden="true" />
      </span>

      <div>
        <h3 className="fl-h3 text-ink">{title}</h3>
        {/* Capped so the description wraps at a readable measure on the wide
            tiles instead of running the full two columns. */}
        <p className="fl-small mt-2 max-w-sm">{description}</p>
      </div>
    </div>
  );
}

function Features() {
  return (
    <>
      <SectionHeading
        title="Why Families Love Nanny Sharing"
        lede="One nanny, two families, half the cost — with care that stays personal."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <BentoTile key={feature.title} {...feature} />
        ))}
      </div>
    </>
  );
}

export default Features;
