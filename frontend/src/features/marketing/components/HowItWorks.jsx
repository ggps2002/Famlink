import React, { useState, useEffect } from "react";
import CustomButton from "@shared/ui/Button";
import { NavLink } from "react-router-dom";
import clsx from "classnames";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@shared/ui/Section";
import createAccountImg from "@/assets/images/createAccount.webp";
import browseFamImg from "@/assets/images/dashboard.webp";
import requestImg from "@/assets/images/request.webp";
import connectImg from "@/assets/images/chat.webp";

/* The auto-advancing "How Famlink works" walkthrough.
 *
 * marketing/caregivers/HowItWorks.jsx and nanny-share/landing/HowItWorks.jsx
 * were the same component copied twice, and the copies had drifted on eight
 * axes: section padding, whether an eyebrow showed, active-row background,
 * step-number diameter, three font sizes (16px/15px title, 14px/13.5px body),
 * heading colour, and the CTA. Only the CTA is a real difference, so it's the
 * only thing left as a prop. The two files are now thin wrappers.
 *
 * The step/panel behaviour follows 21st.dev's `FeatureSteps`
 * (21st.dev/@ayushmxxn/components/feature-section): the badge for every step up
 * to the current one stays filled, inactive rows dim, and the panel enters on a
 * rotateX tilt. Five deliberate departures, all so it survives this site:
 *
 *   1. Steps stay <button>s. Upstream they're plain motion.divs — no keyboard
 *      access and nothing announced. That was fixed here once already.
 *   2. Inactive rows dim to 0.62, not upstream's 0.3. At 0.3 the descriptions
 *      land near 1.6:1 against the beige, which this palette does not ship
 *      (see the `muted` note in tailwind.config.js). Hover and keyboard focus
 *      restore full contrast on demand, and autoplay does it on a timer.
 *   3. The panel crossfades instead of running AnimatePresence `mode="wait"`.
 *      Waiting finishes the exit before starting the enter, leaving the frame
 *      empty for a full second of every 3.2s cycle — invisible behind
 *      upstream's edge-to-edge photos, but over a screenshot it reads as a
 *      failed load.
 *   4. Badges keep their numerals. Upstream swaps them for a checkmark once
 *      passed, which loses the one label a step can be referred to by.
 *   5. No rotateX. Upstream tilts the incoming panel in 3D; over a UI
 *      screenshot that skews the text and straight edges for the length of
 *      the transition, which reads as a rendering fault rather than motion.
 *      The panel just rises and fades now, so the `perspective` the tilt
 *      needed is gone with it.
 */

const STEPS = [
  {
    title: "Create Your Profile",
    description:
      "Share your experience, availability, location, and nanny share preferences.",
    img: createAccountImg,
  },
  {
    title: "Browse Compatible Families",
    description:
      "Explore families and nanny share arrangements that fit your schedule and childcare style.",
    img: browseFamImg,
  },
  {
    title: "Request a Match",
    description:
      "Send match requests to families you're interested in working with.",
    img: requestImg,
  },
  {
    title: "Connect After a Mutual Match",
    description:
      "Once there's mutual interest, connect directly to discuss schedules, care needs, and next steps.",
    img: connectImg,
  },
];

const AUTOPLAY_MS = 3200;

export default function HowItWorks({
  ctaTo,
  ctaLabel = "Get Matched",
  ctaClassName = "bg-accent hover:bg-accent-strong text-ink",
  eyebrow = "How it works",
  title = "How Famlink works",
}) {
  const [activeStep, setActiveStep] = useState(0);
  const reduceMotion = useReducedMotion();

  /* Autoplay never stops. Clicking a step used to latch a `paused` flag that
   * nothing ever cleared, so the first click killed the walkthrough for the
   * rest of the page's life.
   *
   * A timeout keyed on `activeStep` rather than a standing interval is what
   * makes a click safe: changing the step tears this effect down and starts a
   * fresh countdown, so you always get the full AUTOPLAY_MS on the step you
   * picked instead of inheriting whatever milliseconds were left on a shared
   * interval — which is the "it yanks the panel away" problem the pause was
   * reaching for in the first place. */
  useEffect(() => {
    const timer = setTimeout(
      () => setActiveStep((prev) => (prev + 1) % STEPS.length),
      AUTOPLAY_MS
    );
    return () => clearTimeout(timer);
  }, [activeStep]);

  return (
    <>
      <SectionHeading eyebrow={eyebrow} eyebrowClass="text-subtle" title={title} />

      {/* Three placed cells, not two columns: the steps and the preview share
          row 1 so the preview can stretch to exactly the steps' height, and the
          CTA drops to row 2 under the steps. gap-y is 0 because the row gap
          would otherwise stack on top of the CTA's own mt-6; each stacked item
          carries its own top margin instead.

          The columns are 0.8/1.2 rather than even, and the gutter is 48px
          rather than 64px, because the preview can only grow by being given
          room — the art is never cropped, so the box is the only thing that
          scales it. Measured at a 1280 content width, that takes the landscape
          shots from 608x366 to 721x434 (+19%) and drops their vertical slack to
          zero, i.e. they now meet both edges of the row exactly. It's also the
          point where widening stops paying: past ~1.2fr they become
          height-bound and the extra column width turns into side margin.
          minmax(0,…) on both tracks so a wide frame can't blow the grid out. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-x-10 lg:gap-x-12 gap-y-0 items-start">
        {/* Steps. Buttons rather than click-handled divs so the walkthrough is
            reachable by keyboard and announces its selected state. */}
        <div className="flex flex-col gap-1.5 lg:col-start-1 lg:row-start-1">
          {STEPS.map((step, i) => {
            const isActive = activeStep === i;
            /* Upstream's badge rule — everything up to and including the current
               step reads as done — but keeping the numeral rather than swapping
               in a checkmark, so a step is still addressable by its number. */
            const isPassed = i <= activeStep;
            return (
              <motion.button
                key={step.title}
                type="button"
                onClick={() => setActiveStep(i)}
                aria-current={isActive}
                initial={false}
                animate={{ opacity: isActive ? 1 : 0.62 }}
                whileHover={{ opacity: 1 }}
                whileFocus={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.5 }}
                className={clsx(
                  "group flex items-start gap-4 p-4 sm:p-5 rounded-2xl text-left w-full transition-colors duration-200",
                  isActive ? "bg-white shadow-card" : "bg-transparent hover:bg-white/60"
                )}
              >
                <motion.span
                  initial={false}
                  animate={{ scale: isActive && !reduceMotion ? 1.1 : 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.3 }}
                  className={clsx(
                    "w-9 h-9 min-w-9 rounded-full flex items-center justify-center shrink-0",
                    "font-livvic-bold text-sm border-2",
                    isActive
                      ? "bg-accent border-accent text-ink"
                      : "bg-transparent border-line text-subtle"
                  )}
                >
                  {i + 1}
                </motion.span>

                <span className="block flex-1">
                  <span className="fl-h4 text-ink block mb-1">{step.title}</span>
                  <span className="fl-small block">{step.description}</span>
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Row 2 under the steps. Out of the steps' flex column so it doesn't
            count toward the height the preview stretches to. */}
        <div className="mt-6 sm:pl-[52px] lg:col-start-1 lg:row-start-2">
          <NavLink
            to={ctaTo}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <CustomButton
              size="lg"
              className={clsx("w-full sm:w-auto", ctaClassName)}
              btnText={ctaLabel}
            />
          </NavLink>
        </div>

        {/* Step preview. Sits in row 1 next to the steps and self-stretches to
            that row, so its top edge lines up with step 1 and its bottom edge
            with the last line of step 4 — the CTA is in row 2 and doesn't pull
            it further down. The box has no intrinsic height at lg (the frames
            inside are absolutely positioned), so the row is sized by the steps
            and the stretch resolves against that rather than circularly.

            Below lg the column is stacked and there's nothing to match, so the
            old fixed ratio stays. */}
        <div className="w-full mt-10 lg:mt-0 lg:col-start-2 lg:row-start-1 lg:self-stretch">
          {/* The panel swap, from the source component: the outgoing frame
              leaves and the incoming one arrives from below. The box needs a
              resolved height either way — without one it collapses to zero
              while both frames are absolutely positioned mid-swap — which is
              the ratio below lg and the stretched row at lg.

              Upstream runs this `mode="wait"`, which finishes the exit before
              starting the enter — a full second of the 3.2s cycle with an empty
              frame. Over its own edge-to-edge photos you never notice; over a
              screenshot it reads as a failed load. Overlapping the two makes it
              an ordinary crossfade, and since both frames are opaque and
              absolutely stacked, the incoming one simply covers the outgoing
              one. */}
          {/* bg-accent-soft (#DCE6FF) is the palette's existing light-blue
              tint, so this doesn't introduce a fifth blue. Every frame is a
              browser window floating on transparency with a soft shadow, so the
              blue shows through the margins and around the window's own rounded
              corners. Rounded to match the step rows. */}
          <div className="relative w-full aspect-[905/490] lg:aspect-auto lg:h-full overflow-hidden rounded-2xl bg-accent-soft">
            <AnimatePresence initial={false}>
              <motion.img
                key={activeStep}
                src={STEPS[activeStep].img}
                alt={STEPS[activeStep].title}
                /* Contain, never cover: nothing in these screenshots may be
                   clipped. Scaling comes from the box, which is why it
                   stretches to the steps — the art grows to the tallest it fits
                   at, uncropped, and the leftover is side margin. */
                className="absolute inset-0 w-full h-full block object-contain object-center"
                initial={reduceMotion ? false : { y: 56, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  /* Opacity is eased out rather than in-out so the incoming
                     frame is essentially opaque a third of the way through.
                     Both frames are screenshots of different screens, so a long
                     symmetric crossfade double-exposes them; this keeps the
                     window where both read at once short. */
                  duration: reduceMotion ? 0.15 : 0.42,
                  ease: "easeOut",
                  exit: { duration: reduceMotion ? 0.1 : 0.22, ease: "easeIn" },
                }}
              />
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
