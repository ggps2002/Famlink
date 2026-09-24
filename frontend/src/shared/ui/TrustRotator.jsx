import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import BlurReveal from "./BlurReveal";

const noop = () => {};

/* Renders text the way BlurReveal lays it out (one inline-block per letter,
 * spaces as nbsp) so a measurement of it matches the animated text exactly.
 * Per-letter inline-blocks lose kerning, so plain text would measure a little
 * narrow and the real line could still overflow by a few pixels. */
function MeasureText({ text }) {
  return text.split("").map((ch, i) => (
    <span key={i} className="[font-family:inherit] inline-block">
      {ch === " " ? " " : ch}
    </span>
  ));
}

/* Icon sized in em so it scales with the fitted font size, and the same box is
 * reserved in the measurer so the fit accounts for it. Decorative: the text
 * next to it says the same thing, so alt is empty. */
const ICON_BOX = "w-[1.15em] h-[1.15em] flex-shrink-0";
const ROW = "flex items-center gap-[0.4em]";

function Icon({ src }) {
  return src ? (
    <img src={src} alt="" aria-hidden="true" className={`${ICON_BOX} object-contain`} />
  ) : null;
}

/* One hero trust-item slot that cycles through several items in place.
 *
 * Each item is { text, icon? }. The outgoing text blurs out, then the next one
 * enters with BlurReveal.
 *
 * Every item stays on ONE line. `itemClassName` sets the preferred (maximum)
 * size, and each item is shrunk on its own only if it would not fit the column
 * at that size. Items that fit keep the full size, so one long line does not
 * make the short ones small. The slot reserves the height of a full-size line,
 * so a shrunk item sits centred in it and the layout below never moves.
 *
 * With prefers-reduced-motion the items render as a static row: nothing moves
 * and nothing auto-updates, which also keeps WCAG 2.2.2 (pause/stop/hide for
 * auto-updating content) out of the picture.
 */
export default function TrustRotator({
  items,
  interval = 3000,
  className = "",
  itemClassName = "",
}) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Per-item font size in px, or null to use the CSS size. Plus the height of
  // one full-size line, reserved on the slot.
  const [fit, setFit] = useState({ sizes: [], minHeight: null });
  const slotRef = useRef(null);
  const measureRef = useRef(null);

  useEffect(() => {
    if (reduceMotion || items.length < 2) return undefined;
    const id = setInterval(() => setLeaving(true), interval);
    return () => clearInterval(id);
  }, [reduceMotion, items.length, interval]);

  // Fit the longest item to the slot width. The measurer always renders at the
  // CSS size from itemClassName (it never gets the inline override), so its
  // width is the natural width at the preferred size at this breakpoint.
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const measurer = measureRef.current;
    if (!slot || !measurer) return undefined;

    const measure = () => {
      const available = slot.clientWidth * 0.98; // headroom for sub-pixel rounding
      const rows = [...measurer.children];
      if (!available || !rows.length) return;
      const cssSize = parseFloat(getComputedStyle(rows[0]).fontSize);
      const sizes = rows.map((r) => {
        const width = r.getBoundingClientRect().width;
        return width > available ? Math.floor(((cssSize * available) / width) * 2) / 2 : null;
      });
      const minHeight = Math.ceil(Math.max(...rows.map((r) => r.getBoundingClientRect().height)));
      setFit((prev) =>
        prev.minHeight === minHeight && prev.sizes.join() === sizes.join()
          ? prev
          : { sizes, minHeight },
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    // Widths change once the webfont swaps in (font-display: swap).
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [items]);

  const sizeStyle = (i) => (fit.sizes[i] ? { fontSize: `${fit.sizes[i]}px` } : undefined);

  const measurer = (
    <div
      ref={measureRef}
      aria-hidden="true"
      className="absolute left-0 top-0 h-0 w-full overflow-hidden invisible pointer-events-none"
    >
      {items.map((m) => (
        <div key={m.text} className={`${itemClassName} ${ROW} w-max whitespace-nowrap`}>
          {m.icon && <span className={ICON_BOX} />}
          <span className="[font-family:inherit]">
            <MeasureText text={m.text} />
          </span>
        </div>
      ))}
    </div>
  );

  if (reduceMotion) {
    return (
      <div ref={slotRef} className={`relative flex flex-wrap gap-x-5 gap-y-1 ${className}`}>
        {measurer}
        {items.map((item, i) => (
          <div
            key={item.text}
            className={`${itemClassName} ${ROW} whitespace-nowrap`}
            style={sizeStyle(i)}
          >
            <Icon src={item.icon} />
            <span className="[font-family:inherit]">{item.text}</span>
          </div>
        ))}
      </div>
    );
  }

  const item = items[index];

  // One persistent container, never unmounted. It blurs out, the text is
  // swapped while it is invisible, and the new text blurs in letter by letter.
  // AnimatePresence mode="wait" was dropped here on purpose: framer-motion
  // repaints the outgoing node at full opacity for one frame before removing
  // it, which flashed the old text on every swap.
  //
  // `onUpdate` is load-bearing, not a leftover. Its presence makes framer-motion
  // animate opacity/filter in JS instead of through the browser's Web
  // Animations API. The WAAPI path drops its final value for one frame when it
  // finishes, so the faded-out text flashed back to full opacity right before
  // the swap. See AcceleratedAnimation.supports() in framer-motion.
  return (
    <div
      ref={slotRef}
      className={`relative flex items-center ${className}`}
      style={fit.minHeight ? { minHeight: `${fit.minHeight}px` } : undefined}
    >
      {measurer}
      <motion.div
        className={`${itemClassName} ${ROW} whitespace-nowrap`}
        style={sizeStyle(index)}
        initial={false}
        onUpdate={noop}
        animate={
          leaving
            ? { opacity: 0, filter: "blur(8px)", transition: { duration: 0.3 } }
            : { opacity: 1, filter: "blur(0px)", transition: { duration: 0 } }
        }
        onAnimationComplete={() => {
          if (!leaving) return;
          setIndex((i) => (i + 1) % items.length);
          setLeaving(false);
        }}
      >
        {item.icon && (
          <motion.img
            key={`icon-${index}`}
            src={item.icon}
            alt=""
            aria-hidden="true"
            className={`${ICON_BOX} object-contain`}
            initial={{ opacity: 0, scale: 0.6, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.35 }}
            onUpdate={noop}
          />
        )}
        <BlurReveal key={index} as="span" speedReveal={2} speedSegment={0.8}>
          {item.text}
        </BlurReveal>
      </motion.div>
    </div>
  );
}
