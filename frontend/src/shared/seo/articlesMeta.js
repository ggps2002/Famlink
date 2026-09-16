// ⚠️ This module runs in Node as well as in the browser: it is reachable from
// api/ (Vercel serverless functions) and/or scripts/ (the build step), neither
// of which resolves the "@" aliases — those exist only inside Vite. Import to
// and from this file with relative paths that include the file extension.
// tests/architecture/aliases.test.js fails the build if that stops being true.

// Plain-JS metadata for the static blog articles, shared by the React app
// (articlesData.jsx) and the build-time prerender script
// (scripts/prerender-meta.mjs), which imports it directly under Node — so this
// file must stay free of JSX and asset imports.
export const SITE_ORIGIN = "https://famlink.care";

export const ARTICLES_META = [
  {
    slug: "what-is-a-nanny-share",
    title: "What Is a Nanny Share?",
    excerpt:
      "A nanny share is when two families hire one nanny together and split the cost. It's a simple way to receive personalized, in-home childcare while spending significantly less...",
    ogImage: `${SITE_ORIGIN}/blog/what-is-a-nanny-share.jpg`,
    datePublished: "2026-07-06",
    dateModified: "2026-07-19",
  },
  {
    slug: "how-does-a-nanny-share-work",
    title: "How Does a Nanny Share Work?",
    excerpt:
      "A nanny share is a childcare arrangement where two families hire one nanny together and share the cost. The nanny cares for both families' children at the same time...",
    ogImage: `${SITE_ORIGIN}/blog/how-does-a-nanny-share-work.jpg`,
    datePublished: "2026-07-06",
    dateModified: "2026-07-19",
  },
  {
    slug: "nanny-share-vs-daycare",
    title: "Nanny Share vs. Daycare: Which Is Right for Your Family?",
    excerpt:
      "A nanny share and daycare are two of the most common childcare options for working parents, but they offer very different experiences. A nanny share combines...",
    ogImage: `${SITE_ORIGIN}/blog/nanny-share-vs-daycare.jpg`,
    datePublished: "2026-07-06",
    dateModified: "2026-07-19",
  },
];
