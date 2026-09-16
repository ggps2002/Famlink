import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import {
  NotFoundError,
  UpstreamServiceError,
  ValidationError,
} from "../../core/errors/index.js";
import { parsePaging, pagingMeta, searchTerm } from "./admin.middleware.js";
import {
  ensureShareToken,
  shareLinkFor,
  toPublicSharedProfile,
} from "../share/shareProfile.util.js";

/**
 * The owner fields the public serializer needs.
 *
 * `name` and `imageUrl` are deliberately absent — the shared page never shows
 * them, and not selecting them means they cannot leak through a serializer bug
 * either.
 */
const OWNER_FIELDS = "type location noOfChildren additionalInfo";

const LINK_FIELDS =
  "userId shareToken shareEnabled shareViewCount shareLastViewedAt " +
  "shareDisabledAt createdAt nannyShareType hasNanny hasFamily " +
  "shareTokenCreatedAt shareTokenSource shareTokenCreatedBy";

/**
 * Admin control over the public "Share Profile" links.
 *
 * The links themselves already exist: every member can mint one for their own
 * profile, and it renders a privacy-safe version of their listing with no login
 * required — built to be pasted into a Facebook group or a neighbourhood
 * thread.
 *
 * What the console adds is seeing every link in one place, generating one on a
 * member's behalf, and switching an individual link off. That last one matters:
 * before it, the only way to take a shared listing down was to delete the
 * profile behind it — a far bigger hammer than "this person asked me to unlist
 * them for a fortnight".
 */
export class ShareLinksService extends BaseService {
  #requireObjectId(userId) {
    if (!mongoose.isValidObjectId(userId)) throw new ValidationError("Invalid user id");
    return userId;
  }

  async list({ query = {} }) {
    const paging = parsePaging(query);
    const { search, enabled, hasLink } = query;
    const filter = {};

    // `$ne: false` rather than `true`: the field defaults to true and every
    // profile predating it has no value at all, so those must read as enabled.
    if (enabled === "true") filter.shareEnabled = { $ne: false };
    if (enabled === "false") filter.shareEnabled = false;
    if (hasLink === "true") filter.shareToken = { $nin: [null, ""] };
    if (hasLink === "false") filter.shareToken = { $in: [null, ""] };

    if (search) {
      // The filterable identity lives on the user and the link lives on the
      // profile, so a search resolves users first and then scopes the profile
      // query to them. Two steps rather than a `$lookup` because the user side
      // is the selective one — this way Mongo uses the index on `email` instead
      // of scanning every profile.
      const term = searchTerm(search);
      const matched = await this.userRepository.findIdsMatching(
        { $or: [{ name: term }, { email: term }] },
        500
      );
      filter.userId = { $in: matched.map((user) => user._id) };
    }

    const [profiles, totalRecords] = await Promise.all([
      this.profileRepository.find(filter, {
        select: LINK_FIELDS,
        populate: [
          { path: "userId", select: "name email type status location.city" },
          { path: "shareTokenCreatedBy", select: "name email" },
        ],
        sort: { shareViewCount: -1, createdAt: -1 },
        skip: paging.skip,
        limit: paging.limit,
        lean: true,
      }),
      this.profileRepository.count(filter),
    ]);

    const data = profiles
      // A profile whose owner has been deleted has nothing to show and no link
      // worth toggling.
      .filter((profile) => profile.userId)
      .map((profile) => this.#toRow(profile));

    return { data, pagination: pagingMeta(totalRecords, paging) };
  }

  #toRow(profile) {
    return {
      profileId: profile._id,
      user: {
        _id: profile.userId._id,
        name: profile.userId.name,
        email: profile.userId.email,
        type: profile.userId.type,
        status: profile.userId.status,
        city: profile.userId.location?.city || null,
      },
      token: profile.shareToken || null,
      url: profile.shareToken ? shareLinkFor(profile.shareToken) : null,
      enabled: profile.shareEnabled !== false,
      views: profile.shareViewCount || 0,
      lastViewedAt: profile.shareLastViewedAt || null,
      disabledAt: profile.shareDisabledAt || null,
      createdAt: profile.createdAt,

      // Where the link came from. Null on tokens minted before this was
      // recorded — reported as null rather than defaulted to "member", because
      // guessing would make the column quietly assert something about consent
      // that nothing in the data supports.
      generatedBy: profile.shareToken ? profile.shareTokenSource : null,
      generatedAt: profile.shareToken ? profile.shareTokenCreatedAt || null : null,
      // Only set for admin-generated links; the owner of a self-generated one
      // is already the member named on the row.
      generatedByAdmin: profile.shareTokenCreatedBy
        ? {
            _id: profile.shareTokenCreatedBy._id,
            name: profile.shareTokenCreatedBy.name,
            email: profile.shareTokenCreatedBy.email,
          }
        : null,
    };
  }

  /**
   * Mint a link for a member who has not asked for one, so an admin can post a
   * listing on their behalf.
   *
   * Idempotent: `ensureShareToken` returns the existing token rather than
   * rotating it, because a rotated token breaks every URL already out in the
   * world.
   */
  async generate({ userId, adminId }) {
    this.#requireObjectId(userId);

    const profile = await this.profileRepository.findByUserId(userId, {
      populate: { path: "userId", select: OWNER_FIELDS },
    });

    if (!profile) {
      throw new NotFoundError(
        "This member has no share profile yet, so there is nothing to link to."
      );
    }

    const alreadyExisted = Boolean(profile.shareToken);

    // Recorded as console-generated, and against the admin who did it. Only
    // takes effect on a first mint; if the member made their own link, that
    // origin stands.
    const token = await ensureShareToken(profile, { source: "admin", createdBy: adminId });
    if (!token) throw new UpstreamServiceError("Could not create a share link");

    // Generating also switches the link on. An admin who asked for a link and
    // got a dead one would reasonably call that a bug.
    if (profile.shareEnabled === false) {
      await this.profileRepository.updateById(profile._id, {
        shareEnabled: true,
        shareDisabledAt: null,
        shareToggledBy: adminId,
      });
    }

    return { token, url: shareLinkFor(token), enabled: true, alreadyExisted, profile };
  }

  /**
   * Exactly what a stranger following the link sees.
   *
   * Uses the same serializer the public route does, not a reimplementation: an
   * admin about to paste this into a community board needs to see the real
   * thing, and a second copy of the redaction logic would be the copy that
   * drifts and leaks a name.
   */
  async preview(userId) {
    this.#requireObjectId(userId);

    const profile = await this.profileRepository.findByUserId(userId, {
      populate: { path: "userId", select: OWNER_FIELDS },
    });

    if (!profile || !profile.userId) {
      throw new NotFoundError("No share profile for this member");
    }

    return {
      profile: toPublicSharedProfile(profile.toObject()),
      token: profile.shareToken || null,
      url: profile.shareToken ? shareLinkFor(profile.shareToken) : null,
      enabled: profile.shareEnabled !== false,
    };
  }

  /**
   * The visibility switch.
   *
   * Turning it off makes the public route 404 while leaving the token in place,
   * so switching it back on revives the SAME url — every link already pasted
   * into a group chat starts working again. Revoking by deleting the token
   * would make that impossible.
   */
  async toggle({ userId, enabled: requested, adminId }) {
    this.#requireObjectId(userId);

    // Strictly `=== true`: anything else is off, so a malformed body cannot
    // accidentally publish a listing someone asked to have taken down.
    const enabled = requested === true;

    const profile = await this.profileRepository.updateOne(
      { userId },
      {
        $set: {
          shareEnabled: enabled,
          shareDisabledAt: enabled ? null : new Date(),
          shareToggledBy: adminId,
        },
      }
    );

    if (!profile) throw new NotFoundError("No share profile for this member");

    return {
      enabled,
      profileId: profile._id,
      token: profile.shareToken || null,
      url: profile.shareToken ? shareLinkFor(profile.shareToken) : null,
      message: enabled ? "Share link is live." : "Share link is switched off.",
    };
  }
}

export default ShareLinksService;
