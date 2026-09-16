import { describe, it, expect, vi } from "vitest";
import { UserDirectoryService } from "#src/modules/user/userDirectory.service.js";
import { UserRepository } from "#src/modules/user/user.repository.js";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "#src/core/errors/index.js";

// A repository whose queries are recorded rather than run. The filter-building
// is the part worth asserting on — everything below checks what was asked of
// the database, not what a database would have answered.
const repo = (over = {}) => ({
  findById: vi.fn().mockResolvedValue({ location: { coordinates: [-97.74, 30.27] } }),
  findPublicById: vi.fn().mockResolvedValue(null),
  findPublicPage: vi.fn().mockResolvedValue({ users: [], totalRecords: 0 }),
  aggregatePublicPage: vi.fn().mockResolvedValue({ users: [], totalRecords: 0 }),
  findActiveNanniesInZip: vi.fn().mockResolvedValue([]),
  countByType: vi.fn().mockResolvedValue(0),
  deleteById: vi.fn().mockResolvedValue({ _id: "target" }),
  // The filter builder is real: a fake would defeat the point of the geo tests.
  withinRadiusFilter: UserRepository.prototype.withinRadiusFilter,
  ...over,
});

const build = (over = {}) => {
  const userRepository = repo(over.userRepository);
  const profileRepository = {
    findByUserId: vi.fn().mockResolvedValue(null),
    ...over.profileRepository,
  };

  return {
    service: new UserDirectoryService({ userRepository, profileRepository }),
    userRepository,
    profileRepository,
  };
};

const paging = { page: 1, limit: 10, skip: 0 };

describe("browseNearby", () => {
  it("refuses to browse for an account with no coordinates", async () => {
    // The query is anchored on the caller's position, so there is no sensible
    // result to return — a silent empty list would read as "nobody near you".
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ location: null }) },
    });

    await expect(service.browseNearby({ userId: "u1", ...paging })).rejects.toThrow(
      ValidationError
    );
  });

  it("defaults to searching for caregivers", async () => {
    const { service, userRepository } = build();

    await service.browseNearby({ userId: "u1", ...paging });

    expect(userRepository.findPublicPage.mock.calls[0][0].type).toBe("Nanny");
  });

  it("anchors the geo query on the caller's own coordinates", async () => {
    const { service, userRepository } = build();

    await service.browseNearby({ userId: "u1", ...paging });

    const [center] = userRepository.findPublicPage.mock.calls[0][0].location.$geoWithin
      .$centerSphere;
    expect(center).toEqual([-97.74, 30.27]);
  });

  it("passes the page window through to the query", async () => {
    const { service, userRepository } = build();

    await service.browseNearby({ userId: "u1", page: 3, limit: 25, skip: 50 });

    expect(userRepository.findPublicPage.mock.calls[0][1]).toEqual({ skip: 50, limit: 25 });
  });
});

describe("browseFiltered", () => {
  it("404s when the caller's account is gone", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.browseFiltered({ userId: "u1", query: {}, ...paging })).rejects.toThrow(
      NotFoundError
    );
  });

  it("falls back to an exact zip match when there are no coordinates", async () => {
    // Fewer results than a radius, but an account with no coordinates would
    // otherwise get none at all.
    const { service, userRepository } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ location: null, zipCode: "78701" }),
      },
    });

    await service.browseFiltered({ userId: "u1", query: {}, ...paging });

    const match = userRepository.aggregatePublicPage.mock.calls[0][0];
    expect(match.zipCode).toBe("78701");
    expect(match.location).toBeUndefined();
  });

  it("rejects a caller with neither coordinates nor a zip", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({}) },
    });

    await expect(service.browseFiltered({ userId: "u1", query: {}, ...paging })).rejects.toThrow(
      "User must have either location coordinates or a zip code."
    );
  });

  it("defaults to a 5-mile radius and widens when asked", async () => {
    const { service, userRepository } = build();

    await service.browseFiltered({ userId: "u1", query: {}, ...paging });
    const [, defaultRadius] =
      userRepository.aggregatePublicPage.mock.calls[0][0].location.$geoWithin.$centerSphere;

    await service.browseFiltered({ userId: "u1", query: { location: "50" }, ...paging });
    const [, wideRadius] =
      userRepository.aggregatePublicPage.mock.calls[1][0].location.$geoWithin.$centerSphere;

    expect(wideRadius).toBeCloseTo(defaultRadius * 10, 10);
  });

  it("requires every filter to be met by a different answer", async () => {
    // One $elemMatch per filter, combined with $and. Merging them into a single
    // $elemMatch would let one questionnaire answer satisfy two filters.
    const { service, userRepository } = build();

    await service.browseFiltered({
      userId: "u1",
      query: { ageGroupsExp: "infant", start: "immediately" },
      ...paging,
    });

    const { $and } = userRepository.aggregatePublicPage.mock.calls[0][0];
    expect($and).toHaveLength(2);
    expect($and[0].additionalInfo.$elemMatch.key).toBe("start");
    expect($and[1].additionalInfo.$elemMatch.key).toBe("ageGroupsExp");
  });

  it("splits a comma-separated filter into an $in", async () => {
    const { service, userRepository } = build();

    await service.browseFiltered({
      userId: "u1",
      query: { ageGroupsExp: "infant, toddler ,school" },
      ...paging,
    });

    const { $and } = userRepository.aggregatePublicPage.mock.calls[0][0];
    expect($and[0].additionalInfo.$elemMatch["value.option"]).toEqual({
      $in: ["infant", "toddler", "school"],
    });
  });

  it("maps the same control to a different answer key per user type", async () => {
    // A family's "preferredSchedule" is a caregiver's "avaiForWorking"; the UI
    // control is one and the same.
    const { service, userRepository } = build();

    await service.browseFiltered({
      userId: "u1",
      query: { userType: "Parents", avaiForWorking: "weekends", interestedPosi: "tutoring" },
      ...paging,
    });

    const keys = userRepository.aggregatePublicPage.mock.calls[0][0].$and.map(
      (clause) => clause.additionalInfo.$elemMatch.key
    );
    expect(keys).toEqual(["preferredSchedule", "additionalServices"]);
  });

  it("requires the stored salary range to sit inside the requested one", async () => {
    // Not an overlap: asking for $20-30 must not return someone who wants $45.
    const { service, userRepository } = build();

    await service.browseFiltered({
      userId: "u1",
      query: { salaryRange: ["20", "30"] },
      ...paging,
    });

    const [clause] = userRepository.aggregatePublicPage.mock.calls[0][0].$and;
    expect(clause.additionalInfo.$elemMatch.$and).toEqual([
      { "value.min": { $gte: 20 } },
      { "value.max": { $lte: 30 } },
    ]);
  });

  it("ignores a salary range that is not two numbers", async () => {
    const { service, userRepository } = build();

    await service.browseFiltered({
      userId: "u1",
      query: { salaryRange: ["cheap", "30"] },
      ...paging,
    });

    expect(userRepository.aggregatePublicPage.mock.calls[0][0].$and).toBeUndefined();
  });
});

describe("getProfile", () => {
  it("404s an id nobody holds", async () => {
    const { service } = build();

    await expect(service.getProfile("missing")).rejects.toThrow(NotFoundError);
  });

  it("reads through the public projection, never the raw document", async () => {
    // The projection is what keeps the home coordinates in the database; a
    // plain findById here would undo it.
    const { service, userRepository } = build({
      userRepository: {
        findPublicById: vi.fn().mockResolvedValue({ _id: "u2", name: "Sam", reviews: [] }),
      },
    });

    await service.getProfile("u2");

    expect(userRepository.findPublicById).toHaveBeenCalled();
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it("attaches the detailed profile, or null when there is none", async () => {
    const { service } = build({
      userRepository: {
        findPublicById: vi.fn().mockResolvedValue({ _id: "u2", name: "Sam", reviews: [] }),
      },
    });

    expect(await service.getProfile("u2")).toMatchObject({
      nannyProfile: null,
      averageRating: 0,
    });
  });

  it("populates reviewers with a name and avatar only", async () => {
    const { service, userRepository } = build({
      userRepository: {
        findPublicById: vi.fn().mockResolvedValue({ _id: "u2", reviews: [] }),
      },
    });

    await service.getProfile("u2");

    expect(userRepository.findPublicById.mock.calls[0][1].populate).toEqual({
      path: "reviews.userId",
      select: "name imageUrl",
    });
  });
});

describe("countPerType", () => {
  it("counts both sides of the marketplace", async () => {
    const { service } = build({
      userRepository: {
        countByType: vi.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(34),
      },
    });

    expect(await service.countPerType()).toEqual({ familyCount: 12, nannyCount: 34 });
  });
});

describe("listServiceProviders", () => {
  it("asks only for the fields the public card renders", async () => {
    const { service, userRepository } = build();

    await service.listServiceProviders("78701");

    expect(userRepository.findActiveNanniesInZip).toHaveBeenCalledWith("78701", {
      select: "name additionalInfo reviews",
    });
  });

  it("flattens each caregiver's positions into separate cards", async () => {
    const { service } = build({
      userRepository: {
        findActiveNanniesInZip: vi.fn().mockResolvedValue([
          {
            name: "Sam Ortiz",
            reviews: [],
            additionalInfo: [{ key: "interestedPosi", value: { option: ["nanny", "babysitter"] } }],
          },
          { name: "No Positions", reviews: [], additionalInfo: [] },
        ]),
      },
    });

    const cards = await service.listServiceProviders("78701");

    expect(cards).toHaveLength(2);
    expect(cards.every((card) => card.name === "Sam O.")).toBe(true);
  });
});

describe("deleteAccount", () => {
  it("lets a member delete their own account", async () => {
    const { service, userRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await service.deleteAccount({ requesterId: "u1", targetId: "u1" });

    expect(userRepository.deleteById).toHaveBeenCalledWith("u1");
  });

  it("refuses to let one member delete another", async () => {
    // Before the refactor this route had no auth at all: an unauthenticated
    // DELETE against a guessed id removed that account.
    const { service, userRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await expect(
      service.deleteAccount({ requesterId: "u1", targetId: "u2" })
    ).rejects.toThrow(ForbiddenError);
    expect(userRepository.deleteById).not.toHaveBeenCalled();
  });

  it("lets an admin delete anyone", async () => {
    const { service, userRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Admin" }) },
    });

    await service.deleteAccount({ requesterId: "admin", targetId: "u2" });

    expect(userRepository.deleteById).toHaveBeenCalledWith("u2");
  });

  it("compares ids as strings, so an ObjectId still matches itself", async () => {
    // req.params gives a string and the token gives whatever was signed; a
    // strict === between the two forms would deny a member their own account.
    const asObjectId = { toString: () => "u1" };
    const { service, userRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await service.deleteAccount({ requesterId: asObjectId, targetId: "u1" });

    expect(userRepository.deleteById).toHaveBeenCalled();
  });

  it("401s when the token names an account that no longer exists", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.deleteAccount({ requesterId: "ghost", targetId: "u2" })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("404s when the target is already gone", async () => {
    const { service } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ type: "Admin" }),
        deleteById: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.deleteAccount({ requesterId: "admin", targetId: "u2" })
    ).rejects.toThrow(NotFoundError);
  });
});
