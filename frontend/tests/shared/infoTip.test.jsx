import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InfoTip from "@shared/ui/InfoTip";

const HINT = "What one family pays per hour in the share.";

// `delay: null` drops user-event's setTimeout between each synthetic event.
// With the default delay these tests pass alone and intermittently time out in
// the full suite, where 21 other files are competing for the same cores — the
// tooltip is not slow, the event chain is just queued behind everything else.
const tap = () => userEvent.setup({ delay: null });

// Radix mounts the content through a portal, so it arrives a tick after the
// click. The generous timeout is for the same contention, not for the widget.
const tooltip = () => screen.findByRole("tooltip", {}, { timeout: 5000 });

describe("InfoTip", () => {
  it("renders nothing when there is no hint to give", () => {
    const { container } = render(<InfoTip text="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens on a tap, because these are read on a phone", async () => {
    // Radix opens a tooltip on hover and on keyboard focus, and a phone has
    // neither — so without the click handler the ⓘ would be inert on exactly
    // the devices most of these cards are read on.
    const user = tap();
    render(<InfoTip text={HINT} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: HINT }));
    expect(await tooltip()).toHaveTextContent(HINT);
  });

  it("closes on a second tap", async () => {
    // Radix's own trigger closes the tooltip on pointerdown, so a naive toggle
    // reads `open: false` by the time the click lands and re-opens every time.
    const user = tap();
    render(<InfoTip text={HINT} />);

    const trigger = screen.getByRole("button", { name: HINT });
    await user.click(trigger);
    expect(await tooltip()).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not let the tap reach the card underneath", async () => {
    // Several of these sit inside browse cards that navigate on click. Asking
    // what a rate means must not open somebody's profile.
    const user = tap();
    const openProfile = vi.fn();

    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onClick={openProfile}>
        <InfoTip text={HINT} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: HINT }));
    expect(openProfile).not.toHaveBeenCalled();
  });

  it("uses the light variant, which is what sits on these white cards", async () => {
    const user = tap();
    render(<InfoTip text={HINT} />);

    await user.click(screen.getByRole("button", { name: HINT }));
    const content = await tooltip();

    expect(content).toHaveClass("bg-background", "text-foreground", "border-border");
    expect(content).not.toHaveClass("bg-zinc-950");

    // Rounder than shadcn's default, to sit with the site's 10-20px boxes —
    // and `rounded-md` must be gone, not merely losing a specificity fight.
    expect(content).toHaveClass("rounded-xl");
    expect(content).not.toHaveClass("rounded-md");
  });
});
