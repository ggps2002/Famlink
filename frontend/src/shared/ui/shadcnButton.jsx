/**
 * The shadcn/ui button (Origin UI flavour), on Radix Slot.
 *
 * Ported from the TSX source the same way `switch.jsx` and `tooltip.jsx` were:
 * JSX instead of TSX, `cn` from `@shared/lib/cn` rather than `@/lib/utils`,
 * Slot from the `radix-ui` umbrella package, and no `'use client'`.
 *
 * FILE NAME: not `button.jsx`. `Button.jsx` (CustomButton) already lives here,
 * and macOS's case-insensitive filesystem treats the two as one file.
 *
 * This is NOT the app's action button — that is still CustomButton. This one
 * exists for icon controls such as <MenuToggle>. Two tokens shadcn assumes
 * (`input`, `ring`) are not in this project's theme, so the outline variant's
 * border and every variant's focus outline are mapped to `line` and `ink`.
 * The remaining `*-foreground` / `destructive` / `secondary` tokens are also
 * absent; pass colours through `className` when using those variants.
 */
import * as React from "react";
import PropTypes from "prop-types";
import { Slot } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "@shared/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-black/5 hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm shadow-black/5 hover:bg-destructive/90",
        outline:
          "border border-line bg-background shadow-sm shadow-black/5 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm shadow-black/5 hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      // A bare <button> defaults to "submit"; match CustomButton instead.
      type={asChild ? type : type ?? "button"}
      {...props}
    />
  );
});

Button.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(["default", "destructive", "outline", "secondary", "ghost", "link"]),
  size: PropTypes.oneOf(["default", "sm", "lg", "icon"]),
  asChild: PropTypes.bool,
  type: PropTypes.string,
};

export { Button, buttonVariants };

export default Button;
