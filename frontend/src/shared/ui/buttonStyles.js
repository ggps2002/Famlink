// Shared button styling for the dashboard + settings surfaces.
//
// The settings panels had each grown their own button look (35px pills, Livvic-Bold,
// white-on-blue, rounded-3xl...), none of which matched the dashboard. One definition
// lives here now: Livvic-Medium, text-primary (#001243) on bg-primary (#AEC4FF),
// gently rounded, with a slight hover shift. `bg-primary` / `text-primary` are the
// project's own tokens (see index.css) — use these constants rather than re-typing
// hex values.

const BASE = "Livvic-Medium rounded-xl px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

/* Filled, for the main action in a panel (Save, Upgrade, Verify). */
export const BTN_PRIMARY = `${BASE} bg-primary text-primary hover:bg-[#9DB8FF]`;

/* Outlined, for the way out (Discard, Cancel). */
export const BTN_SECONDARY = `${BASE} border border-[#EEEEEE] text-[#555555] hover:bg-[#F5F5F5]`;

/* Destructive, only where the action really is destructive. */
export const BTN_DANGER = `${BASE} bg-[#FF8484] text-white hover:bg-[#F97070]`;

/* antd's <Button> ships its own hover/border rules that beat plain utilities,
   so those two variants need `!` overrides and an auto height to respect padding. */
export const BTN_PRIMARY_ANTD = `${BTN_PRIMARY} h-auto border-none hover:!bg-[#9DB8FF] hover:!text-[#001243] hover:!border-none`;
export const BTN_SECONDARY_ANTD = `${BTN_SECONDARY} h-auto hover:!bg-[#F5F5F5] hover:!text-[#555555] hover:!border-[#EEEEEE]`;
