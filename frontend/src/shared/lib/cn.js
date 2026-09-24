import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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
/* Livvic is four font FAMILIES, not weights (see App.css), so its classes are
 * invisible to twMerge's font-weight group. Teaching it they are one group is
 * what lets a component's `className="Livvic-Medium"` replace its default
 * `Livvic-SemiBold` rather than leaving both and letting App.css order pick. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "livvic-face": [
        "Livvic",
        "Livvic-Medium",
        "Livvic-SemiBold",
        "Livvic-Bold",
        "font-livvic",
        "font-livvic-medium",
        "font-livvic-semibold",
        "font-livvic-bold",
      ],
    },
  },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
