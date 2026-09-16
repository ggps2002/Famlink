/**
 * The shadcn/ui tooltip, on Radix.
 *
 * Ported from the TSX source with three changes, all forced by this codebase:
 *
 *   1. JSX, not TSX — the app has no TypeScript, so the prop types and
 *      `VariantProps` are gone. The runtime behaviour is identical.
 *   2. `cn` comes from `@shared/lib/cn`; there is no `src/lib/utils` here.
 *   3. The content is rendered through a Portal. Every card this is used on
 *      (`profileCard.jsx`, `SharedProfileCard.jsx`) is `rounded-3xl
 *      overflow-hidden`, and an in-place tooltip is clipped by that to a
 *      sliver. Upstream shadcn portals for the same reason.
 *
 * The `'use client'` directive from the source is dropped: this is a Vite SPA,
 * where it does nothing and Rollup warns about it on every build.
 */
import * as React from "react";
import { cva } from "class-variance-authority";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@shared/lib/cn";

function TooltipProvider({ delayDuration = 0, ...props }) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

const tooltipVariants = cva(
  "z-50 overflow-hidden rounded-md px-3 py-1.5 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        light: "border border-border bg-background text-foreground shadow-md shadow-black/5",
        dark: "dark:border dark:border-border bg-zinc-950 text-white dark:bg-zinc-300 dark:text-black shadow-md shadow-black/5",
      },
    },
    defaultVariants: {
      variant: "dark",
    },
  },
);

function TooltipContent({ className, sideOffset = 4, variant, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(tooltipVariants({ variant }), className)}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, tooltipVariants };
