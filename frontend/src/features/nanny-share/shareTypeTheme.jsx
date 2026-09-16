import { Users } from "lucide-react";
import { SHARE_TYPE_GOALS } from "@features/nanny-share/shareTypeGoals";

// Accent color themes + shared goal labels for each share-type / user goal.
//
// There are four goals, determined by role (Family / Nanny) plus whether the
// user already has a counterpart (a nanny to share, or a family they nanny for).
// Each gets its own accent pair, drawn from the accent colors already used in
// the profile banner (the meta-row icons). The profile banner badge
// (profileCard.jsx / profileList.jsx) and the "Share Type" filter
// (filterSlide.jsx) all read from this single source, so the colors, the
// wording AND the "Role • Goal" formatting stay identical everywhere.
//
// The data itself now lives in shareTypeGoals.js so the share-link functions can
// read it without dragging lucide-react into an edge bundle; it is re-exported
// here because this is the import path the app already uses.
export { SHARE_TYPE_GOALS };

// Shared renderer: "Role • Goal" with the faint separation dot. Used by both the
// profile banner badge and the filter chip so they read exactly the same.
// Expects to sit inside a flex container with a gap (the dot/role/goal are flex
// items) — both call sites use `inline-flex items-center gap-1.5`.
export const ShareTypeLabel = ({ role, goal }) => (
  <>
    <span className="Livvic-Bold font-bold">{role}</span>
    <span className="opacity-30">•</span>
    <span className="Livvic-Bold font-bold">{goal}</span>
  </>
);

// Fully-themed "Share Type" pill — icon + "Role • Goal" on the goal's accent
// colors. Keyed by variant (familyLooking | familyHasNanny | nannyLooking |
// nannyHasFamily). Used by the onboarding match cards.
export const ShareTypeBadge = ({ variant, className = "" }) => {
  const g = SHARE_TYPE_GOALS[variant];
  if (!g) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold Livvic-Bold rounded-full px-3 py-1 text-[11px] md:text-xs flex-shrink-0 ${className}`}
      style={{ backgroundColor: g.theme.bg, color: g.theme.text }}
    >
      <Users size={13} strokeWidth={2} className="flex-shrink-0" />
      <ShareTypeLabel role={g.role} goal={g.goal} />
    </span>
  );
};

// Accent (text) color for a variant — e.g. for a themed avatar background.
export const getVariantTheme = (variant) => SHARE_TYPE_GOALS[variant]?.theme;

// ── Profile banner helpers (keyed off the hasNanny / hasFamily booleans) ──
export const getFamilyTheme = (hasNanny) =>
  (hasNanny ? SHARE_TYPE_GOALS.familyHasNanny : SHARE_TYPE_GOALS.familyLooking).theme;
export const getNannyTheme = (hasFamily) =>
  (hasFamily ? SHARE_TYPE_GOALS.nannyHasFamily : SHARE_TYPE_GOALS.nannyLooking).theme;

export const getFamilyGoal = (hasNanny) =>
  (hasNanny ? SHARE_TYPE_GOALS.familyHasNanny : SHARE_TYPE_GOALS.familyLooking).goal;
export const getNannyGoal = (hasFamily) =>
  (hasFamily ? SHARE_TYPE_GOALS.nannyHasFamily : SHARE_TYPE_GOALS.nannyLooking).goal;

// ── Filter "Share Type" chips (keyed off the exact backend value strings) ──
export const SHARE_TYPE_OPTION_THEME = Object.fromEntries(
  Object.values(SHARE_TYPE_GOALS).map((g) => [g.value, g.theme])
);
