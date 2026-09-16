import { toPublicUser } from "../user/user.privacy.js";

/**
 * Turns stored documents into the shapes the client receives.
 *
 * Kept apart from the service because "what the rule is" and "what the JSON
 * looks like" change for different reasons, and only the latter is coupled to
 * the frontend's 35 Redux slices.
 */

/**
 * A match-request row as the other party may see it.
 *
 * Accepting a request opens an in-app chat — it does not hand over a contact
 * address — so the owner is reduced to the public projection here too, and the
 * share token stays private.
 */
export const toMatchCard = (profileDoc, extra) => {
  const src = typeof profileDoc?.toObject === "function" ? profileDoc.toObject() : profileDoc;
  const { shareToken: _shareToken, ...rest } = src || {};
  return { ...rest, userId: toPublicUser(src?.userId), ...extra };
};

/**
 * A short "2 children · Full-time · Looking for nanny" summary for the
 * sender/match cards in match emails, from whatever profile fields are present.
 */
export const buildProfileSummary = (profile, user) => {
  const parts = [];
  const num = profile?.numberOfChildren ?? user?.noOfChildren;
  const n = typeof num === "number" ? num : parseInt(num, 10);
  if (n && !Number.isNaN(n)) parts.push(`${n} ${n === 1 ? "child" : "children"}`);
  if (profile?.nannyShareType) parts.push(profile.nannyShareType);
  if (profile?.hasNanny != null) parts.push(profile.hasNanny ? "Has a nanny" : "Looking for nanny");
  return parts.join(" · ") || undefined;
};

/** The identity block the match emails render for the other party. */
export const toMatchEmailParty = (user, profile) => ({
  id: String(user._id),
  name: user.name,
  location: user.location?.neighborhood || user.location?.city || undefined,
  summary: buildProfileSummary(profile, user),
});
