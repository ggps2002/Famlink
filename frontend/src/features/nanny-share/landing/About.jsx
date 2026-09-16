import React from "react";
import Button from "@shared/ui/Button";
import { NavLink } from "react-router-dom";

/* "What is Nanny Share?" explainer on /, as a two-column split.
 *
 * Was the single largest heading on the site at `text-4xl lg:text-[60px]`,
 * against `text-[44px]` for the equivalent section on /jobSeekers and
 * `text-[52px]` on the FAQ. All three are the same h2 now.
 */
function About() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
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
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Button
            btnText="Join Now"
            size="lg"
            className="bg-blossom hover:bg-blossom-strong text-blossom-ink w-full sm:w-auto mt-8"
          />
        </NavLink>
      </div>

      <div className="w-full rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.1)]">
        <img
          src="nanny_share.webp"
          width={1536}
          height={1024}
          loading="lazy"
          alt="Two families sharing one nanny"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

export default About;
