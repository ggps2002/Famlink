import { describe, it, expect } from "vitest";
import {
  averageRating,
  displayRating,
  parsePaging,
  splitCityState,
  splitName,
  toAdminEditedRow,
  toAdminFamilyRow,
  toAdminNannyRow,
  toPagination,
  toTopUserRow,
} from "#src/modules/user/user.presenter.js";

const aUser = (over = {}) => ({
  _id: "u1",
  name: "Sam Ortiz",
  email: "sam@example.com",
  imageUrl: "https://cdn/x.jpg",
  phoneNo: "+15550001111",
  location: { format_location: "12 Elm St, Austin, TX 78701, USA" },
  reviews: [{ rating: 4 }, { rating: 5 }],
  verified: { emailVer: true, nationalIDVer: "true" },
  status: "Active",
  createdAt: "2026-01-01",
  ...over,
});

describe("splitName", () => {
  it("keeps a multi-word surname together", () => {
    expect(splitName("Sam Ortiz Reyes")).toEqual({ firstName: "Sam", lastName: "Ortiz Reyes" });
  });

  it("gives an empty last name to a single-word name", () => {
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });

  it("survives a missing name rather than throwing", () => {
    // The console renders a row per account; one record with no name must not
    // take the whole page down.
    expect(splitName(undefined)).toEqual({ firstName: "", lastName: "" });
  });
});

describe("splitCityState", () => {
  it("reads city and state from the end, not the start", () => {
    expect(splitCityState("12 Elm St, Austin, TX 78701, USA")).toEqual({
      city: "Austin",
      state: "TX 78701",
    });
  });

  it("returns empty strings for an address with too few parts", () => {
    expect(splitCityState("USA")).toEqual({ city: "", state: "" });
  });

  it("returns empty strings when there is no address at all", () => {
    expect(splitCityState(undefined)).toEqual({ city: "", state: "" });
  });
});

describe("ratings", () => {
  it("averages the review scores", () => {
    expect(averageRating([{ rating: 4 }, { rating: 5 }])).toBe(4.5);
  });

  it("reports 0 rather than NaN when nobody has reviewed", () => {
    // A division by zero here would render "NaN" on a public profile.
    expect(averageRating([])).toBe(0);
    expect(displayRating([])).toBe(0);
  });

  it("rounds the displayed rating to one decimal", () => {
    expect(displayRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }])).toBe("4.7");
  });
});

describe("pagination", () => {
  it("reports zero pages for an empty result", () => {
    // Not Math.max(1, …): the "no results" branches in the list screens test
    // totalPages === 0.
    expect(toPagination({ totalRecords: 0, page: 1, limit: 10 })).toEqual({
      totalRecords: 0,
      totalPages: 0,
      currentPage: 1,
      limit: 10,
    });
  });

  it("rounds a partial last page up", () => {
    expect(toPagination({ totalRecords: 21, page: 3, limit: 10 }).totalPages).toBe(3);
  });

  it("defaults to page 1 of 10 when the query says nothing", () => {
    expect(parsePaging({})).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it("falls back to the defaults for junk rather than producing NaN", () => {
    // `skip: NaN` silently returns the first page forever.
    expect(parsePaging({ page: "abc", limit: "xyz" })).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it("computes skip from the page", () => {
    expect(parsePaging({ page: "3", limit: "25" })).toEqual({ page: 3, limit: 25, skip: 50 });
  });
});

describe("admin rows", () => {
  it("derives a username from the email local part", () => {
    expect(toAdminFamilyRow(aUser()).username).toBe("sam");
  });

  it("treats nationalIDVer as the string it is stored as", () => {
    // Stored as "true"/"false" strings; a truthiness check would make the
    // string "false" report as verified.
    expect(toAdminFamilyRow(aUser({ verified: { nationalIDVer: "false" } })).isVerifiedID).toBe(
      false
    );
    expect(toAdminFamilyRow(aUser()).isVerifiedID).toBe(true);
  });

  it("uses aboutMe for a family's bio", () => {
    expect(toAdminFamilyRow(aUser({ aboutMe: "Two kids in Austin" })).bio).toBe(
      "Two kids in Austin"
    );
  });

  it("uses the job-description answer for a nanny's bio", () => {
    const nanny = aUser({
      additionalInfo: [{ key: "jobDescription", value: "Ten years with toddlers" }],
    });

    expect(toAdminNannyRow(nanny).bio).toBe("Ten years with toddlers");
  });

  it("renders a nanny who never answered the job-description question", () => {
    // This threw a TypeError before the move, which the route turned into a
    // 500 — one unanswered question blanked the entire admin nannies page.
    const nanny = aUser({ additionalInfo: [{ key: "experience", value: "5 years" }] });

    expect(toAdminNannyRow(nanny).bio).toBe("");
  });

  it("renders a nanny with no additionalInfo array at all", () => {
    expect(toAdminNannyRow(aUser({ additionalInfo: undefined })).bio).toBe("");
  });

  it("rounds a family's rating but not a nanny's", () => {
    // An existing inconsistency between the two endpoints, preserved on
    // purpose so the move does not change what the console displays.
    const reviews = [{ rating: 4 }, { rating: 5 }, { rating: 5 }];

    expect(toAdminFamilyRow(aUser({ reviews })).avgRating).toBe(4.7);
    expect(toAdminNannyRow(aUser({ reviews })).avgRating).toBeCloseTo(4.6667, 3);
  });

  it("takes the role from the record when an admin edits someone", () => {
    expect(toAdminEditedRow(aUser({ type: "Nanny" })).role).toBe("Nanny");
  });

  it("carries the nanny-only columns the families table has no room for", () => {
    const row = toAdminNannyRow(aUser({ premium: true, dob: "1990-04-02" }));

    expect(row).toMatchObject({ premium: true, dob: "1990-04-02" });
    expect(toAdminFamilyRow(aUser())).not.toHaveProperty("premium");
  });

  it("nulls a missing avatar instead of leaving it undefined", () => {
    // The console's <img> binding distinguishes null from undefined.
    expect(toAdminFamilyRow(aUser({ imageUrl: undefined })).profileImage).toBeNull();
  });
});

describe("toTopUserRow", () => {
  it("splits the name and defaults an absent rating to 0", () => {
    expect(toTopUserRow({ _id: "u1", name: "Sam Ortiz", imageUrl: null })).toEqual({
      id: "u1",
      firstName: "Sam",
      lastName: "Ortiz",
      profileImage: null,
      avgRating: 0,
      reviewCount: 0,
    });
  });
});
