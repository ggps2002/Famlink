import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, CookieIcon } from "lucide-react";

import CustomButton from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
import { COOKIE_CATEGORIES, allAccepted, essentialOnly } from "@shared/consent/categories";
import { writeConsent } from "@shared/consent/consentStore";

/**
 * The cookie consent banner.
 *
 * Only ever rendered by `CookieConsentGate`, and only when the visitor has no
 * answer on file — so this component may assume it is being shown, and does not
 * read storage itself. Everything about when to ask lives in the gate.
 *
 * Two deliberate omissions from the component this was ported from:
 *
 *   1. NO framer-motion. Upstream animates the banner with `motion.div` and
 *      `AnimatePresence`. Today that would be free — `NannyShareLanding` is
 *      statically imported by App.jsx and reaches framer-motion through
 *      `landing/HowItWorks`, so the library is already in the entry chunk. The
 *      point is that this is the only thing keeping it there. Lazy-loading the
 *      landing page is an obvious future win, and on that day a banner that
 *      mounts site-wide would be the one import dragging the whole library
 *      back onto the critical path, with nothing at the call site to explain
 *      why. The entrance below is `tailwindcss-animate` utilities — plain CSS
 *      the stylesheet already carries — so this component has no opinion about
 *      where framer-motion lives.
 *
 *   2. NO `mounted` flag. Upstream needs one because Next.js renders it on the
 *      server, where `localStorage` does not exist and a first client render
 *      that disagreed with the server's HTML would be a hydration error. This
 *      is a Vite SPA with no SSR.
 *
 * The preferences dialog is `React.lazy`: Radix's dialog, switch, label and
 * tooltip only load if someone clicks "Customize". See the header comment in
 * `CookiePreferencesDialog.jsx` before moving any import across that line.
 */

const loadPreferencesDialog = () => import("@shared/consent/CookiePreferencesDialog");
const CookiePreferencesDialog = React.lazy(loadPreferencesDialog);

function CookieConsent({
  className,
  categories = COOKIE_CATEGORIES,
  cookiePolicyUrl = "/terms-and-conditions",
  onAccept,
  onDecline,
}) {
  const [dismissed, setDismissed] = React.useState(false);
  const [showDialog, setShowDialog] = React.useState(false);
  const [preferences, setPreferences] = React.useState(() => essentialOnly(categories));

  // Callbacks go through a ref so the commit handlers below can depend on
  // nothing that changes per render. Upstream listed `onAccept` in an effect's
  // deps, which re-runs — and re-fires the callback — on every render of any
  // parent passing an inline arrow function, i.e. the common case.
  const handlers = React.useRef({ onAccept, onDecline });
  React.useEffect(() => {
    handlers.current = { onAccept, onDecline };
  });

  const commit = React.useCallback((prefs) => {
    writeConsent(prefs);
    setPreferences(prefs);
    setShowDialog(false);
    setDismissed(true);
    handlers.current.onAccept?.(prefs);
  }, []);

  const handleAcceptAll = React.useCallback(
    () => commit(allAccepted(categories)),
    [categories, commit],
  );

  const handleRejectAll = React.useCallback(() => {
    commit(essentialOnly(categories));
    handlers.current.onDecline?.();
  }, [categories, commit]);

  const handleSaveCustom = React.useCallback(() => commit(preferences), [commit, preferences]);

  const handleToggle = React.useCallback(
    (categoryId, checked) => {
      // Essential cookies are not a choice, so refuse the write here rather
      // than relying on the switch being disabled — this is also reachable
      // from the keyboard and from anything else that calls it.
      if (categories.find((c) => c.id === categoryId)?.isEssential) return;
      setPreferences((prev) => ({ ...prev, [categoryId]: checked }));
    },
    [categories],
  );

  if (dismissed) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Cookie preferences"
        className={cn(
          // Above the sticky header (z-50) and its mobile menu (z-40), below
          // the preferences dialog (z-100) that opens from it.
          "fixed inset-x-0 bottom-0 z-[60] w-full sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md",
          "animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
          className,
        )}
      >
        <div className="m-3 rounded-3xl border border-line bg-white/95 shadow-card backdrop-blur-lg">
          <div className="flex items-center gap-3 p-6 pb-4">
            <div className="rounded-xl bg-accent-soft p-2">
              <CookieIcon className="h-5 w-5 text-ink" />
            </div>
            <h2 className="font-livvic-semibold text-lg text-ink">Cookie preferences</h2>
          </div>

          <div className="px-6 pb-4">
            <p className="fl-small mb-4">
              We use cookies to keep you signed in, understand how Famlink is used, and show
              families relevant content.
            </p>
            <Link
              to={cookiePolicyUrl}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="group inline-flex items-center font-livvic-medium text-xs text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
            >
              Read our cookie policy
              <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="flex flex-col gap-3 rounded-b-3xl border-t border-line bg-canvas/60 p-4 sm:flex-row">
            <CustomButton
              btnText="Accept all"
              action={handleAcceptAll}
              className="w-full bg-accent text-sm text-ink transition-colors hover:bg-accent-strong sm:flex-1"
            />
            <CustomButton
              btnText="Customize"
              action={() => setShowDialog(true)}
              // Start fetching the dialog chunk on intent rather than on the
              // click, so the panel opens immediately instead of after a round
              // trip. Repeat calls are free — the import is cached.
              onMouseEnter={loadPreferencesDialog}
              onFocus={loadPreferencesDialog}
              className="w-full border border-line bg-white text-sm text-ink transition-colors hover:bg-canvas sm:flex-1"
            />
          </div>
        </div>
      </div>

      {/* Not rendered until "Customize" is clicked, so the chunk is not
          requested by simply showing the banner. */}
      {showDialog && (
        <React.Suspense fallback={null}>
          <CookiePreferencesDialog
            open={showDialog}
            onOpenChange={setShowDialog}
            categories={categories}
            preferences={preferences}
            onToggle={handleToggle}
            onSave={handleSaveCustom}
            onRejectAll={handleRejectAll}
          />
        </React.Suspense>
      )}
    </>
  );
}

export { CookieConsent };
export default CookieConsent;
