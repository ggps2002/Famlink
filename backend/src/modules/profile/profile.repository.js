import { BaseRepository } from "../../core/database/BaseRepository.js";
import { PUBLIC_USER_SELECT } from "../user/user.privacy.js";
import NannyProfile from "./nannyProfile.model.js";

/**
 * The profile document attached to a member — held by both caregivers and
 * families, despite the collection's name.
 *
 * Almost every read here is paired with the owning user, and the owner must be
 * reduced to the public projection when it is shown to anyone else. Making
 * `withOwner` the ordinary way to fetch a profile means that pairing is the
 * default rather than something each caller remembers.
 */
export class ProfileRepository extends BaseRepository {
  constructor(model = NannyProfile) {
    super(model);
  }

  findByUserId(userId, options = {}) {
    return this.findOne({ userId }, options);
  }

  /** A profile with its owner populated through the public projection. */
  withOwner(userId, options = {}) {
    return this.findOne(
      { userId },
      { ...options, populate: { path: "userId", select: PUBLIC_USER_SELECT } }
    );
  }

  findManyByUserIds(userIds, options = {}) {
    return this.find({ userId: { $in: userIds } }, options);
  }

  /**
   * Write a member's profile, creating it if this is their first save.
   *
   * Upsert rather than create-or-update because the onboarding flow saves a
   * partial profile at every step and the client does not track whether one
   * exists yet — a create that raced a second step would 409 on the unique
   * index over `userId`.
   *
   * `validate` is a parameter, not a default, because the two callers differ:
   * the questionnaire posts a few answers at a time and much of the schema is
   * absent mid-flow, while a full profile edit posts a complete document and
   * should be checked. Turning it on everywhere would reject half the
   * onboarding steps.
   */
  saveForUser(userId, document, { validate = false } = {}) {
    return this.model
      .findOneAndUpdate({ userId }, document, {
        new: true,
        upsert: true,
        runValidators: validate,
      })
      .exec();
  }

  /* ─────────────────────────────── share browse ───────────────────────────
   * The nanny-share directory. Same rule as the user directory: the owner is
   * another member, so every read here reduces them to the public projection. */

  /** Every profile matching a browse query, newest first, owner projected. */
  findBrowsable(filter) {
    return this.find(filter, {
      populate: { path: "userId", select: PUBLIC_USER_SELECT },
      sort: { createdAt: -1 },
    });
  }

  /**
   * One page of the console's share table.
   *
   * The owner projection is wider here than on the browse path — the console
   * shows contact details — which is why this method is separate rather than a
   * flag on `findBrowsable`. A flag would make it possible to reach the admin
   * projection from a member-facing caller by passing the wrong argument.
   */
  async findAdminPage(filter, { skip, limit, select }) {
    const [totalRecords, profiles] = await Promise.all([
      this.count(filter),
      this.find(filter, {
        populate: { path: "userId", select },
        sort: { createdAt: -1 },
        skip,
        limit,
        lean: true,
      }),
    ]);

    return { profiles, totalRecords };
  }

  /**
   * The share types actually present in the data.
   *
   * Read from the collection rather than hardcoded: the questionnaires have
   * added types over time, and a fixed list silently hides every profile posted
   * under one nobody remembered to add.
   */
  distinctShareTypes() {
    return Promise.all([
      this.model.distinct("nannyShareType").exec(),
      this.model.distinct("careType").exec(),
    ]);
  }

  /* ──────────────────────────────── share links ─────────────────────────── */

  findByShareToken(token, options = {}) {
    return this.findOne({ shareToken: token }, options);
  }

  /** Fire-and-forget view counter behind a public share link. */
  recordShareView(id) {
    return this.model
      .updateOne(
        { _id: id },
        { $inc: { shareViewCount: 1 }, $set: { shareLastViewedAt: new Date() } }
      )
      .exec();
  }
}

export const profileRepository = new ProfileRepository();

export default profileRepository;
