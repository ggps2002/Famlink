import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, UpstreamServiceError } from "../../core/errors/index.js";
import { ensureShareToken, shareLinkFor, toPublicSharedProfile } from "./shareProfile.util.js";

/**
 * Owner fields the public serializer needs.
 *
 * `name` and `imageUrl` are deliberately absent: the shared page never shows
 * them, and not selecting them means they cannot leak through a serializer bug
 * either. The projection is the guarantee; the serializer is the convenience.
 */
const OWNER_FIELDS = "type location noOfChildren additionalInfo";

/**
 * Public "share your profile" links.
 *
 * One member-facing method to mint a link, one unauthenticated method to
 * resolve one. The second is the reason this service is careful about what it
 * says: it is reachable by anyone with a URL.
 */
export class ShareLinkService extends BaseService {
  /**
   * The signed-in member's own share link, minting the token on first ask.
   *
   * Everyone gets one — all four share types have something worth posting — but
   * a profile has to exist first, so a member who has not finished onboarding
   * is told that rather than handed a link to an empty page.
   */
  async mintForOwner(userId) {
    const profile = await this.profileRepository.findByUserId(userId, {
      populate: { path: "userId", select: OWNER_FIELDS },
    });

    if (!profile) {
      throw new NotFoundError("Finish your nanny share profile to get a shareable link");
    }

    // Recorded as member-minted at creation because it cannot be reconstructed
    // later: the console shows the source to tell a listing someone chose to
    // publish from one an admin created on their behalf.
    const token = await ensureShareToken(profile, { source: "member" });
    if (!token) throw new UpstreamServiceError("Could not create a share link");

    return {
      token,
      url: shareLinkFor(token),
      // The owner's own preview of what strangers will see, so the share sheet
      // shows the real headline and card rather than a guess at it.
      profile: toPublicSharedProfile({ ...profile.toObject(), shareToken: token }),
    };
  }

  /**
   * The public page behind a shared link.
   *
   * Unauthenticated by design: this is what someone finds after a friend pastes
   * the URL into a group chat, and requiring a login to see it would break the
   * loop the feature exists to create.
   *
   * Every failure answers identically — a malformed token, a deleted profile,
   * a share switched off by its owner or an admin, and an owner who is no
   * longer an active member. Same status, same sentence, so the endpoint cannot
   * be used to probe which tokens exist, or to tell "never existed" from "was
   * taken down".
   */
  async resolvePublic(token) {
    if (!token) throw new NotFoundError("This share is no longer available");

    const profile = await this.profileRepository.findByShareToken(token, {
      populate: { path: "userId", select: `${OWNER_FIELDS} status` },
    });

    // `shareEnabled !== false` rather than a truthy test: the field defaults to
    // true, and every profile minted before it existed has no value at all, so
    // those must keep resolving.
    const disabled = profile?.shareEnabled === false;
    const ownerInactive = profile?.userId?.status && profile.userId.status !== "Active";

    if (!profile || !profile.userId || disabled || ownerInactive) {
      throw new NotFoundError("This share is no longer available");
    }

    // Fire-and-forget: a counter is not worth delaying the page for, and a
    // failed increment must not turn a working link into an error for whoever
    // followed it.
    this.profileRepository
      .recordShareView(profile._id)
      .catch((error) => console.error("Share view count failed:", error?.message || error));

    return toPublicSharedProfile(profile);
  }
}

export default ShareLinkService;
