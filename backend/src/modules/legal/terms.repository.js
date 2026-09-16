import { BaseRepository } from "../../core/database/BaseRepository.js";
import Terms from "./terms.model.js";

/**
 * The legal documents, versioned.
 *
 * There is exactly one published row per slug — enforced by a partial unique
 * index — and every surface that shows the terms reads that row. Propagation is
 * therefore not a mechanism that has to run; it is the only thing that can
 * happen.
 */
export class TermsRepository extends BaseRepository {
  constructor(model = Terms) {
    super(model);
  }

  findPublished(slug, options = {}) {
    return this.findOne({ slug, isPublished: true }, options);
  }

  /**
   * The highest version number that has EVER existed for a slug.
   *
   * Not the published one. Version numbers must never be reused, and reading
   * the published row would reuse a number after a rollback — leaving two
   * different documents that both claim to be v4, with `termsAcceptedVersion`
   * unable to tell them apart.
   */
  findHighestVersion(slug) {
    return this.findOne({ slug }, { sort: { version: -1 }, select: "version", lean: true });
  }

  history(slug, limit = 50) {
    return this.find(
      { slug },
      {
        select:
          "version title effectiveDate isPublished requiresReacceptance changeSummary createdAt publishedBy",
        populate: { path: "publishedBy", select: "name email" },
        sort: { version: -1 },
        limit,
        lean: true,
      }
    );
  }

  setPublished(id, isPublished) {
    return this.model.updateOne({ _id: id }, { $set: { isPublished } }).exec();
  }
}

export const termsRepository = new TermsRepository();

export default termsRepository;
