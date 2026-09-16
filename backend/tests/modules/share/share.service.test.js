import { describe, it, expect, vi } from "vitest";
import { ShareService } from "#src/modules/share/share.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "#src/core/errors/index.js";

const aProfile = (id, over = {}) => ({
  _id: `p-${id}`,
  shareToken: "secret-token",
  careType: "full time",
  userId: { _id: id, name: "Sam", email: "sam@example.com", location: {} },
  ...over,
});

const build = (over = {}) => {
  const userRepository = {
    findById: vi.fn().mockResolvedValue({ location: { coordinates: [-97.7, 30.2] }, type: "Nanny" }),
    findIdsAndTypes: vi.fn().mockResolvedValue([
      { _id: "u2", type: "Parents" },
      { _id: "u3", type: "Nanny" },
    ]),
    findIdsMatching: vi.fn().mockResolvedValue([]),
    ...over.userRepository,
  };

  const profileRepository = {
    findBrowsable: vi.fn().mockResolvedValue([]),
    findByUserId: vi.fn().mockResolvedValue(aProfile("u1")),
    findAdminPage: vi.fn().mockResolvedValue({ profiles: [], totalRecords: 0 }),
    distinctShareTypes: vi.fn().mockResolvedValue([[], []]),
    ...over.profileRepository,
  };

  const matchRepository = {
    counterpartyIds: vi.fn().mockResolvedValue(new Set()),
    ...over.matchRepository,
  };

  return {
    service: new ShareService({
      userRepository,
      profileRepository,
      matchRepository,
      escapeRegex: (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    }),
    userRepository,
    profileRepository,
    matchRepository,
  };
};

describe("browse", () => {
  it("refuses to browse for a member with no coordinates", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ location: null }) },
    });

    await expect(service.browse({ userId: "u1" })).rejects.toThrow(ValidationError);
  });

  it("always includes the caller, regardless of distance or completeness", async () => {
    // So a member can see their own listing in the browse view.
    const { service, userRepository } = build();

    await service.browse({ userId: "u1", criteria: {} });

    expect(userRepository.findIdsAndTypes.mock.calls[0][0].$or).toEqual([
      { _id: "u1" },
      { _id: { $ne: "u1" }, nannyProfileCompleted: true },
    ]);
  });

  it("only applies a radius when one was asked for", async () => {
    const { service, userRepository } = build();

    await service.browse({ userId: "u1", criteria: {} });
    expect(userRepository.findIdsAndTypes.mock.calls[0][0].location).toBeUndefined();

    await service.browse({ userId: "u1", criteria: { location: "10" } });
    expect(userRepository.findIdsAndTypes.mock.calls[1][0].location).toBeDefined();
  });

  it("withholds the share token from every row", async () => {
    // The token is the capability behind /share/public/<token>. Attaching it to
    // a browse response would let one account walk away with a working public
    // link for every member in its radius.
    const { service } = build({
      profileRepository: { findBrowsable: vi.fn().mockResolvedValue([aProfile("u2")]) },
    });

    const { data } = await service.browse({ userId: "u1" });

    expect(data[0]).not.toHaveProperty("shareToken");
  });

  it("reduces the owner to the public projection", async () => {
    const { service } = build({
      profileRepository: { findBrowsable: vi.fn().mockResolvedValue([aProfile("u2")]) },
    });

    const { data } = await service.browse({ userId: "u1" });

    expect(data[0].userId).not.toHaveProperty("email");
    expect(data[0].userId.name).toBe("Sam");
  });

  it("removes anyone the member already has a request with", async () => {
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([aProfile("u2"), aProfile("u3")]),
      },
      matchRepository: { counterpartyIds: vi.fn().mockResolvedValue(new Set(["u2"])) },
    });

    const { data, pagination } = await service.browse({ userId: "u1" });

    expect(data).toHaveLength(1);
    expect(data[0].userId._id).toBe("u3");
    expect(pagination.totalRecords).toBe(1);
  });

  it("attaches each owner's rating to the row", async () => {
    // So the browse card can show stars without a second request, and so the
    // number it prints is the one the rating filter compared against.
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([
          aProfile("u2", {
            userId: { _id: "u2", name: "Sam", reviews: [{ rating: 5 }, { rating: 4 }] },
          }),
        ]),
      },
    });

    const { data } = await service.browse({ userId: "u1" });

    expect(data[0].averageRating).toBe(4.5);
    expect(data[0].totalRatings).toBe(2);
  });

  it("reports an unrated owner as zero rather than omitting the field", async () => {
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([
          aProfile("u2", { userId: { _id: "u2", name: "Sam", reviews: [] } }),
        ]),
      },
    });

    const { data } = await service.browse({ userId: "u1" });

    expect(data[0].averageRating).toBe(0);
    expect(data[0].totalRatings).toBe(0);
  });

  it("keeps only profiles at or above the requested rating", async () => {
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([
          aProfile("u2", { userId: { _id: "u2", name: "Sam", reviews: [{ rating: 5 }] } }),
          aProfile("u3", { userId: { _id: "u3", name: "Lee", reviews: [{ rating: 3 }] } }),
        ]),
      },
    });

    const { data } = await service.browse({ userId: "u1", criteria: { minRating: 4 } });

    expect(data).toHaveLength(1);
    expect(data[0].userId._id).toBe("u2");
  });

  it("compares the rating filter against the rounded average the card shows", async () => {
    // 4 and 5 average to 4.5 exactly; 4, 4 and 5 average to 4.333… which the
    // card prints as 4.3. Comparing the filter against the unrounded value
    // would let a profile through a "4.4+" filter that reads 4.3 on screen.
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([
          aProfile("u2", {
            userId: { _id: "u2", name: "Sam", reviews: [{ rating: 4 }, { rating: 4 }, { rating: 5 }] },
          }),
        ]),
      },
    });

    const { data } = await service.browse({ userId: "u1", criteria: { minRating: 4.4 } });

    expect(data).toHaveLength(0);
  });

  it("hides unrated profiles once a rating filter is set", async () => {
    // The one place this departs from "no answer is not a no": a member asking
    // for 4+ stars is setting a threshold of evidence, and in a directory where
    // most profiles have no reviews yet, letting the unrated through leaves the
    // list all but unchanged.
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([
          aProfile("u2", { userId: { _id: "u2", name: "Sam", reviews: [] } }),
        ]),
      },
    });

    expect((await service.browse({ userId: "u1", criteria: { minRating: 4 } })).data).toHaveLength(0);
    // …and shows them again as soon as the filter is cleared.
    expect((await service.browse({ userId: "u1", criteria: {} })).data).toHaveLength(1);
  });

  it("counts the rating-filtered set, not the set before it", async () => {
    // Filtering after the slice would leave the pager promising results that
    // later pages do not contain.
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([
          aProfile("u2", { userId: { _id: "u2", name: "Sam", reviews: [{ rating: 5 }] } }),
          aProfile("u3", { userId: { _id: "u3", name: "Lee", reviews: [{ rating: 1 }] } }),
          aProfile("u4", { userId: { _id: "u4", name: "Kim", reviews: [{ rating: 2 }] } }),
        ]),
      },
    });

    const { pagination } = await service.browse({
      userId: "u1",
      criteria: { minRating: 4, limit: 10 },
    });

    expect(pagination.totalRecords).toBe(1);
    expect(pagination.totalPages).toBe(1);
  });

  it("asks about existing requests once, not once per profile", async () => {
    // This was an N+1 that ran the length of the whole matched set rather than
    // the page being returned.
    const { service, matchRepository } = build({
      profileRepository: {
        findBrowsable: vi
          .fn()
          .mockResolvedValue([aProfile("u2"), aProfile("u3"), aProfile("u4")]),
      },
    });

    await service.browse({ userId: "u1" });

    expect(matchRepository.counterpartyIds).toHaveBeenCalledTimes(1);
  });

  it("skips a profile whose owner has been deleted", async () => {
    // A dangling reference threw when the owner's id was read, failing the
    // whole browse request with a 500.
    const { service } = build({
      profileRepository: {
        findBrowsable: vi.fn().mockResolvedValue([aProfile("u2", { userId: null })]),
      },
    });

    const { data } = await service.browse({ userId: "u1" });

    expect(data).toEqual([]);
  });

  it("paginates over the filtered set, not the raw one", async () => {
    const profiles = ["u2", "u3", "u4", "u5"].map((id) => aProfile(id));
    const { service } = build({
      profileRepository: { findBrowsable: vi.fn().mockResolvedValue(profiles) },
      matchRepository: { counterpartyIds: vi.fn().mockResolvedValue(new Set(["u2"])) },
    });

    const { data, pagination } = await service.browse({
      userId: "u1",
      criteria: { page: 2, limit: 2 },
    });

    expect(pagination).toEqual({
      totalRecords: 3,
      totalPages: 2,
      currentPage: 2,
      pageSize: 2,
    });
    expect(data).toHaveLength(1);
  });

  it("reports status and matchId as null, since matched rows are gone", async () => {
    const { service } = build({
      profileRepository: { findBrowsable: vi.fn().mockResolvedValue([aProfile("u2")]) },
    });

    const { data } = await service.browse({ userId: "u1" });

    expect(data[0]).toMatchObject({ status: null, matchId: null });
  });
});

describe("ownProfile", () => {
  it("400s a request with no caller", async () => {
    const { service } = build();

    await expect(service.ownProfile(undefined)).rejects.toThrow(ValidationError);
  });

  it("404s separately for a missing account and a missing profile", async () => {
    const noUser = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(noUser.service.ownProfile("u1")).rejects.toThrow("User not found");

    const noProfile = build({
      profileRepository: { findByUserId: vi.fn().mockResolvedValue(null) },
    });
    await expect(noProfile.service.ownProfile("u1")).rejects.toThrow("User profile not found");
  });

  it("returns the member's own record without stripping anything", async () => {
    // Their own profile, so the browse redaction does not apply.
    const { service } = build();

    expect(await service.ownProfile("u1")).toHaveProperty("shareToken");
  });
});

describe("the admin console", () => {
  it("blocks a non-admin from both endpoints", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await expect(service.listAllForAdmin({ adminId: "u1" })).rejects.toThrow(ForbiddenError);
    await expect(service.filterOptionsForAdmin("u1")).rejects.toThrow(ForbiddenError);
  });

  const asAdmin = (over = {}) =>
    build({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ type: "Admin" }),
        ...over.userRepository,
      },
      profileRepository: over.profileRepository,
    });

  it("caps the page size so one request cannot dump the collection", async () => {
    const { service, profileRepository } = asAdmin();

    await service.listAllForAdmin({ adminId: "a1", query: { limit: "5000" } });

    expect(profileRepository.findAdminPage.mock.calls[0][1].limit).toBe(100);
  });

  it("filters in the database, not over the page already fetched", async () => {
    // A search applied to twelve loaded rows would look like it covered the
    // platform, so a member on page three would read as "no results".
    const { service, userRepository, profileRepository } = asAdmin({
      userRepository: { findIdsMatching: vi.fn().mockResolvedValue([{ _id: "u9" }]) },
    });

    await service.listAllForAdmin({ adminId: "a1", query: { search: "sam" } });

    expect(userRepository.findIdsMatching).toHaveBeenCalled();
    expect(profileRepository.findAdminPage.mock.calls[0][0].userId).toEqual({ $in: ["u9"] });
  });

  it("escapes a search term before it becomes a regex", async () => {
    // "a{100000}" is otherwise a denial of service against the user table.
    const { service, userRepository } = asAdmin({
      userRepository: { findIdsMatching: vi.fn().mockResolvedValue([]) },
    });

    await service.listAllForAdmin({ adminId: "a1", query: { search: "a{100}" } });

    const [nameClause] = userRepository.findIdsMatching.mock.calls[0][0].$or;
    expect(nameClause.name.source).toBe("a\\{100\\}");
  });

  it("maps the console's role labels to stored types", async () => {
    const { service, userRepository } = asAdmin({
      userRepository: { findIdsMatching: vi.fn().mockResolvedValue([]) },
    });

    await service.listAllForAdmin({ adminId: "a1", query: { role: "caregiver" } });
    expect(userRepository.findIdsMatching.mock.calls[0][0].type).toBe("Nanny");

    await service.listAllForAdmin({ adminId: "a1", query: { role: "family" } });
    expect(userRepository.findIdsMatching.mock.calls[1][0].type).toBe("Parents");
  });

  it("does not narrow by user at all for role=all with no search", async () => {
    const { service, userRepository, profileRepository } = asAdmin();

    await service.listAllForAdmin({ adminId: "a1", query: { role: "all" } });

    expect(userRepository.findIdsMatching).not.toHaveBeenCalled();
    expect(profileRepository.findAdminPage.mock.calls[0][0]).toEqual({});
  });

  it("matches a share type against both questionnaires' fields", async () => {
    const { service, profileRepository } = asAdmin();

    await service.listAllForAdmin({ adminId: "a1", query: { shareType: "full time" } });

    expect(profileRepository.findAdminPage.mock.calls[0][0].$or).toEqual([
      { nannyShareType: "full time" },
      { careType: "full time" },
    ]);
  });

  it("reports at least one page even when empty", async () => {
    // Unlike the member-facing lists — the console's pager renders "1 of 1".
    const { service } = asAdmin();

    const { pagination } = await service.listAllForAdmin({ adminId: "a1", query: {} });

    expect(pagination.totalPages).toBe(1);
  });

  it("merges, dedupes and sorts the filter options from both fields", async () => {
    const { service } = asAdmin({
      profileRepository: {
        findAdminPage: vi.fn(),
        findBrowsable: vi.fn(),
        findByUserId: vi.fn(),
        distinctShareTypes: vi
          .fn()
          .mockResolvedValue([["part time", "full time", null, "  "], ["full time", "seasonal"]]),
      },
    });

    expect(await service.filterOptionsForAdmin("a1")).toEqual([
      "full time",
      "part time",
      "seasonal",
    ]);
  });
});

describe("ownProfile", () => {
  it("carries the member's own rating, like a browse row", async () => {
    // Otherwise "Your Profile" is the one card on the page that never shows a
    // rating, because it comes from a different endpoint than the rest.
    const { service } = build({
      profileRepository: {
        findByUserId: vi.fn().mockResolvedValue(
          aProfile("u1", {
            userId: { _id: "u1", name: "Sam", reviews: [{ rating: 5 }, { rating: 4 }] },
          })
        ),
      },
    });

    const profile = await service.ownProfile("u1");

    expect(profile.averageRating).toBe(4.5);
    expect(profile.totalRatings).toBe(2);
  });
});
