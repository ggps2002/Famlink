import { useEffect } from "react";

/**
 * The one place that takes the page's scroll away, and the only one allowed to.
 *
 * WHY THIS EXISTS
 *
 * Six components used to write `document.body.style.overflow` by hand. Two of
 * them — the marketing header's hamburger menu and the city-search header's —
 * did it in an effect with no cleanup:
 *
 *     useEffect(() => {
 *       document.body.style.overflow = isMenuOpen ? "hidden" : "";
 *     }, [isMenuOpen]);
 *
 * That is only correct while the component stays mounted. Tapping a link inside
 * the open menu navigates, React unmounts the header mid-lock, and the effect
 * that would have written `overflow` back never runs again. The body stays
 * locked for the rest of the session, across every route the SPA renders
 * afterwards — which is how a phone could land on /dashboard unable to scroll
 * at all, with nothing on that screen to blame for it. Desktop never saw it
 * because the hamburger is `lg:hidden`.
 *
 * WHAT THE COUNT IS FOR
 *
 * Two locks can be open at once — a modal over a menu — and the first one to
 * close must not unlock the page under the second. Releases are counted, and
 * only the last one restores.
 *
 * WHAT `restore` IS FOR
 *
 * The old call sites spelled "unlocked" three different ways: "", "unset" and
 * "auto". Those are not the same value, and none of them is necessarily what
 * the element had before. The previous value is captured on the first lock and
 * put back on the last release, so locking is reversible rather than
 * approximately reversible.
 *
 * Enforced by tests/architecture/bodyScrollLock.test.js, which fails if any
 * other file assigns to `document.body.style.overflow`.
 */

let depth = 0;
let restore = "";

/**
 * Locks the page and hands back the matching release.
 *
 * The release is idempotent — calling it twice does not decrement twice, which
 * matters because React may run an effect's cleanup and then the effect again
 * (StrictMode does exactly this in development).
 */
export function lockBodyScroll() {
  if (typeof document === "undefined") return () => {};

  if (depth === 0) {
    restore = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  depth += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth -= 1;
    if (depth === 0) document.body.style.overflow = restore;
  };
}

/**
 * Locks the page for as long as `active` is true AND this component is mounted.
 *
 * The second half is the part the hand-written versions kept missing: an
 * unmount releases the lock, so a component can be torn down mid-lock — by a
 * navigation, a parent re-render, a route change — without stranding the page.
 *
 * @param {boolean} active  whether the lock should be held right now.
 */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    return lockBodyScroll();
  }, [active]);
}

export default useBodyScrollLock;
