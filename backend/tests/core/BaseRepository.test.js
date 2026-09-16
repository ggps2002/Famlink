import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { BaseRepository } from "#src/core/database/BaseRepository.js";
import { NotFoundError, ValidationError } from "#src/core/errors/index.js";

/**
 * A stand-in for a Mongoose Model that records the chain a repository builds.
 * Enough to assert *which* query options were applied without a live database.
 */
const fakeModel = (result = null) => {
  const calls = { select: null, populate: null, sort: null, skip: null, limit: null, lean: false };

  const query = {
    select: vi.fn((v) => ((calls.select = v), query)),
    populate: vi.fn((v) => ((calls.populate = v), query)),
    sort: vi.fn((v) => ((calls.sort = v), query)),
    skip: vi.fn((v) => ((calls.skip = v), query)),
    limit: vi.fn((v) => ((calls.limit = v), query)),
    lean: vi.fn(() => ((calls.lean = true), query)),
    exec: vi.fn(async () => result),
  };

  return {
    calls,
    query,
    modelName: "Widget",
    findById: vi.fn(() => query),
    findOne: vi.fn(() => query),
    find: vi.fn(() => query),
    findByIdAndUpdate: vi.fn(() => query),
    findOneAndUpdate: vi.fn(() => query),
    findByIdAndDelete: vi.fn(() => query),
    countDocuments: vi.fn(() => ({ exec: async () => 42 })),
    create: vi.fn(async (d) => ({ ...d, _id: "created" })),
    exists: vi.fn(async () => null),
  };
};

describe("BaseRepository", () => {
  it("refuses to construct without a model", () => {
    expect(() => new BaseRepository()).toThrow(/without a model/);
  });

  it("applies only the options it was given", async () => {
    const model = fakeModel({ _id: "1" });
    const repo = new BaseRepository(model);

    await repo.findById("1", { select: "name", lean: true });

    expect(model.calls.select).toBe("name");
    expect(model.calls.lean).toBe(true);
    expect(model.query.sort).not.toHaveBeenCalled();
    expect(model.query.limit).not.toHaveBeenCalled();
  });

  it("returns hydrated documents unless lean is asked for", async () => {
    const model = fakeModel({ _id: "1" });
    // Defaulting to lean would break every caller that goes on to .save().
    await new BaseRepository(model).findById("1");

    expect(model.calls.lean).toBe(false);
  });

  describe("toObjectId", () => {
    it("rejects a non-id as a 400 rather than letting Mongoose throw a 500", () => {
      const repo = new BaseRepository(fakeModel());

      expect(() => repo.toObjectId("not-an-id", "userId")).toThrow(ValidationError);
      expect(() => repo.toObjectId("not-an-id", "userId")).toThrow("Invalid userId");
    });

    it("passes through a valid id and an existing ObjectId", () => {
      const repo = new BaseRepository(fakeModel());
      const id = new mongoose.Types.ObjectId();

      expect(String(repo.toObjectId(String(id)))).toBe(String(id));
      expect(repo.toObjectId(id)).toBe(id);
    });
  });

  describe("paginate", () => {
    it("computes skip from a 1-based page and reports hasMore", async () => {
      const model = fakeModel([{ _id: "1" }]);
      const repo = new BaseRepository(model);

      const result = await repo.paginate({}, { page: 2, limit: 10 });

      expect(model.calls.skip).toBe(10);
      expect(model.calls.limit).toBe(10);
      expect(result.pagination).toEqual({
        currentPage: 2,
        pageSize: 10,
        totalPages: 5, // 42 records / 10
        totalRecords: 42,
        hasMore: true,
      });
    });

    it("caps limit so ?limit=100000 can't dump the collection", async () => {
      const model = fakeModel([]);
      await new BaseRepository(model).paginate({}, { page: 1, limit: 100000 });

      expect(model.calls.limit).toBe(200);
    });

    it("falls back to sane values for junk paging input", async () => {
      const model = fakeModel([]);
      const repo = new BaseRepository(model);

      const result = await repo.paginate({}, { page: -3, limit: "abc" });

      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.pageSize).toBe(25);
      expect(model.calls.skip).toBe(0);
    });

    it("reports hasMore false on the last page", async () => {
      const model = fakeModel([]);
      const result = await new BaseRepository(model).paginate({}, { page: 5, limit: 10 });

      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe("findByIdOrFail", () => {
    it("throws a NotFoundError naming the model", async () => {
      const repo = new BaseRepository(fakeModel(null));

      await expect(repo.findByIdOrFail("1")).rejects.toThrow(NotFoundError);
      await expect(repo.findByIdOrFail("1")).rejects.toThrow("Widget not found");
    });

    it("accepts a caller-supplied message", async () => {
      const repo = new BaseRepository(fakeModel(null));

      await expect(repo.findByIdOrFail("1", {}, "No such share")).rejects.toThrow("No such share");
    });

    it("returns the document when it exists", async () => {
      const repo = new BaseRepository(fakeModel({ _id: "1" }));

      await expect(repo.findByIdOrFail("1")).resolves.toEqual({ _id: "1" });
    });
  });

  it("returns the updated document by default", async () => {
    const model = fakeModel({ _id: "1" });
    await new BaseRepository(model).updateById("1", { name: "x" });

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      "1",
      { name: "x" },
      expect.objectContaining({ new: true, runValidators: true })
    );
  });
});
