import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Carousal1 from "../../../assets/images/Carousal1.jpg";
import Carousal2 from "../../../assets/images/Carousal2.jpg";

/* The two nanny-share arrangements as an auto-advancing carousel.
 *
 * Shared by the "What is Nanny Share?" section on / and the "What Is a Nanny
 * Share Arrangement?" section on /jobSeekers, so both pages show the same
 * slides. Colours stay on the blossom palette on both pages on purpose: the
 * slide text sits on a white fade, and the caregiver `accent` green is too
 * light to read there.
 */
const slides = [
  {
    id: 1,
    title: "Alternate Between Homes",
    description:
      "Families alternate hosting the nanny at their respective homes, sharing hosting responsibilities while children get comfortable in different settings.",
    image: Carousal1,
  },
  {
    id: 2,
    title: "Share at One Family’s Home",
    description:
      "Families agree to have the nanny provide care at one of their homes, simplifying logistics and giving children a familiar environment.",
    image: Carousal2,
  },
];

const DURATION = 5;

export default function NannyShareCarousel() {
  const [current, setCurrent] = useState(0);

  // Automatically move to the next slide. Keyed on `current` so a dot click
  // restarts the timer instead of advancing again a moment later.
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, DURATION * 1000);

    return () => clearTimeout(timer);
  }, [current]);

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl overflow-hidden">
      <div className="relative w-full aspect-[1] overflow-hidden">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={slides[current].id}
            className="absolute inset-0 w-full h-full"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{
              duration: 0.5,
              ease: "easeInOut",
            }}
          >
            <img
              src={slides[current].image}
              alt={slides[current].title}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Fade over the image */}
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-white via-white/80 to-transparent z-10" />

            {/* Title + Description */}
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 z-20">
              <h3 className="text-2xl sm:text-3xl Livvic-Bold mb-2 text-blossom-ink">
                {slides[current].title}
              </h3>

              <p className="text-primary text-sm sm:text-base Livvic-Medium leading-relaxed">
                {slides[current].description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-2 rounded-full transition-all ${
                current === index ? "w-6 bg-blossom-strong" : "w-2 bg-ink/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
