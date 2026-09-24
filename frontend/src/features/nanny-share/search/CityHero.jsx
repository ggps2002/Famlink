import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CustomButton from "@shared/ui/Button";
import HeroBand from "@shared/ui/HeroBand";

/* Hero for the programmatic city/neighborhood pages. Shares one implementation
 * with the Resource Center hero (shared/ui/HeroBand.jsx) so the two
 * top-of-funnel page types read as one family. Only the copy is local. */
export default function CityHero({ city }) {
  const navigate = useNavigate();

  return (
    <HeroBand
      eyebrow={`Nanny Share in ${city}`}
      eyebrowIcon={<MapPin size={14} />}
      title={`Share a nanny with a family near you in ${city}`}
      lede={`See where ${city} families and caregivers are looking to share, and cut the cost of in-home care by 30–50%. Create a free profile and explore compatible nanny shares.`}
      actions={
        <>
          {/* "Learn more" rather than a waitlist ask: these pages are live
              markets, and San Francisco is the ONE page that still pitches the
              waitlist (./Hero.jsx). Destination is still sign-up. */}
          <CustomButton
            btnText="Learn more"
            className="bg-accent text-ink hover:bg-accent-strong px-7 py-3.5 transition-colors"
            action={() => navigate("/joinNow")}
          />
          <CustomButton
            btnText="See who's nearby"
            className="bg-white/10 hover:bg-white/20 text-white px-7 py-3.5 transition-colors"
            action={() =>
              document
                .getElementById("coverage-map")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          />
        </>
      }
    />
  );
}
