import React from "react";
import { Card } from "@shared/ui/Section";

/* Quote card. The fixed `w-[24rem]` and the `h-[250px]` quote box are gone:
 * width now comes from the grid that holds it, and the card flexes so a long
 * quote grows the card instead of spilling out of a 250px box. `items-stretch`
 * on the parent keeps a row of them level.
 */
function TestimonialCard({ para, name, highlight }) {
  return (
    <Card className="flex flex-col h-full">
      <img src="/quote.svg" alt="" aria-hidden="true" className="w-8 h-8" />

      <blockquote className="fl-body text-ink mt-5 flex-1">{para}</blockquote>

      <p className="font-livvic-bold text-ink text-base sm:text-lg mt-5">— {name}</p>

      {highlight && (
        <div className="mt-6 flex items-start gap-3 border-t border-line pt-4">
          <img src="/info-circle.svg" alt="" aria-hidden="true" className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="font-livvic-semibold text-[#6EA400] text-sm leading-relaxed">
            {highlight}
          </p>
        </div>
      )}
    </Card>
  );
}

export default TestimonialCard;
