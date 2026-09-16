import { useParams } from "react-router-dom";
import SEOMetaData from "@shared/seo/SEOMetaData";
import Footer from "@app/layout/Footer";
import CostEstimation from "@features/nanny-share/landing/CostEstimation";
import FAQ from "@features/marketing/home/FAQ";
import Header from "@app/layout/Header";
import CityHero from "@features/nanny-share/search/CityHero";
import Hero from "@features/nanny-share/search/Hero";
import HeroOakland from "@features/nanny-share/search/HeroOakland";
import NannySharePreview from "@features/nanny-share/landing/NannySharePreview";
import ServiceAreaOakland from "@features/nanny-share/search/ServiceAreaOakland";
import NannyShareMap from "@features/nanny-share/search/NannyShareMap";
import NeighborhoodLinks from "@features/nanny-share/search/NeighborhoodLinks";
import { resolveCityGeo } from "@shared/lib/cityGeo";
import { cityMeta } from "@shared/seo/routeMeta";
import { Section, SectionHeading } from "@shared/ui/Section";
import HeroCurve from "@shared/ui/HeroCurve";

// Section wrapper for the live coverage map — reused by every city/neighborhood
// variant so the map presentation stays consistent.
//
// On a pre-launch market (geo.waitlist, currently San Francisco only) the same
// map has to read as demand signing up, not as members already sharing —
// otherwise the map quietly contradicts the "coming soon, join the waitlist"
// hero directly above it.
function MapSection({ geo, cityName }) {
  const waitlist = Boolean(geo.waitlist);

  return (
    <Section tone="canvas" size="tight" id="coverage-map" className="scroll-mt-20">
      <SectionHeading
        align="center"
        title={
          waitlist
            ? `Where ${cityName} families are joining the waitlist`
            : `Nanny shares near ${cityName}`
        }
        lede={
          waitlist
            ? `We're opening neighborhood by neighborhood. Here's where ${cityName} families and caregivers have signed up so far — join them and we'll match you when we launch near you.`
            : "See where local families and caregivers are looking to share — then join to connect."
        }
      />
      <NannyShareMap
        center={geo}
        areaLabel={cityName}
        coverage={geo.coverage}
        waitlist={waitlist}
      />
    </Section>
  );
}

// Wrapper for the two legacy heroes (Oakland / San Francisco), which sit on
// white and scoop into the beige below. The templated CityHero doesn't use it —
// its navy band butts straight into the beige.
//
// z-30 keeps the fixed Header (rendered inside those heroes) above the beige
// sections below. The inner wrapper sets NO z-index on purpose; see HeroCurve.
function LegacyHeroBand({ children }) {
  return (
    <div className="relative z-30 bg-white pb-8">
      <div className="relative">{children}</div>
      <HeroCurve />
    </div>
  );
}

export default function NannyCityPage() {
  const { city } = useParams();

  // Resolve the slug (city OR neighborhood, e.g. "oakland-ca" or "rockridge")
  // to a map centre + a display name in one place. cityMeta canonicalizes slug
  // variants ("/nanny-share/oakland" → ".../oakland-ca") and noindexes unknown
  // slugs, which would otherwise render as indexable near-duplicates.
  const geo = resolveCityGeo(city);
  const cityName = geo.label;
  const meta = cityMeta(city);

  const isOakland = cityName === "Oakland";
  const isSanFrancisco = cityName === "San Francisco";

  // The three variants differed only in their hero and in whether Oakland's
  // two extra sections appear. Everything below the hero is shared now, so the
  // spacing can't drift between city pages the way it had.
  return (
    <div className="min-h-screen bg-white">
      <SEOMetaData
        title={meta.title}
        description={meta.description}
        canonical={meta.canonical}
        noIndex={meta.noIndex}
        jsonLd={meta.jsonLd}
      />

      {isOakland ? (
        <LegacyHeroBand>
          <HeroOakland city={cityName} />
        </LegacyHeroBand>
      ) : isSanFrancisco ? (
        <LegacyHeroBand>
          <Hero city={cityName} />
        </LegacyHeroBand>
      ) : (
        <>
          <Header />
          <CityHero city={cityName} />
        </>
      )}

      {/* The local intro brief that used to sit here was removed at marketing's
          request — the hero now runs straight into the map. geo.blurb still
          exists and still keeps each page's meta description unique (see
          seo/routeMeta.js); it just isn't rendered. */}

      {/* Oakland is the one launched market with local proof to show, so it gets
          the caregiver preview and the service-area breakdown. Both share one
          beige band: consecutive same-tone <Section>s would double their
          padding at the seam, so they stack inside a single band instead.
          No top curve here — the hero above already draws its own. */}
      {isOakland && (
        <Section tone="canvas" containerClassName="space-y-16 sm:space-y-20">
          <NannySharePreview caregiver />
          <ServiceAreaOakland />
        </Section>
      )}

      <MapSection geo={geo} cityName={cityName} />

      {/* Oakland already carries a lot above the fold; the cost calculator would
          push the neighborhood links below three full screens. */}
      {!isOakland && (
        <Section tone="canvas" size="tight">
          <div className="fl-panel">
            <CostEstimation />
          </div>
        </Section>
      )}

      <NeighborhoodLinks slugKey={geo.key} />

      <FAQ />
      <Footer />
    </div>
  );
}
