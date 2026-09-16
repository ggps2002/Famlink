import React from "react";
import Button from "@shared/ui/Button";
import { NavLink } from "react-router-dom";

const benefits = [
  "Background-checked providers",
  "18-month average match duration",
  "Save $18,000–$26,000 annually",
  "Built-in support network of like-minded families",
];

/* Nanny-share pitch + benefits box, as a two-column split.
 *
 * The hard <br> tags that used to force the heading onto three lines and the
 * paragraph onto four are gone. They were baked for one viewport width and
 * broke in the middle of phrases at every other size; a measure cap does the
 * same job at any width.
 */
function NannyShare() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div>
        <h2 className="fl-h2 text-ink">
          Nanny Share &amp; Shared Care—More Affordable Than You Think
        </h2>
        <p className="fl-lede mt-5">
          Famlink helps families connect with nearby families to share
          caregivers—whether that’s a nanny, tutor, or coach. Save money, split
          schedules, and build consistency with our compatibility-based matching
          system.
        </p>
        <NavLink to="/joinNow">
          <Button
            btnText="Learn more about Nanny Share"
            className="bg-[#D6FB9A] text-ink mt-8 w-full sm:w-auto"
          />
        </NavLink>
      </div>

      <div className="border-2 border-line rounded-2xl flex flex-col gap-5 p-6 sm:p-8 lg:p-10">
        <h3 className="fl-h3 text-ink">What you get</h3>
        {benefits.map((benefit) => (
          <div key={benefit} className="flex gap-3 items-start">
            <img
              src="/icons/Check.svg"
              alt=""
              aria-hidden="true"
              className="flex-shrink-0 mt-0.5"
            />
            <p className="fl-body text-[#025738]">{benefit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NannyShare;
