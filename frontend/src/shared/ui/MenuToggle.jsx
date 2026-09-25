/**
 * The animated hamburger ⇄ close control used by every site header.
 *
 * One control, both states: the three bars fold into an X when `open`. There is
 * deliberately no second "close" button inside the menu panel. The header keeps
 * this toggle above the panel, so the X appears in exactly the spot the
 * hamburger was tapped.
 *
 * The animation is driven by `aria-expanded` (`group-aria-expanded:`), so the
 * visual state and the accessible state cannot drift apart.
 */
import * as React from "react";
import PropTypes from "prop-types";

import { Button } from "@shared/ui/shadcnButton";
import { cn } from "@shared/lib/cn";

const BAR = "origin-center transition-all duration-300";

const MenuToggle = React.forwardRef(function MenuToggle(
  { open, onToggle, className, controls, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      className={cn("group h-10 w-10 flex-shrink-0", className)}
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? "Close menu" : "Open menu"}
      {...props}
    >
      <svg
        className="pointer-events-none"
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M4 12L20 12"
          className={`${BAR} -translate-y-[7px] [transition-timing-function:cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]`}
        />
        <path
          d="M4 12H20"
          className={`${BAR} [transition-timing-function:cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45`}
        />
        <path
          d="M4 12H20"
          className={`${BAR} translate-y-[7px] [transition-timing-function:cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]`}
        />
      </svg>
    </Button>
  );
});

MenuToggle.propTypes = {
  open: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  className: PropTypes.string,
  controls: PropTypes.string,
};

export default MenuToggle;
