/**
 * A loading spinner, in CSS.
 *
 * This exists because the two marketing pages used antd's `<Spin>`, and antd's
 * runtime is not tree-shakeable down to one component: importing `Spin` pulls
 * ConfigProvider, the cssinjs style engine, the theme tokens and their rc-*
 * dependencies. On the landing page that was 69 KB brotli and 6 extra requests
 * before first paint — for a rotating circle.
 *
 * Dashboard and onboarding screens still use antd's `<Spin>`, and should: they
 * already pay for antd, and `<Spin>` there wraps content with an overlay this
 * does not implement.
 *
 * `border-current` takes the colour from the parent's `text-*`, so a spinner on
 * a pink CTA and one on a white panel both read correctly without a prop.
 */
const SIZES = {
  small: "h-4 w-4 border-2",
  default: "h-6 w-6 border-2",
  large: "h-8 w-8 border-[3px]",
};

export function Spinner({ size = "default", className = "" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={
        `inline-block shrink-0 animate-spin rounded-full border-current ` +
        `border-t-transparent align-[-0.125em] ${SIZES[size] ?? SIZES.default} ${className}`
      }
    />
  );
}

export default Spinner;
