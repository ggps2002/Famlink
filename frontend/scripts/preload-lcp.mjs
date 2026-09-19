// Post-build: preload the homepage's LCP image.
//
// The hero is imported by a React component, so the browser cannot discover it
// until the entry bundle has been fetched, parsed and executed. Measured on the
// live site, that put 1,109 ms of "load delay" in front of a 2.2 s LCP — half
// the metric spent waiting to find out the image existed. `fetchpriority="high"`
// on the <img> does not help with that: it ranks the request once it is known,
// and the problem is that it is not known yet.
//
// A preload in the shell's <head> is discoverable in the first HTML chunk, so
// the fetch starts alongside the bundle instead of after it.
//
// It has to be injected rather than written into index.html by hand because the
// filename is content-hashed — it changes whenever the image does, and a
// hard-coded path would silently become a preload for a 404, which costs a
// request and warns in the console.
//
// Runs BEFORE prerender-meta.mjs, which copies the shell once per marketing
// route: inject first and every route inherits the preload.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const SHELL = join(DIST, "index.html");

// The homepage hero. Named by its source basename, which the hash is appended
// to — see vite's asset naming.
const LCP_BASENAME = "familyHero";
const MARKER = "<!-- LCP:PRELOAD -->";

const assets = readdirSync(join(DIST, "assets"));
const hero = assets.find(
  (file) => file.startsWith(`${LCP_BASENAME}-`) && /\.(webp|avif|png|jpg|jpeg)$/.test(file)
);

if (!hero) {
  // Loud, not silent: if the hero is renamed or the homepage stops using it,
  // this preload is stale and someone should decide what the new LCP is.
  console.error(
    `[preload-lcp] No built asset matching "${LCP_BASENAME}-*" in dist/assets.\n` +
      `             The homepage LCP image was renamed or removed — update LCP_BASENAME\n` +
      `             in scripts/preload-lcp.mjs, or drop this step if it no longer applies.`
  );
  process.exit(1);
}

const html = readFileSync(SHELL, "utf8");

if (html.includes(MARKER)) {
  console.log("[preload-lcp] already injected, skipping");
  process.exit(0);
}

const tag =
  `${MARKER}\n  <link rel="preload" as="image" fetchpriority="high" href="/assets/${hero}" />`;

// After the font preloads, which are the other thing the first paint blocks on.
const anchor = '<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/Livvic/Livvic-Bold.woff2" />';
if (!html.includes(anchor)) {
  console.error("[preload-lcp] Could not find the font preload anchor in dist/index.html.");
  process.exit(1);
}

writeFileSync(SHELL, html.replace(anchor, `${anchor}\n\n  ${tag}`));
console.log(`[preload-lcp] preloading /assets/${hero}`);
