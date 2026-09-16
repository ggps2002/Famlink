import { describe, it, expect, vi } from "vitest";
import { LegalService } from "#src/modules/legal/legal.service.js";
import { ConflictError, NotFoundError } from "#src/core/errors/index.js";

const aDoc = (over = {}) => ({
  slug: "terms",
  version: 3,
  title: "Terms",
  content: "<p>text</p>",
  effectiveDate: new Date("2026-01-01"),
  requiresReacceptance: true,
  ...over,
});

const build = (over = {}) => {
  const termsRepository = {
    findOne: vi.fn().mockResolvedValue(aDoc()),
    ...over.termsRepository,
  };
  const userRepository = {
    findById: vi.fn().mockResolvedValue({ termsAcceptedVersion: 3 }),
    updateById: vi.fn().mockResolvedValue(undefined),
    ...over.userRepository,
  };

  return {
    service: new LegalService({ termsRepository, userRepository, ...over.options }),
    termsRepository,
    userRepository,
  };
};

describe("LegalService document reads", () => {
  it("404s a slug it does not serve", async () => {
    const { service } = build();

    await expect(service.getDocument("secret-policy")).rejects.toThrow("Unknown document");
  });

  it("tells the client explicitly when nothing is published", async () => {
    // So the frontend can fall back to its bundled copy rather than rendering
    // an empty legal page.
    const { service } = build({ termsRepository: { findOne: vi.fn().mockResolvedValue(null) } });

    await expect(service.getDocument("terms")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_PUBLISHED",
    });
  });

  it("falls back to the highest version when none is marked published", async () => {
    // Only reachable if a publish crashed between demoting the incumbent and
    // promoting its replacement. A blank terms page is worse than stale text.
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(aDoc({ version: 9 }));
    const { service } = build({ termsRepository: { findOne } });

    await expect(service.getDocument("terms")).resolves.toMatchObject({ version: 9 });
    expect(findOne.mock.calls[1][1]).toMatchObject({ sort: { version: -1 } });
  });

  it("serves repeat reads from cache rather than the database", async () => {
    const { service, termsRepository } = build();

    await service.getDocument("terms");
    await service.getDocument("terms");

    expect(termsRepository.findOne).toHaveBeenCalledTimes(1);
  });

  it("re-reads once the cache TTL has passed", async () => {
    // Short TTL rather than invalidation, so a publish propagates without any
    // coordination between machines.
    const { service, termsRepository } = build({ options: { cacheTtlMs: 0 } });

    await service.getDocument("terms");
    await service.getDocument("terms");

    expect(termsRepository.findOne).toHaveBeenCalledTimes(2);
  });

  it("returns only version metadata from getVersion", async () => {
    // The banner polls this; it must not transfer kilobytes of legal text.
    const { service } = build();

    const version = await service.getVersion("terms");

    expect(version).not.toHaveProperty("content");
    expect(version).toMatchObject({ slug: "terms", version: 3 });
  });
});

describe("LegalService.accept", () => {
  it("records the SERVER's version, never the client's claim", async () => {
    // A client that could name the version it accepted could claim to have
    // agreed to any text at all, including one never published.
    const { service, userRepository } = build();

    await service.accept({ userId: "u1", slug: "terms" });

    expect(userRepository.updateById).toHaveBeenCalledWith("u1", {
      $set: { termsAcceptedAt: expect.any(Date), termsAcceptedVersion: 3 },
    });
  });

  it("rejects an acceptance sent from a stale page", async () => {
    const { service, userRepository } = build();

    await expect(service.accept({ userId: "u1", slug: "terms", version: 2 })).rejects.toMatchObject(
      { statusCode: 409, code: "VERSION_MISMATCH" }
    );
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("accepts when the client's version agrees with the server's", async () => {
    const { service, userRepository } = build();

    await service.accept({ userId: "u1", slug: "terms", version: 3 });

    expect(userRepository.updateById).toHaveBeenCalled();
  });

  it("defaults an unknown slug to terms rather than failing", async () => {
    const { service, userRepository } = build();

    await expect(service.accept({ userId: "u1", slug: "nonsense" })).resolves.toBeTruthy();
    expect(userRepository.updateById).toHaveBeenCalled();
  });

  it("409s when there is nothing published to accept", async () => {
    const { service } = build({ termsRepository: { findOne: vi.fn().mockResolvedValue(null) } });

    await expect(service.accept({ userId: "u1" })).rejects.toThrow(ConflictError);
  });

  it("does not touch the user for a non-terms document", async () => {
    const { service, userRepository } = build({
      termsRepository: { findOne: vi.fn().mockResolvedValue(aDoc({ slug: "privacy" })) },
    });

    await service.accept({ userId: "u1", slug: "privacy" });

    expect(userRepository.updateById).not.toHaveBeenCalled();
  });
});

describe("LegalService.statusFor", () => {
  it("prompts someone who has never accepted, regardless of the reacceptance flag", async () => {
    // That flag governs whether an EXISTING acceptance is invalidated by a
    // change, not whether consent is needed at all.
    const { service } = build({
      termsRepository: {
        findOne: vi.fn().mockResolvedValue(aDoc({ requiresReacceptance: false })),
      },
      userRepository: { findById: vi.fn().mockResolvedValue({ termsAcceptedVersion: null }) },
    });

    await expect(service.statusFor("u1")).resolves.toMatchObject({ needsAcceptance: true });
  });

  it("does not prompt someone already on the current version", async () => {
    const { service } = build();

    await expect(service.statusFor("u1")).resolves.toMatchObject({ needsAcceptance: false });
  });

  it("prompts an outdated acceptance only when reacceptance is required", async () => {
    const outdated = { userRepository: { findById: vi.fn().mockResolvedValue({ termsAcceptedVersion: 1 }) } };

    const required = build({ ...outdated });
    const optional = build({
      ...outdated,
      termsRepository: { findOne: vi.fn().mockResolvedValue(aDoc({ requiresReacceptance: false })) },
    });

    await expect(required.service.statusFor("u1")).resolves.toMatchObject({ needsAcceptance: true });
    await expect(optional.service.statusFor("u1")).resolves.toMatchObject({
      needsAcceptance: false,
    });
  });

  it("does not prompt when nothing is published", async () => {
    const { service } = build({ termsRepository: { findOne: vi.fn().mockResolvedValue(null) } });

    await expect(service.statusFor("u1")).resolves.toEqual({
      needsAcceptance: false,
      currentVersion: null,
    });
  });
});
