// Who may send a match request, and what to show them when they may not.
//
// Two different walls, and they are not interchangeable:
//
//   Families (Parents)                  → one free request, then subscribe
//   Caregivers with a family already    → subscribe
//   Caregivers looking for a share job  → one free request, then refer a friend
//
// That last group pays nothing ever. Each friend who signs up with their link
// grants a calendar month of matching, tracked on the user as
// referralMatchingUntil. See backend Services/utils/referral.js.
//
// This mirrors the server check in Controllers/match.controller.js requestMatch.
// The server is authoritative — this only exists so the UI can lock the button
// and show the right modal instead of firing a request that comes back 403.

export const MATCH_GATE = {
  ALLOWED: null,
  SUBSCRIBE: "subscribe",
  REFER: "refer",
};

// True while the user's referral-earned months still cover them.
export const hasActiveReferralMatching = (user) =>
  Boolean(user?.referralMatchingUntil) &&
  new Date(user.referralMatchingUntil).getTime() > Date.now();

// hasFamily can be a boolean or the string "true"/"false" depending on which
// save path wrote the profile (FormData submissions stringify it). Normalise to
// a real boolean, and separately track whether it's known at all — an unloaded
// profile must not be mistaken for a caregiver.
const hasFamilyTrue = (profile) =>
  profile?.hasFamily === true || profile?.hasFamily === "true";
const hasFamilyKnown = (profile) =>
  profile != null && profile.hasFamily !== undefined && profile.hasFamily !== null;

// A caregiver looking for a share position — the referral audience. `profile` is
// the viewer's own nanny profile (state.postNannyShare.currentProfile), since
// hasFamily lives there and not on the user.
//
// Requires hasFamily to be known (loaded) and false: a profile that hasn't
// loaded yet, or predates the field, must not be treated as gated.
export const isReferralCaregiver = (user, profile) =>
  user?.type === "Nanny" && hasFamilyKnown(profile) && !hasFamilyTrue(profile);

// Which wall (if any) stands between this user and sending a request.
// Returns one of MATCH_GATE.
export const getMatchGate = (user, profile) => {
  if (!user) return MATCH_GATE.ALLOWED;

  // A paid subscription clears every wall, including the referral one — a
  // caregiver who chose to subscribe shouldn't be pushed back to referring.
  if (user.premium) return MATCH_GATE.ALLOWED;

  const freeMatchUsed = (user.matchRequestsSent || 0) > 0;

  if (user.type === "Parents") {
    return freeMatchUsed ? MATCH_GATE.SUBSCRIBE : MATCH_GATE.ALLOWED;
  }

  if (user.type === "Nanny") {
    if (isReferralCaregiver(user, profile)) {
      // One free match, exactly like a family — then the referral wall.
      if (!freeMatchUsed) return MATCH_GATE.ALLOWED;
      return hasActiveReferralMatching(user) ? MATCH_GATE.ALLOWED : MATCH_GATE.REFER;
    }
    // Nanny who already has a family — unchanged, still the subscription wall.
    // Normalised so a stringy "true" isn't misread (and a stringy "false" isn't
    // treated as truthy, which would wrongly show the subscribe wall).
    if (hasFamilyTrue(profile)) return MATCH_GATE.SUBSCRIBE;
  }

  return MATCH_GATE.ALLOWED;
};

// Convenience for the card lock icons, which only care that something blocks.
export const isMatchGated = (user, profile) =>
  getMatchGate(user, profile) !== MATCH_GATE.ALLOWED;
