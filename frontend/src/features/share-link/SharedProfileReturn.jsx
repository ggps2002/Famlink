import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { api } from "@shared/api/client";
import {
  getStoredSharedProfile,
  clearStoredSharedProfile,
} from "@features/share-link/sharedProfileRef";

// Closes the loop a shared link opens.
//
// Share → view the opportunity → join FamLink → see if it's a match → connect.
// The middle of that is long: a new arrival picks a role, answers a
// questionnaire, registers, and finishes a profile, by which point the share
// that brought them here is several screens behind them. Landing them on the
// general dashboard at that moment means asking them to go hunt for it, and
// most won't.
//
// So the moment their profile is complete, this takes them back to the profile
// they came for — once. Rendering nothing itself; it exists for the effect.

export default function SharedProfileReturn() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  // Effects can re-run (StrictMode double-invokes them in development, and the
  // auth user object is replaced on every token refresh). The token is cleared
  // before navigating, but this guard means we never fire two navigations off
  // one stored token even if two runs read it before either clears it.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const token = getStoredSharedProfile();
    if (!token) return;

    // Still onboarding — keep the token parked. They can't request a match
    // without a profile, so sending them to the share now would only show them
    // a locked button.
    if (!user?.nannyProfileCompleted) return;

    handled.current = true;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/share/public/${encodeURIComponent(token)}`);
        const shared = data?.data;
        clearStoredSharedProfile();
        if (cancelled || !shared?.ownerId) return;

        // Someone who opened their own link, or the rare case where the share's
        // owner is the person now signing in. Nothing to return them to.
        if (shared.ownerId === user._id) return;

        navigate(
          shared.role === "Family"
            ? `/dashboard/family-profile-view/${shared.ownerId}`
            : `/dashboard/nanny-profile-view/${shared.ownerId}`
        );
      } catch {
        // The share was deleted, or the request failed. Drop the token rather
        // than retrying on every dashboard visit — the user is already where
        // they can search, and a silent no-op beats a recurring error.
        clearStoredSharedProfile();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, user?._id, user?.nannyProfileCompleted]);

  return null;
}
