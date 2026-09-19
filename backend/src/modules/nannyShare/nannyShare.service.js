import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import {
  PUBLIC_USER_SELECT,
  USER_IDENTITY_SELECT,
  withPublicUser,
  withPublicUsers,
} from "../user/user.privacy.js";

/**
 * Nanny share listings: posting one, editing it, and the three ways they get
 * read back — the authenticated browse, the admin table, and the public city
 * pages.
 *
 * Migrated from Routes/nannyShare.js. The rules below are the ones that file
 * enforced, moved rather than rewritten; two of them look like bugs and are
 * called out at the point they apply, because changing them here would be a
 * product decision smuggled into a refactor.
 */

/**
 * The nanny share types the browse filter offers as checkboxes. Anything else a
 * poster typed is reachable only through the "Other" option, which matches by
 * exclusion — so this list is load-bearing for that filter, not decorative.
 */
const STANDARD_TYPES = [
  "full-time care",
  "part-time care",
  "pickup/drop-off (carpool style)",
  "after-school care",
  "summer/seasonal",
  "weekend nanny share",
];

const MILES_TO_KM = 1.60934;
const EARTH_RADIUS_KM = 6378.1;

export class NannyShareService {
  constructor({ nannyShareRepository, userRepository, emailService, templates }) {
    this.shares = nannyShareRepository;
    this.users = userRepository;
    this.email = emailService;
    this.templates = templates;
  }

  /**
   * Post a share.
   *
   * NOTE: the check is `["Admin"].includes(user.type)` — Admin only. The
   * comment above it in the original read "Only Parents & Admins can post
   * jobs", so either the comment or the check has been wrong for a while.
   * Preserved exactly as it behaved; widening it to parents would change who
   * can post, which is not this refactor's call to make.
   */
  async create(userId, data) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (!["Admin"].includes(user.type)) {
      throw new ForbiddenError("Access denied. Unauthorized user.");
    }

    return this.shares.create({ ...data, user: userId });
  }

  /** Delete a share the caller owns. */
  async remove(userId, shareId) {
    const share = await this.#ownedBy(userId, shareId, "delete");
    await this.shares.deleteById(share._id);
  }

  /** Patch the supplied fields of a share the caller owns. */
  async update(userId, shareId, updates) {
    const share = await this.#ownedBy(userId, shareId, "update");

    // Assigned field by field rather than through updateById so that Mongoose
    // applies the schema's setters and validators the same way the original
    // `job[key] = …; job.save()` did.
    for (const key of Object.keys(updates)) {
      share[key] = updates[key];
    }
    await share.save();

    return this.shares.findById(shareId, {
      populate: { path: "user", select: USER_IDENTITY_SELECT },
    });
  }

  /** A share with its poster reduced to the public projection. */
  async detail(shareId) {
    const share = await this.shares.findById(shareId, {
      populate: { path: "user", select: PUBLIC_USER_SELECT },
    });
    if (!share) throw new NotFoundError("Job not found");

    return withPublicUser(share);
  }

  /**
   * The authenticated browse, filtered by distance, rate, children and type.
   *
   * Paginated in memory, not by the database, because the children's-age filter
   * cannot run as a query: ages are stored as strings like "2 yrs" and have to
   * be parsed per document. Slicing after that filter is what keeps the page
   * count honest — counting in Mongo would count rows the filter then removes.
   */
  async browse(userId, query) {
    const {
      minChildren = 0,
      maxChildren = 0,
      minAge = 0,
      maxAge = 0,
      minRate = 0,
      maxRate = 100,
      nannyShareTypes,
      page = 1,
      limit = 10,
      location,
    } = query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const currentUser = await this.users.findById(userId, { select: "location type" });

    // A 400 rather than a 403: this is the shape the browse screens already
    // handle, and changing the status would change how they render it.
    if (currentUser?.type === "Nanny") {
      throw new ValidationError("You aren't authorized");
    }
    if (!currentUser?.location?.coordinates) {
      throw new ValidationError("User location not found");
    }

    const filter = await this.#browseFilter({
      coordinates: currentUser.location.coordinates,
      location,
      minRate,
      maxRate,
      minChildren,
      maxChildren,
      nannyShareTypes,
    });

    const matching = await this.shares.find(filter, {
      populate: { path: "user", select: PUBLIC_USER_SELECT },
      sort: { createdAt: -1 },
    });

    const filtered = this.#byChildAge(matching, { minAge, maxAge });
    const totalRecords = filtered.length;

    return {
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNumber),
        currentPage: pageNumber,
        pageSize: limitNumber,
      },
      data: withPublicUsers(filtered.slice(skip, skip + limitNumber)),
    };
  }

  /** Every share, for the admin console's table. */
  async adminList(userId, { page = 1, limit = 10 }) {
    const admin = await this.users.findById(userId, {
      select: "name email imageUrl zipCode location type",
    });
    if (!admin || admin.type !== "Admin") {
      throw new ForbiddenError("Access denied. Admins only.");
    }

    const limitNumber = parseInt(limit, 10) || 10;
    const pageNumber = parseInt(page, 10) || 1;
    const skip = (pageNumber - 1) * limitNumber;

    const [shares, totalRecords] = await Promise.all([
      this.shares.find(
        {},
        {
          populate: { path: "user", select: "name email imageUrl zipCode location" },
          sort: { createdAt: -1 },
          skip,
          limit: limitNumber,
          lean: true,
        }
      ),
      this.shares.count({}),
    ]);

    return {
      admin,
      data: shares,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber,
      },
    };
  }

  /**
   * Shares posted by members of one city, for the public /nanny-share/:city
   * pages.
   *
   * Unauthenticated, which is why the poster goes through `withPublicUsers`:
   * the projection is what keeps a street address and an exact coordinate off a
   * page that anyone — including a search crawler — can fetch.
   */
  async listByCity(city, { page = 1, limit = 6 }) {
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Word-bounded so that "Oakland" does not also match "Oaklandale", while
    // still matching inside a full formatted address.
    const cityRegex = new RegExp(`\\b${city}\\b`, "i");
    const usersInCity = await this.users.find(
      { "location.format_location": cityRegex },
      { select: "_id" }
    );
    const userIds = usersInCity.map((user) => user._id);

    const filter = { user: { $in: userIds } };
    const [shares, totalRecords] = await Promise.all([
      this.shares.find(filter, {
        populate: { path: "user", select: PUBLIC_USER_SELECT },
        sort: { createdAt: -1 },
        skip,
        limit: limitNumber,
      }),
      this.shares.count(filter),
    ]);

    return {
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNumber),
        currentPage: pageNumber,
        pageSize: limitNumber,
      },
      data: withPublicUsers(shares),
    };
  }

  /** Send the intake-questionnaire nudge. */
  async sendQuestionnaireEmail({ email, name, id }) {
    const html = this.templates.questionnaireEmail({
      firstName: String(name ?? "").split(" ")[0],
      intakeFormUrl: `https://famlink.care/find-nanny-share/nanny-share-questionnaire/${id}`,
      year: new Date().getFullYear(),
    });

    await this.email.sendAutoEmail(
      '"Famlink Team" <system@famlink.care>',
      email,
      "One more step from nanny share matches",
      html
    );
  }

  /* ─────────────────────────────── internals ─────────────────────────────── */

  async #ownedBy(userId, shareId, verb) {
    const share = await this.shares.findById(shareId);
    if (!share) throw new NotFoundError("Nanny Share job not found");

    if (share.user.toString() !== userId) {
      throw new ForbiddenError(`You are not authorized to ${verb} this job`);
    }
    return share;
  }

  /**
   * Build the Mongo filter for a browse request.
   *
   * NOTE: the distance and rate conditions are both inside `if (location)`.
   * Without a `location` query param the rate filter does not apply either, so
   * an unfiltered browse ignores minRate/maxRate entirely. That is how the
   * route behaved and it is preserved; separating the two is a behaviour
   * change and belongs in its own commit.
   */
  async #browseFilter({
    coordinates,
    location,
    minRate,
    maxRate,
    minChildren,
    maxChildren,
    nannyShareTypes,
  }) {
    const filter = {};

    if (location) {
      const [lng, lat] = coordinates;
      const radiusInRadians = (parseFloat(location) * MILES_TO_KM) / EARTH_RADIUS_KM;

      // Built inline rather than through userRepository.withinRadiusFilter,
      // which also constrains `type`. This query deliberately does not — it
      // wants every nearby poster regardless of member type.
      const nearby = await this.users.find(
        { location: { $geoWithin: { $centerSphere: [[lng, lat], radiusInRadians] } } },
        { select: "_id" }
      );

      filter.$and = [
        { user: { $in: nearby.map((user) => user._id) } },
        {
          // Two shapes because the rate is stored either as a range or as a
          // single "specify" figure, depending on which questionnaire version
          // the poster completed.
          $or: [
            {
              "hourlyBudget.min": {
                $exists: true,
                $gte: Number(minRate),
                $lte: Number(maxRate),
              },
            },
            {
              hourlyBudgetSpecify: {
                $exists: true,
                $gte: Number(minRate),
                $lte: Number(maxRate),
              },
            },
          ],
        },
      ];
    }

    // Strictly `<`: equal bounds mean "no preference" rather than "exactly n".
    if (Number(minChildren) < Number(maxChildren)) {
      filter.numberOfChildren = {
        $gte: Number(minChildren),
        $lte: Number(maxChildren),
      };
    }

    if (Array.isArray(nannyShareTypes) && nannyShareTypes.length > 0) {
      const selectedStandard = nannyShareTypes
        .map((type) => type.toLowerCase())
        .filter((type) => STANDARD_TYPES.includes(type));

      const orConditions = [];
      if (selectedStandard.length > 0) {
        orConditions.push({ nannyShareType: { $in: selectedStandard } });
      }
      // "Other" is everything the checkbox list cannot name.
      if (nannyShareTypes.includes("Other")) {
        orConditions.push({ nannyShareType: { $nin: STANDARD_TYPES } });
      }

      if (orConditions.length > 0) {
        filter.$and = filter.$and || [];
        filter.$and.push({ $or: orConditions });
      }
    }

    return filter;
  }

  /**
   * Keep shares with at least one child inside the requested age band.
   *
   * Ages are free text — "2 yrs", "18 months", "5" — so each is reduced to its
   * first number. A share with no parseable age is dropped rather than kept,
   * which is the original behaviour: an unknown age cannot be shown to satisfy
   * a filter the family explicitly set.
   */
  #byChildAge(shares, { minAge, maxAge }) {
    if (Number(maxAge) <= 0) return shares;

    return shares.filter((share) => {
      if (!share.childrenAges || share.childrenAges.length === 0) return false;

      const ages = share.childrenAges
        .map((age) => {
          const match = String(age).match(/(\d+(\.\d+)?)/);
          return match ? Number(match[1]) : null;
        })
        .filter((age) => age !== null);

      if (ages.length === 0) return false;

      return ages.some((age) => age >= Number(minAge) && age <= Number(maxAge));
    });
  }
}

export default NannyShareService;
