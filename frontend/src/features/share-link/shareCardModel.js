// ⚠️ This module runs in Node as well as in the browser: it is reachable from
// api/ (Vercel serverless functions) and/or scripts/ (the build step), neither
// of which resolves the "@" aliases — those exist only inside Vite. Import to
// and from this file with relative paths that include the file extension.
// tests/architecture/aliases.test.js fails the build if that stops being true.

// Explicit .js extensions: Vite would resolve these without, but this module is
// also loaded raw by the share-link functions under api/, and Node ESM will not
// guess an extension. Keep them.
import {
  formatScheduleDays,
  formatAgeLabels,
  formatCareTypeLabel,
  formatHostingLabel,
} from "../../shared/lib/scheduleFormat.js";
import { SHARE_TYPE_GOALS } from "../nanny-share/shareTypeGoals.js";

// One description of a shared profile card, for the surfaces that can't render
// React: the Open Graph tags on /share/<token> (api/share/[token].js) and the
// preview image drawn for them (api/share-og.js).
//
// The card a member sees on the dashboard, the card on the public share page,
// the preview image in a Facebook post and the text under it all have to say the
// same thing about the same opportunity. This is the one place that decides what
// "the same thing" is — which fields appear, in what order, worded how. Change a
// meta row here and every non-React surface follows.
//
// Import-light on purpose: only the two other dependency-free config modules, so
// this loads in a Node function and an edge runtime alike.

// Same alphabet and bounds as the minted token (backend/Services/utils/
// shareProfile.js). Lives here because both functions validate before spending
// an API call on a path someone typed by hand.
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;

// The meta-row accents from SharedProfileCard, in the order that card lays them
// out. Carried as hex rather than icon components because the image renderer
// draws them as dots — an icon set won't load in an edge bundle, and a colored
// marker is enough to make five rows scannable.
const ACCENT = {
  schedule: "#6366F1",
  location: "#F59E0B",
  rate: "#10B981",
  hosting: "#F97316",
  start: "#3B82F6",
};

/* "August 1, 2026". Start dates arrive as ISO, quoted ISO, or free text like
   "Flexible", which has to survive rather than become "Invalid Date" — the same
   contract SharedProfileCard's formatStart honours, without pulling in dayjs.
   Pinned to UTC so an ISO midnight doesn't slide to the previous day. */
export const formatStartDate = (start) => {
  if (!start) return "";
  const cleaned = String(start).replace(/"/g, "");
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime())
    ? cleaned
    : parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
};

/* Flatten the server's public projection into what a card shows: a badge, the
   one-line subject, and the meta rows. Rows with nothing to say are dropped
   rather than rendered empty — on a page and an image built to attract
   strangers, blank cells read as an abandoned listing. */
export const buildShareCardModel = (profile) => {
  const variant = profile.variant || "familyLooking";
  const goal = SHARE_TYPE_GOALS[variant] || SHARE_TYPE_GOALS.familyLooking;

  // A caregiver with no family yet quotes one combined rate that two families
  // split, and describes themselves rather than a household. Same branch the
  // dashboard and the share card both make.
  const quotesCombinedRate = profile.role !== "Family" && !profile.hasFamily;
  const ageText = formatAgeLabels(profile.ages);

  let subject = "";
  if (quotesCombinedRate) {
    subject = [profile.experience && `${profile.experience} experience`, ageText]
      .filter(Boolean)
      .join(" • ");
  } else if (profile.childrenCount) {
    const children = `${profile.childrenCount} Child${profile.childrenCount === 1 ? "" : "ren"}`;
    subject = [children, ageText].filter(Boolean).join(" • ");
  }

  // Each row carries how it reads on a card (primary over a quieter secondary)
  // and how it reads in a sentence. They are not the same shape: "Starting" over
  // "August 1, 2026" is right in a meta cell, but joining those two mechanically
  // gives "Starting, August 1, 2026", and "Hosting, Rotate homes" — label noise
  // that a one-line preview can't afford. So each row states its own prose form.
  const metas = [];

  const care = formatCareTypeLabel(profile.careType);
  const days = formatScheduleDays(profile.schedule);
  if (care || days) {
    const both = [care, days].filter(Boolean).join(", ");
    metas.push({ color: ACCENT.schedule, primary: care || days, secondary: care ? days : "", text: both });
  }

  const area = profile.location?.neighborhood || profile.location?.city;
  if (area) {
    const city =
      profile.location?.neighborhood && profile.location?.city ? profile.location.city : "";
    metas.push({
      color: ACCENT.location,
      primary: area,
      secondary: city,
      text: [area, city].filter(Boolean).join(", "),
    });
  }

  // The per-family share leads and a solo rate follows it, matching
  // SharedProfileCard: the number a reader is deciding on is their own side of
  // the split, and it is the smaller of the two. Families have no solo rate —
  // they state what they pay, not what a caregiver charges alone.
  const rateSet = (rate) => Boolean(rate) && rate !== "N/A" && rate;
  const ratePrimary = rateSet(profile.sharedRate);
  const soloRate = rateSet(profile.soloRate);
  if (ratePrimary || soloRate) {
    const rateSecondary = soloRate ? `${soloRate} on their own` : "";
    metas.push({
      color: ACCENT.rate,
      primary: ratePrimary || rateSecondary,
      secondary: ratePrimary ? rateSecondary : "",
      // The per-family wording is already in the string, so it reads on its own.
      text: ratePrimary || rateSecondary,
    });
  }

  if (profile.hosting) {
    const hosting = formatHostingLabel(profile.hosting);
    metas.push({
      color: ACCENT.hosting,
      primary: "Hosting",
      secondary: hosting,
      text: hosting,
    });
  }

  const start = formatStartDate(profile.start);
  if (start) {
    // Families and placed nannies describe when the share begins; a nanny
    // without a family describes when they are free.
    const label = quotesCombinedRate ? "Available" : "Starting";
    metas.push({
      color: ACCENT.start,
      primary: label,
      secondary: start,
      text: `${label} ${start}`,
    });
  }

  return { variant, badge: { role: goal.role, goal: goal.goal, theme: goal.theme }, subject, metas };
};

/* The one-line summary under a link preview. Same facts as the card, flattened
   and separated by middots — the order someone skimming a parents' group weighs
   them: who it's for, when, how much, where, from when. */
export const buildShareDescription = (model) => {
  const parts = model.subject ? [model.subject] : [];
  for (const meta of model.metas) parts.push(meta.text);
  return parts.filter(Boolean).join(" · ");
};
