import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  CONSENT_EVENT,
  CONSENT_VERSION,
  clearConsent,
  hasConsent,
  readConsent,
  writeConsent,
} from "@shared/consent/consentStore";
import { COOKIE_CATEGORIES, allAccepted, essentialOnly } from "@shared/consent/categories";

/**
 * Consent is the one piece of stored state whose failure mode is silent and
 * legal rather than visible: a misread record does not crash anything, it just
 * starts tracking someone who said no. These tests pin the three ways that can
 * happen — a stale schema, a reordered category list, and storage that throws.
 */

const STORAGE_KEY = "famlink_cookie_consent";

beforeEach(() => {
  localStorage.clear();
});

describe("readConsent", () => {
  it("returns null when nothing has been stored", () => {
    expect(readConsent()).toBeNull();
  });

  it("round-trips a stored answer", () => {
    writeConsent({ essential: true, analytics: true, marketing: false });
    expect(readConsent()).toEqual({ essential: true, analytics: true, marketing: false });
  });

  it("ignores a record written against an older CONSENT_VERSION", () => {
    // An older record expresses no opinion about categories added since, and an
    // unanswered category must never be read as a yes — so the whole record is
    // discarded and the visitor is asked again.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION - 1, prefs: { marketing: true } }),
    );
    expect(readConsent()).toBeNull();
  });

  it("returns null for malformed JSON rather than throwing", () => {
    // Deciding whether to show a banner must not be able to take down the page.
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => readConsent()).not.toThrow();
    expect(readConsent()).toBeNull();
  });

  it("returns null when the record has no prefs object", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CONSENT_VERSION }));
    expect(readConsent()).toBeNull();
  });

  it("returns null when localStorage itself throws", () => {
    // Safari's private mode and a browser with site data blocked both do this.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied");
    });
    expect(readConsent()).toBeNull();
  });
});

describe("storage is keyed by category id, not by position", () => {
  it("survives the category list being reordered", () => {
    // This is the bug the ported component had: it stored a boolean[] indexed
    // by position and validated only its length, so swapping two categories
    // silently moved every answer onto a different category. Someone who
    // refused marketing would start consenting to it, with nothing logged.
    writeConsent({ essential: true, analytics: false, marketing: true });

    const reordered = [
      { id: "marketing" },
      { id: "essential", isEssential: true },
      { id: "analytics" },
    ];

    const stored = readConsent();
    expect(reordered.map((c) => stored[c.id])).toEqual([true, true, false]);
    expect(hasConsent("analytics")).toBe(false);
    expect(hasConsent("marketing")).toBe(true);
  });

  it("treats a category the stored record never mentioned as not consented", () => {
    writeConsent({ essential: true, analytics: true });
    expect(hasConsent("marketing")).toBe(false);
  });
});

describe("hasConsent", () => {
  it("is false for every non-essential category before anyone answers", () => {
    // Opt-in is the requirement for anything past strictly-necessary cookies,
    // so silence has to mean no.
    expect(hasConsent("analytics")).toBe(false);
    expect(hasConsent("marketing")).toBe(false);
  });

  it("is false again after the answer is cleared", () => {
    writeConsent(allAccepted());
    expect(hasConsent("analytics")).toBe(true);

    clearConsent();
    expect(hasConsent("analytics")).toBe(false);
  });
});

describe("change notification", () => {
  it("announces the new preferences on write", () => {
    const seen = vi.fn();
    window.addEventListener(CONSENT_EVENT, seen);

    const prefs = { essential: true, analytics: true, marketing: false };
    writeConsent(prefs);

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0].detail).toEqual(prefs);
    window.removeEventListener(CONSENT_EVENT, seen);
  });

  it("announces a null detail on clear, which is what reopens the banner", () => {
    const seen = vi.fn();
    window.addEventListener(CONSENT_EVENT, seen);

    clearConsent();

    expect(seen.mock.calls[0][0].detail).toBeNull();
    window.removeEventListener(CONSENT_EVENT, seen);
  });

  it("still announces when the write itself failed", () => {
    // A visitor in a browser that refuses to store anything should still get
    // the behaviour they asked for for the rest of the session; they will
    // simply be asked again next visit.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota");
    });
    const seen = vi.fn();
    window.addEventListener(CONSENT_EVENT, seen);

    expect(() => writeConsent(allAccepted())).not.toThrow();
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONSENT_EVENT, seen);
  });
});

describe("category defaults", () => {
  it("essentialOnly turns on exactly the essential categories", () => {
    expect(essentialOnly()).toEqual({ essential: true, analytics: false, marketing: false });
  });

  it("allAccepted turns on everything", () => {
    expect(allAccepted()).toEqual({ essential: true, analytics: true, marketing: true });
  });

  it("marks exactly one shipped category as essential", () => {
    // More than one "Always on" row and the dialog stops offering a real
    // choice; none, and the site's own session cookie has no category.
    expect(COOKIE_CATEGORIES.filter((c) => c.isEssential).map((c) => c.id)).toEqual(["essential"]);
  });
});
