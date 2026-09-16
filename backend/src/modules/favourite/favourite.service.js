import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError } from "../../core/errors/index.js";
import { PUBLIC_USER_SELECT, toPublicUser } from "../user/user.privacy.js";
import { ratingOf } from "../review/rating.js";

/**
 * A member's saved list.
 *
 * Two different things get saved into one `favourite` array of ids: job posts,
 * hearted from the job listing, and members, hearted from a profile card. The
 * array is `Mixed` and carries both kinds side by side.
 *
 * This used to resolve the whole array against ONE collection, picked from the
 * caller's type — jobs for a caregiver, members for a family. A caregiver could
 * therefore heart a member's profile card, watch it turn red, and never see it
 * again: the id was saved, and then looked for among job posts. Every id is now
 * resolved against both collections and tagged with which one it came from, so
 * a saved row appears for whoever saved it.
 */
export class FavouriteService extends BaseService {
  /**
   * Add or remove — one endpoint, decided by whether the id is already there.
   * Returns which of the two happened so the controller can say so.
   */
  async toggle({ userId, favouriteUserId }) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const index = user.favourite.indexOf(favouriteUserId);
    const wasFavourite = index !== -1;

    if (wasFavourite) {
      user.favourite.splice(index, 1);
    } else {
      // unshift, not push: the list is shown most-recently-saved first.
      user.favourite.unshift(favouriteUserId);
    }

    await user.save();

    return { removed: wasFavourite };
  }

  async list({ userId, page = 1, limit = 1 }) {
    const user = await this.userRepository.findById(userId, { select: "favourite type" });
    if (!user) throw new NotFoundError("User not found");

    const favouriteIds = (user.favourite || []).map(String);

    // Page the saved ORDER, then resolve those ids — rather than handing skip
    // and limit to the query. `toggle` unshifts precisely so the list reads
    // most-recently-saved first, and a `$in` with skip/limit returns rows in
    // whatever order the index produces, throwing that intent away. Slicing
    // first is also what lets a single page hold both kinds at once.
    const skip = (page - 1) * limit;
    const pageIds = favouriteIds.slice(skip, skip + limit);

    // Two queries rather than one, each over at most `limit` ids. An id matches
    // in one collection or neither, so there is nothing to disambiguate.
    const [members, jobs] = await Promise.all([
      this.#favouriteMembers(pageIds),
      this.#favouriteJobs(pageIds),
    ]);

    const byId = new Map(
      [...members, ...jobs].map((row) => [String(row._id), row])
    );

    // Counted from the id array rather than the fetched page, so a saved item
    // whose target has since been deleted still counts. Preserved as-is.
    const totalRecords = favouriteIds.length;

    return {
      // Rebuilt in saved order, and `filter(Boolean)` drops the ids whose
      // target no longer exists — a deleted job or a closed account leaves its
      // id behind in the array.
      data: pageIds.map((id) => byId.get(id)).filter(Boolean),
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit,
      },
    };
  }

  /**
   * Saved job posts, each carrying its poster's public profile and rating.
   *
   * `kind` is what the Favourites page branches on. A job row and a member row
   * have entirely different shapes, and now that one page can contain both, the
   * client needs to be told which it is holding rather than sniffing for a
   * `user` key.
   */
  async #favouriteJobs(ids) {
    const jobs = await this.jobRepository.find(
      { _id: { $in: ids } },
      {
        populate: { path: "user", select: PUBLIC_USER_SELECT },
        lean: true,
      }
    );

    return jobs.map((job) => {
      const rating = ratingOf(job.user?.reviews);

      return {
        ...job,
        kind: "job",
        user: {
          ...toPublicUser(job.user),
          ...rating,
        },
      };
    });
  }

  /**
   * Saved members, through the public projection.
   *
   * Favouriting someone does not entitle you to their contact details or their
   * address — this used to return both.
   */
  async #favouriteMembers(ids) {
    const users = await this.userRepository.find(
      { _id: { $in: ids } },
      { select: PUBLIC_USER_SELECT, lean: true }
    );

    return users.map((user) => ({
      ...toPublicUser(user),
      kind: "member",
      // Precomputed for the same reason the browse rows carry it: the card
      // shows a rating, and deriving it in two places invites the two to
      // disagree.
      ...ratingOf(user.reviews),
    }));
  }
}

export default FavouriteService;
