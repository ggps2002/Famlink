import { describe, it, expect, vi } from "vitest";
import { FavouriteService } from "#src/modules/favourite/favourite.service.js";
import { NotFoundError } from "#src/core/errors/index.js";

const build = ({ favourite = [], type = "Nanny", members = [], jobs = [] } = {}) => {
  const userRepository = {
    findById: vi.fn().mockResolvedValue({ favourite, type }),
    find: vi.fn().mockImplementation(({ _id: { $in: ids } }) =>
      Promise.resolve(members.filter((member) => ids.includes(String(member._id))))
    ),
  };

  const jobRepository = {
    find: vi.fn().mockImplementation(({ _id: { $in: ids } }) =>
      Promise.resolve(jobs.filter((job) => ids.includes(String(job._id))))
    ),
  };

  return {
    service: new FavouriteService({ userRepository, jobRepository }),
    userRepository,
    jobRepository,
  };
};

describe("list", () => {
  it("returns a caregiver's saved member profiles", async () => {
    // The bug this covers: the whole array used to be resolved against ONE
    // collection chosen by the caller's type — jobs for a caregiver. A nanny
    // could heart a member's profile card, watch it turn red, and never see it
    // again, because the saved id was looked for among job posts.
    const { service } = build({
      type: "Nanny",
      favourite: ["m1"],
      members: [{ _id: "m1", name: "Sam", reviews: [] }],
    });

    const { data } = await service.list({ userId: "u1", page: 1, limit: 10 });

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Sam");
    expect(data[0].kind).toBe("member");
  });

  it("returns members and job posts side by side", async () => {
    const { service } = build({
      favourite: ["j1", "m1"],
      members: [{ _id: "m1", name: "Sam", reviews: [] }],
      jobs: [{ _id: "j1", jobType: "nanny", user: { _id: "u9", name: "Lee", reviews: [] } }],
    });

    const { data } = await service.list({ userId: "u1", page: 1, limit: 10 });

    expect(data.map((row) => row.kind)).toEqual(["job", "member"]);
  });

  it("preserves the saved order, newest first", async () => {
    // `toggle` unshifts precisely so the list reads most-recently-saved first.
    // Handing skip/limit to the query returned rows in whatever order the index
    // produced and threw that intent away.
    const { service } = build({
      favourite: ["m3", "m1", "m2"],
      members: [
        { _id: "m1", name: "One", reviews: [] },
        { _id: "m2", name: "Two", reviews: [] },
        { _id: "m3", name: "Three", reviews: [] },
      ],
    });

    const { data } = await service.list({ userId: "u1", page: 1, limit: 10 });

    expect(data.map((row) => row.name)).toEqual(["Three", "One", "Two"]);
  });

  it("pages the saved order rather than each collection", async () => {
    const { service, userRepository } = build({
      favourite: ["m1", "m2", "m3"],
      members: [
        { _id: "m1", name: "One", reviews: [] },
        { _id: "m2", name: "Two", reviews: [] },
        { _id: "m3", name: "Three", reviews: [] },
      ],
    });

    const { data } = await service.list({ userId: "u1", page: 2, limit: 2 });

    // Only the ids on this page are asked for.
    expect(userRepository.find.mock.calls[0][0]._id.$in).toEqual(["m3"]);
    expect(data.map((row) => row.name)).toEqual(["Three"]);
  });

  it("drops a saved id whose target no longer exists but still counts it", async () => {
    // A deleted job or a closed account leaves its id behind in the array. The
    // count is deliberately taken from the array, not the fetched page.
    const { service } = build({
      favourite: ["m1", "gone"],
      members: [{ _id: "m1", name: "Sam", reviews: [] }],
    });

    const { data, pagination } = await service.list({ userId: "u1", page: 1, limit: 10 });

    expect(data).toHaveLength(1);
    expect(pagination.totalRecords).toBe(2);
  });

  it("attaches a rating to a saved member", async () => {
    const { service } = build({
      favourite: ["m1"],
      members: [{ _id: "m1", name: "Sam", reviews: [{ rating: 5 }, { rating: 4 }] }],
    });

    const { data } = await service.list({ userId: "u1", page: 1, limit: 10 });

    expect(data[0].averageRating).toBe(4.5);
    expect(data[0].totalRatings).toBe(2);
  });

  it("withholds a saved member's contact details", async () => {
    // Favouriting someone does not entitle you to their email or their address.
    const { service } = build({
      favourite: ["m1"],
      members: [{ _id: "m1", name: "Sam", email: "sam@example.com", reviews: [] }],
    });

    const { data } = await service.list({ userId: "u1", page: 1, limit: 10 });

    expect(data[0]).not.toHaveProperty("email");
  });

  it("refuses an unknown user", async () => {
    const { service } = build();
    service.userRepository.findById = vi.fn().mockResolvedValue(null);

    await expect(service.list({ userId: "nope" })).rejects.toThrow(NotFoundError);
  });
});

describe("toggle", () => {
  it("adds to the front so the list reads newest first", async () => {
    const user = { favourite: ["old"], save: vi.fn() };
    const { service } = build();
    service.userRepository.findById = vi.fn().mockResolvedValue(user);

    const { removed } = await service.toggle({ userId: "u1", favouriteUserId: "new" });

    expect(removed).toBe(false);
    expect(user.favourite).toEqual(["new", "old"]);
  });

  it("removes an id that is already saved", async () => {
    const user = { favourite: ["a", "b"], save: vi.fn() };
    const { service } = build();
    service.userRepository.findById = vi.fn().mockResolvedValue(user);

    const { removed } = await service.toggle({ userId: "u1", favouriteUserId: "a" });

    expect(removed).toBe(true);
    expect(user.favourite).toEqual(["b"]);
  });
});
