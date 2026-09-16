import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError, NotFoundError } from "../../core/errors/index.js";
import { SELF_USER_SELECT } from "./user.privacy.js";
import {
  toAdminFamilyRow,
  toAdminNannyRow,
  toPagination,
  toTopUserRow,
} from "./user.presenter.js";

/**
 * The admin console's reads of the user table.
 *
 * These return the private tier — email, phone, date of birth, subscription
 * state — so the gate in front of them is the only thing between a signed-in
 * member and the whole user base. It is applied per method rather than once as
 * middleware, deliberately: see `#requireAdmin`.
 */
export class UserAdminService extends BaseService {
  /**
   * Assert the caller is an Admin, in the words the calling route already used.
   *
   * The shared `adminOnly` middleware in modules/admin does this too, and is
   * the right long-term home for it. It is not used here because it would
   * change two things at once: the wording of five responses the console
   * matches on, and the rule about suspended admins, which `adminOnly` enforces
   * and these five routes never have. Both changes are probably improvements;
   * neither belongs inside a move. Folding these onto `adminOnly` is a
   * follow-up with its own diff.
   */
  async #requireAdmin(userId, { missing, denied }) {
    const user = await this.userRepository.findById(userId, { select: "type", lean: true });

    if (!user) {
      // Two of the five routes never distinguished this case and answered 403
      // for a missing account as well. Passing `missing: null` keeps that.
      if (missing === null) throw new ForbiddenError(denied);
      throw new NotFoundError(missing);
    }
    if (user.type !== "Admin") throw new ForbiddenError(denied);

    return user;
  }

  /** The dashboard leaderboards: best-rated caregivers and families. */
  async topRated(adminId) {
    await this.#requireAdmin(adminId, { missing: null, denied: "Access denied" });

    const [topNannies, topParents] = await Promise.all([
      this.userRepository.topRatedByType("Nanny"),
      this.userRepository.topRatedByType("Parents"),
    ]);

    return {
      topNannies: topNannies.map(toTopUserRow),
      topParents: topParents.map(toTopUserRow),
    };
  }

  async listFamilies({ adminId, page, limit, skip }) {
    return this.#listByType({
      adminId,
      type: "Parents",
      format: toAdminFamilyRow,
      page,
      limit,
      skip,
    });
  }

  async listNannies({ adminId, page, limit, skip }) {
    return this.#listByType({
      adminId,
      type: "Nanny",
      format: toAdminNannyRow,
      page,
      limit,
      skip,
    });
  }

  async #listByType({ adminId, type, format, page, limit, skip }) {
    await this.#requireAdmin(adminId, { missing: null, denied: "Access denied. Admins only." });

    const { users, totalRecords } = await this.userRepository.findAdminPage(
      { type },
      {
        skip,
        limit,
        // Notification preferences are a per-user settings blob the console has
        // no column for, and __v is Mongoose bookkeeping.
        select: `${SELF_USER_SELECT} -notifications -__v`,
        sort: { createdAt: -1 },
      }
    );

    return {
      data: users.map(format),
      pagination: toPagination({ totalRecords, page, limit }),
    };
  }

  /**
   * Every non-admin account, or one type of them.
   *
   * Admins are excluded when no type is asked for, so the console's default
   * view is the user base rather than a list with the staff mixed in.
   */
  async listAll({ adminId, userType, page, limit, skip }) {
    await this.#requireAdmin(adminId, {
      missing: "User not found",
      denied: "Access denied. Only Admins can get data.",
    });

    const filter = userType ? { type: userType } : { type: { $ne: "Admin" } };

    const { users, totalRecords } = await this.userRepository.findAdminPage(filter, {
      skip,
      limit,
    });

    return { data: users, pagination: toPagination({ totalRecords, page, limit }) };
  }

  /** One record, for the console's edit screen. */
  async getById({ adminId, userId }) {
    await this.#requireAdmin(adminId, {
      missing: "Admin not found",
      denied: "Access denied. Only Admins can access user data.",
    });

    const user = await this.userRepository.findAdminById(userId);
    if (!user) throw new NotFoundError("User not found");

    return user;
  }
}

export default UserAdminService;
