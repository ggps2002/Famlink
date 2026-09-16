import { ImageResponse } from "@vercel/og";
import { createElement as h } from "react";
import { getShareProfileCopy } from "../src/features/share-link/shareProfileCopy.js";
import { buildShareCardModel, SHARE_TOKEN_PATTERN } from "../src/features/share-link/shareCardModel.js";

// The preview image for a shared profile: /api/share-og?token=<token>.
//
// A link posted to a Facebook group or a Nextdoor thread is judged on its
// thumbnail long before anyone reads the title, and never by clicking through.
// So the thumbnail has to *be* the opportunity — the same badge, the same
// subject line, the same meta rows as the card on the share page — rather than a
// FamLink logo that says nothing about who is looking for what, where.
//
// Drawn rather than screenshotted. Satori (what ImageResponse runs on) supports
// a subset of CSS — flexbox only, no grid, no external stylesheets, and every
// element with more than one child needs an explicit display:flex — so this is a
// purpose-built layout that mirrors SharedProfileCard rather than a reuse of it.
// The icons are colored dots for the same reason: lucide is a React component
// library and none of it survives the trip.
//
// Everything it says comes from buildShareCardModel, which is also what writes
// the og:description next to it, so the image and the text under it cannot
// disagree.

export const config = { runtime: "edge" };

const WIDTH = 1200;
const HEIGHT = 630;

// Livvic is already served from public/fonts for the app itself, so the preview
// carries the brand face instead of a fallback sans. Fetched from the
// deployment's own origin — a font file in the function bundle would be a second
// copy to keep in step.
const loadFont = async (origin, file) => {
  const response = await fetch(`${origin}/fonts/Livvic/${file}`);
  if (!response.ok) throw new Error(`font ${file}: ${response.status}`);
  return response.arrayBuffer();
};

// Satori has no emoji font. The 🧩 in the headline would render as a blank box,
// so it is dropped from the image — it still reads fine in og:title, where the
// platform draws it with its own emoji set.
// The variation selector is stripped in its own pass: inside the class it
// combines with the preceding range into a single grapheme, which is both what
// no-misleading-character-class warns about and a real mis-strip.
const stripEmoji = (text) =>
  String(text || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/\s+/g, " ")
    .trim();

// flexShrink: 0 on every text node is load-bearing, not habit. These sit in a
// column flex container, and a profile with five meta rows and a long headline
// runs taller than 630px; the default flexShrink: 1 then squashes each line into
// the one below it and the headline renders on top of the subheadline. Fixed
// line boxes overflow instead, which is recoverable — overlapping text is not.
const text = (content, style) =>
  h("div", { style: { display: "flex", flexShrink: 0, lineHeight: 1.25, ...style } }, content);

/* One meta row: the accent dot, then the primary line with its quieter second
   line underneath — the same shape as the card's MetaItem. Two per row, so five
   rows land in three lines and the tallest case still fits the frame. */
const metaRow = ({ color, primary, secondary }, key) =>
  h(
    "div",
    {
      key,
      style: {
        display: "flex",
        alignItems: "center",
        width: "50%",
        paddingBottom: 18,
        flexShrink: 0,
      },
    },
    h("div", {
      style: {
        display: "flex",
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: color,
        marginRight: 12,
        flexShrink: 0,
      },
    }),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", flexShrink: 0 } },
      text(primary, { fontSize: 24, fontFamily: "Livvic-Bold", color: "#202020" }),
      secondary
        ? text(secondary, { fontSize: 19, fontFamily: "Livvic", color: "#888" })
        : null
    )
  );

const card = (model) =>
  h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        border: "1px solid #ECECEC",
        borderRadius: 26,
        padding: "26px 34px 8px 34px",
        width: "100%",
        flexShrink: 0,
      },
    },
    // Badge — the share type, on that type's own accent pair.
    h(
      "div",
      { style: { display: "flex", flexShrink: 0, marginBottom: model.subject ? 12 : 18 } },
      text(`${model.badge.role} • ${model.badge.goal}`, {
        backgroundColor: model.badge.theme.bg,
        color: model.badge.theme.text,
        fontFamily: "Livvic-Bold",
        fontSize: 22,
        borderRadius: 999,
        padding: "7px 20px",
      })
    ),
    model.subject
      ? text(model.subject, {
          fontSize: 26,
          fontFamily: "Livvic-Bold",
          color: "#202020",
          marginBottom: 20,
        })
      : null,
    h(
      "div",
      { style: { display: "flex", flexWrap: "wrap", width: "100%" } },
      ...model.metas.slice(0, 6).map(metaRow)
    )
  );

const errorImage = (fonts) =>
  new ImageResponse(
    h(
      "div",
      {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F9FA",
          fontFamily: "Livvic-Bold",
          fontSize: 56,
          color: "#0D134C",
        },
      },
      "FamLink"
    ),
    { width: WIDTH, height: HEIGHT, fonts }
  );

export default async function handler(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const origin = url.origin;

  let fonts;
  try {
    const [bold, medium] = await Promise.all([
      loadFont(origin, "Livvic-Bold.ttf"),
      loadFont(origin, "Livvic-Medium.ttf"),
    ]);
    fonts = [
      { name: "Livvic-Bold", data: bold, weight: 700, style: "normal" },
      { name: "Livvic", data: medium, weight: 400, style: "normal" },
    ];
  } catch (error) {
    // Satori cannot draw anything without a font, so there is no partial
    // fallback here: let the crawler fall back to the static site image.
    console.error("Share OG image: fonts unavailable:", error);
    return new Response("Preview unavailable", { status: 500 });
  }

  const apiBase = (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || "").replace(
    /\/$/,
    ""
  );

  let profile = null;
  if (apiBase && SHARE_TOKEN_PATTERN.test(token)) {
    try {
      const response = await fetch(`${apiBase}/share/public/${encodeURIComponent(token)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) profile = (await response.json())?.data || null;
    } catch (error) {
      console.error(`Share OG image: lookup failed for ${token}:`, error);
    }
  }

  // A deleted share or an API blip still has to answer with an image — a broken
  // thumbnail in a Facebook post looks worse than a plain branded one, and the
  // page behind the link explains itself.
  if (!profile) return errorImage(fonts);

  const model = buildShareCardModel(profile);
  const copy = getShareProfileCopy(profile.variant);

  return new ImageResponse(
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#F7F9FA",
          padding: 46,
          fontFamily: "Livvic",
        },
      },
      text(stripEmoji(copy.headline), {
        fontSize: 42,
        fontFamily: "Livvic-Bold",
        color: "#0D134C",
        lineHeight: 1.15,
        marginBottom: 6,
      }),
      text(copy.subheadline, { fontSize: 24, color: "#5D5D5D", marginBottom: 22 }),
      card(model),
      h("div", { style: { display: "flex", flexGrow: 1, minHeight: 14 } }),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "space-between",
          },
        },
        text("Names and photos stay private until both sides agree to match.", {
          fontSize: 19,
          color: "#888",
        }),
        text("FamLink", { fontSize: 24, fontFamily: "Livvic-Bold", color: "#0D134C" })
      )
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        // Crawlers re-scrape on their own schedule and a rate or start date can
        // change; an hour at the edge keeps a burst of shares off the API
        // without pinning stale details to a link.
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
