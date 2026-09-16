import { describe, it, expect, vi } from "vitest";
import { UserAdminService } from "#src/modules/user/userAdmin.service.js";
import { ForbiddenError, NotFoundError } from "#src/core/errors/index.js";

const anAdmin = { type: "Admin" };
const aMember = { type: "Nanny" };

const build = (caller = anAdmin, over = {}) => {
  const userRepository = {
    findById: vi.fn().mockResolvedValue(caller),
    findAdminPage: vi.fn().mockResolvedValue({ users: [], totalRecords: 0 }),
    findAdminById: vi.fn().mockResolvedValue({ _id: "u2" }),
    topRatedByType: vi.fn().mockResolvedValue([]),
    ...over,
  };

  return { service: new UserAdminService({ userRepository }), userRepository };
};

const paging = { page: 1, limit: 10, skip: 0 };

describe("the admin gate", () => {
  it.each([
    ["topRated", (s) => s.topRated("u1")],
    ["listFamilies", (s) => s.listFamilies({ adminId: "u1", ...paging })],
    ["listNannies", (s) => s.listNannies({ adminId: "u1", ...paging })],
    ["listAll", (s) => s.listAll({ adminId: "u1", ...paging })],
    ["getById", (s) => s.getById({ adminId: "u1", userId: "u2" })],
  ])("blocks a non-admin from %s", async (_name, call) => {
    // Each of these returns the private tier — email, phone, date of birth,
    // subscription state — for the whole user base.
    const { service, userRepository } = build(aMember);

    await expect(call(service)).rejects.toThrow(ForbiddenError);
    expect(userRepository.findAdminPage).not.toHaveBeenCalled();
    expect(userRepository.findAdminById).not.toHaveBeenCalled();
  });

  it("never loads the caller's full record just to check their type", async () => {
    // An admin has a bcrypt hash and a Stripe id like anyone else; there is no
    // reason for either to be read on every console request.
    const { service, userRepository } = build();

    await service.topRated("u1");

    expect(userRepository.findById.mock.calls[0][1]).toMatchObject({ select: "type" });
  });

  it("keeps each route's own wording for a missing account", async () => {
    // These five routes worded the same two failures five different ways. The
    // console matches on the text, so the move preserves it rather than
    // standardising — see the note on #requireAdmin.
    const { service } = build(null);

    await expect(service.listAll({ adminId: "u1", ...paging })).rejects.toThrow("User not found");
    await expect(service.getById({ adminId: "u1", userId: "u2" })).rejects.toThrow(
      "Admin not found"
    );
  });

  it("answers 403, not 404, on the routes that never distinguished the two", async () => {
    const { service } = build(null);

    await expect(service.topRated("u1")).rejects.toThrow(ForbiddenError);
    await expect(service.listFamilies({ adminId: "u1", ...paging })).rejects.toThrow(
      "Access denied. Admins only."
    );
  });
});

describe("topRated", () => {
  it("asks for both sides of the marketplace", async () => {
    const { service, userRepository } = build();

    await service.topRated("u1");

    expect(userRepository.topRatedByType.mock.calls.map(([type]) => type)).toEqual([
      "Nanny",
      "Parents",
    ]);
  });

  it("formats each side into leaderboard rows", async () => {
    const { service } = build(anAdmin, {
      topRatedByType: vi
        .fn()
        .mockResolvedValue([{ _id: "u2", name: "Sam Ortiz", avgRating: 4.8, reviewCount: 6 }]),
    });

    const { topNannies } = await service.topRated("u1");

    expect(topNannies[0]).toEqual({
      id: "u2",
      firstName: "Sam",
      lastName: "Ortiz",
      profileImage: undefined,
      avgRating: 4.8,
      reviewCount: 6,
    });
  });
});

describe("listFamilies / listNannies", () => {
  it("filters by type and shows the newest first", async () => {
    const { service, userRepository } = build();

    await service.listFamilies({ adminId: "u1", ...paging });

    const [filter, options] = userRepository.findAdminPage.mock.calls[0];
    expect(filter).toEqual({ type: "Parents" });
    expect(options.sort).toEqual({ createdAt: -1 });
  });

  it("drops the settings blob and Mongoose bookkeeping from the projection", async () => {
    const { service, userRepository } = build();

    await service.listNannies({ adminId: "u1", ...paging });

    expect(userRepository.findAdminPage.mock.calls[0][1].select).toContain("-notifications");
    expect(userRepository.findAdminPage.mock.calls[0][1].select).toContain("-__v");
  });

  it("formats families and nannies with their own row shapes", async () => {
    const record = {
      _id: "u2",
      name: "Sam Ortiz",
      email: "sam@example.com",
      reviews: [],
      additionalInfo: [],
    };
    const { service } = build(anAdmin, {
      findAdminPage: vi.fn().mockResolvedValue({ users: [record], totalRecords: 1 }),
    });

    const families = await service.listFamilies({ adminId: "u1", ...paging });
    const nannies = await service.listNannies({ adminId: "u1", ...paging });

    expect(families.data[0].role).toBe("Parents");
    expect(families.data[0]).not.toHaveProperty("premium");
    expect(nannies.data[0].role).toBe("Nanny");
    expect(nannies.data[0]).toHaveProperty("premium");
  });

  it("returns the pager shape the console's tables read", async () => {
    const { service } = build(anAdmin, {
      findAdminPage: vi.fn().mockResolvedValue({ users: [], totalRecords: 42 }),
    });

    const { pagination } = await service.listFamilies({ adminId: "u1", page: 2, limit: 10, skip: 10 });

    expect(pagination).toEqual({
      totalRecords: 42,
      totalPages: 5,
      currentPage: 2,
      limit: 10,
    });
  });
});

describe("listAll", () => {
  it("excludes staff from the default view", async () => {
    const { service, userRepository } = build();

    await service.listAll({ adminId: "u1", userType: null, ...paging });

    expect(userRepository.findAdminPage.mock.calls[0][0]).toEqual({ type: { $ne: "Admin" } });
  });

  it("filters to one type when asked", async () => {
    const { service, userRepository } = build();

    await service.listAll({ adminId: "u1", userType: "Nanny", ...paging });

    expect(userRepository.findAdminPage.mock.calls[0][0]).toEqual({ type: "Nanny" });
  });

  it("returns the records unformatted, unlike the two table endpoints", async () => {
    // This one feeds a screen that reads the raw fields.
    const { service } = build(anAdmin, {
      findAdminPage: vi.fn().mockResolvedValue({ users: [{ _id: "u2" }], totalRecords: 1 }),
    });

    expect((await service.listAll({ adminId: "u1", ...paging })).data).toEqual([{ _id: "u2" }]);
  });
});

describe("getById", () => {
  it("404s a user id that does not exist", async () => {
    const { service } = build(anAdmin, { findAdminById: vi.fn().mockResolvedValue(null) });

    await expect(service.getById({ adminId: "u1", userId: "gone" })).rejects.toThrow(
      NotFoundError
    );
  });

  it("returns the record through the admin projection", async () => {
    const { service, userRepository } = build();

    expect(await service.getById({ adminId: "u1", userId: "u2" })).toEqual({ _id: "u2" });
    expect(userRepository.findAdminById).toHaveBeenCalledWith("u2");
  });
});
