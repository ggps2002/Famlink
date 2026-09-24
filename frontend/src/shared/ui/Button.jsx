import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@shared/lib/cn";

/* Padding steps. The marketing CTAs were six hand-written strings across six
 * call sites (`px-8 py-3`, `px-10 py-3.5`, `px-7 py-3.5`, …), so the same
 * button was a different size on every page. `md` is the historical default and
 * is deliberately unchanged — every dashboard and form button inherits it.
 * `lg` is the marketing CTA.
 */
const SIZES = {
  sm: "px-5 py-1.5 text-sm",
  md: "px-6 py-2",
  lg: "px-8 py-3.5",
};

/* The one button for every action in the app. Style a call site through
 * `className`: classes are merged with twMerge (via `cn`), so a caller's
 * `rounded-xl`, `px-4`, `bg-…` or `Livvic-Medium` REPLACES the default here
 * instead of racing it in the stylesheet — no `!important` needed. A button
 * that should have no padding, radius or Livvic face at all says so
 * explicitly (`px-0 py-0 rounded-none Livvic`), otherwise it gets the pill.
 *
 * Content is `children` or, for older call sites, `btnText`. The click handler
 * is `onClick` or `action`; either way it is skipped while loading/disabled.
 * The default faded disabled look is dropped when the caller styles its own
 * `disabled:` state, so that styling isn't dimmed a second time.
 *
 * Unlike a raw <button>, `type` defaults to "button": pass
 * `htmlType="submit"` (or `type="submit"`) for a form's submit button. */
const CustomButton = forwardRef(function CustomButton(
  {
    btnText,
    children,
    btnBgColor = "",
    size = "md",
    className = "",
    action,
    onClick,
    isLoading = false,
    loadingBtnText = "",
    htmlType = "",
    type,
    disabled,
    ...props
  },
  ref
) {
  const isDisabled = isLoading || !!disabled;
  const handler = action ?? onClick;
  const ownsDisabledLook = /(^|\s)disabled:/.test(`${btnBgColor} ${className}`);

  return (
    <button
      ref={ref}
      type={htmlType || type || "button"}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        "rounded-full Livvic-SemiBold transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#001243]/40 focus-visible:ring-offset-2",
        SIZES[size] ?? SIZES.md,
        btnBgColor,
        className,
        isDisabled && !ownsDisabledLook && "opacity-50 cursor-not-allowed"
      )}
      onClick={(e) => {
        if (!isDisabled && handler) handler(e);
      }}
      {...props}
    >
      {isLoading ? (
        <div className="flex gap-2 items-center Livvic-SemiBold justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> {loadingBtnText}
        </div>
      ) : (
        children ?? btnText
      )}
    </button>
  );
});

export default CustomButton;
