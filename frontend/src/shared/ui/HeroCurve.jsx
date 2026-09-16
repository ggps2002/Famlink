import React from "react";
import clsx from "classnames";

/* The scoop that transitions one background band into the next.
 *
 * Two anchors, same shape:
 *
 *   position="bottom"  sits at the bottom of a hero, painted in the colour of
 *                      the band BELOW, curving down into it.
 *   position="top"     sits above a band, painted in that band's own colour,
 *                      reaching up over the band ABOVE it.
 *
 * Both were previously inlined: `position="bottom"` was copy-pasted into
 * FamiliesHome and NannyShareCityPage with different heights (one let the
 * viewBox decide, the other pinned 80px), and `position="top"` lived inside
 * nanny-share/landing/NannySharePreview.jsx — which is why that component
 * needed a `flush` prop to suppress its own curve on the one page that already
 * drew one.
 *
 * The parent must be `relative`. z-20 sits above the band's content but below a
 * fixed Header (z-50); the hero wrapper must NOT set a z-index of its own or the
 * header gets trapped beneath this curve and the curve paints over the nav.
 */
export default function HeroCurve({ position = "bottom", fill = "#F6F3EE", className = "" }) {
  const isTop = position === "top";

  return (
    <div
      className={clsx(
        "absolute left-0 w-full overflow-hidden leading-none pointer-events-none z-20",
        isTop ? "bottom-full -mb-px" : "-bottom-px",
        className
      )}
    >
      <svg
        className="w-full block h-10 sm:h-16 lg:h-20"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path fill={fill} d="M0,0 C360,120 1080,120 1440,0 L1440,120 L0,120 Z" />
      </svg>
    </div>
  );
}
