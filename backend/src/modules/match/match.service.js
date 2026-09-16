import { BaseService } from "../../core/http/BaseService.js";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../core/errors/index.js";
import { toMatchCard, toMatchEmailParty } from "./match.presenter.js";

/**
 * The matching rules: who may send a request, what happens when one is
 * answered, and who may block whom.
 *
 * Everything here was previously interleaved with `res.status(...).json(...)`
 * calls inside route handlers, which is why none of it could be tested and why
 * the paywall check existed in one code path but not the others. The rules are
 * now statements about users and requests; turning a thrown ForbiddenError
 * into a 403 is the controller's problem.
 */
export class MatchService extends BaseService {
  /**
   * @param {object} deps
   * @param {import("./match.repository.js").MatchRepository} deps.matchRepository
   * @param {import("../user/user.repository.js").UserRepository} deps.userRepository
   * @param {import("../profile/profile.repository.js").ProfileRepository} deps.profileRepository
   * @param {import("../messaging/chat.repository.js").ChatRepository} deps.chatRepository
   * @param {{ sendMatchRequestEmail: Function, sendMatchAcceptedEmail: Function }} deps.emailService
   * @param {{ hasActiveReferralMatching: (user: object) => boolean }} deps.referralPolicy
   */
  constructor(deps) {
    super(deps);
  }

  /**
   * The caller's own account, or 401.
   *
   * Every action here begins with it. A token can outlive the account it names
   * — deletion does not revoke issued tokens — so a valid signature is not on
   * its own evidence that the user still exists.
   */
  async #requireUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Access denied");
    return user;
  }

  /**
   * Whether this member may send another match request.
   *
   * Two separate gates that look alike and are not:
   *
   *  - A family gets one free request, then pays. `premium` clears it.
   *  - A caregiver *looking for a share job* also gets one free request, but
   *    redeems the next one by referring a friend rather than with a card. A
   *    caregiver who did subscribe is not sent to the referral wall.
   *
   * A caregiver who already has a family (`hasFamily`) is in neither group and
   * is not gated at all.
   */
  async #assertMayRequest(user) {
    if (!user.nannyProfileCompleted) {
      throw new ForbiddenError("Please complete your profile before matching");
    }

    if (user.type === "Parents" && user.matchRequestsSent > 0 && !user.premium) {
      throw new ForbiddenError("Free request limit exhausted. Subscribe to keep matching");
    }

    if (user.type !== "Nanny" || user.premium) return;

    const senderProfile = await this.profileRepository.findByUserId(user._id, {
      select: "hasFamily",
      lean: true,
    });

    // Stored as a boolean or the string "true"/"false" depending on which form
    // saved the profile, so normalise before deciding.
    const hasFamily = senderProfile?.hasFamily === true || senderProfile?.hasFamily === "true";
    const isJobSeekingCaregiver = senderProfile != null && !hasFamily;

    if (
      isJobSeekingCaregiver &&
      user.matchRequestsSent > 0 &&
      !this.referralPolicy.hasActiveReferralMatching(user)
    ) {
      throw new ForbiddenError(
        "Free match used. Refer a friend to unlock another month of matching",
        // The frontend switches on this to show the referral modal rather than
        // the subscribe modal — the message alone would be too brittle.
        { code: "REFERRAL_REQUIRED" }
      );
    }
  }

  async requestMatch({ userId, senderId, receiverId, message }) {
    const user = await this.#requireUser(userId);
    await this.#assertMayRequest(user);

    const request = await this.matchRepository.create({ senderId, receiverId, message });
    await this.userRepository.incrementMatchRequestsSent(userId);

    this.#notifyRequestSent({ user, receiverId }).catch((error) =>
      console.error("[match] request notification failed:", error)
    );

    return request;
  }

  /**
   * Tell the receiver a request is waiting.
   *
   * Deliberately not awaited by the caller: this reads the receiver and the
   * sender's profile to build the email, and those queries must not fail a
   * request that has already been written. The mail host is no longer part of
   * that risk — the email is queued rather than sent, and the dispatcher
   * delivers it, retrying for hours if the host is down. Previously a
   * two-minute outage here lost the notification permanently.
   */
  async #notifyRequestSent({ user, receiverId }) {
    const receiver = await this.userRepository.findById(receiverId, {
      select: "email name",
      lean: true,
    });
    if (!receiver?.email) return;

    const senderProfile = await this.profileRepository
      .findByUserId(user._id, { lean: true })
      .catch(() => null);

    await this.emailService.sendMatchRequestEmail(
      receiver.email,
      receiver.name,
      toMatchEmailParty(user, senderProfile)
    );
  }

  /* ─────────────────────────────── listings ─────────────────────────────── */

  /**
   * Requests this member sent or received, as profile cards.
   *
   * Paginated in memory, which is preserved from the original rather than
   * improved: a request whose counterparty has no profile is dropped, and it is
   * dropped *before* the count. Paginating in the database would make
   * `totalRecords` count rows the client never receives, so pages would come
   * back short and `hasMore` would disagree with what was rendered. Fixing that
   * properly means storing the profile link on the request, which is a schema
   * change and not part of this refactor.
   */
  async #listRequests({ userId, page, limit, requestType }) {
    await this.#requireUser(userId);

    const requests =
      requestType === "outgoing"
        ? await this.matchRepository.findSentBy(userId)
        : await this.matchRepository.findReceivedBy(userId);

    const counterpartyOf = (request) =>
      requestType === "outgoing" ? request.receiverId : request.senderId;

    const cards = await Promise.all(
      requests.map(async (request) => {
        const profile = await this.profileRepository.withOwner(counterpartyOf(request));
        if (!profile) return null;

        return toMatchCard(profile, {
          requestType,
          status: request.status,
          matchId: request._id,
        });
      })
    );

    const visible = cards.filter(Boolean);
    const totalRecords = visible.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    return {
      data: visible.slice(skip, skip + limit),
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasMore: page < totalPages,
      },
    };
  }

  listOutgoing({ userId, page, limit }) {
    return this.#listRequests({ userId, page, limit, requestType: "outgoing" });
  }

  listIncoming({ userId, page, limit }) {
    return this.#listRequests({ userId, page, limit, requestType: "incoming" });
  }

  /**
   * How many incoming requests are still unanswered — the navbar badge.
   *
   * Not `listIncoming(...).data.length`: that loads every request this member
   * has ever received and resolves a profile for each of them one at a time,
   * and the badge is on screen for every dashboard page. This is two indexed
   * queries regardless of inbox size.
   *
   * It still applies the listing's visibility rule. #listRequests drops a
   * request whose counterparty has no profile, so counting the raw rows would
   * promise a request the member cannot find when they follow the badge.
   */
  async countPendingIncoming({ userId }) {
    await this.#requireUser(userId);

    const senderIds = await this.matchRepository.pendingSenderIdsFor(userId);
    if (senderIds.length === 0) return 0;

    const profiles = await this.profileRepository.findManyByUserIds(senderIds, {
      select: "userId",
      lean: true,
    });
    const hasProfile = new Set(profiles.map((profile) => String(profile.userId)));

    // Filtered rather than counted off the profiles: the count is of requests,
    // and one sender with two pending requests is two rows in the list.
    return senderIds.filter((senderId) => hasProfile.has(senderId)).length;
  }

  /* ──────────────────────────── status changes ──────────────────────────── */

  /** Load a request that is in the state this transition requires, or 404. */
  async #requireRequestInState(matchId, status) {
    const request = await this.matchRepository.findByIdWithStatus(matchId, status);
    if (!request) throw new NotFoundError("Request not found");
    return request;
  }

  async accept({ userId, matchId }) {
    const user = await this.#requireUser(userId);
    const request = await this.#requireRequestInState(matchId, "pending");

    request.status = "accepted";
    // Stamped here rather than derived later: status is mutated in place, so
    // this is the only moment the response time is knowable.
    request.respondedAt = new Date();
    await request.save();

    // Both side effects are best-effort. The acceptance is already durable, and
    // neither a chat that failed to open nor an email that failed to send is a
    // reason to tell the member their acceptance did not happen.
    this.chatRepository
      .findOrCreateBetween(request.senderId, request.receiverId)
      .catch((error) => console.error("[match] failed to open chat on acceptance:", error));

    this.#notifyAccepted({ user, request }).catch((error) =>
      console.error("[match] acceptance notification failed:", error)
    );

    return request;
  }

  async #notifyAccepted({ user, request }) {
    const sender = await this.userRepository.findById(request.senderId, {
      select: "email name",
      lean: true,
    });
    if (!sender?.email) return;

    const accepterProfile = await this.profileRepository
      .findByUserId(user._id, { lean: true })
      .catch(() => null);

    await this.emailService.sendMatchAcceptedEmail(
      sender.email,
      sender.name,
      user.name,
      toMatchEmailParty(user, accepterProfile)
    );
  }

  async reject({ userId, matchId }) {
    await this.#requireUser(userId);
    const request = await this.#requireRequestInState(matchId, "pending");

    request.status = "rejected";
    request.respondedAt = new Date();
    await request.save();

    return request;
  }

  /** Restore a rejected request to pending, so the receiver can reconsider. */
  async undoReject({ userId, matchId }) {
    await this.#requireUser(userId);
    const request = await this.#requireRequestInState(matchId, "rejected");

    // respondedAt is deliberately left as it was: the receiver did answer, and
    // overwriting it would erase that from the response-time reporting.
    request.status = "pending";
    await request.save();

    return request;
  }

  /** Either participant may block; the conversation is unavailable until undone. */
  async block({ userId, matchId }) {
    await this.#requireUser(userId);

    const request = await this.matchRepository.findById(matchId);
    if (!request) throw new NotFoundError("Request not found");

    const isParticipant =
      String(request.senderId) === String(userId) ||
      String(request.receiverId) === String(userId);
    if (!isParticipant) throw new ForbiddenError("Not allowed");

    request.status = "blocked";
    request.blockedBy = userId;
    await request.save();

    return request;
  }

  /** Only the member who blocked can undo it. Restores the conversation. */
  async unblock({ userId, matchId }) {
    await this.#requireUser(userId);
    const request = await this.#requireRequestInState(matchId, "blocked");

    if (String(request.blockedBy) !== String(userId)) {
      throw new ForbiddenError("Only the user who blocked can unblock");
    }

    request.status = "accepted";
    request.blockedBy = null;
    await request.save();

    return request;
  }

  /**
   * The match between the caller and another member, in either direction, so
   * the chat screen can reflect a blocked state. Null when there is none —
   * absence is an ordinary answer here, not an error.
   */
  async findMatchWith({ userId, otherUserId }) {
    if (!otherUserId) throw new ValidationError("userId is required");

    const request = await this.matchRepository.findBetween(userId, otherUserId);
    if (!request) return null;

    return {
      matchId: request._id,
      status: request.status,
      blockedBy: request.blockedBy,
    };
  }

  /**
   * Families within 10km of a member.
   *
   * Carried over unmounted: the pre-refactor code exported this but no router
   * line ever referenced it. Kept rather than deleted so the refactor removes
   * no capability, and left unmounted so it does not become reachable by
   * accident — it takes a userId straight from the caller, so exposing it would
   * need an ownership check first.
   */
  async listNearby({ userId, maxDistance = 10000 }) {
    const user = await this.userRepository.findById(userId, {
      select: "location",
      lean: true,
    });

    const coordinates = user?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new ValidationError("User location not found");
    }

    return this.userRepository.findNearby({ coordinates, maxDistance, type: "Parents" });
  }
}

export default MatchService;
