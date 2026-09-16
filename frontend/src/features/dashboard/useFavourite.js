import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addOrRemoveFavouriteThunk } from "@features/dashboard/store/favouriteSlice";
import { refreshTokenThunk } from "@features/auth/store/authSlice";
import { fireToastMessage } from "@shared/ui/toast";

/**
 * The heart on a card: is this id saved, and the handler that toggles it.
 *
 * One hook rather than a copy per card, because the three copies this replaces
 * shared two bugs and only the second is obvious.
 *
 * The first: the saved state was read into `useState` once and never again. The
 * access token is no longer persisted, so every reload re-fetches the user and
 * `favourite` arrives AFTER the cards have mounted — which meant a cold load
 * drew every heart empty, however many profiles were actually saved. Reading it
 * from the store and syncing on change is what fixes that.
 *
 * The second: the toggle was fire-and-forget. A refused or failed save left the
 * heart red, so the member believed the profile was in their favourites and
 * found it missing there later.
 *
 * @param {string} id  the saved id — a member's user id from a profile card, or
 *                     a job post's id from a listing card. Both live in the
 *                     same `favourite` array; see the favourite service.
 */
export const useFavourite = (id) => {
  const dispatch = useDispatch();
  const { user, accessToken } = useSelector((state) => state.auth);

  // `favourite` mixes ObjectIds and strings, so compare stringified on both
  // sides — `includes` on the raw array misses whenever the two disagree.
  const isSaved = Boolean(
    user?.favourite?.some((entry) => String(entry) === String(id))
  );

  const [isFavorited, setIsFavorited] = useState(isSaved);

  useEffect(() => {
    setIsFavorited(isSaved);
  }, [isSaved]);

  const toggleFavourite = useCallback(
    async (event) => {
      // Cards are wrapped in links; without this, saving one navigates to it.
      event?.stopPropagation?.();
      event?.preventDefault?.();
      if (!id) return;

      // Fill the heart first. The round trip is two requests long — the toggle,
      // then the token refresh that re-reads the list — and a heart that waits
      // for both reads as a dead button.
      setIsFavorited((previous) => !previous);

      try {
        await dispatch(
          addOrRemoveFavouriteThunk({ favouriteUserId: id, accessToken })
        ).unwrap();
        // Refreshes `user.favourite`, which every other card on the page reads:
        // saving someone here fills their heart wherever else they appear.
        await dispatch(refreshTokenThunk());
      } catch (error) {
        setIsFavorited((previous) => !previous);
        fireToastMessage({
          type: "error",
          message: error?.message || "Couldn't update your favourites.",
        });
      }
    },
    [dispatch, id, accessToken]
  );

  return { isFavorited, toggleFavourite };
};

export default useFavourite;
