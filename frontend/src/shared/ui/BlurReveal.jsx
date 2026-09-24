import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/* Per-letter blur-in text reveal.
 *
 * Ported from the shadcn-style `blur-reveal.tsx` snippet. Two deliberate
 * differences from the original:
 *
 *  - It imports from `framer-motion`, not `motion/react`. They are the same
 *    library (motion is framer-motion's rename), and framer-motion is already
 *    installed and already on the homepage's eager path via landing/About.
 *    Adding `motion` too would ship the animation runtime twice.
 *  - It honours prefers-reduced-motion by rendering the plain text.
 *  - Every span it creates carries `[font-family:inherit]`. App.css has a
 *    global `* { font-family: Livvic }` reset that hits each span directly,
 *    so without this a font class like `Livvic-SemiBold` on the caller's
 *    element never reached the letters and the text rendered Regular.
 *  - Every animated span gets a no-op `onUpdate`. That forces framer-motion to
 *    run opacity/filter in JS instead of the Web Animations API, whose finish
 *    drops the final value for a frame: each letter blinked out once as it
 *    landed, which read as a glitch rippling through the word.
 *
 * `children` must be a string: it is split into words and letters. The full
 * string is kept in an sr-only span so screen readers read words, not letters.
 */
const noop = () => {};
const INHERIT_FONT = "[font-family:inherit]";

export function BlurReveal({
  children,
  className,
  delay = 0,
  speedReveal = 1.5,
  speedSegment = 0.5,
  trigger = true,
  onAnimationComplete,
  onAnimationStart,
  as = "p",
  style,
  inView = false,
  once = true,
  letterSpacing,
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    const Tag = as;
    return trigger ? (
      <Tag className={`${INHERIT_FONT} ${className ?? ""}`} style={style}>
        {children}
      </Tag>
    ) : null;
  }

  const MotionTag = motion[as] ?? motion.p;

  const stagger = 0.03 / speedReveal;
  const baseDuration = 0.3 / speedSegment;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
    exit: {
      transition: { staggerChildren: stagger, staggerDirection: -1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, filter: "blur(12px)", y: 10 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { duration: baseDuration },
    },
    exit: { opacity: 0, filter: "blur(12px)", y: 10 },
  };

  return (
    <AnimatePresence mode="popLayout">
      {trigger && (
        <MotionTag
          initial="hidden"
          whileInView={inView ? "visible" : undefined}
          animate={inView ? undefined : "visible"}
          exit="exit"
          variants={containerVariants}
          viewport={{ once }}
          className={`${INHERIT_FONT} ${className ?? ""}`}
          onAnimationComplete={onAnimationComplete}
          onAnimationStart={onAnimationStart}
          style={style}
          onUpdate={noop}
        >
          <span className="sr-only">{children}</span>
          {children &&
            children.split(" ").map((word, wordIndex, wordsArray) => (
              <span
                key={`word-${wordIndex}`}
                className={`${INHERIT_FONT} inline-block whitespace-nowrap`}
                aria-hidden="true"
              >
                {word.split("").map((char, charIndex) => (
                  <motion.span
                    key={`char-${wordIndex}-${charIndex}`}
                    variants={itemVariants}
                    onUpdate={noop}
                    className={`${INHERIT_FONT} inline-block`}
                    style={letterSpacing ? { marginRight: letterSpacing } : undefined}
                  >
                    {char}
                  </motion.span>
                ))}
                {wordIndex < wordsArray.length - 1 && (
                  <motion.span variants={itemVariants} onUpdate={noop} className={`${INHERIT_FONT} inline-block`}>
                    &nbsp;
                  </motion.span>
                )}
              </span>
            ))}
        </MotionTag>
      )}
    </AnimatePresence>
  );
}

export default BlurReveal;
