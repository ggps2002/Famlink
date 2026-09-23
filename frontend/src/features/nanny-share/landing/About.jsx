import React, { useEffect, useState } from "react";
import Button from "@shared/ui/Button";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Carousal1 from "../../../assets/images/Carousal1.jpg";
import Carousal2 from "../../../assets/images/Carousal2.jpg";

/* "What is Nanny Share?" explainer on / */
function About() {
  const [current, setCurrent] = useState(0);

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

  // Automatically move to the next slide
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, DURATION * 1000);

    return () => clearTimeout(timer);
  }, [current, slides.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      {/* Left side */}
      <div>
        <h2 className="fl-h2 text-ink">What is Nanny Share?</h2>

        <h3 className="fl-h3 text-ink mt-4">
          Nanny sharing is when two families share one nanny.
        </h3>

        <p className="fl-lede mt-2">
          It’s a simple way to lower childcare costs while giving your child
          personalized, in-home care with a built-in playmate.
        </p>

        <NavLink
          to="/joinNow"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          <Button
            btnText="Join Now"
            size="lg"
            className="bg-blossom hover:bg-blossom-strong text-blossom-ink w-full sm:w-auto mt-8"
          />
        </NavLink>
      </div>

      {/* Right side - Carousel */}
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
                <h2 className="text-2xl sm:text-3xl Livvic-Bold mb-2 text-blossom-ink">
                  {slides[current].title}
                </h2>

                <p className="text-primary text-sm sm:text-base Livvic-Medium leading-relaxed">
                  {slides[current].description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
            {slides.map((_, index) => (
              <button
                key={index}
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
    </div>
  );
}

export default About;
