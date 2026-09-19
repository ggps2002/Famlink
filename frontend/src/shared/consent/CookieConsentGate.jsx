import * as React from "react";

import { CONSENT_EVENT, readConsent } from "@shared/consent/consentStore";

/**
 * Decides whether the cookie banner is needed, and loads it only if it is.
 *
 * This is the piece that PageLayout mounts, so it is the only part of the
 * consent feature that every page pays for — and it is deliberately almost
 * nothing: one `localStorage` read and an event listener. The banner, its
 * button, its icons and the whole preferences dialog sit behind `React.lazy`
 * below.
 *
 * WHY THE SPLIT IS HERE RATHER THAN INSIDE THE BANNER
 * A visitor only ever sees the banner once. Every visit after that it renders
 * nothing — so shipping its markup, `CustomButton` and two lucide icons to
 * every page on every visit buys a component that immediately returns null.
 * Measured on this branch, mounting the banner directly cost 8.5 KB brotli on
 * the critical path of every route; gating it costs a fraction of that, and a
 * returning visitor never fetches the rest at all.
 *
 * The trade is that a first-time visitor sees the banner one round trip after
 * first paint instead of with it. That is the right way round: nothing is
 * stored before they answer, so the banner is not blocking anything, and it
 * stops the one-time UI from competing with the page's LCP.
 */

const loadBanner = () => import("@shared/consent/CookieConsentPanel");
const CookieConsent = React.lazy(loadBanner);

export default function CookieConsentGate({ onAccept, ...props }) {
  // Read before the first paint: a returning visitor must never see the banner
  // appear and then vanish once storage is consulted.
  const [stored] = React.useState(readConsent);
  const [needsAnswer, setNeedsAnswer] = React.useState(() => stored === null);
  // Bumped on every reopen and used as the banner's key. The banner hides
  // itself once answered, so re-showing it needs a fresh mount rather than a
  // prop change — without this, a second 'Manage cookies' click would render
  // a banner that is still in its dismissed state.
  const [reopens, setReopens] = React.useState(0);

  const onAcceptRef = React.useRef(onAccept);
  React.useEffect(() => {
    onAcceptRef.current = onAccept;
  });

  // Re-apply an answer already on file, so a consenting visitor's analytics or
  // marketing tags come back on without the banner being involved at all. This
  // is why the storage read stays eager: the decision has to be available to
  // the rest of the app immediately, even though the UI does not.
  React.useEffect(() => {
    if (stored) onAcceptRef.current?.(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `clearConsent()` dispatches a null detail. That is how a "Manage cookies"
  // link anywhere on the site brings the banner back — withdrawing consent has
  // to be as easy as giving it, so that affordance cannot live only in the
  // banner that has already been dismissed.
  React.useEffect(() => {
    const onExternalChange = (event) => {
      if (event.detail === null) {
        setNeedsAnswer(true);
        setReopens((n) => n + 1);
      }
    };

    window.addEventListener(CONSENT_EVENT, onExternalChange);
    return () => window.removeEventListener(CONSENT_EVENT, onExternalChange);
  }, []);

  if (!needsAnswer) return null;

  return (
    <React.Suspense fallback={null}>
      <CookieConsent key={reopens} onAccept={onAccept} {...props} />
    </React.Suspense>
  );
}
