// ⚠️ This module runs in Node as well as in the browser: it is reachable from
// api/ (Vercel serverless functions) and/or scripts/ (the build step), neither
// of which resolves the "@" aliases — those exist only inside Vite. Import to
// and from this file with relative paths that include the file extension.
// tests/architecture/aliases.test.js fails the build if that stops being true.

// Copy for the public share page, keyed by the four share types.
//
// The framing matters as much as the wording: a shared page is FamLink
// presenting an available nanny share, not a member advertising themselves.
// That's why every headline names what the share is *missing* ("Another family
// needed") rather than who is asking, and why the subheadline spells out the
// arithmetic — a reader who has never heard of a nanny share needs to see that
// it takes two families and one nanny before the CTA means anything.
//
// The variant keys match src/Config/shareTypeTheme.jsx and the `variant` the
// backend puts on the public payload (Services/utils/shareProfile.js).
//
// `shareText` takes the neighborhood because "in Rockridge" is what makes
// someone stop scrolling a Facebook group — each variant slots it in itself
// rather than having a caller splice it into a finished sentence.

export const SHARE_PROFILE_COPY = {
  // A family with no nanny and no share partner yet.
  familyLooking: {
    headline: "Another family needed to build a share. 🧩",
    subheadline: "Family + Another Family + Nanny = Nanny Share",
    cta: "See If It's a Match",
    shareText: (area) =>
      `A local family${area ? ` in ${area}` : ""} is looking for another family to build a nanny share with.`,
  },

  // A family that already employs a nanny and wants a second family in.
  familyHasNanny: {
    headline: "One more family needed to build a share. 🧩",
    subheadline: "Family + Nanny + Your Family = Nanny Share",
    cta: "See If Your Family Fits",
    shareText: (area) =>
      `A family${area ? ` in ${area}` : ""} already has a nanny and is looking for one more family to share with.`,
  },

  // A caregiver with no family yet — the only type that needs two families.
  nannyLooking: {
    headline: "Two families needed to build a share. 🧩",
    subheadline: "Your Family + Another Family + Nanny = Nanny Share",
    cta: "Build a Nanny Share",
    shareText: (area) =>
      `A nanny${area ? ` in ${area}` : ""} is available for a nanny share position.`,
  },

  // A caregiver already placed with one family, looking for the second.
  nannyHasFamily: {
    headline: "One more family needed to build a share. 🧩",
    subheadline: "Nanny + Family + Your Family = Nanny Share",
    cta: "See If Your Family Fits",
    shareText: (area) =>
      `A nanny${area ? ` in ${area}` : ""} and the family they work with are looking for one more family to join their share.`,
  },
};

// Falls back to the plain family case rather than rendering a page with no
// headline: a share type we somehow can't classify is still a real opportunity.
export const getShareProfileCopy = (variant) =>
  SHARE_PROFILE_COPY[variant] || SHARE_PROFILE_COPY.familyLooking;

// Resolve the variant from a profile the way the backend does, for the moment
// before the server payload has arrived (the share sheet previews the owner's
// own card from state it already has).
export const resolveShareVariant = (userType, profile) => {
  const asBool = (v) => v === true || v === "true";
  if (userType === "Parents") {
    return asBool(profile?.hasNanny) ? "familyHasNanny" : "familyLooking";
  }
  return asBool(profile?.hasFamily) ? "nannyHasFamily" : "nannyLooking";
};

// The message body for a text, a Nextdoor post, or the native share sheet.
// The link travels separately (as `url` for navigator.share, appended for the
// URL-scheme links), so this never embeds it.
export const shareMessageFor = (variant, location) => {
  const area = location?.neighborhood || location?.city || null;
  return `${getShareProfileCopy(variant).shareText(area)} See the details on FamLink:`;
};
