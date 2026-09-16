// ⚠️ This module runs in Node as well as in the browser: it is reachable from
// api/ (Vercel serverless functions) and/or scripts/ (the build step), neither
// of which resolves the "@" aliases — those exist only inside Vite. Import to
// and from this file with relative paths that include the file extension.
// tests/architecture/aliases.test.js fails the build if that stops being true.

// Geo + SEO lookup for the programmatic city/neighborhood landing pages
// (Category 4.1). Maps a URL slug (e.g. "oakland-ca" or "rockridge") to a map
// center + zoom so the Leaflet map can render without a geocoding round-trip,
// plus the SEO fields the prerender script (scripts/prerender-meta.mjs) and the
// internal-linking components need. This file is imported by Node at build
// time — keep it plain JS with no JSX/asset imports.
//
// Per entry:
//   canonicalSlug — the ONE slug we want indexed (cities keep their "-ca"
//                   suffix to match the sitemap/footer URLs; neighborhoods are
//                   bare). resolveCityGeo() accepts suffixed variants but the
//                   canonical always points here.
//   parent        — cityGeo key of the containing city (neighborhoods only).
//   blurb         — unique intro copy behind the meta description, so the ~20
//                   templated pages don't all read identically to Google. It is
//                   NOT rendered on the page any more (marketing removed the
//                   on-page intro brief) — keep it unique per entry anyway,
//                   that's the whole point of it.
//   coverage      — the family / caregiver / area counts the coverage map
//                   publishes for this page, plus the `spots` the circles are
//                   drawn on. Set here, these override the live
//                   /location/map-pins response: marketing owns the numbers
//                   these launch pages show. Entries WITHOUT a coverage block
//                   still render whatever the API actually reports.
//   waitlist      — this market hasn't opened yet, so the page sells the
//                   waitlist instead of matches (see Search/Hero.jsx). The
//                   coverage map reads its counts as people who've signed up
//                   for early access rather than as members you can contact
//                   today, and its CTAs point at /waitlist. Drop the flag when
//                   the market goes live and the map reverts to member copy.
//
// About `spots`: every one is a REAL residential neighborhood, hand-picked. A
// generated ring or spiral cannot do this job here — half the Bay Area ring
// around any of these centres lands in the Bay, on Tilden/Redwood Regional
// parkland, or on open hillside, and a coverage circle sitting on open water
// reads as obviously fake. Two rules when editing:
//   • Centres go on inhabited ground. No bay, no estuary, no regional park,
//     no ridgeline.
//   • Keep any two spots on a page apart — the drawn radius is derived from
//     the closest pair (see NannyShareMap) so circles never overlap, which
//     means one tight pair shrinks every circle on the page.
// First spot listed carries the largest share of the families.
//
// Coordinates are approximate neighborhood centroids — precision isn't critical
// because the pins themselves are intentionally fuzzed.
const CITY_GEO = {
  // Cities
  "san-francisco": {
    lat: 37.7749, lng: -122.4194, zoom: 12, label: "San Francisco", radius: 9000,
    canonicalSlug: "san-francisco-ca",
    waitlist: true,
    coverage: {
      families: 160, caregivers: 65, areas: 8,
      spots: [
        [37.75, -122.432],    // Noe Valley
        [37.792, -122.436],   // Pacific Heights
        [37.779, -122.482],   // Outer Richmond
        [37.759, -122.399],   // Potrero Hill
        [37.755, -122.489],   // Outer Sunset
        [37.7245, -122.429],  // Excelsior
      ],
    },
    blurb:
      "From Noe Valley strollers to Golden Gate Park playdates, San Francisco families use nanny shares to make in-home care affordable in one of the country's priciest childcare markets. Shares here usually pair families within the same neighborhood to keep mornings simple.",
  },
  oakland: {
    lat: 37.8044, lng: -122.2712, zoom: 12, label: "Oakland", radius: 8000,
    canonicalSlug: "oakland-ca",
    coverage: {
      families: 120, caregivers: 48, areas: 6,
      spots: [
        [37.845, -122.252],   // Rockridge
        [37.8115, -122.247],  // Grand Lake
        [37.809, -122.293],   // West Oakland
        [37.78, -122.223],    // Fruitvale
        [37.799, -122.21],    // Laurel / Dimond
        [37.768, -122.183],   // Eastmont
      ],
    },
    blurb:
      "Oakland is the heart of East Bay nanny sharing, with active families from Rockridge to Grand Lake looking to pair up. Sharing a nanny here typically saves each family 30–50% compared to hiring alone.",
  },
  berkeley: {
    lat: 37.8715, lng: -122.273, zoom: 13, label: "Berkeley", radius: 6000,
    canonicalSlug: "berkeley-ca",
    coverage: {
      families: 85, caregivers: 34, areas: 4,
      spots: [
        [37.8815, -122.269],  // North Berkeley / Gourmet Ghetto
        [37.857, -122.253],   // Elmwood
        [37.868, -122.299],   // West Berkeley / Fourth Street
        [37.876, -122.245],   // Northside / Euclid Ave
        [37.89, -122.296],    // Albany line / Solano Ave
        [37.852, -122.276],   // South Berkeley
      ],
    },
    blurb:
      "Berkeley families — many juggling university schedules — use nanny shares for flexible, in-home care that daycare waitlists can't match. Shares often form around North Berkeley, Elmwood, and the Gourmet Ghetto.",
  },
  alameda: {
    lat: 37.7652, lng: -122.2416, zoom: 13, label: "Alameda", radius: 5000,
    canonicalSlug: "alameda-ca",
    coverage: {
      families: 45, caregivers: 18, areas: 2,
      // The island is narrow, so these hug its built-up spine and then step
      // onto the Oakland side of the estuary rather than out over the water.
      spots: [
        [37.766, -122.245],   // Central Alameda / Park Street
        [37.773, -122.283],   // West End / Webster Street
        [37.759, -122.225],   // East End / Fernside
        [37.732, -122.244],   // Bay Farm Island / Harbor Bay
        [37.78, -122.223],    // Fruitvale, Oakland
        [37.797, -122.249],   // Eastlake, Oakland
      ],
    },
    blurb:
      "Alameda's flat, walkable streets and beach playgrounds make it easy for two island families to share one great nanny. Many shares form around Central Alameda and Bay Farm Island.",
  },
  emeryville: {
    lat: 37.8313, lng: -122.2852, zoom: 14, label: "Emeryville", radius: 4000,
    canonicalSlug: "emeryville-ca",
    coverage: {
      families: 43, caregivers: 17, areas: 1,
      // Emeryville is ~1.2 sq mi, so five of the six sit in the dense
      // neighborhoods immediately around it.
      spots: [
        [37.835, -122.289],   // Emeryville / Doyle Street
        [37.836, -122.262],   // Temescal, Oakland
        [37.866, -122.296],   // West Berkeley
        [37.811, -122.29],    // West Oakland
        [37.808, -122.268],   // Uptown Oakland
        [37.853, -122.268],   // South Berkeley
      ],
    },
    blurb:
      "Emeryville sits at the crossroads of Oakland, Berkeley, and the Bay Bridge commute, making it a natural meeting point for nanny share families. Its compact size means most matches live only a few minutes apart.",
  },
  albany: {
    lat: 37.8869, lng: -122.2977, zoom: 14, label: "Albany", radius: 4000,
    canonicalSlug: "albany-ca",
    coverage: {
      families: 28, caregivers: 11, areas: 1,
      // Albany is ~1.7 sq mi — same story as Emeryville, the spread runs into
      // the built-up neighbors along the San Pablo / Solano corridors.
      spots: [
        [37.888, -122.295],   // Albany / Solano Ave
        [37.88, -122.269],    // North Berkeley
        [37.87, -122.299],    // West Berkeley / Gilman
        [37.915, -122.305],   // El Cerrito / San Pablo Ave
        [37.906, -122.282],   // Kensington
        [37.93, -122.335],    // Richmond
      ],
    },
    blurb:
      "Albany's small-town feel and top-rated schools draw young families who pair up for nanny shares near Solano Avenue and Memorial Park. North Berkeley families frequently join Albany shares too.",
  },
  "san-leandro": {
    lat: 37.7249, lng: -122.1561, zoom: 13, label: "San Leandro", radius: 5000,
    canonicalSlug: "san-leandro-ca",
    coverage: {
      families: 22, caregivers: 9, areas: 2,
      // Along the dense East 14th / San Leandro Blvd corridor. Nothing in the
      // hills east of I-580 and nothing out on the marina side.
      spots: [
        [37.725, -122.156],   // Downtown San Leandro
        [37.693, -122.15],    // Washington Manor
        [37.708, -122.135],   // Bal / East 14th corridor
        [37.695, -122.115],   // Ashland
        [37.766, -122.178],   // Eastmont, Oakland
        [37.672, -122.103],   // Mt Eden, Hayward
      ],
    },
    blurb:
      "San Leandro families share nannies to get personalized infant care without the daycare waitlist, often pairing near Estudillo Estates and Washington Manor. BART access also makes shares with Oakland families practical.",
  },
  "castro-valley": {
    lat: 37.6941, lng: -122.0863, zoom: 13, label: "Castro Valley", radius: 5000,
    canonicalSlug: "castro-valley-ca",
    coverage: {
      families: 18, caregivers: 7, areas: 1,
      // The built-up flats only. Castro Valley's own eastern half is canyon
      // and hillside subdivision — Palomares, Five Canyons, Fairview — and
      // circles out there would sit on near-empty ground.
      spots: [
        [37.695, -122.086],   // Castro Valley village
        [37.679, -122.133],   // San Lorenzo
        [37.696, -122.114],   // Ashland
        [37.68, -122.103],    // Cherryland
        [37.669, -122.08],    // Downtown Hayward
        [37.645, -122.09],    // Southgate, Hayward
      ],
    },
    blurb:
      "Castro Valley parents use nanny shares to keep infants and toddlers in a home setting while splitting the cost with a neighbor. Shares often form around Castro Village and the Palomares Hills area.",
  },

  // Oakland neighborhoods
  rockridge: {
    lat: 37.8447, lng: -122.2523, zoom: 14, label: "Rockridge", radius: 3500,
    canonicalSlug: "rockridge", parent: "oakland",
    coverage: {
      families: 63, caregivers: 25, areas: 3,
      spots: [
        [37.845, -122.252],   // Rockridge
        [37.834, -122.265],   // Temescal
        [37.859, -122.253],   // Elmwood, Berkeley
        [37.827, -122.25],    // Piedmont Avenue
        [37.876, -122.265],   // North Berkeley
        [37.8115, -122.247],  // Grand Lake
      ],
    },
    blurb:
      "Rockridge's stroller-friendly College Avenue and quick BART access make it one of the East Bay's most active nanny share pockets. Most shares here pair families within walking distance of each other.",
  },
  temescal: {
    lat: 37.8353, lng: -122.2637, zoom: 14, label: "Temescal", radius: 3500,
    canonicalSlug: "temescal", parent: "oakland",
    coverage: {
      families: 58, caregivers: 23, areas: 2,
      spots: [
        [37.835, -122.264],   // Temescal
        [37.845, -122.251],   // Rockridge
        [37.827, -122.25],    // Piedmont Avenue
        [37.824, -122.279],   // Longfellow / Hoover
        [37.859, -122.253],   // Elmwood, Berkeley
        [37.8115, -122.247],  // Grand Lake
      ],
    },
    blurb:
      "Temescal families meet at Frog Park and the Sunday farmers market — and many end up sharing a nanny with a household just a few blocks away. It's one of North Oakland's most active nanny share neighborhoods.",
  },
  "piedmont-avenue": {
    lat: 37.8271, lng: -122.2506, zoom: 14, label: "Piedmont Avenue", radius: 3000,
    canonicalSlug: "piedmont-avenue", parent: "oakland",
    blurb:
      "Piedmont Avenue's café strip and nearby Dracena Quarry Park make it a natural hub for nanny share families in central Oakland. Shares here often include families from neighboring Grand Lake and Rockridge.",
  },
  montclair: {
    lat: 37.8285, lng: -122.2091, zoom: 14, label: "Montclair", radius: 3500,
    canonicalSlug: "montclair", parent: "oakland",
    coverage: {
      families: 52, caregivers: 21, areas: 2,
      // Montclair village itself plus the built-up neighborhoods downhill of
      // it. Nothing east of the village — that's Joaquin Miller and Redwood
      // Regional Park.
      spots: [
        [37.8285, -122.209],  // Montclair village
        [37.824, -122.231],   // Piedmont
        [37.805, -122.221],   // Glenview / Dimond
        [37.845, -122.252],   // Rockridge
        [37.797, -122.195],   // Redwood Heights
        [37.84, -122.228],    // Upper Rockridge
      ],
    },
    blurb:
      "Up in the Oakland hills, Montclair families share nannies to bring flexible, in-home care to a neighborhood where daycare options are sparse. Montclair Park and the village shops are favorite meetup spots.",
  },
  "grand-lake": {
    lat: 37.811, lng: -122.257, zoom: 14, label: "Grand Lake", radius: 3000,
    canonicalSlug: "grand-lake", parent: "oakland",
    blurb:
      "Grand Lake families pair up for nanny shares between Lake Merritt walks and Saturday's famous farmers market. Its central location also draws share partners from Adams Point and Lakeshore.",
  },
  "adams-point": {
    lat: 37.8117, lng: -122.2606, zoom: 15, label: "Adams Point", radius: 2500,
    canonicalSlug: "adams-point", parent: "oakland",
    blurb:
      "Adams Point's apartment-dense blocks beside Lake Merritt are full of young families looking to split a nanny. Children's Fairyland and the lakeside lawns are everyday destinations for shares here.",
  },
  lakeshore: {
    lat: 37.8047, lng: -122.2489, zoom: 14, label: "Lakeshore", radius: 3000,
    canonicalSlug: "lakeshore", parent: "oakland",
    blurb:
      "Lakeshore families share nannies around the Lakeshore Avenue shops and the east side of Lake Merritt. Shares often team up with nearby Grand Lake and Trestle Glen households.",
  },

  // Berkeley neighborhoods
  elmwood: {
    lat: 37.858, lng: -122.254, zoom: 15, label: "Elmwood", radius: 2500,
    canonicalSlug: "elmwood", parent: "berkeley",
    blurb:
      "Elmwood's quiet streets and the shops at College and Ashby anchor one of Berkeley's most family-dense pockets. Nanny shares here often pair with neighboring Rockridge families across the Oakland line.",
  },
  "north-berkeley": {
    lat: 37.882, lng: -122.276, zoom: 14, label: "North Berkeley", radius: 3500,
    canonicalSlug: "north-berkeley", parent: "berkeley",
    blurb:
      "North Berkeley families form nanny shares around the Gourmet Ghetto, Live Oak Park, and the Monterey Market blocks. Flexible in-home care is a popular alternative to the area's long preschool waitlists.",
  },
  "west-berkeley": {
    lat: 37.869, lng: -122.29, zoom: 14, label: "West Berkeley", radius: 3500,
    canonicalSlug: "west-berkeley", parent: "berkeley",
    blurb:
      "West Berkeley's mix of new condos and classic bungalows houses many young families working around Fourth Street and the Gilman district. Nanny shares here keep infant care close to home and off the freeway.",
  },
  "downtown-berkeley": {
    lat: 37.8701, lng: -122.2681, zoom: 15, label: "Downtown Berkeley", radius: 2500,
    canonicalSlug: "downtown-berkeley", parent: "berkeley",
    blurb:
      "Downtown Berkeley families — many tied to campus schedules — use nanny shares for care that flexes around semesters and commutes. BART access makes pairing with families across the East Bay easy.",
  },
};

// Every canonical landing page, for the prerender script, the sitemap, and the
// internal-linking components. `key` is the CITY_GEO lookup key.
export const CITY_PAGES = Object.entries(CITY_GEO).map(([key, entry]) => ({
  key,
  ...entry,
}));

// The service-area default when a slug isn't in the table (East Bay / Oakland).
const DEFAULT_GEO = { lat: 37.8044, lng: -122.2712, zoom: 12, label: "the East Bay", radius: 12000 };

// US state abbreviations we strip off the end of a slug ("oakland-ca" → "oakland").
const STATE_SUFFIXES = new Set([
  "ca", "ny", "tx", "fl", "il", "wa", "ma", "co", "or", "dc", "us",
]);

// Turn a slug into a display name ("piedmont-avenue" → "Piedmont Avenue"),
// dropping a trailing state abbreviation.
export const formatCitySlug = (slug) => {
  if (!slug) return "";
  const parts = String(slug).toLowerCase().split("-");
  if (parts.length > 1 && STATE_SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  return parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// Resolve a slug to { lat, lng, zoom, label, radius, canonicalSlug, known, … }.
// Falls back to the East Bay center with known:false — callers use that to
// noindex the page, since any unlisted slug would otherwise render as an
// indexable near-duplicate.
export const resolveCityGeo = (slug) => {
  if (!slug) return { ...DEFAULT_GEO, known: false };
  const parts = String(slug).toLowerCase().split("-");
  if (parts.length > 1 && STATE_SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  const key = parts.join("-");
  if (CITY_GEO[key]) return { ...CITY_GEO[key], key, known: true };
  return { ...DEFAULT_GEO, label: formatCitySlug(slug) || DEFAULT_GEO.label, known: false };
};
