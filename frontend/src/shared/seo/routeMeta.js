// ⚠️ This module runs in Node as well as in the browser: it is reachable from
// api/ (Vercel serverless functions) and/or scripts/ (the build step), neither
// of which resolves the "@" aliases — those exist only inside Vite. Import to
// and from this file with relative paths that include the file extension.
// tests/architecture/aliases.test.js fails the build if that stops being true.

// Single source of truth for per-route SEO metadata (title, description,
// canonical, og image, JSON-LD). Consumed in two places:
//   1. The React pages, via SEOMetaData — what react-helmet renders client-side.
//   2. scripts/prerender-meta.mjs, which bakes the same values into
//      dist/<route>/index.html at build time so crawlers see them without
//      running JavaScript.
// Both must stay identical, which is why pages import from here instead of
// hardcoding strings. Plain JS only — Node imports this file directly.
import { ARTICLES_META, SITE_ORIGIN } from "./articlesMeta.js";
import { CITY_PAGES, resolveCityGeo } from "../lib/cityGeo.js";
import {
  orgNode,
  websiteNode,
  articleNode,
  cityServiceNode,
  breadcrumbNode,
} from "./jsonLd.js";

// No site-wide preview image, on purpose.
//
// A link to famlink.care previews as text only: title, description, domain —
// the smallest card any platform renders. Setting a default image here would
// put artwork back into every one of those previews, which is exactly what was
// removed. See the note in index.html.
//
// Routes MAY still set their own `image` (the resource articles each have a
// 1200×630 photo), and those get the large card. The prerender script decides
// the card type from whether an image is present at all.
const DEFAULT_OG_IMAGE = null;

// Title/description for the printable Resource Center documents. Lives here
// (not in ResourceDownloadPage.jsx) so the prerender script can read it; the
// page component imports it back.
export const DOWNLOADS_META = {
  "nanny-share-agreement": {
    title: "Nanny Share Agreement Template",
    description:
      "A free, ready-to-fill nanny share agreement covering schedule, cost split, time off, taxes, and house rules for both families and your nanny.",
  },
  "payroll-tax-guide": {
    title: "Nanny Share Payroll & Tax Guide",
    description:
      "A plain-English guide to payroll, tax withholding, and year-end forms for a two-family nanny share.",
  },
};

export const homeMeta = () => ({
  path: "/",
  title: "Nanny Share | Find Families & Reduce Childcare Costs",
  description:
    "Connect with local families to share a nanny, save on childcare costs, and provide consistent care for your children. Easy, safe, and convenient.",
  canonical: `${SITE_ORIGIN}/`,
  // Social caption, deliberately separate from the two fields above.
  //
  // `title` and `description` are the Google result — they stay long and
  // keyword-bearing. These two are the share card, which is now the compact
  // format and reads as a short label beside a thumbnail rather than a
  // paragraph under a banner. Overwriting the SERP fields to get this wording
  // would trade search copy for a link preview.
  ogTitle: "Find your Nanny Share",
  ogDescription: "famlink.care",
  jsonLd: [orgNode(), websiteNode()],
});

export const familiesMeta = () => ({
  path: "/families",
  title: "Famlink | Connect Families & Caregivers",
  description:
    "Discover Famlink, the platform connecting families with nannies and caregivers. Explore nanny-share opportunities, community events, and resources.",
  canonical: `${SITE_ORIGIN}/families`,
});

export const jobSeekersMeta = () => ({
  path: "/jobSeekers",
  title: "Caregivers & Nanny Job Opportunities | Famlink",
  description:
    "Find nanny and caregiver opportunities with local families on Famlink. Browse job listings, connect with families, and grow your childcare career.",
  canonical: `${SITE_ORIGIN}/jobSeekers`,
});

export const findNannyShareMeta = () => ({
  path: "/find-nanny-share",
  title: "Find a Nanny Share Near You | FamLink",
  description:
    "Match with local families to share a nanny. Tell us your neighborhood and schedule and we'll help you find nearby nanny share matches and save on childcare.",
  canonical: `${SITE_ORIGIN}/find-nanny-share`,
});

export const resourcesIndexMeta = () => ({
  path: "/resources",
  title: "Nanny Share Resources & Guides | FamLink",
  description:
    "Discover helpful guides, cost estimations, and tips for finding and managing a successful nanny share arrangement.",
  canonical: `${SITE_ORIGIN}/resources`,
});

export const resourceCenterMeta = () => ({
  path: "/nanny-share-resources",
  title:
    "Free Nanny Share Resources | Cost Calculator, Agreement Template & Payroll Guide",
  description:
    "Free tools for setting up a nanny share: an interactive cost calculator, a ready-to-fill nanny share agreement template, and a plain-English payroll & tax guide.",
  canonical: `${SITE_ORIGIN}/nanny-share-resources`,
});

export const articleMeta = (slug) => {
  const article = ARTICLES_META.find((a) => a.slug === slug);
  if (!article) return null;
  const canonical = `${SITE_ORIGIN}/resources/${article.slug}`;
  return {
    path: `/resources/${article.slug}`,
    title: `${article.title} | FamLink Resources`,
    description: article.excerpt,
    canonical,
    image: article.ogImage,
    type: "article",
    jsonLd: [
      articleNode({
        headline: article.title,
        description: article.excerpt,
        image: article.ogImage,
        canonical,
        datePublished: article.datePublished,
        dateModified: article.dateModified,
      }),
    ],
  };
};

export const downloadMeta = (slug) => {
  const doc = DOWNLOADS_META[slug];
  if (!doc) return null;
  const canonical = `${SITE_ORIGIN}/nanny-share-resources/${slug}`;
  return {
    path: `/nanny-share-resources/${slug}`,
    title: `${doc.title} | FamLink`,
    description: doc.description,
    canonical,
    type: "article",
    jsonLd: [
      articleNode({
        headline: doc.title,
        description: doc.description,
        canonical,
      }),
    ],
  };
};

// Meta description: the blurb's first sentence (unique per location) plus a
// short shared tail. Kept looser than 160 chars — uniqueness matters more than
// truncation here.
const firstSentence = (text) => {
  const end = text.indexOf(". ");
  return end === -1 ? text : text.slice(0, end + 1);
};

export const cityMeta = (slug) => {
  const geo = resolveCityGeo(slug);
  const title = `Nanny Share in ${geo.label} | Find Families & Reduce Childcare Costs`;

  // Unknown slug: keep the page rendering (generic template) but noindex it and
  // don't claim a canonical of its own.
  if (!geo.known) {
    return {
      path: `/nanny-share/${slug}`,
      title,
      description: `Connect with families in ${geo.label} to share a nanny, save on childcare costs, and provide consistent care for your children. See a live map of local families and caregivers.`,
      canonical: `${SITE_ORIGIN}/nanny-share/${slug}`,
      noIndex: true,
    };
  }

  const canonical = `${SITE_ORIGIN}/nanny-share/${geo.canonicalSlug}`;
  const description = `${firstSentence(geo.blurb)} Find nanny share families near you on FamLink.`;

  const crumbs = [{ name: "Home", url: `${SITE_ORIGIN}/` }];
  if (geo.parent) {
    const parent = resolveCityGeo(geo.parent);
    crumbs.push({
      name: `Nanny Share in ${parent.label}`,
      url: `${SITE_ORIGIN}/nanny-share/${parent.canonicalSlug}`,
    });
  }
  crumbs.push({ name: `Nanny Share in ${geo.label}`, url: canonical });

  return {
    path: `/nanny-share/${geo.canonicalSlug}`,
    title,
    description,
    canonical,
    jsonLd: [
      cityServiceNode({
        label: geo.label,
        description,
        canonical,
        lat: geo.lat,
        lng: geo.lng,
      }),
      breadcrumbNode(crumbs),
    ],
  };
};

// Every route the prerender script writes a static index.html for, plus
// sitemap-only entries. changefreq/priority feed the generated sitemap.xml.
export const getPrerenderRoutes = () => [
  { ...homeMeta(), changefreq: "weekly", priority: "1.0" },
  { ...familiesMeta(), changefreq: "weekly", priority: "0.9" },
  { ...jobSeekersMeta(), changefreq: "weekly", priority: "0.9" },
  { ...findNannyShareMeta(), changefreq: "weekly", priority: "0.8" },
  { ...resourceCenterMeta(), changefreq: "weekly", priority: "0.9" },
  ...Object.keys(DOWNLOADS_META).map((slug) => ({
    ...downloadMeta(slug),
    changefreq: "monthly",
    priority: "0.8",
  })),
  { ...resourcesIndexMeta(), changefreq: "weekly", priority: "0.8" },
  ...ARTICLES_META.map((a) => ({
    ...articleMeta(a.slug),
    changefreq: "monthly",
    priority: "0.7",
  })),
  ...CITY_PAGES.map((entry) => ({
    ...cityMeta(entry.canonicalSlug),
    changefreq: "weekly",
    priority: entry.parent ? "0.7" : "0.8",
  })),
  // In the sitemap but not worth a prerendered head of its own.
  {
    path: "/terms-and-conditions",
    sitemapOnly: true,
    changefreq: "yearly",
    priority: "0.3",
  },
];

export { SITE_ORIGIN, DEFAULT_OG_IMAGE };
