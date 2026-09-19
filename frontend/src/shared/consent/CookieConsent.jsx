import * as React from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

import { cn } from "@shared/lib/cn";
import { Switch } from "@shared/ui/switch";
import { COOKIE_CATEGORIES, allAccepted, essentialOnly } from "@shared/consent/categories";
import { writeConsent } from "@shared/consent/consentStore";

/**
 * The cookie consent panel, as a set of composable parts.
 *
 * Adapted from the Hirael cookie-consent block. The composition is the point:
 * the panel does not hard-code its own copy or category list, so the same
 * mechanics can render a different wording or an extra category without this
 * file growing a prop for each.
 *
 * WHAT WAS CHANGED ON THE WAY IN, AND WHY
 *
 *   Storage. The original owns a `storageKey` and reads it with
 *   `useSyncExternalStore`, with a server snapshot for SSR. This app is a Vite
 *   SPA with no server render, and it already has `consentStore` — which
 *   versions the record and keys it by category id rather than by position.
 *   Keeping two ideas of where consent lives would mean two answers to "has
 *   this person consented"; the parts below commit through the store, and
 *   `CookieConsentGate` remains the only thing that decides whether to ask.
 *
 *   The `Field` primitives. Those are shadcn's newer form wrappers, which this
 *   project does not have. A category row is a label, a description and a
 *   switch — adding three primitives to express that would be more code than
 *   the thing it expresses.
 *
 *   `aria-modal={false}` with `role="dialog"` is dropped in favour of
 *   `role="region"`. A dialog that is not modal and traps nothing is not a
 *   dialog, and announcing it as one tells a screen reader user they are in
 *   something they must dismiss before continuing. They are not.
 *
 * NO framer-motion, deliberately — see the note in CookieConsentGate about what
 * mounts site-wide.
 */

const CookieConsentContext = React.createContext(null);

const useCookieConsent = () => {
  const ctx = React.useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("CookieConsent parts must be used within <CookieConsent>");
  }
  return ctx;
};

/**
 * The panel shell and the state every part below reads.
 *
 * Categories register themselves on mount rather than being passed down, so
 * "accept all" means every category actually rendered — a category added to the
 * markup cannot be silently left out of the answer that gets stored.
 */
function CookieConsent({ className, children, categories = COOKIE_CATEGORIES, onAccept, onDecline }) {
  const [dismissed, setDismissed] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [prefs, setPrefs] = React.useState(() => essentialOnly(categories));

  const registered = React.useRef(new Map());

  const handlers = React.useRef({ onAccept, onDecline });
  React.useEffect(() => {
    handlers.current = { onAccept, onDecline };
  });

  const register = React.useCallback((category) => {
    registered.current.set(category.id, category);
    return () => registered.current.delete(category.id);
  }, []);

  const setPref = React.useCallback((id, checked) => {
    setPrefs((prev) => ({ ...prev, [id]: checked }));
  }, []);

  const commit = React.useCallback((next) => {
    writeConsent(next);
    setPrefs(next);
    setExpanded(false);
    setDismissed(true);
    handlers.current.onAccept?.(next);
  }, []);

  const acceptAll = React.useCallback(() => {
    const next = {};
    for (const { id } of registered.current.values()) next[id] = true;
    commit(Object.keys(next).length ? next : allAccepted(categories));
  }, [categories, commit]);

  const rejectAll = React.useCallback(() => {
    const next = {};
    for (const { id, required } of registered.current.values()) next[id] = Boolean(required);
    commit(Object.keys(next).length ? next : essentialOnly(categories));
    handlers.current.onDecline?.();
  }, [categories, commit]);

  const save = React.useCallback(() => {
    const next = {};
    for (const { id, required } of registered.current.values()) {
      // A required category is on whatever the switch says, because the switch
      // is disabled and cannot say otherwise — but this is also the guard that
      // stops a keyboard or a stale state from turning one off.
      next[id] = Boolean(required) || Boolean(prefs[id]);
    }
    commit(next);

    const refusedAll = [...registered.current.values()].every(
      ({ id, required }) => required || !prefs[id]
    );
    if (refusedAll) handlers.current.onDecline?.();
  }, [commit, prefs]);

  const value = React.useMemo(
    () => ({ prefs, setPref, expanded, setExpanded, register, acceptAll, rejectAll, save }),
    [prefs, setPref, expanded, register, acceptAll, rejectAll, save]
  );

  // Escape collapses the categories rather than dismissing the panel: the
  // question is still unanswered, and a key press is not an answer.
  const onKeyDown = (event) => {
    if (event.key === "Escape" && expanded) {
      event.stopPropagation();
      setExpanded(false);
    }
  };

  if (dismissed) return null;

  return (
    <CookieConsentContext.Provider value={value}>
      <div
        role="region"
        aria-label="Cookie preferences"
        data-slot="cookie-consent"
        data-expanded={expanded ? "" : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          // Above the sticky header (z-50) and its mobile menu (z-40).
          "fixed bottom-4 start-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-4",
          "rounded-2xl border border-line bg-white/95 p-5 text-ink shadow-card backdrop-blur",
          "animate-in fade-in-0 slide-in-from-bottom-4 duration-300 motion-reduce:animate-none",
          className
        )}
      >
        {children}
      </div>
    </CookieConsentContext.Provider>
  );
}

function CookieConsentTitle({ className, children, ...props }) {
  return (
    <h2
      data-slot="cookie-consent-title"
      className={cn("flex items-center gap-2 font-livvic-semibold text-sm text-ink", className)}
      {...props}
    >
      <Cookie aria-hidden="true" className="size-4 text-muted" />
      {children}
    </h2>
  );
}

function CookieConsentDescription({ className, ...props }) {
  return (
    <p
      data-slot="cookie-consent-description"
      className={cn("font-livvic-medium text-sm leading-relaxed text-muted", className)}
      {...props}
    />
  );
}

/** Expands the per-category switches. Hidden once they are showing. */
function CookieConsentManage({ className, children = "Manage", ...props }) {
  const { expanded, setExpanded } = useCookieConsent();
  if (expanded) return null;

  return (
    <button
      type="button"
      data-slot="cookie-consent-manage"
      aria-expanded={expanded}
      onClick={() => setExpanded(true)}
      className={cn(
        "cursor-pointer rounded-full px-3 py-1.5 font-livvic-semibold text-xs text-muted",
        "transition-colors hover:bg-canvas hover:text-ink",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Renders its categories only while the panel is expanded. */
function CookieConsentCategories({ className, ...props }) {
  const { expanded } = useCookieConsent();
  if (!expanded) return null;

  return (
    <div
      data-slot="cookie-consent-categories"
      className={cn(
        "flex flex-col divide-y divide-line rounded-xl border border-line bg-white",
        "animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

function CookieConsentCategory({ id, name, description, required = false, className, ...props }) {
  const { prefs, setPref, register } = useCookieConsent();

  React.useEffect(() => register({ id, required }), [register, id, required]);

  const checked = required || Boolean(prefs[id]);
  const switchId = `cookie-consent-${id}`;

  return (
    <div
      data-slot="cookie-consent-category"
      data-required={required ? "" : undefined}
      className={cn("flex items-start justify-between gap-4 p-3", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={switchId}
          className="flex items-center gap-2 font-livvic-semibold text-sm text-ink"
        >
          {name}
          {required && (
            <span className="font-livvic-medium text-[10px] uppercase tracking-[0.08em] text-muted">
              Always on
            </span>
          )}
        </label>
        {description && (
          <p className="font-livvic-medium text-xs leading-5 text-muted">{description}</p>
        )}
      </div>

      <Switch
        id={switchId}
        checked={checked}
        disabled={required}
        onCheckedChange={(next) => setPref(id, next)}
        aria-label={typeof name === "string" ? name : undefined}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

function CookieConsentActions({ className, ...props }) {
  return (
    <div
      data-slot="cookie-consent-actions"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

/* The three commit buttons. `accent` is the brand fill and carries ink text;
 * the outline pair sit on white so they read as the quieter choice without
 * being hard to find — which a consent banner's "reject" must never be. */
const BASE_BUTTON =
  "cursor-pointer rounded-full px-3.5 py-1.5 font-livvic-semibold text-xs transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30";
const FILLED = "bg-accent text-ink hover:bg-accent-strong";
const OUTLINE = "border border-line bg-white text-ink hover:bg-canvas";

function CookieConsentAcceptAll({ className, children = "Accept all", ...props }) {
  const { acceptAll } = useCookieConsent();
  return (
    <button
      type="button"
      data-slot="cookie-consent-accept-all"
      onClick={acceptAll}
      className={cn(BASE_BUTTON, FILLED, className)}
      {...props}
    >
      {children}
    </button>
  );
}

function CookieConsentRejectAll({ className, children = "Reject all", ...props }) {
  const { rejectAll } = useCookieConsent();
  return (
    <button
      type="button"
      data-slot="cookie-consent-reject-all"
      onClick={rejectAll}
      className={cn(BASE_BUTTON, OUTLINE, className)}
      {...props}
    >
      {children}
    </button>
  );
}

/** Saves the current switches. Only shown while the categories are expanded. */
function CookieConsentSave({ className, children = "Save choices", ...props }) {
  const { expanded, save } = useCookieConsent();
  if (!expanded) return null;

  return (
    <button
      type="button"
      data-slot="cookie-consent-save"
      onClick={save}
      className={cn(BASE_BUTTON, OUTLINE, className)}
      {...props}
    >
      {children}
    </button>
  );
}

/** A react-router Link, so the policy opens in-app rather than reloading it. */
function CookieConsentLink({ className, ...props }) {
  return (
    <Link
      data-slot="cookie-consent-link"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "text-xs text-muted underline underline-offset-4 transition-colors hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        className
      )}
      {...props}
    />
  );
}

export {
  CookieConsent,
  CookieConsentTitle,
  CookieConsentDescription,
  CookieConsentManage,
  CookieConsentCategories,
  CookieConsentCategory,
  CookieConsentActions,
  CookieConsentAcceptAll,
  CookieConsentRejectAll,
  CookieConsentSave,
  CookieConsentLink,
  useCookieConsent,
};
