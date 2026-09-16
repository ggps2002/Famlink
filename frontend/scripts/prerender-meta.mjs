// Post-build SEO prerender. The site is a client-rendered SPA, so without this
// every URL serves dist/index.html with the homepage's <head> — crawlers and
// link scrapers never see per-page titles, descriptions, canonicals, or
// JSON-LD. This script copies the built shell once per marketing route,
// replacing the <!-- SEO:BEGIN -->…<!-- SEO:END --> block in <head> with that
// route's real tags, and writes dist/<route>/index.html. Vercel serves
// filesystem matches before applying the SPA rewrite, so crawlers get the
// per-route HTML on the first request with no vercel.json changes.
//
// Also regenerates dist/sitemap.xml from the same route list so the sitemap
// can never drift from the pages that actually exist.
//
// Route data comes from src/seo/routeMeta.js — plain JS imported directly by
// Node ("type": "module"). If someone adds a JSX/asset import to that chain,
// this script (and the build) fails loudly, which is the desired guardrail.
//
// Run automatically via `npm run build` (vite build && node scripts/prerender-meta.mjs).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPrerenderRoutes,
  SITE_ORIGIN,
  DEFAULT_OG_IMAGE,
} from "../src/shared/seo/routeMeta.js";
import { serializeJsonLd } from "../src/shared/seo/jsonLd.js";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const SHELL_PATH = join(DIST, "index.html");
const BEGIN = "<!-- SEO:BEGIN";
const END = "<!-- SEO:END -->";

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildHeadBlock = (route) => {
  const image = route.image || DEFAULT_OG_IMAGE;
  // Social copy falls back to the SERP copy, so a route only overrides these
  // when the share card genuinely wants different wording from the search
  // result — which the compact card does, being a label beside a thumbnail
  // rather than a paragraph under a banner.
  const ogTitle = route.ogTitle || route.title;
  const ogDescription = route.ogDescription || route.description;
  const lines = [
    `<title>${escapeHtml(route.title)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${escapeHtml(route.canonical)}" />`,
    `<meta property="og:site_name" content="FamLink" />`,
    `<meta property="og:type" content="${escapeHtml(route.type || "website")}" />`,
    `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`,
    `<meta property="og:url" content="${escapeHtml(route.canonical)}" />`,
  ];

  // The card type follows the image, because the two have to agree.
  //
  // Most routes have NO image (DEFAULT_OG_IMAGE is null), and those emit no
  // og:image at all — which, with `summary`, gives the smallest text-only card.
  // Emitting an empty og:image instead of omitting it would be worse than
  // either: scrapers try to fetch it, fail, and some fall back to hunting the
  // page for an image of their own choosing.
  //
  // A route that supplies its OWN image has a real banner behind it (the
  // resource articles each have a 1200×630 photo), and those keep the large
  // card.
  if (image) {
    lines.push(
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${escapeHtml(ogTitle)}" />`
    );
  }

  lines.push(
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`
  );
  if (image) {
    lines.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }
  for (const node of route.jsonLd || []) {
    lines.push(
      `<script type="application/ld+json">${serializeJsonLd(node)}</script>`
    );
  }
  return lines.map((l) => `  ${l}`).join("\n");
};

const buildSitemap = (routes, lastmod) => {
  const urls = routes
    .map((r) => {
      const loc = r.path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${r.path}`;
      return [
        "  <url>",
        `    <loc>${escapeHtml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${r.changefreq}</changefreq>`,
        `    <priority>${r.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const main = () => {
  const shell = readFileSync(SHELL_PATH, "utf8");
  const beginAt = shell.indexOf(BEGIN);
  const endAt = shell.indexOf(END);
  if (beginAt === -1 || endAt === -1 || endAt < beginAt) {
    throw new Error(
      "SEO markers missing from dist/index.html — index.html must contain <!-- SEO:BEGIN --> … <!-- SEO:END -->"
    );
  }
  if (
    shell.indexOf(BEGIN, beginAt + 1) !== -1 ||
    shell.indexOf(END, endAt + 1) !== -1
  ) {
    throw new Error("SEO markers appear more than once in dist/index.html");
  }
  const before = shell.slice(0, beginAt);
  // Keep the marker comment's own line but drop the old tag block.
  const after = shell.slice(endAt + END.length);

  const routes = getPrerenderRoutes();
  const seen = new Set();
  const written = [];

  for (const route of routes) {
    if (seen.has(route.path)) throw new Error(`Duplicate route path: ${route.path}`);
    seen.add(route.path);
    if (route.sitemapOnly) continue;
    for (const field of ["title", "description", "canonical"]) {
      if (!route[field]) {
        throw new Error(`Route ${route.path} is missing required field "${field}"`);
      }
    }
    if (route.noIndex) {
      throw new Error(`Route ${route.path} is noIndex — it should not be prerendered`);
    }
    const html = `${before}<!-- SEO:BEGIN (generated) -->\n${buildHeadBlock(route)}\n  ${END}${after}`;
    const outPath =
      route.path === "/" ? SHELL_PATH : join(DIST, route.path, "index.html");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    written.push([route.path, route.title]);
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  writeFileSync(join(DIST, "sitemap.xml"), buildSitemap(routes, lastmod));

  console.log(`Prerendered SEO heads for ${written.length} routes:`);
  for (const [path, title] of written) console.log(`  ${path}  →  ${title}`);
  console.log(`Wrote sitemap.xml with ${routes.length} URLs (lastmod ${lastmod})`);
};

main();
