import React from "react";
import CustomButton from "@shared/ui/Button";
import { NavLink } from "react-router-dom";
import { SectionHeading } from "@shared/ui/Section";
import seeMatchesImg from "@/assets/images/seeMatches.webp";
import seeMatches480 from "@/assets/images/seeMatches-480w.webp";
import seeMatches900 from "@/assets/images/seeMatches-900w.webp";
import browseFamImg from "@/assets/images/browseFam.webp";

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
  // Intrinsic size travels with the screenshot: the two differ in aspect ratio,
  // so a single hard-coded pair would stretch whichever one it was not measured
  // from.
  const preview = caregiver
    ? { src: browseFamImg, width: 1808, height: 3076, srcSet: undefined }
    : {
        src: seeMatchesImg,
        width: 1806,
        height: 3913,
        // The tallest asset on the homepage at 274 KB, and on a 390px phone it
        // renders about 358px wide — roughly a fifth of the pixels it ships.
        // The full-width file stays as the top candidate for desktop, where it
        // is genuinely 2x the 896px box.
        srcSet: `${seeMatches480} 480w, ${seeMatches900} 900w, ${seeMatchesImg} 1806w`,
      };

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
            <img
              key={i}
              src={preview.src}
              srcSet={preview.srcSet}
              sizes="(min-width: 1024px) 66vw, 92vw"
              alt=""
              width={preview.width}
              height={preview.height}
              loading="lazy"
              decoding="async"
              className="w-full block object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default NannySharePreview;
