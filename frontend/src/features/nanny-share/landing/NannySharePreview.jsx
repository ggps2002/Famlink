import React from "react";
import CustomButton from "@shared/ui/Button";
import { NavLink } from "react-router-dom";
import { SectionHeading } from "@shared/ui/Section";
import seeMatchesImg from "@/assets/images/seeMatches.png";
import browseFamImg from "@/assets/images/browseFam.png";

/* The "matches near you" teaser: a CTA over an endlessly scrolling screenshot.
 *
 * The band, the padding and the white→beige curve above it are the page's job
 * now (see the `<HeroCurve position="top" />` in the pages that render this),
 * which is what let the `flush` prop go — it existed only to suppress this
 * component's own curve on the one page that already drew one.
 *
 * Also dropped: 94 lines of `nannyShareData` and the ProfileCard /
 * NannyShareCard imports. Nothing here ever read them — the section renders a
 * screenshot, not cards — so they were shipping to every visitor unused.
 */
function NannySharePreview({ caregiver }) {
  const image = caregiver ? browseFamImg : seeMatchesImg;

  return (
    <div className="flex flex-col items-center text-center">
      <SectionHeading
        align="center"
        eyebrow="Matches Near You"
        eyebrowClass="text-subtle"
        title={caregiver ? "See Families Near You" : "See Who's Near You"}
        lede={
          caregiver
            ? "Browse families in your area looking for a nanny share caregiver."
            : "Browse families in your area looking for the same kind of nanny share."
        }
        className="mb-8"
      >
        <NavLink to="/joinNow">
          <CustomButton
            btnText="See All Matches Near You"
            size="lg"
            className={`${
              caregiver
                ? "bg-accent hover:bg-accent-strong text-ink"
                : "bg-blossom hover:bg-blossom-strong text-blossom-ink"
            } mt-8`}
          />
        </NavLink>
      </SectionHeading>

      {/* Masked viewport for the marquee. The gradient mask fades the screenshot
          out at both edges so it reads as a continuous feed rather than a
          cropped image. */}
      <div
        className="w-full max-w-4xl mx-auto h-[320px] xs:h-[400px] sm:h-[500px] lg:h-[600px] overflow-hidden relative"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        }}
      >
        {/* Four copies: the animation translates -50%, so the second pair has to
            be in place for the loop to be seamless. */}
        <div className="flex flex-col animate-scrollUp w-full">
          {[0, 1, 2, 3].map((i) => (
            <img key={i} src={image} alt="" className="w-full block object-cover" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default NannySharePreview;
