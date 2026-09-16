import { BaseRepository } from "../../core/database/BaseRepository.js";
import { looksLikeObjectId } from "./blogSlug.js";
import Blog from "./blog.model.js";

/**
 * Resource articles.
 *
 * The distinction that matters throughout: a draft is not public. Every
 * member-facing read here filters `isDraft: false`, and the admin reads are
 * separate methods rather than a flag, so a public route cannot serve an
 * unfinished article by passing the wrong argument.
 */
export class BlogRepository extends BaseRepository {
  constructor(model = Blog) {
    super(model);
  }

  /**
   * Find a published article by slug or by id.
   *
   * Both are already out in the world: the original resources are linked by
   * slug from the site and from Google, and everything published before slugs
   * existed is linked by Mongo id from the weekly resources email.
   *
   * Slug is tried first because it is the common case now, and because calling
   * `findById` with a non-id string throws a CastError rather than returning
   * null.
   */
  findByIdOrSlug(idOrSlug) {
    return looksLikeObjectId(idOrSlug)
      ? this.findById(idOrSlug)
      : this.findOne({ slug: String(idOrSlug).toLowerCase() });
  }

  /** One page of the public resources list. */
  async findPublishedPage({ category, skip, limit }) {
    const filter = { isDraft: false };
    if (category) filter.category = category;

    const [blogs, totalRecords] = await Promise.all([
      this.find(filter, {
        skip,
        limit,
        // Newest published first, falling back to creation date for the
        // articles that predate `publishedAt`.
        sort: { publishedAt: -1, createdAt: -1 },
      }),
      this.count(filter),
    ]);

    return { blogs, totalRecords };
  }

  findByCategory(category) {
    return this.find({ category });
  }

  /** Other published articles in the same category, excluding this one. */
  findRelated({ category, excludeId }) {
    return this.find({ category, isDraft: false, _id: { $ne: excludeId } });
  }

  /** Every article, drafts included. The admin list — never a public one. */
  findAllForAdmin() {
    return this.find({}, { sort: { createdAt: -1 } });
  }
}

export const blogRepository = new BlogRepository();

export default blogRepository;
