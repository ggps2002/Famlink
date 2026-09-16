import { Link } from "react-router-dom";
import { CITY_PAGES } from "@shared/lib/cityGeo";
import { Section, SectionHeading } from "@shared/ui/Section";

// Internal links between the city/neighborhood landing pages. Without this
// section most neighborhood pages are orphans — listed in the sitemap but
// linked from nowhere on the site — which stalls their indexing. City pages
// link to their neighborhoods plus the other cities; neighborhood pages link to
// their parent city plus sibling neighborhoods.
export default function NeighborhoodLinks({ slugKey }) {
  const current = CITY_PAGES.find((p) => p.key === slugKey);
  if (!current) return null;

  const related = current.parent
    ? [
        CITY_PAGES.find((p) => p.key === current.parent),
        ...CITY_PAGES.filter(
          (p) => p.parent === current.parent && p.key !== current.key
        ),
      ].filter(Boolean)
    : [
        ...CITY_PAGES.filter((p) => p.parent === current.key),
        ...CITY_PAGES.filter((p) => !p.parent && p.key !== current.key),
      ];

  if (related.length === 0) return null;

  return (
    <Section tone="canvas" size="tight">
      <SectionHeading
        align="center"
        title="Explore nanny shares nearby"
        lede={`Families often match across neighborhood lines — browse the areas around ${current.label}.`}
      />
      <div className="flex flex-wrap justify-center gap-2">
        {related.map((p) => (
          <Link
            key={p.key}
            to={`/nanny-share/${p.canonicalSlug}`}
            onClick={() => window.scrollTo({ top: 0 })}
            className="fl-small text-ink bg-white border-2 border-gray-100 rounded-full px-4 py-1.5 hover:border-accent transition-colors"
          >
            Nanny Share in {p.label}
          </Link>
        ))}
      </div>
    </Section>
  );
}
