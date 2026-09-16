// ⚠️ This module runs in Node as well as in the browser: it is reachable from
// api/ (Vercel serverless functions) and/or scripts/ (the build step), neither
// of which resolves the "@" aliases — those exist only inside Vite. Import to
// and from this file with relative paths that include the file extension.
// tests/architecture/aliases.test.js fails the build if that stops being true.

// JSON-LD structured-data builders, shared by the React app (via the
// SEOMetaData `jsonLd` prop) and the build-time prerender script
// (scripts/prerender-meta.mjs). Both paths call the same builders so the baked
// head and the client-rendered head always carry identical values. Plain JS
// only — this file is imported directly by Node at build time.
import { SITE_ORIGIN } from "./articlesMeta.js";

const LOGO_URL = `${SITE_ORIGIN}/logo3.png`;

export const orgNode = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FamLink",
  url: `${SITE_ORIGIN}/`,
  logo: LOGO_URL,
  sameAs: [
    "https://www.facebook.com/profile.php?id=61573842520549",
    "https://www.instagram.com/famlink.care",
    "https://nextdoor.com/page/famlink",
  ],
});

export const websiteNode = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "FamLink",
  url: `${SITE_ORIGIN}/`,
});

export const articleNode = ({
  headline,
  description,
  image,
  canonical,
  datePublished,
  dateModified,
}) => {
  const node = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    author: { "@type": "Organization", name: "FamLink", url: `${SITE_ORIGIN}/` },
    publisher: {
      "@type": "Organization",
      name: "FamLink",
      logo: { "@type": "ImageObject", url: LOGO_URL },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };
  if (image) node.image = image;
  if (datePublished) node.datePublished = datePublished;
  if (dateModified) node.dateModified = dateModified;
  return node;
};

// Schema for a city/neighborhood landing page. Deliberately `Service` (a
// matching service covering an area), not `ChildCare`/`LocalBusiness` — FamLink
// has no care facility at a street address there.
export const cityServiceNode = ({ label, description, canonical, lat, lng }) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  name: `Nanny Share in ${label}`,
  serviceType: "Nanny share matching",
  description,
  url: canonical,
  provider: { "@type": "Organization", name: "FamLink", url: `${SITE_ORIGIN}/` },
  areaServed: {
    "@type": "Place",
    name: `${label}, CA`,
    geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng },
  },
});

export const breadcrumbNode = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});

// Serialize for embedding in a <script> tag; "<" is escaped so content
// containing "</script>" can't break out of the tag.
export const serializeJsonLd = (node) =>
  JSON.stringify(node).replace(/</g, "\\u003c");
