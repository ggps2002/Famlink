import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import { toPublicUser } from "../user/user.privacy.js";
import { ratingOf } from "../review/rating.js";
import { milesToRadians } from "../user/user.repository.js";
import { buildShareBrowseFilter } from "./shareBrowse.query.js";

/** The default browse radius, in miles, when the member has not moved the slider. */
const DEFAULT_RADIUS_MILES = 5;

/**
 * Owner fields the member-facing "my own profile" view populates.
 *
 * Wider than the public projection because this is the member's own record.
 */
const OWN_PROFILE_OWNER_FIELDS =
  "name email goal type imageUrl zipCode location noOfChildren additionalInfo sheetId reviews";

/** The same, plus the join date, for the console's table. */
const ADMIN_OWNER_FIELDS = `${OWN_PROFILE_OWNER_FIELDS} createdAt`;

/**
 * A share profile as another member may see it.
 *
 * `shareToken` is stripped. It is the capability behind /share/public/<token>:
 * not secret the way a password is, but attaching it to every row of a browse
 * response would let one account walk away with a working public link for every
 * member in its radius. It stays with the owner, who gets it from
 * /share/my-share-link.
 */
const toBrowsableProfile = (profile, extra = {}) => {
  const src = typeof profile?.toObject === "function" ? profile.toObject() : profile;
  const { shareToken: _withheld, ...rest } = src || {};

  return { ...rest, userId: toPublicUser(src?.userId), ...extra };
};

export class ShareService extends BaseService {
  /**
   * The nanny-share directory.
   *
   * Anyone the member has already sent or received a match request with is
   * removed, so the browse list is only people they have not acted on yet.
   */
  async browse({ userId, criteria = {} }) {
    const { page = 1, limit = 10, location } = criteria;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    const caller = await this.userRepository.findById(userId, {
      select: "location type",
      lean: true,
    });

    if (!caller?.location?.coordinates) {
      throw new ValidationError("User location not found");
    }

    const audience = await this.#audience({ userId, caller, location });

    const profiles = await this.profileRepository.findBrowsable(
      buildShareBrowseFilter(criteria, audience)
    );

    // Everyone this member already has a request with, in one query. This was
    // previously one findOne per profile on the page — an N+1 that ran the
    // length of the whole matched set, not just the page being returned.
    const counterparties = await this.matchRepository.counterpartyIds(userId);

    // The `profile.userId &&` guard is new: a profile whose owner has been
    // deleted has a dangling reference, and reading `_id` off it threw and
    // failed the whole browse request with a 500. Those rows are skipped now.
    const unmatched = profiles.filter(
      (profile) => profile.userId && !counterparties.has(String(profile.userId._id))
    );

    // ── Rating ───────────────────────────────────────────────────────────────
    // Applied here rather than in the Mongo filter because a rating is derived
    // from reviews on the USER document while the query runs over profiles —
    // the reviews only exist once `userId` has been populated.
    //
    // It runs before the slice, so `totalRecords` and the page count describe
    // the filtered set. Filtering the page instead would leave the pager
    // promising results that later pages do not contain.
    //
    // Unrated members are excluded rather than shown, which is the one place
    // this file departs from the "no answer is not a no" rule the rate and age
    // filters follow. Those describe an unanswered question; this describes
    // what other members reported, and someone who asks for 4+ stars is setting
    // a threshold of evidence. In a directory where most profiles have no
    // reviews yet, passing the unrated through leaves the list very nearly
    // unchanged — a filter that visibly does nothing.
    const minRating = Number(criteria.minRating) || 0;

    const rated = unmatched.map((profile) => ({
      profile,
      rating: ratingOf(profile.userId?.reviews),
    }));

    const visible =
      minRating > 0
        ? rated.filter(({ rating }) => rating.averageRating >= minRating)
        : rated;

    return {
      // `status` and `matchId` are always null by construction — everything
      // with a request was just filtered out. Kept because the browse card
      // reads both keys.
      // `averageRating` / `totalRatings` ride along so the browse card can show
      // the stars without a second request, and so the number it prints is the
      // same one the filter above compared.
      data: visible
        .slice(skip, skip + pageSize)
        .map(({ profile, rating }) =>
          toBrowsableProfile(profile, { status: null, matchId: null, ...rating })
        ),
      pagination: {
        totalRecords: visible.length,
        totalPages: Math.ceil(visible.length / pageSize),
        currentPage: pageNumber,
        pageSize,
      },
    };
  }

  /**
   * Members whose profiles may appear, split by role.
   *
   * The caller is always included regardless of distance or completeness, so
   * they can see their own listing in the browse view. Everyone else must have
   * finished their profile.
   */
  async #audience({ userId, caller, location }) {
    const filter = {
      $or: [{ _id: userId }, { _id: { $ne: userId }, nannyProfileCompleted: true }],
    };

    if (location) {
      const [lng, lat] = caller.location.coordinates;
      const miles = parseFloat(location) || DEFAULT_RADIUS_MILES;
      filter.location = {
        $geoWithin: { $centerSphere: [[lng, lat], milesToRadians(miles)] },
      };
    }

    const users = await this.userRepository.findIdsAndTypes(filter);

    return {
      all: users.map((user) => user._id),
      family: users.filter((user) => user.type === "Parents").map((user) => user._id),
      nanny: users.filter((user) => user.type === "Nanny").map((user) => user._id),
    };
  }

  /** The member's own share profile, as they see it. */
  async ownProfile(userId) {
    if (!userId) throw new ValidationError("User Id not found");

    const user = await this.userRepository.findById(userId, { select: "_id", lean: true });
    if (!user) throw new NotFoundError("User not found");

    const profile = await this.profileRepository.findByUserId(userId, {
      populate: { path: "userId", select: OWN_PROFILE_OWNER_FIELDS },
    });

    if (!profile) throw new NotFoundError("User profile not found");

    // Shaped like a browse row so the "Your Profile" card can render from the
    // same props as everyone else's — without this it was the one card on the
    // page that never showed its own rating.
    const src = typeof profile.toObject === "function" ? profile.toObject() : profile;

    return { ...src, ...ratingOf(src.userId?.reviews) };
  }

  /* ─────────────────────────────── admin console ────────────────────────── */

  async #requireAdmin(userId) {
    const user = await this.userRepository.findById(userId, { select: "type", lean: true });
    if (!user || user.type !== "Admin") throw new ForbiddenError("Access denied. Admins only.");
    return user;
  }

  /**
   * Every share profile, for the console.
   *
   * Filtering runs in the database rather than over the page already fetched.
   * A search applied to twelve loaded rows would look like it covered the
   * platform while covering one page, so a member on page three would read as
   * "no results" rather than as "not on this page".
   */
  async listAllForAdmin({ adminId, query = {} }) {
    await this.#requireAdmin(adminId);

    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(query.limit, 10) || 12, 100);
    const filter = {};

    const search = String(query.search ?? "").trim();
    const role = String(query.role ?? "all").trim();

    // Name, email, city and role all live on the referenced user, so both
    // filters resolve through one user query and land as a single id list.
    const userFilter = {};
    if (search) {
      const term = new RegExp(this.escapeRegex(search), "i");
      userFilter.$or = [{ name: term }, { email: term }, { "location.format_location": term }];
    }
    if (role === "family") userFilter.type = "Parents";
    else if (role === "caregiver") userFilter.type = "Nanny";

    if (Object.keys(userFilter).length > 0) {
      const matched = await this.userRepository.findIdsMatching(userFilter);
      filter.userId = { $in: matched.map((user) => user._id) };
    }

    const shareType = String(query.shareType ?? "").trim();
    if (shareType && shareType !== "all") {
      // Families answer `nannyShareType`, caregivers answer `careType`.
      // Matching only the first would drop every caregiver profile.
      filter.$or = [{ nannyShareType: shareType }, { careType: shareType }];
    }

    const { profiles, totalRecords } = await this.profileRepository.findAdminPage(filter, {
      skip: (page - 1) * limit,
      limit,
      select: ADMIN_OWNER_FIELDS,
    });

    return {
      data: profiles,
      pagination: {
        totalRecords,
        totalPages: Math.max(Math.ceil(totalRecords / limit), 1),
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  /** The share types present in the data, for the console's filter dropdown. */
  async filterOptionsForAdmin(adminId) {
    await this.#requireAdmin(adminId);

    const [shareTypes, careTypes] = await this.profileRepository.distinctShareTypes();
    const usable = (values) => values.filter((value) => typeof value === "string" && value.trim());

    return [...new Set([...usable(shareTypes), ...usable(careTypes)])].sort();
  }
}

export default ShareService;
