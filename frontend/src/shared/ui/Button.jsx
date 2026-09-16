import React from "react";
import clsx from "classnames";
import { Loader2 } from "lucide-react";

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

function CustomButton({
  btnText,
  btnBgColor = "",
  size = "md",
  className = "",
  action = () => {},
  isLoading = false,
  loadingBtnText = "",
  htmlType = "",
  ...props
}) {
  return (
    <button
      disabled={isLoading || props.disabled}
      type={htmlType?.length > 0 ? htmlType : "button"}
      className={clsx(
        "rounded-full Livvic-SemiBold transition duration-200",
        SIZES[size] ?? SIZES.md,
        (isLoading || props.disabled) ? "opacity-50 cursor-not-allowed" : "",
        btnBgColor,
        className
      )}
      onClick={(e) => {
        if (!isLoading && !props.disabled && action) {
          action(e);
        }
      }}
      {...props}
    >
      {isLoading ? (
        <div className="flex gap-2 items-center Livvic-SemiBold justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> {loadingBtnText}
        </div>
      ) : (
        btnText
      )}
    </button>
  );
}

export default CustomButton;
