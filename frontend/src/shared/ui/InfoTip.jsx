import * as React from "react";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@shared/ui/tooltip";

/**
 * The ⓘ that sits beside a number whose label doesn't fully explain it.
 *
 * Rates are why this exists. "Shared rate" and "On their own" are two different
 * amounts for the same caregiver, and nothing on the page told a reader which
 * one they would actually be paying — so the smaller number read as a discount
 * and the larger one as the real price.
 *
 * Always the light variant: these sit on white cards, and the dark tooltip
 * reads as an error state next to them.
 */
export default function InfoTip({ text, size = 14, className = "" }) {
  // Radix opens on hover and on keyboard focus. Neither exists on a phone, and
  // these live on the browse cards, which are mostly read on a phone — so a tap
  // opens it too.
  //
  // `wasOpen` is read at pointerdown because Radix's own trigger closes the
  // tooltip on pointerdown: by the time the click handler runs, `open` is
  // already false and a plain toggle could never close it again.
  const [open, setOpen] = React.useState(false);
  const wasOpen = React.useRef(false);

  // Hooks first — this component is rendered in lists where `text` comes and
  // goes with the data, and an early return above them changes the hook count.
  if (!text) return null;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          onPointerDown={() => {
            wasOpen.current = open;
          }}
          onClick={(event) => {
            // These buttons sit inside cards that navigate on click. Asking what
            // a rate means should not open somebody's profile.
            event.stopPropagation();
            event.preventDefault();
            setOpen(!wasOpen.current);
          }}
          className={`inline-flex items-center justify-center align-middle bg-transparent border-none p-0 cursor-pointer text-[#9CA3AF] hover:text-[#6B7280] transition-colors ${className}`}
        >
          <Info size={size} strokeWidth={2} />
        </button>
      </TooltipTrigger>
      {/* shadcn's own radius is `rounded-md` (6px), which reads sharp beside
          this site's boxes — the profile cards are 20px, the stat tiles 10px
          and every chip is fully round. Overridden here rather than in
          tooltip.jsx so that file stays a faithful copy of the component;
          twMerge drops the losing radius, which is what `cn` is there for. */}
      <TooltipContent
        variant="light"
        className="max-w-[260px] whitespace-normal leading-snug rounded-xl"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
