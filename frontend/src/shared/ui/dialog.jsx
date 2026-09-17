/**
 * The shadcn/ui dialog, on Radix.
 *
 * Ported from the TSX source with the same three changes `tooltip.jsx` needed:
 * JSX rather than TSX, `cn` from `@shared/lib/cn`, and no `'use client'`.
 *
 * Two further deviations from upstream, both deliberate:
 *
 *   1. No `dark:` variants. This app has no dark mode (see the `:root` comment
 *      in index.css) and Tailwind's default `media` strategy would flip them
 *      from under a light-only design.
 *   2. The overlay is `bg-ink/40` rather than `bg-black/80`. Pure black at 80%
 *      reads as a system error modal next to this site's palette; the brand
 *      navy at 40% dims the page without changing its colour temperature.
 *
 * Radix ships the close button with `sr-only` text so the icon-only control is
 * still announced. Keep it.
 */
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@shared/lib/cn";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[100] bg-ink/40 backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
});

const DialogContent = React.forwardRef(function DialogContent(
  { className, children, showClose = true, ...props },
  ref,
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-[101] grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "gap-4 rounded-3xl border border-line bg-white p-6 shadow-card duration-200",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-5 top-5 rounded-full p-1 text-muted opacity-70 transition hover:bg-canvas hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ink/30 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

function DialogHeader({ className, ...props }) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="dialog-title"
      className={cn("font-livvic-semibold text-ink text-xl leading-snug tracking-tight", className)}
      {...props}
    />
  );
});

const DialogDescription = React.forwardRef(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="dialog-description"
      className={cn("fl-small", className)}
      {...props}
    />
  );
});

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
