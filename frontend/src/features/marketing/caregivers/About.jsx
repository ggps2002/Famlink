import React from "react";
import Button from "@shared/ui/Button";
import { NavLink } from "react-router-dom";

/* "What is a nanny share" explainer for caregivers, as a two-column split.
 * The page's <Section> supplies the band and padding — this brought its own
 * `py-[80px] px-4 sm:px-[72px]`, which is why it sat wider than every other
 * section on /jobSeekers.
 */
const routes = [
  {
    emoji: "👨‍👩‍👧‍👦",
    title: "Already work with a family?",
    description:
      "Add a second family to your current setup and turn your role into a nanny share.",
  },
  {
    emoji: "🔍",
    title: "Looking for a nanny share job?",
    description:
      "Connect with families searching for nanny share caregivers nearby.",
  },
];

function About() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div>
        <p className="fl-eyebrow text-subtle mb-3">What is nanny share?</p>
        <h2 className="fl-h2 text-ink">What Is a Nanny Share Arrangement?</h2>
        <p className="fl-lede mt-4">
          A nanny share is when one nanny cares for children from two different
          families in one shared arrangement. Caregivers can earn more while
          working with compatible families on a consistent schedule.
        </p>

        <div className="flex flex-col gap-3 mt-8">
          {routes.map((route) => (
            <div
              key={route.title}
              className="border border-accent-soft rounded-2xl px-5 py-4 flex items-start gap-4 bg-accent-soft/30"
            >
              <div
                className="w-10 h-10 min-w-10 rounded-xl bg-accent flex items-center justify-center text-lg"
                aria-hidden="true"
              >
                {route.emoji}
              </div>
              <div>
                <h3 className="fl-h4 text-ink mb-1">
                  {route.title}
                </h3>
                <p className="fl-small">{route.description}</p>
              </div>
            </div>
          ))}
        </div>

        <NavLink
          to="/caregiver/nannyshare"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Button
            btnText="Get Started"
            size="lg"
            className="bg-accent hover:bg-accent-strong text-ink w-full sm:w-auto mt-8"
          />
        </NavLink>
      </div>

      <div className="w-full flex justify-center items-center">
        <img
          src="nanny_share.png"
          alt="A nanny caring for children from two families"
          className="w-full max-w-md object-cover rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.1)]"
        />
      </div>
    </div>
  );
}

export default About;
