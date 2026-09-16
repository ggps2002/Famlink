import { describe, it, expect } from "vitest";
import {
  maskedName,
  rateRange,
  roleCTA,
  toServiceProviderCards,
} from "#src/modules/user/serviceProvider.presenter.js";

const aCaregiver = (info = [], over = {}) => ({
  name: "Sam Ortiz",
  additionalInfo: info,
  reviews: [],
  ...over,
});

const positions = (...options) => ({ key: "interestedPosi", value: { option: options } });

describe("maskedName", () => {
  it("reduces a full name to a first name and a surname initial", () => {
    // This response is served to logged-out visitors. A full legal name beside
    // a zip code, a rate and an availability window identifies a specific
    // caregiver to a stranger who never made an account.
    expect(maskedName("Sam Ortiz")).toBe("Sam O.");
  });

  it("uses the last word, not the second, for a multi-part name", () => {
    expect(maskedName("Ana Maria Ortiz")).toBe("Ana O.");
  });

  it("leaves a single-word name alone", () => {
    expect(maskedName("Cher")).toBe("Cher");
  });

  it("falls back to a generic label rather than an empty string", () => {
    expect(maskedName("   ")).toBe("A caregiver");
    expect(maskedName(undefined)).toBe("A caregiver");
  });
});

describe("rateRange", () => {
  it("spans the lowest and highest numbers in the answer", () => {
    expect(rateRange({ min: "20", max: "30", weekend: "35" })).toBe("$20 - $35/hour");
  });

  it("returns null when nothing in the answer parses as a number", () => {
    // Better no rate than "$NaN - $NaN/hour" on the homepage.
    expect(rateRange({ min: "negotiable" })).toBeNull();
    expect(rateRange(null)).toBeNull();
  });
});

describe("roleCTA", () => {
  it("sends teaching roles to the teaching profile", () => {
    expect(roleCTA("musicInstructor")).toBe("View Teaching Profile");
    expect(roleCTA("privateEducator")).toBe("View Teaching Profile");
    expect(roleCTA("nanny")).toBe("View Full Profile");
  });
});

describe("toServiceProviderCards", () => {
  it("emits one card per position, because the page is a grid of roles", () => {
    const cards = toServiceProviderCards(aCaregiver([positions("nanny", "babysitter")]));

    expect(cards.map((card) => card.role)).toEqual(["Nanny", "Babysitter"]);
  });

  it("drops positions that are not on the preview list", () => {
    const cards = toServiceProviderCards(aCaregiver([positions("nanny", "dogWalker")]));

    expect(cards).toHaveLength(1);
    expect(cards[0].role).toBe("Nanny");
  });

  it("skips a caregiver whose positions are all off the list", () => {
    expect(toServiceProviderCards(aCaregiver([positions("dogWalker")]))).toEqual([]);
  });

  it("skips a caregiver who never answered the position question", () => {
    expect(toServiceProviderCards(aCaregiver([]))).toEqual([]);
    expect(toServiceProviderCards(aCaregiver(undefined))).toEqual([]);
  });

  it("shows 5 stars for an unreviewed caregiver, not 0", () => {
    // A new joiner should not look worse than a badly-reviewed one on the
    // marketing page.
    expect(toServiceProviderCards(aCaregiver([positions("nanny")]))[0].rating).toBe(5);
  });

  it("rounds a real rating to one decimal", () => {
    const user = aCaregiver([positions("nanny")], {
      reviews: [{ rating: 4 }, { rating: 5 }, { rating: 5 }],
    });

    expect(toServiceProviderCards(user)[0].rating).toBe(4.7);
  });

  it("falls back to placeholder copy for every unanswered field", () => {
    const [card] = toServiceProviderCards(aCaregiver([positions("nanny")]));

    expect(card).toMatchObject({
      rate: "$25/hour",
      availability: "Availability not specified",
      experience: "Experience not specified",
      description: "No description provided.",
    });
  });

  it("never carries a field that was not asked for", () => {
    // The guard against this response growing: it is public, so any new key
    // here is a new thing strangers learn about a caregiver.
    const [card] = toServiceProviderCards(aCaregiver([positions("nanny")]));

    expect(Object.keys(card).sort()).toEqual([
      "availability",
      "cta",
      "description",
      "experience",
      "name",
      "rate",
      "rating",
      "role",
      "service",
    ]);
  });
});
