import { BaseService } from "../../core/http/BaseService.js";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../core/errors/index.js";
import { milesToRadians, kmToRadians } from "./user.repository.js";
import { toPublicUser, toPublicUsers } from "./user.privacy.js";
import { displayRating, toPagination } from "./user.presenter.js";
import {
  SERVICE_PROVIDER_SELECT,
  toServiceProviderCards,
} from "./serviceProvider.presenter.js";

/**
 * The nationwide browse radius, in kilometres.
 *
 * ~2000 miles, which is not a neighbourhood — it is a coarse "is this account
 * plausibly in the same country" filter that exists so `/getAllData` has an
 * index-backed geo query rather than scanning the table. The narrow radius that
 * a member actually sets lives on `/getFiltered` and defaults to 5 miles.
 *
 * Kept as the literal the pre-refactor route used, rather than recomputed from
 * 2000 × 1.60934, so the boundary of an existing result set does not move.
 */
const NATIONWIDE_RADIUS_KM = 3218.69;

/** The radius, in miles, a member gets if they do not choose one. */
const DEFAULT_RADIUS_MILES = 5;

/**
 * The member-facing directory: browsing, filtering, and viewing one profile.
 *
 * Everything this service returns goes to one member about another, so every
 * read runs through the public projection and every response is passed through
 * `toPublicUser` on the way out. Those are two different defences and both are
 * needed: the projection stops the database from returning a home address, and
 * the serializer coarsens the address that is left. Removing either one leaks
 * on its own.
 */
export class UserDirectoryService extends BaseService {
  /**
   * Members of a type near the caller, nationwide.
   *
   * Requires the caller to have coordinates, and 400s if they do not — the
   * query is anchored on their position, so there is no sensible result to
   * return for an account that has never set a location.
   */
  async browseNearby({ userId, userType = "Nanny", page, limit, skip }) {
    const caller = await this.userRepository.findById(userId, {
      select: "location",
      lean: true,
    });

    if (!caller?.location?.coordinates) {
      throw new ValidationError("Current user location not found or invalid.");
    }

    const filter = this.userRepository.withinRadiusFilter({
      coordinates: caller.location.coordinates,
      radiusRadians: kmToRadians(NATIONWIDE_RADIUS_KM),
      type: userType,
    });

    const { users, totalRecords } = await this.userRepository.findPublicPage(filter, {
      skip,
      limit,
    });

    return {
      users: toPublicUsers(users),
      pagination: toPagination({ totalRecords, page, limit }),
    };
  }

  /**
   * The dashboard search: type, radius, and the questionnaire answers.
   *
   * The filters read `additionalInfo`, the array of question/answer pairs the
   * onboarding flow writes. Each filter is one `$elemMatch` against that array,
   * and they are combined with `$and` so that two filters must be satisfied by
   * two different entries — a single entry cannot satisfy both by accident.
   */
  async browseFiltered({ userId, query, page, limit, skip }) {
    const caller = await this.userRepository.findById(userId, {
      select: "location zipCode",
      lean: true,
    });

    if (!caller) throw new NotFoundError("Current user not found.");

    const userType = query.userType || "Nanny";
    const matchStage = { type: userType };
    const filters = this.#additionalInfoFilters(query, userType);

    if (filters.length > 0) {
      matchStage.$and = filters.map((filter) => ({ additionalInfo: { $elemMatch: filter } }));
    }

    // Coordinates if we have them, zip if we do not. The zip fallback is exact
    // rather than radial, so it finds fewer people — but an account with no
    // coordinates would otherwise get no results at all.
    if (caller.location?.coordinates?.length === 2) {
      const [lng, lat] = caller.location.coordinates;
      const miles = query.location ? parseFloat(query.location) : DEFAULT_RADIUS_MILES;
      matchStage.location = {
        $geoWithin: { $centerSphere: [[lng, lat], milesToRadians(miles)] },
      };
    } else if (caller.zipCode) {
      matchStage.zipCode = caller.zipCode;
    } else {
      throw new ValidationError("User must have either location coordinates or a zip code.");
    }

    const { users, totalRecords } = await this.userRepository.aggregatePublicPage(matchStage, {
      skip,
      limit,
    });

    return {
      users: toPublicUsers(users),
      pagination: toPagination({ totalRecords, page, limit }),
    };
  }

  /**
   * Build the `additionalInfo` filters from the query string.
   *
   * Two of the keys are named differently depending on who is being searched
   * for — a family's "preferredSchedule" is a caregiver's "avaiForWorking" —
   * so the same UI control maps to a different answer key per type.
   */
  #additionalInfoFilters(query, userType) {
    const { avaiForWorking, ageGroupsExp, interestedPosi, salaryRange, start } = query;
    const isFamily = userType === "Parents";
    const filters = [];

    const csv = (value) => ({
      $in: String(value)
        .split(",")
        .map((entry) => entry.trim()),
    });

    if (salaryRange && salaryRange.length === 2) {
      const [min, max] = salaryRange.map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        // The stored range must sit inside the requested one, not merely
        // overlap it: asking for $20–30 should not return someone who wants $45.
        filters.push({
          key: "salaryRange",
          $and: [{ "value.min": { $gte: min } }, { "value.max": { $lte: max } }],
        });
      }
    }

    if (avaiForWorking) {
      filters.push({
        key: isFamily ? "preferredSchedule" : "avaiForWorking",
        "value.option": csv(avaiForWorking),
      });
    }
    if (start) {
      filters.push({ key: "start", "value.option": csv(start) });
    }
    if (ageGroupsExp) {
      filters.push({ key: "ageGroupsExp", "value.option": csv(ageGroupsExp) });
    }
    if (interestedPosi) {
      filters.push({
        key: isFamily ? "additionalServices" : "interestedPosi",
        "value.option": csv(interestedPosi),
      });
    }

    return filters;
  }

  /** Name and avatar only — for a chat header or a match card. */
  async getIdentity(id) {
    const user = await this.userRepository.findById(id, {
      select: "name profilePic imageUrl type",
      lean: true,
    });

    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  /**
   * A member's profile page, as seen by another member.
   *
   * Requires a signed-in caller. Before the refactor this route was
   * unauthenticated and served the whole document: anyone who could guess or
   * scrape an ObjectId got that person's email, phone number, date of birth,
   * Stripe customer id and the exact lat/lng of their home.
   */
  async getProfile(id) {
    const user = await this.userRepository.findPublicById(id, {
      populate: {
        path: "reviews.userId",
        // The reviewer is a member too — a byline must not become a route to
        // their contact details.
        select: "name imageUrl",
      },
    });

    if (!user) throw new NotFoundError("User not found");

    const nannyProfile = await this.profileRepository.findByUserId(id, { lean: true });

    return {
      ...toPublicUser(user),
      nannyProfile: nannyProfile || null,
      averageRating: displayRating(user.reviews),
    };
  }

  async countPerType() {
    const [familyCount, nannyCount] = await Promise.all([
      this.userRepository.countByType("Parents"),
      this.userRepository.countByType("Nanny"),
    ]);

    return { familyCount, nannyCount };
  }

  /** The homepage preview. Public, unauthenticated, and masked accordingly. */
  async listServiceProviders(zipCode) {
    const users = await this.userRepository.findActiveNanniesInZip(zipCode, {
      select: SERVICE_PROVIDER_SELECT,
    });

    return users.flatMap(toServiceProviderCards);
  }

  /**
   * Delete an account.
   *
   * Before the refactor this had no auth of any kind: an unauthenticated DELETE
   * against a guessed id removed that account, and the response handed back the
   * deleted document — password hash, reset token and all. You must now be
   * signed in, you may only delete yourself unless you are an Admin, and the
   * deleted record is not echoed back.
   */
  async deleteAccount({ requesterId, targetId }) {
    const requester = await this.userRepository.findById(requesterId, {
      select: "type",
      lean: true,
    });

    // 401, not 404: the token verified but names an account that no longer
    // exists, so the answer is "sign in again", not "that user is missing".
    if (!requester) throw new UnauthorizedError("Access denied.");

    const isSelf = String(targetId) === String(requesterId);
    if (!isSelf && requester.type !== "Admin") {
      throw new ForbiddenError("You can only delete your own account.");
    }

    const deleted = await this.userRepository.deleteById(targetId);
    if (!deleted) throw new NotFoundError("User not found.");
  }
}

export default UserDirectoryService;
