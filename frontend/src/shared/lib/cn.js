import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, with later Tailwind utilities beating earlier ones.
 *
 * The `cn` that shadcn-derived components (shared/ui/tooltip.jsx) import as
 * `@/lib/utils`. It lives here instead because this project's module map has no
 * `src/lib` — see aliases.js — and `shared/lib` is where every other shared
 * helper already is.
 *
 * clsx alone would keep both of `px-3 px-0` and let the stylesheet order decide;
 * twMerge drops the loser, so a `className` prop can always override a
 * component's own padding or colour.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
