import mongoose from "mongoose";
import { NotFoundError, ValidationError } from "../errors/index.js";

/**
 * Every query against a collection goes through a repository, and every
 * repository extends this.
 *
 * The point is not to hide Mongoose — it is to give the persistence layer a
 * seam. Right now the same query is written slightly differently in a dozen
 * places (`.lean()` here but not there, `parseInt(page)` with a different cap
 * per route), and a change to how pagination works means finding all of them.
 * Shared mechanics live here; a subclass adds only the queries that are
 * specific to its domain, and reads as a list of things the domain can ask.
 *
 * `lean` defaults to false so a document returned from here behaves like one
 * from a bare `Model.findById()` — it has virtuals, and `.save()` works.
 * Read-only paths should pass `{ lean: true }`.
 */
export class BaseRepository {
  /** @param {import("mongoose").Model} model */
  constructor(model) {
    if (!model) {
      throw new Error(`${new.target.name} was constructed without a model.`);
    }
    this.model = model;
  }

  get modelName() {
    return this.model.modelName;
  }

  /**
   * Coerce a value to an ObjectId, rejecting anything that isn't one.
   *
   * Passing an arbitrary string into a query on an ObjectId field makes
   * Mongoose throw a CastError, which surfaces as a 500 — an unhandled server
   * fault for what is really a malformed request. This turns it into a 400.
   */
  toObjectId(value, field = "id") {
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (!mongoose.isValidObjectId(value)) {
      throw new ValidationError(`Invalid ${field}`);
    }
    return new mongoose.Types.ObjectId(String(value));
  }

  /** Applies the shared query options. Kept private so subclasses can't drift. */
  #applyOptions(query, { select, populate, sort, skip, limit, lean = false } = {}) {
    if (select) query.select(select);
    if (populate) query.populate(populate);
    if (sort) query.sort(sort);
    if (typeof skip === "number") query.skip(skip);
    if (typeof limit === "number") query.limit(limit);
    if (lean) query.lean();
    return query;
  }

  findById(id, options = {}) {
    return this.#applyOptions(this.model.findById(id), options).exec();
  }

  findOne(filter = {}, options = {}) {
    return this.#applyOptions(this.model.findOne(filter), options).exec();
  }

  find(filter = {}, options = {}) {
    return this.#applyOptions(this.model.find(filter), options).exec();
  }

  /**
   * One page of results plus the metadata the frontend's infinite-scroll lists
   * expect. `limit` is capped because several list endpoints return whole user
   * records — an uncaught `?limit=100000` turns one request into a dump of the
   * collection.
   */
  async paginate(filter = {}, { page = 1, limit = 25, maxLimit = 200, ...options } = {}) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (safePage - 1) * safeLimit;

    // Counting and fetching are independent, so the round trips overlap.
    const [data, totalRecords] = await Promise.all([
      this.find(filter, { ...options, skip, limit: safeLimit }),
      this.count(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / safeLimit));

    return {
      data,
      pagination: {
        currentPage: safePage,
        pageSize: safeLimit,
        totalPages,
        totalRecords,
        hasMore: safePage < totalPages,
      },
    };
  }

  create(data) {
    return this.model.create(data);
  }

  insertMany(docs, options = {}) {
    return this.model.insertMany(docs, options);
  }

  /** Returns the document *after* the update, which is almost always what the caller wants. */
  updateById(id, update, options = {}) {
    return this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true, ...options })
      .exec();
  }

  updateOne(filter, update, options = {}) {
    return this.model
      .findOneAndUpdate(filter, update, { new: true, runValidators: true, ...options })
      .exec();
  }

  updateMany(filter, update, options = {}) {
    return this.model.updateMany(filter, update, options).exec();
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id).exec();
  }

  deleteOne(filter) {
    return this.model.deleteOne(filter).exec();
  }

  deleteMany(filter) {
    return this.model.deleteMany(filter).exec();
  }

  count(filter = {}) {
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter) {
    return (await this.model.exists(filter)) !== null;
  }

  aggregate(pipeline) {
    return this.model.aggregate(pipeline).exec();
  }

  /**
   * Find one document or throw. Saves every caller the same three lines, and
   * makes "missing" a single consistent 404 rather than each route's own
   * wording and status.
   */
  async findByIdOrFail(id, options = {}, message = null) {
    const doc = await this.findById(id, options);
    if (!doc) throw new NotFoundError(message ?? `${this.modelName} not found`);
    return doc;
  }
}

export default BaseRepository;
