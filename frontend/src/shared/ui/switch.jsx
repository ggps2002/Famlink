/**
 * The shadcn/ui switch, on Radix.
 *
 * Ported from the TSX source the same way `tooltip.jsx` was: JSX instead of
 * TSX, `cn` from `@shared/lib/cn` rather than `@/lib/utils`, and no
 * `'use client'` (this is a Vite SPA, where Rollup only warns about it).
 *
 * COLOUR: checked is `bg-ink`, not `bg-accent`. The brand blue (#AEC4FF) sits
 * at roughly 1.5:1 against a white thumb, so an "on" switch read as an off one
 * — the thumb disappeared into the track. Navy carries the same brand weight
 * and leaves the thumb visible, which is the entire job of a switch.
 */
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@shared/lib/cn";

const Switch = React.forwardRef(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-ink data-[state=unchecked]:bg-[#D9DDE5]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export { Switch };
