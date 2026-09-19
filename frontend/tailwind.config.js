/** @type {import('tailwindcss').Config} */

import flowbite from "flowbite-react/tailwind"; // Import Flowbite plugin
import animate from "tailwindcss-animate";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    flowbite.content(), // Add Flowbite content paths
    "./src/**/*.css"
  ],
  theme: {
    extend: {
      // ── Design system tokens ────────────────────────────────────────────
      //
      // The marketing + city pages are built from these. See the `.fl-*`
      // typography and layout classes in src/index.css, and the <Section> /
      // <SectionHeading> / <Card> primitives in src/shared/ui/Section.jsx,
      // which are what pages should actually reach for.
      //
      // NAMING: deliberately avoids `primary` / `secondary` / `tertiary`.
      // src/index.css already defines `.text-primary`, `.bg-primary` and
      // friends as plain (unlayered) classes, so a token by the same name
      // would generate a utility that those classes silently beat. New names
      // never collide.

      colors: {
        // ── shadcn compatibility layer ────────────────────────────────────
        //
        // Components lifted from shadcn/ui (shared/ui/tooltip.jsx) are written
        // against `bg-background` / `text-foreground` / `border-border`. Only
        // the three the tooltip actually uses are mapped, and they resolve to
        // this project's own palette — `foreground` IS `ink`, `border` IS
        // `line` — so a borrowed component inherits the brand rather than
        // introducing a second one. Defined as CSS variables in index.css
        // because that is the hook shadcn components and their themes expect.
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",

        // Brand navy. Headings, hero bands, body text on light backgrounds.
        ink: "#001243",
        // The one muted body colour. Replaces the five that were in use
        // (#00000099, #666, #8A8E99, #555555, gray-500) — 5.7:1 on white.
        muted: "#666666",
        // Tertiary: metadata, captions, timestamps. Not for body copy.
        //
        // Was #8A8E99, which is 3.3:1 on white and 3.0:1 on `canvas` — under the
        // 4.5:1 WCAG AA needs for text this size, and Lighthouse failed it on the
        // chip subtitles and section eyebrows. #6B6F79 is 5.0:1 and 4.5:1. It sits
        // closer to `muted` than the old value did, which is the unavoidable part:
        // a tertiary grey lighter than roughly this cannot pass AA on either
        // background, so the tier is as light as it is allowed to be.
        subtle: "#6B6F79",
        // Beige section background — the de-facto brand backdrop.
        canvas: "#F6F3EE",
        // Cyan section background, used to break up long pages.
        mist: "#E7FCFF",
        // Hairline borders and dividers.
        line: "#EEEEEE",
        accent: {
          DEFAULT: "#AEC4FF", // primary CTA / brand blue
          strong: "#9DB8FF",  // its hover
          soft: "#DCE6FF",    // tinted fills, icon chips
          // The brand blue AS TEXT. #AEC4FF on white is 1.7:1 — it fails even the
          // 3:1 large-text threshold, and the homepage h1's second line was set
          // in it. This is the same hue, darkened until it passes (3.8:1).
          //
          // Use `accent` for fills, where contrast is carried by whatever sits on
          // top; use `accent-ink` whenever the accent IS the text.
          ink: "#5B7FE0",
        },
        // The two non-blue CTA colours. Same DEFAULT/strong shape as `accent`
        // so every CTA on the site hovers by shifting colour rather than by
        // fading with `hover:opacity-90` — four call sites used the fade and
        // two used the shift, which read as two different button systems.
        blossom: {
          DEFAULT: "#FFADE1", // pink CTA (Join Now)
          strong: "#FF97D7",  // its hover
          ink: "#3B0025",     // the plum label that sits on it — 9.4:1
        },
        aqua: {
          DEFAULT: "#94F3FF", // cyan CTA (View all Resources)
          strong: "#7BEEFF",  // its hover
        },
      },

      boxShadow: {
        "custom-shadow": `
          0px 2.71px 4.4px 0px #C0C0C007,
          0px 6.86px 11.12px 0px #C0C0C00A,
          0px 14px 22.68px 0px #C0C0C00C,
          0px 28.84px 46.72px 0px #C0C0C00F,
          0px 79px 128px 0px #C0C0C017,
          0px -4px 4px 0px #C0C0C017
        `,
        'soft': '0 0 12px 0 rgba(0, 0, 0, 0.08)',
        // Figma's "Light-shadow" style, used by every card on the profile
        // screens. Distinct from `soft` — the design is a tighter 8px blur at
        // 6%, and the two read differently side by side.
        'profile': '0 0 8px 0 rgba(0, 0, 0, 0.06)',
        // The one card elevation, plus its hover. Replaces the ad-hoc
        // shadow-[0_4px_20px_rgba(0,0,0,0.03)] arbitrary values.
        card: '0 4px 20px rgba(0, 18, 67, 0.04)',
        'card-hover': '0 8px 30px rgba(0, 18, 67, 0.08)',
      },

      fontFamily: {
        // The Livvic faces are separate files, not weights (see App.css
        // @font-face). Named `livvic-*` rather than `bold`/`medium` so they
        // never collide with Tailwind's font-WEIGHT utilities.
        livvic: ["Livvic", "sans-serif"],
        "livvic-medium": ["Livvic-Medium", "sans-serif"],
        "livvic-semibold": ["Livvic-SemiBold", "sans-serif"],
        "livvic-bold": ["Livvic-Bold", "sans-serif"],
      },

      screens: {
        // Small phones (320–479px) had no breakpoint of their own, so every
        // "mobile" style was really a 375px style. This is the step below `sm`.
        xs: "480px",
        // NOTE: `2xl` overrides Tailwind's 1536px default. 21 files under
        // features/dashboard, features/nanny-share/browse and
        // features/nanny-share/profile-views target it at 1920px; changing it
        // would move those layouts, so it stays.
        "2xl": "1920px",
        "3xl": "2560px", // was a duplicate of 2xl and unused
      },

      maxWidth: {
        // Measure caps. Long-form prose past ~70ch gets hard to track.
        prose: "42rem",     // 672px — section ledes, article body
        heading: "56rem",   // 896px — display headings
      },

      keyframes: {
        glow: {
          "0%, 100%": {
            textShadow: "0 0 10px #FACC15, 0 0 20px #38bdf8",
            color: "#4B5563",
          },
          "50%": {
            textShadow: "0 0 20px #FFBF00, 0 0 30px #0ea5e9",
            color: "#374151",
          },
        },
      },
      animation: {
        glow: "glow 2s ease-in-out infinite",
      },
    }, // Add any theme extensions here
  },
  plugins: [
    flowbite.plugin(), // Include the Flowbite plugin
    // `animate-in` / `fade-in-0` / `zoom-in-95` / `slide-in-from-*`, which every
    // shadcn overlay (tooltip, dialog, popover) is styled with. This is the
    // Tailwind 3 plugin; the `tw-animate-css` import in shadcn's docs is the
    // Tailwind 4 replacement and does not apply here.
    animate,
  ],
};
