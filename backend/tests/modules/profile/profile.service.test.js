import { describe, it, expect, vi } from "vitest";
import { ProfileService } from "#src/modules/profile/profile.service.js";
import { UnauthorizedError } from "#src/core/errors/index.js";

const build = (over = {}) => {
  const userRepository = {
    findById: vi.fn().mockResolvedValue({ _id: "u1" }),
    updateById: vi.fn().mockResolvedValue({}),
    ...over.userRepository,
  };

  const profileRepository = {
    saveForUser: vi.fn().mockImplementation(async (_id, doc) => doc),
    findByUserId: vi.fn().mockResolvedValue(null),
    ...over.profileRepository,
  };

  const imageUploader = vi.fn().mockResolvedValue("https://cdn/pic.jpg");
  // Resolves to null: "not referred, or already credited", the ordinary case.
  const creditReferrer = vi.fn().mockResolvedValue(null);
  const sendReferralRewardEmail = vi.fn().mockResolvedValue(undefined);

  return {
    service: new ProfileService({
      userRepository,
      profileRepository,
      imageUploader,
      creditReferrer,
      sendReferralRewardEmail,
    }),
    userRepository,
    profileRepository,
    imageUploader,
    creditReferrer,
    sendReferralRewardEmail,
  };
};

const saved = (profileRepository) => profileRepository.saveForUser.mock.calls[0][1];

describe("create", () => {
  it("refuses a token that names an account that no longer exists", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.create({ userId: "u1", body: {} })).rejects.toThrow(UnauthorizedError);
  });

  it("parses answers that arrive as JSON strings", async () => {
    // Multipart delivers everything as text, so an unparsed field is stored as
    // the string "[1,2]" and reads back wrong forever after.
    const { service, profileRepository } = build();

    await service.create({
      userId: "u1",
      body: { availability: '["mon","tue"]', preferredAges: '{"min":0,"max":5}' },
    });

    expect(saved(profileRepository).availability).toEqual(["mon", "tue"]);
    expect(saved(profileRepository).preferredAges).toEqual({ min: 0, max: 5 });
  });

  it("leaves a value that is not JSON exactly as it arrived", async () => {
    const { service, profileRepository } = build();

    await service.create({ userId: "u1", body: { availability: "weekends only" } });

    expect(saved(profileRepository).availability).toBe("weekends only");
  });

  it("coerces the gating flags to real booleans", async () => {
    // `hasFamily: "false"` — the string, as FormData delivers it — is truthy,
    // and the match paywall compares against the boolean false.
    const { service, profileRepository } = build();

    await service.create({ userId: "u1", body: { hasFamily: "false", hasNanny: "true" } });

    expect(saved(profileRepository).hasFamily).toBe(false);
    expect(saved(profileRepository).hasNanny).toBe(true);
  });

  it("leaves a flag absent rather than defaulting it to false", async () => {
    const { service, profileRepository } = build();

    await service.create({ userId: "u1", body: {} });

    expect(saved(profileRepository)).not.toHaveProperty("hasFamily");
  });

  it("writes the avatar to the user record as well as the profile", async () => {
    // So the photo appears everywhere, not only on the share card.
    const { service, userRepository, profileRepository } = build();

    await service.create({ userId: "u1", body: {}, file: { buffer: Buffer.from("img") } });

    expect(userRepository.updateById).toHaveBeenCalledWith("u1", {
      imageUrl: "https://cdn/pic.jpg",
    });
    expect(saved(profileRepository).imageFile).toBe("https://cdn/pic.jpg");
  });

  it("marks the profile complete only on the final questionnaire step", async () => {
    // `careType` marks a mid-flow step; its absence is what the flow uses to
    // mean "this was the last one".
    const midFlow = build();
    await midFlow.service.create({ userId: "u1", body: { careType: "full time" } });
    expect(midFlow.userRepository.updateById).not.toHaveBeenCalled();

    const final = build();
    await final.service.create({ userId: "u1", body: {} });
    expect(final.userRepository.updateById).toHaveBeenCalledWith("u1", {
      nannyProfileCompleted: true,
    });
  });

  it("upserts, so re-running an earlier step does not fail", async () => {
    const { service, profileRepository } = build();

    await service.create({ userId: "u1", body: {} });

    expect(profileRepository.saveForUser.mock.calls[0][0]).toBe("u1");
    expect(profileRepository.saveForUser.mock.calls[0][2]).toBeUndefined();
  });
});

describe("update", () => {
  it("parses the fields the create path does not", async () => {
    // An inherited difference between the two paths, named in the service.
    const { service, profileRepository } = build();

    await service.update({ userId: "u1", body: { languages: '["en","es"]' } });

    expect(saved(profileRepository).$set.languages).toEqual(["en", "es"]);
  });

  it("validates on write, unlike create", async () => {
    // A full profile edit posts a complete document and should be checked; the
    // questionnaire posts a few answers at a time and much of the schema is
    // absent mid-flow.
    const { service, profileRepository } = build();

    await service.update({ userId: "u1", body: {} });

    expect(profileRepository.saveForUser.mock.calls[0][2]).toEqual({ validate: true });
  });

  it("re-points the user's avatar at the profile's when no file is sent", async () => {
    const { service, userRepository } = build({
      profileRepository: {
        findByUserId: vi.fn().mockResolvedValue({ imageFile: "https://cdn/existing.jpg" }),
      },
    });

    await service.update({ userId: "u1", body: {} });

    expect(userRepository.updateById).toHaveBeenCalledWith("u1", {
      imageUrl: "https://cdn/existing.jpg",
    });
  });

  it("leaves the user's avatar alone when the profile has none either", async () => {
    const { service, userRepository } = build();

    await service.update({ userId: "u1", body: {} });

    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("does not require the profile to exist first", async () => {
    // The questionnaire saves as the member moves through it, and neither side
    // tracks which step created the record.
    const { service, profileRepository } = build();

    await expect(service.update({ userId: "u1", body: {} })).resolves.toBeDefined();
    expect(profileRepository.saveForUser).toHaveBeenCalled();
  });
});

describe("referral payout", () => {
  it("fires on every save, from both entry points", async () => {
    // Previously hung off a `!careType` heuristic that does not hold across all
    // the onboarding flows, so a referred friend could finish a profile and
    // silently credit nobody.
    const created = build();
    await created.service.create({ userId: "u1", body: { careType: "full time" } });
    expect(created.creditReferrer).toHaveBeenCalledWith("u1");

    const updated = build();
    await updated.service.update({ userId: "u1", body: {} });
    expect(updated.creditReferrer).toHaveBeenCalledWith("u1");
  });

  it("emails the referrer when a payout actually lands", async () => {
    const { service, creditReferrer, sendReferralRewardEmail } = build();
    creditReferrer.mockResolvedValue({
      referrer: {
        _id: "r1",
        email: "ref@example.com",
        name: "Ref",
        referralCount: 2,
        referralMatchingUntil: "2026-10-01",
      },
      referred: { _id: "u1", name: "Sam" },
    });

    await service.create({ userId: "u1", body: {} });
    await new Promise((resolve) => setImmediate(resolve));

    expect(sendReferralRewardEmail).toHaveBeenCalledWith("ref@example.com", "Ref", {
      friendName: "Sam",
      monthsEarned: 2,
      matchingUntil: "2026-10-01",
    });
  });

  it("sends nothing when there was nothing to credit", async () => {
    const { service, sendReferralRewardEmail } = build();

    await service.create({ userId: "u1", body: {} });
    await new Promise((resolve) => setImmediate(resolve));

    expect(sendReferralRewardEmail).not.toHaveBeenCalled();
  });

  it("never fails the profile save when the payout throws", async () => {
    const { service, creditReferrer } = build();
    creditReferrer.mockRejectedValue(new Error("ledger down"));

    await expect(service.create({ userId: "u1", body: {} })).resolves.toBeDefined();
  });
});
