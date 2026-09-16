import { Helmet } from "react-helmet";
import { serializeJsonLd } from "@shared/seo/jsonLd";

// Central SEO tag block for every public page. Beyond title/description it emits
// Open Graph + Twitter Card tags (what Google, Facebook, iMessage, Slack, etc.
// read for rich previews) and an explicit robots directive, so any page that
// renders this component is both indexable and shareable without extra work.
//
// Props:
//   title       — page <title> and og/twitter title
//   description — meta description + og/twitter description
//   noIndex     — set true on pages that shouldn't be indexed (auth, thank-you)
//   canonical   — absolute canonical URL (also used as og:url when set)
//   image       — absolute preview image URL. Optional and unset by default:
//                 links preview as text only. Pass one only for a page with a
//                 real 1200×630 banner behind it (the resource articles).
//   type        — Open Graph type; "website" for pages, "article" for blog posts
//   jsonLd      — array of schema.org node objects (built in src/seo/jsonLd.js);
//                 values must match what the prerender script bakes into the
//                 static head, so build them via src/seo/routeMeta.js
// No site-wide preview image, matching DEFAULT_OG_IMAGE in src/seo/routeMeta.js
// — a link previews as text only. Kept in step with the prerender script so a
// page's static head and its client-rendered head cannot disagree about what a
// share preview looks like.

function SEOMetaData({
  title,
  description,
  noIndex = false,
  canonical,
  // Pages with a real banner of their own (resource articles) pass one; the
  // rest leave it unset and get the small text-only card.
  image,
  type = "website",
  jsonLd,
  // Social copy, when the share card wants different wording from the search
  // result. Falls back to title/description so only the routes that care set
  // them — and named the same as the prerender script's fields, so a route
  // object spread into this component produces the identical head.
  ogTitle,
  ogDescription,
}) {
  // The card type has to follow the image. No image means the smallest card
  // every platform offers; a 1200×630 article photo means the banner. Declaring
  // `summary_large_image` with nothing to show gets a card with an empty slot
  // in it on some platforms.
  const twitterCard = image ? "summary_large_image" : "summary";
  const socialTitle = ogTitle || title;
  const socialDescription = ogDescription || description;
  // Prefer the canonical URL for og:url; fall back to the live URL client-side.
  const url =
    canonical || (typeof window !== "undefined" ? window.location.href : undefined);

  return (
    <Helmet>
      {/* Title + description */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Robots — explicit index/follow unless the page opts out */}
      <meta
        name="robots"
        content={noIndex ? "noindex, follow" : "index, follow"}
      />

      {/* Canonical */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph (Facebook, LinkedIn, iMessage, Slack, …) */}
      <meta property="og:site_name" content="FamLink" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={socialTitle} />
      {socialDescription && <meta property="og:description" content={socialDescription} />}
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={socialTitle} />
      {socialDescription && <meta name="twitter:description" content={socialDescription} />}
      {image && <meta name="twitter:image" content={image} />}

      {/* Structured data */}
      {(jsonLd || []).map((node, i) => (
        <script key={i} type="application/ld+json">
          {serializeJsonLd(node)}
        </script>
      ))}
    </Helmet>
  );
}

export default SEOMetaData;
