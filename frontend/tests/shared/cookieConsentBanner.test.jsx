import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import CookieConsentGate from "@shared/consent/CookieConsentGate";
import { clearConsent, hasConsent, readConsent, writeConsent } from "@shared/consent/consentStore";

/**
 * The gate decides whether anyone is asked at all, so the cases worth pinning
 * are the ones where it gets that wrong: showing the panel to someone who has
 * already answered, or failing to show it to someone who has not.
 *
 * The panel is lazy, so every assertion about it goes through `findBy*` — a
 * `getBy*` would run before the chunk resolved and fail for the wrong reason.
 *
 * The switches only exist while the panel is expanded; the collapsed panel does
 * not render them at all. "Not expanded" is therefore asserted as "not in the
 * document", not as "hidden".
 */

const renderGate = (props = {}) =>
  render(
    <MemoryRouter>
      <CookieConsentGate {...props} />
    </MemoryRouter>
  );

const panel = () => screen.findByRole("heading", { name: /we use cookies/i });
const gone = () =>
  waitFor(() =>
    expect(screen.queryByRole("heading", { name: /we use cookies/i })).not.toBeInTheDocument()
  );

const expand = async (user) => {
  const manage = screen.getByRole("button", { name: /manage/i });
  await user.click(manage);
  // Manage swaps itself out for Save, so the row never offers both.
  expect(screen.queryByRole("button", { name: /manage/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /save choices/i })).toBeInTheDocument();
};

beforeEach(() => {
  localStorage.clear();
});

describe("CookieConsentGate", () => {
  it("shows the panel when there is no answer on file", async () => {
    renderGate();
    expect(await panel()).toBeInTheDocument();
  });

  it("renders nothing at all for a visitor who already answered", async () => {
    writeConsent({ essential: true, analytics: true, marketing: false });
    const { container } = renderGate();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("re-applies a stored answer on load without showing the panel", async () => {
    const stored = { essential: true, analytics: true, marketing: false };
    writeConsent(stored);
    const onAccept = vi.fn();

    renderGate({ onAccept });

    await waitFor(() => expect(onAccept).toHaveBeenCalledWith(stored));
    expect(screen.queryByRole("heading", { name: /we use cookies/i })).not.toBeInTheDocument();
  });

  it("brings the panel back when consent is cleared from elsewhere", async () => {
    writeConsent({ essential: true, analytics: true, marketing: true });
    renderGate();

    // A "Cookie Preferences" link anywhere on the site does exactly this.
    clearConsent();

    expect(await panel()).toBeInTheDocument();
  });
});

describe("the collapsed panel", () => {
  it("stores every category on Accept all", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderGate({ onAccept });
    await panel();

    await user.click(screen.getByRole("button", { name: /accept all/i }));

    const all = { essential: true, analytics: true, marketing: true };
    expect(readConsent()).toEqual(all);
    expect(onAccept).toHaveBeenCalledWith(all);
    await gone();
  });

  it("keeps only the essential categories on Reject all", async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    renderGate({ onDecline });
    await panel();

    await user.click(screen.getByRole("button", { name: /reject all/i }));

    expect(readConsent()).toEqual({ essential: true, analytics: false, marketing: false });
    expect(hasConsent("analytics")).toBe(false);
    expect(onDecline).toHaveBeenCalled();
    await gone();
  });

  it("does not render the switches until it is expanded", async () => {
    renderGate();
    await panel();

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save choices/i })).not.toBeInTheDocument();
  });

  it("links to the cookie policy", async () => {
    renderGate();
    await panel();
    expect(screen.getByRole("link", { name: /cookie policy/i })).toHaveAttribute(
      "href",
      "/terms-and-conditions"
    );
  });
});

describe("the expanded panel", () => {
  it("reveals one switch per category", async () => {
    const user = userEvent.setup();
    renderGate();
    await panel();
    await expand(user);

    expect(screen.getAllByRole("switch")).toHaveLength(3);
    // No modal: the panel grows in place.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refuses to switch off an essential category", async () => {
    const user = userEvent.setup();
    renderGate();
    await panel();
    await expand(user);

    const essential = screen.getByRole("switch", { name: /essential/i });
    expect(essential).toBeDisabled();
    expect(essential).toBeChecked();
  });

  it("saves only the categories left switched on", async () => {
    const user = userEvent.setup();
    renderGate();
    await panel();
    await expand(user);

    // Everything starts off except essential, so one click opts into analytics
    // alone — marketing must stay off.
    await user.click(screen.getByRole("switch", { name: /analytics/i }));
    await user.click(screen.getByRole("button", { name: /save choices/i }));

    expect(readConsent()).toEqual({ essential: true, analytics: true, marketing: false });
    expect(hasConsent("marketing")).toBe(false);
    await gone();
  });

  it("treats saving with nothing enabled as a refusal", async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    renderGate({ onDecline });
    await panel();
    await expand(user);

    await user.click(screen.getByRole("button", { name: /save choices/i }));

    expect(readConsent()).toEqual({ essential: true, analytics: false, marketing: false });
    expect(onDecline).toHaveBeenCalled();
  });

  it("collapses on Escape without storing an answer", async () => {
    const user = userEvent.setup();
    renderGate();
    await panel();
    await expand(user);

    // Escape is handled on the panel, not on the document, so it only applies
    // while focus is inside it — which is the right scope for a region that
    // traps nothing and must not swallow Escape from the rest of the page.
    await user.click(screen.getByRole("switch", { name: /analytics/i }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    // A key press is not an answer.
    expect(readConsent()).toBeNull();
  });
});
