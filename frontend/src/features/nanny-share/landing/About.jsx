import React from "react";
import CustomButton from "@shared/ui/Button";
import { NavLink } from "react-router-dom";
import NannyShareCarousel from "@features/marketing/components/NannyShareCarousel";

/* "What is Nanny Share?" explainer on / */
function About() {
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
          <CustomButton
            btnText="Join Now"
            size="lg"
            className="bg-blossom hover:bg-blossom-strong text-blossom-ink w-full sm:w-auto mt-8"
          />
        </NavLink>
      </div>

      {/* Right side - Carousel */}
      <NannyShareCarousel />
    </div>
  );
}

export default About;
