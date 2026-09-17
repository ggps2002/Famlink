import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import CookieConsentGate from "@shared/consent/CookieConsentGate";
import { clearConsent, hasConsent, readConsent, writeConsent } from "@shared/consent/consentStore";

/**
 * The gate decides whether anyone is asked at all, so the cases worth pinning
 * are the ones where it gets that wrong: showing the banner to someone who
 * already answered, or failing to show it to someone who has not.
 *
 * The banner and the preferences dialog are both lazy, so every assertion about
 * them goes through `findBy*` — a `getBy*` here would run before the chunk has
 * resolved and fail for the wrong reason.
 */

const renderGate = (props = {}) =>
  render(
    <MemoryRouter>
      <CookieConsentGate {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
});

describe("CookieConsentGate", () => {
  it("shows the banner when there is no answer on file", async () => {
    renderGate();
    expect(await screen.findByRole("heading", { name: /cookie preferences/i })).toBeInTheDocument();
  });

  it("renders nothing at all for a visitor who already answered", async () => {
    writeConsent({ essential: true, analytics: true, marketing: false });
    const { container } = renderGate();

    // Give the lazy chunk a chance to resolve, so this cannot pass just by
    // asserting before it would have appeared.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole("heading", { name: /cookie preferences/i })).not.toBeInTheDocument();
  });

  it("re-applies a stored answer on load without showing the banner", async () => {
    const stored = { essential: true, analytics: true, marketing: false };
    writeConsent(stored);
    const onAccept = vi.fn();

    renderGate({ onAccept });

    await waitFor(() => expect(onAccept).toHaveBeenCalledWith(stored));
    expect(screen.queryByRole("heading", { name: /cookie preferences/i })).not.toBeInTheDocument();
  });

  it("brings the banner back when consent is cleared from elsewhere", async () => {
    writeConsent({ essential: true, analytics: true, marketing: true });
    renderGate();

    // A "Manage cookies" link anywhere on the site does exactly this.
    clearConsent();

    expect(await screen.findByRole("heading", { name: /cookie preferences/i })).toBeInTheDocument();
  });
});

describe("the banner", () => {
  it("stores every category and closes on Accept all", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderGate({ onAccept });

    await user.click(await screen.findByRole("button", { name: /accept all/i }));

    expect(readConsent()).toEqual({ essential: true, analytics: true, marketing: true });
    expect(onAccept).toHaveBeenCalledWith({ essential: true, analytics: true, marketing: true });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /cookie preferences/i })).not.toBeInTheDocument(),
    );
  });

  it("links to the cookie policy", async () => {
    renderGate();
    const link = await screen.findByRole("link", { name: /cookie policy/i });
    expect(link).toHaveAttribute("href", "/terms-and-conditions");
  });
});

describe("the preferences dialog", () => {
  it("opens from Customize and is not in the document before that", async () => {
    const user = userEvent.setup();
    renderGate();

    const customize = await screen.findByRole("button", { name: /customize/i });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(customize);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("refuses to switch off an essential category", async () => {
    const user = userEvent.setup();
    renderGate();

    await user.click(await screen.findByRole("button", { name: /customize/i }));
    await screen.findByRole("dialog");

    const essential = screen.getByRole("switch", { name: /essential/i });
    expect(essential).toBeDisabled();
    expect(essential).toBeChecked();
  });

  it("saves only the categories left switched on", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderGate({ onAccept });

    await user.click(await screen.findByRole("button", { name: /customize/i }));
    await screen.findByRole("dialog");

    // Everything starts off except essential, so one click is an opt-in to
    // analytics alone — marketing must stay off.
    await user.click(screen.getByRole("switch", { name: /analytics/i }));
    await user.click(screen.getByRole("button", { name: /save preferences/i }));

    expect(readConsent()).toEqual({ essential: true, analytics: true, marketing: false });
    expect(hasConsent("marketing")).toBe(false);
  });

  it("keeps only the essential categories on Reject all", async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    renderGate({ onDecline });

    await user.click(await screen.findByRole("button", { name: /customize/i }));
    await screen.findByRole("dialog");

    // Switch something on first, so Reject all is proven to discard it rather
    // than just to agree with the starting state.
    await user.click(screen.getByRole("switch", { name: /analytics/i }));
    await user.click(screen.getByRole("button", { name: /reject all/i }));

    expect(readConsent()).toEqual({ essential: true, analytics: false, marketing: false });
    expect(onDecline).toHaveBeenCalled();
  });
});
