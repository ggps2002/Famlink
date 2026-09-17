/**
 * The shadcn/ui label, on Radix.
 *
 * Ported like `tooltip.jsx`: JSX rather than TSX, `cn` from `@shared/lib/cn`,
 * no `'use client'`. Upstream wraps the class string in `cva` purely to hang
 * `VariantProps` off it; with no variants and no TypeScript that indirection
 * buys nothing here, so the classes are inline.
 *
 * The face is set by family (`font-livvic-semibold`), never by `font-semibold`
 * — Livvic is loaded as four separate families with no weight axis, so a
 * weight utility renders faux bold instead of the real face.
 */
import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@shared/lib/cn";

const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn(
        "font-livvic-semibold text-sm leading-none text-ink",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
});

export { Label };
