import { describe, it, expect, beforeEach, vi } from "vitest";
import { MatchService } from "#src/modules/match/match.service.js";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "#src/core/errors/index.js";

/**
 * These run with fakes for every collaborator — no database, no mail host.
 * That is the point of constructor injection: the matching rules are the only
 * thing under test, and they were unreachable before because they lived inside
 * route handlers next to `res.status(...)`.
 */

const aUser = (over = {}) => ({
  _id: "user-1",
  name: "Sam",
  type: "Parents",
  premium: false,
  matchRequestsSent: 0,
  nannyProfileCompleted: true,
  location: { city: "Oakland" },
  ...over,
});

/** A saved match request that records whether .save() was called. */
const aRequest = (over = {}) => ({
  _id: "match-1",
  senderId: "user-2",
  receiverId: "user-1",
  status: "pending",
  blockedBy: null,
  respondedAt: null,
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const build = (over = {}) => {
  const deps = {
    matchRepository: {
      create: vi.fn().mockResolvedValue(aRequest()),
      findById: vi.fn().mockResolvedValue(null),
      findByIdWithStatus: vi.fn().mockResolvedValue(null),
      findSentBy: vi.fn().mockResolvedValue([]),
      findReceivedBy: vi.fn().mockResolvedValue([]),
      findBetween: vi.fn().mockResolvedValue(null),
      pendingSenderIdsFor: vi.fn().mockResolvedValue([]),
      ...over.matchRepository,
    },
    userRepository: {
      findById: vi.fn().mockResolvedValue(aUser()),
      incrementMatchRequestsSent: vi.fn().mockResolvedValue(undefined),
      findNearby: vi.fn().mockResolvedValue([]),
      ...over.userRepository,
    },
    profileRepository: {
      findByUserId: vi.fn().mockResolvedValue(null),
      withOwner: vi.fn().mockResolvedValue(null),
      findManyByUserIds: vi.fn().mockResolvedValue([]),
      ...over.profileRepository,
    },
    chatRepository: {
      findOrCreateBetween: vi.fn().mockResolvedValue({ _id: "chat-1" }),
      ...over.chatRepository,
    },
    emailService: {
      sendMatchRequestEmail: vi.fn().mockResolvedValue(undefined),
      sendMatchAcceptedEmail: vi.fn().mockResolvedValue(undefined),
      ...over.emailService,
    },
    referralPolicy: {
      hasActiveReferralMatching: vi.fn().mockReturnValue(false),
      ...over.referralPolicy,
    },
  };

  return { service: new MatchService(deps), deps };
};

beforeEach(() => {
  // The service logs failures of its fire-and-forget side effects.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("MatchService.requestMatch", () => {
  it("rejects a caller whose account no longer exists", async () => {
    // A token outlives the account it names — deletion does not revoke it.
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.requestMatch({ userId: "gone" })).rejects.toThrow(UnauthorizedError);
  });

  it("requires a completed profile", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser({ nannyProfileCompleted: false })) },
    });

    await expect(service.requestMatch({ userId: "user-1" })).rejects.toThrow(
      "Please complete your profile before matching"
    );
  });

  describe("the family paywall", () => {
    it("allows the first request", async () => {
      const { service, deps } = build();

      await service.requestMatch({ userId: "user-1", receiverId: "user-2" });

      expect(deps.matchRepository.create).toHaveBeenCalled();
      expect(deps.userRepository.incrementMatchRequestsSent).toHaveBeenCalledWith("user-1");
    });

    it("blocks the second request when not subscribed", async () => {
      const { service } = build({
        userRepository: {
          findById: vi.fn().mockResolvedValue(aUser({ matchRequestsSent: 1 })),
        },
      });

      await expect(service.requestMatch({ userId: "user-1" })).rejects.toThrow(
        "Free request limit exhausted. Subscribe to keep matching"
      );
    });

    it("lets a subscriber keep going", async () => {
      const { service, deps } = build({
        userRepository: {
          findById: vi.fn().mockResolvedValue(aUser({ matchRequestsSent: 9, premium: true })),
        },
      });

      await service.requestMatch({ userId: "user-1", receiverId: "user-2" });

      expect(deps.matchRepository.create).toHaveBeenCalled();
    });
  });

  describe("the caregiver referral wall", () => {
    const jobSeeker = (over = {}) =>
      build({
        userRepository: {
          findById: vi.fn().mockResolvedValue(
            aUser({ type: "Nanny", matchRequestsSent: 1, ...over.user })
          ),
        },
        profileRepository: {
          // hasFamily false ⇒ looking for a share job ⇒ the referral audience.
          findByUserId: vi.fn().mockResolvedValue({ hasFamily: false }),
        },
        referralPolicy: over.referralPolicy,
      });

    it("sends a job-seeking caregiver to the referral wall, not the paywall", async () => {
      const { service } = jobSeeker();

      // The frontend picks the referral modal off this code, so it is asserted
      // as part of the contract rather than the wording.
      await expect(service.requestMatch({ userId: "user-1" })).rejects.toMatchObject({
        statusCode: 403,
        code: "REFERRAL_REQUIRED",
      });
    });

    it("lets them through while a referral month is active", async () => {
      const { service, deps } = jobSeeker({
        referralPolicy: { hasActiveReferralMatching: vi.fn().mockReturnValue(true) },
      });

      await service.requestMatch({ userId: "user-1", receiverId: "user-2" });

      expect(deps.matchRepository.create).toHaveBeenCalled();
    });

    it("does not gate a caregiver who already has a family", async () => {
      const { service, deps } = build({
        userRepository: {
          findById: vi.fn().mockResolvedValue(aUser({ type: "Nanny", matchRequestsSent: 5 })),
        },
        profileRepository: {
          findByUserId: vi.fn().mockResolvedValue({ hasFamily: true }),
        },
      });

      await service.requestMatch({ userId: "user-1", receiverId: "user-2" });

      expect(deps.matchRepository.create).toHaveBeenCalled();
    });

    it("treats hasFamily stored as the string \"true\" the same as boolean true", async () => {
      // Different forms saved this field differently; reading it naively sends
      // caregivers who have a family to the referral wall.
      const { service, deps } = build({
        userRepository: {
          findById: vi.fn().mockResolvedValue(aUser({ type: "Nanny", matchRequestsSent: 5 })),
        },
        profileRepository: {
          findByUserId: vi.fn().mockResolvedValue({ hasFamily: "true" }),
        },
      });

      await service.requestMatch({ userId: "user-1", receiverId: "user-2" });

      expect(deps.matchRepository.create).toHaveBeenCalled();
    });

    it("does not gate a caregiver with no profile at all", async () => {
      const { service, deps } = build({
        userRepository: {
          findById: vi.fn().mockResolvedValue(aUser({ type: "Nanny", matchRequestsSent: 5 })),
        },
        profileRepository: { findByUserId: vi.fn().mockResolvedValue(null) },
      });

      await service.requestMatch({ userId: "user-1", receiverId: "user-2" });

      expect(deps.matchRepository.create).toHaveBeenCalled();
    });
  });

  it("still succeeds when the notification email fails", async () => {
    // The request is already written; a failing mail host must not undo it.
    const { service, deps } = build({
      userRepository: {
        findById: vi
          .fn()
          .mockResolvedValueOnce(aUser())
          .mockResolvedValue({ email: "a@b.com", name: "Receiver" }),
      },
      emailService: {
        sendMatchRequestEmail: vi.fn().mockRejectedValue(new Error("smtp down")),
      },
    });

    await expect(
      service.requestMatch({ userId: "user-1", receiverId: "user-2" })
    ).resolves.toBeTruthy();
    expect(deps.matchRepository.create).toHaveBeenCalled();
  });
});

describe("MatchService listings", () => {
  const withRequests = (requests) =>
    build({
      matchRepository: {
        findSentBy: vi.fn().mockResolvedValue(requests),
        findReceivedBy: vi.fn().mockResolvedValue(requests),
      },
      profileRepository: {
        withOwner: vi.fn(async (id) =>
          id === "no-profile" ? null : { toObject: () => ({ _id: `p-${id}`, userId: { _id: id } }) }
        ),
      },
    });

  it("drops counterparties with no profile before counting", async () => {
    // Counting them would make `totalRecords` include rows never sent, so pages
    // come back short and hasMore disagrees with what rendered.
    const { service } = withRequests([
      { _id: "m1", receiverId: "a", status: "pending" },
      { _id: "m2", receiverId: "no-profile", status: "pending" },
      { _id: "m3", receiverId: "b", status: "pending" },
    ]);

    const result = await service.listOutgoing({ userId: "user-1", page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.pagination.totalRecords).toBe(2);
  });

  it("labels rows by direction and carries the match id", async () => {
    const { service } = withRequests([{ _id: "m1", senderId: "a", status: "accepted" }]);

    const result = await service.listIncoming({ userId: "user-1", page: 1, limit: 10 });

    expect(result.data[0]).toMatchObject({
      requestType: "incoming",
      status: "accepted",
      matchId: "m1",
    });
  });

  it("paginates and reports hasMore", async () => {
    const requests = Array.from({ length: 25 }, (_, i) => ({
      _id: `m${i}`,
      receiverId: `u${i}`,
      status: "pending",
    }));
    const { service } = withRequests(requests);

    const page1 = await service.listOutgoing({ userId: "user-1", page: 1, limit: 10 });
    const page3 = await service.listOutgoing({ userId: "user-1", page: 3, limit: 10 });

    expect(page1.data).toHaveLength(10);
    expect(page1.pagination).toMatchObject({ totalRecords: 25, totalPages: 3, hasMore: true });
    expect(page3.data).toHaveLength(5);
    expect(page3.pagination.hasMore).toBe(false);
  });

  it("never exposes a profile's share token", async () => {
    const { service } = build({
      matchRepository: {
        findSentBy: vi.fn().mockResolvedValue([{ _id: "m1", receiverId: "a", status: "pending" }]),
      },
      profileRepository: {
        withOwner: vi.fn().mockResolvedValue({
          toObject: () => ({ _id: "p1", shareToken: "secret-token", userId: { _id: "a" } }),
        }),
      },
    });

    const result = await service.listOutgoing({ userId: "user-1", page: 1, limit: 10 });

    expect(result.data[0]).not.toHaveProperty("shareToken");
  });
});

describe("MatchService.countPendingIncoming", () => {
  const withPending = (senderIds, profiled = senderIds) =>
    build({
      matchRepository: { pendingSenderIdsFor: vi.fn().mockResolvedValue(senderIds) },
      profileRepository: {
        findManyByUserIds: vi.fn().mockResolvedValue(profiled.map((id) => ({ userId: id }))),
      },
    });

  it("rejects a caller whose account no longer exists", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.countPendingIncoming({ userId: "gone" })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("counts the requests waiting on an answer", async () => {
    const { service } = withPending(["a", "b", "c"]);

    await expect(service.countPendingIncoming({ userId: "user-1" })).resolves.toBe(3);
  });

  it("drops senders with no profile, the way the listing does", async () => {
    // The badge sends the member to a list built by #listRequests, which skips
    // a request whose counterparty has no profile. Counting it here would
    // promise a request that is not there when they arrive.
    const { service } = withPending(["a", "no-profile", "b"], ["a", "b"]);

    await expect(service.countPendingIncoming({ userId: "user-1" })).resolves.toBe(2);
  });

  it("counts requests, not senders", async () => {
    // One member with two pending requests is two rows in the list.
    const { service } = withPending(["a", "a"], ["a"]);

    await expect(service.countPendingIncoming({ userId: "user-1" })).resolves.toBe(2);
  });

  it("asks nothing of the profile collection when the inbox is empty", async () => {
    const { service, deps } = withPending([]);

    await expect(service.countPendingIncoming({ userId: "user-1" })).resolves.toBe(0);
    expect(deps.profileRepository.findManyByUserIds).not.toHaveBeenCalled();
  });
});

describe("MatchService status transitions", () => {
  it("accepts a pending request, stamps respondedAt, and opens the chat", async () => {
    const request = aRequest();
    const { service, deps } = build({
      matchRepository: { findByIdWithStatus: vi.fn().mockResolvedValue(request) },
    });

    await service.accept({ userId: "user-1", matchId: "match-1" });

    expect(deps.matchRepository.findByIdWithStatus).toHaveBeenCalledWith("match-1", "pending");
    expect(request.status).toBe("accepted");
    expect(request.respondedAt).toBeInstanceOf(Date);
    expect(request.save).toHaveBeenCalled();
    expect(deps.chatRepository.findOrCreateBetween).toHaveBeenCalledWith("user-2", "user-1");
  });

  it("still accepts when opening the chat fails", async () => {
    const request = aRequest();
    const { service } = build({
      matchRepository: { findByIdWithStatus: vi.fn().mockResolvedValue(request) },
      chatRepository: { findOrCreateBetween: vi.fn().mockRejectedValue(new Error("db down")) },
    });

    await expect(service.accept({ userId: "user-1", matchId: "match-1" })).resolves.toBeTruthy();
    expect(request.status).toBe("accepted");
  });

  it("404s a request that is not in the required state", async () => {
    const { service } = build({
      matchRepository: { findByIdWithStatus: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.accept({ userId: "user-1", matchId: "x" })).rejects.toThrow(NotFoundError);
  });

  it("undoing a rejection returns it to pending without erasing respondedAt", async () => {
    const answeredAt = new Date("2026-01-01");
    const request = aRequest({ status: "rejected", respondedAt: answeredAt });
    const { service } = build({
      matchRepository: { findByIdWithStatus: vi.fn().mockResolvedValue(request) },
    });

    await service.undoReject({ userId: "user-1", matchId: "match-1" });

    expect(request.status).toBe("pending");
    // The receiver did answer; overwriting this would erase that from reporting.
    expect(request.respondedAt).toBe(answeredAt);
  });

  describe("blocking", () => {
    it("lets either participant block", async () => {
      const request = aRequest({ senderId: "user-2", receiverId: "user-1" });
      const { service } = build({
        matchRepository: { findById: vi.fn().mockResolvedValue(request) },
      });

      await service.block({ userId: "user-1", matchId: "match-1" });

      expect(request.status).toBe("blocked");
      expect(request.blockedBy).toBe("user-1");
    });

    it("refuses a stranger to the match", async () => {
      const request = aRequest({ senderId: "user-2", receiverId: "user-3" });
      const { service } = build({
        matchRepository: { findById: vi.fn().mockResolvedValue(request) },
      });

      await expect(service.block({ userId: "user-1", matchId: "match-1" })).rejects.toThrow(
        ForbiddenError
      );
      expect(request.save).not.toHaveBeenCalled();
    });

    it("only the blocker can unblock", async () => {
      const request = aRequest({ status: "blocked", blockedBy: "user-2" });
      const { service } = build({
        matchRepository: { findByIdWithStatus: vi.fn().mockResolvedValue(request) },
      });

      await expect(service.unblock({ userId: "user-1", matchId: "match-1" })).rejects.toThrow(
        "Only the user who blocked can unblock"
      );
    });

    it("unblocking restores the conversation to accepted", async () => {
      const request = aRequest({ status: "blocked", blockedBy: "user-1" });
      const { service } = build({
        matchRepository: { findByIdWithStatus: vi.fn().mockResolvedValue(request) },
      });

      await service.unblock({ userId: "user-1", matchId: "match-1" });

      expect(request.status).toBe("accepted");
      expect(request.blockedBy).toBeNull();
    });
  });
});

describe("MatchService.findMatchWith", () => {
  it("requires the other user's id", async () => {
    const { service } = build();

    await expect(service.findMatchWith({ userId: "user-1" })).rejects.toThrow(ValidationError);
  });

  it("returns null when the two have never matched", async () => {
    // A normal answer, not a 404 — the chat screen asks this on every open.
    const { service } = build();

    await expect(
      service.findMatchWith({ userId: "user-1", otherUserId: "user-2" })
    ).resolves.toBeNull();
  });

  it("finds the match regardless of who sent it", async () => {
    const { service, deps } = build({
      matchRepository: {
        findBetween: vi
          .fn()
          .mockResolvedValue({ _id: "m1", status: "blocked", blockedBy: "user-2" }),
      },
    });

    const result = await service.findMatchWith({ userId: "user-1", otherUserId: "user-2" });

    expect(deps.matchRepository.findBetween).toHaveBeenCalledWith("user-1", "user-2");
    expect(result).toEqual({ matchId: "m1", status: "blocked", blockedBy: "user-2" });
  });
});
