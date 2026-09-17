/**
 * The "Customize" half of the cookie banner: one row per category, each with a
 * switch, and the two buttons that commit the choice.
 *
 * WHY THIS IS ITS OWN FILE
 * It is loaded with `React.lazy` from `CookieConsent.jsx`, and the file
 * boundary is the chunk boundary. Everything expensive about the consent UI —
 * Radix's dialog (with its focus trap, portal and scroll lock), the switch, the
 * label and the tooltip — is imported here and nowhere else, so a visitor who
 * clicks "Accept All" or ignores the banner entirely never downloads any of it.
 * The banner itself mounts on every route including "/", which is the page the
 * whole critical path was measured against; see the note in CookieConsent.jsx.
 *
 * Keep the Radix imports in this file. Hoisting any of them into the banner to
 * "tidy up" puts them straight back on the first paint of every page.
 */
import { BarChart3, CookieIcon, ShieldCheck, Target } from "lucide-react";

import CustomButton from "@shared/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Label } from "@shared/ui/label";
import { Switch } from "@shared/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@shared/ui/tooltip";
import { cn } from "@shared/lib/cn";

/**
 * Icons for the built-in categories, keyed by id.
 *
 * They live in this lazy chunk rather than beside the category data in
 * `categories.js`, because that module is imported by the banner and therefore
 * by every page. These are only ever painted inside this dialog, so keeping
 * them here means a visitor who never opens it never downloads them.
 *
 * A caller passing its own `categories` can still supply `icon` per category;
 * that wins, and anything unmatched falls back to the generic cookie.
 */
const DEFAULT_ICONS = {
  essential: <ShieldCheck className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  marketing: <Target className="h-4 w-4" />,
};

export default function CookiePreferencesDialog({
  open,
  onOpenChange,
  categories,
  preferences,
  onToggle,
  onSave,
  onRejectAll,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] gap-0 p-0">
        <DialogHeader className="border-b border-line p-6 pb-4">
          <DialogTitle>Manage cookies</DialogTitle>
          <DialogDescription>
            Choose what Famlink may store on your device. You can change this at any time.
          </DialogDescription>
        </DialogHeader>

        {/* Capped so a long category list scrolls inside the panel rather than
            pushing the footer buttons off a short screen. */}
        <div className="max-h-[calc(100vh-18rem)] space-y-3 overflow-y-auto px-6 py-6 thin-scrollbar">
          {categories.map((category) => {
            const enabled = Boolean(preferences[category.id]);
            const inputId = `cookie-${category.id}`;

            return (
              <div
                key={category.id}
                className={cn(
                  "rounded-2xl border p-4 transition-colors duration-200",
                  enabled ? "border-accent bg-accent-soft/40" : "border-line hover:border-[#DDDDDD]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "shrink-0 rounded-xl p-2 transition-colors",
                        enabled ? "bg-accent-soft text-ink" : "bg-canvas text-muted",
                      )}
                    >
                      {category.icon || DEFAULT_ICONS[category.id] || <CookieIcon className="h-4 w-4" />}
                    </div>

                    <Label htmlFor={inputId} className="cursor-pointer text-base">
                      {category.name}
                      {category.isEssential && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* A span, not a button: it sits inside a <label>,
                                where a nested control would steal the click
                                that is supposed to reach the switch. */}
                            <span
                              tabIndex={0}
                              className="ml-2 inline-flex items-center rounded-full bg-white px-2 py-0.5 font-livvic-medium text-xs text-muted ring-1 ring-line"
                            >
                              Always on
                            </span>
                          </TooltipTrigger>
                          <TooltipContent variant="light">
                            <p className="max-w-[15rem]">
                              These keep you signed in and the site secure, so they cannot be
                              switched off.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </Label>
                  </div>

                  <Switch
                    id={inputId}
                    checked={enabled}
                    onCheckedChange={(checked) => onToggle(category.id, checked)}
                    disabled={category.isEssential}
                    aria-label={category.name}
                  />
                </div>

                <p className="fl-small mt-3">{category.description}</p>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-3 border-t border-line bg-canvas/60 p-6 sm:space-x-0">
          <CustomButton
            btnText="Reject all"
            action={onRejectAll}
            className="w-full border border-line bg-white text-sm text-ink transition-colors hover:bg-canvas sm:w-auto"
          />
          <CustomButton
            btnText="Save preferences"
            action={onSave}
            className="w-full bg-accent text-sm text-ink transition-colors hover:bg-accent-strong sm:w-auto"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
