import React from "react";
import clsx from "classnames";

/* Layout primitives for the public marketing surface.
 *
 * These exist so a page reads as a list of sections rather than a pile of
 * wrapper divs each with its own padding. The vertical rhythm, the horizontal
 * gutter and the heading sizes all come from the `.fl-*` classes in index.css —
 * see the block comment there for the scale and why it looks like this.
 *
 * Pages should not hand-write section padding. If a layout genuinely doesn't
 * fit these, use `tone="none" size="flush"` and take over, rather than
 * inventing a new py-* value inline.
 */

/* Background bands. `none` leaves the background to whatever wraps the section,
 * which is what the hero pages need — their gradient/image lives on a parent. */
const TONES = {
  none: "",
  white: "bg-white",
  canvas: "bg-canvas",
  mist: "bg-mist",
  ink: "bg-ink text-white",
};

/* Vertical rhythm. `hero` clears the fixed Header; `flush` opts out entirely
 * for sections whose child already brings its own padding. */
const SIZES = {
  default: "fl-section-y",
  tight: "fl-section-y-tight",
  loose: "fl-section-y-loose",
  hero: "fl-hero-y",
  flush: "",
};

/**
 * A full-bleed background band with a width-capped, gutter-padded inner column.
 *
 * <Section tone="canvas" size="tight" id="coverage-map">…</Section>
 *
 * Set `container={false}` when the child needs the full bleed itself (a map, a
 * carousel that should run to the edge on mobile).
 */
/* forwardRef because callers scroll to sections by ref — ResourceCenter's
 * "Explore the resources" CTA scrolls to the calculator section. On a plain
 * function component that ref would silently stay null and the scroll would
 * no-op. */
export const Section = React.forwardRef(function Section(
  {
    as: Tag = "section",
    tone = "none",
    size = "default",
    container = true,
    className = "",
    containerClassName = "",
    children,
    ...rest
  },
  ref
) {
  const body = container ? (
    <div className={clsx("fl-container", containerClassName)}>{children}</div>
  ) : (
    children
  );

  return (
    <Tag
      ref={ref}
      className={clsx(TONES[tone] ?? "", SIZES[size] ?? SIZES.default, className)}
      {...rest}
    >
      {body}
    </Tag>
  );
});

/**
 * The heading block at the top of a section: optional eyebrow, a title, an
 * optional lede, and optional `actions` (a CTA that sits beside the heading on
 * wide screens and stacks under it on mobile).
 *
 * <SectionHeading
 *   title="Why families love nanny sharing"
 *   lede="Share a nanny and split the cost — without sacrificing quality."
 *   align="center"
 * />
 *
 * `align="center"` also caps the lede to `max-w-prose` so it wraps at a
 * readable measure instead of spanning the full 1280px column.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  as: Tag = "h2",
  /* Which step of the type scale the title uses. Sections are `fl-h2`; pass
   * "fl-h1" for the one heading that leads a page without a hero band. */
  titleClass = "fl-h2",
  eyebrowClass = "text-accent",
  className = "",
  titleClassName = "",
  ledeClassName = "",
  actions,
  children,
}) {
  const centered = align === "center";

  const heading = (
    <div className={clsx(centered && "text-center mx-auto max-w-heading")}>
      {eyebrow && (
        <p className={clsx("fl-eyebrow mb-3", eyebrowClass)}>{eyebrow}</p>
      )}
      {title && (
        <Tag className={clsx(titleClass, "text-ink", titleClassName)}>{title}</Tag>
      )}
      {lede && (
        <p
          className={clsx(
            "fl-lede mt-4",
            centered ? "mx-auto max-w-prose" : "max-w-prose",
            ledeClassName
          )}
        >
          {lede}
        </p>
      )}
      {children}
    </div>
  );

  if (!actions) {
    return <div className={clsx("fl-heading-gap", className)}>{heading}</div>;
  }

  return (
    <div
      className={clsx(
        "fl-heading-gap flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      {heading}
      <div className="shrink-0">{actions}</div>
    </div>
  );
}

/* Responsive card grid. Column counts step up with the viewport rather than
 * jumping straight from 1 to N, so a 3-up grid reads as 2-up on a tablet. */
const GRID_COLS = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 xs:grid-cols-2 lg:grid-cols-4",
};

export function CardGrid({ cols = 3, className = "", children, ...rest }) {
  return (
    <div className={clsx("grid gap-6", GRID_COLS[cols] ?? GRID_COLS[3], className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * The one card treatment. `interactive` adds the hover elevation — use it only
 * when the whole card is a link or button, so the lift means something.
 */
export function Card({
  as: Tag = "div",
  interactive = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag
      className={clsx(interactive ? "fl-card-interactive" : "fl-card", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Section;
