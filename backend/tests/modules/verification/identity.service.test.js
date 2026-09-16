import { describe, it, expect, vi } from "vitest";
import {
  IdentityVerificationService,
  ID_STATUS,
} from "#src/modules/verification/identity.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "#src/core/errors/index.js";

const aUser = (status = ID_STATUS.none, over = {}) => ({
  _id: "u1",
  email: "sam@example.com",
  name: "Sam",
  verified: { nationalIDVer: status },
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const files = () => ({
  frontImage: [{ buffer: Buffer.from("front") }],
  backImage: [{ buffer: Buffer.from("back") }],
});

const build = (over = {}) => {
  const userRepository = {
    findById: vi.fn().mockResolvedValue(aUser()),
    updateById: vi.fn().mockResolvedValue({}),
    ...over.userRepository,
  };

  const verificationRepository = {
    create: vi.fn().mockResolvedValue({ _id: "v1" }),
    findOne: vi.fn().mockResolvedValue({ _id: "v1" }),
    findById: vi.fn().mockResolvedValue({ _id: "v1", user: "u2" }),
    deleteById: vi.fn().mockResolvedValue({ _id: "v1", user: "u2" }),
    ...over.verificationRepository,
  };

  const imageUploader = vi.fn().mockResolvedValue("https://cdn/id.jpg");
  const sendEmail = vi.fn().mockResolvedValue(undefined);

  return {
    service: new IdentityVerificationService({
      userRepository,
      verificationRepository,
      imageUploader,
      sendEmail,
    }),
    userRepository,
    verificationRepository,
    imageUploader,
    sendEmail,
  };
};

describe("submit", () => {
  it("404s a caller whose account is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.submit({ userId: "u1", files: files() })).rejects.toThrow(NotFoundError);
  });

  it("refuses a second submission while one is in review", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser(ID_STATUS.pending)) },
    });

    await expect(service.submit({ userId: "u1", files: files() })).rejects.toThrow(
      "Your verification is underprocess"
    );
  });

  it("refuses to let a verified member swap their document", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser(ID_STATUS.verified)) },
    });

    await expect(service.submit({ userId: "u1", files: files() })).rejects.toThrow(
      "Your id is already verified"
    );
  });

  it("requires both sides of the document", async () => {
    const { service } = build();

    await expect(
      service.submit({ userId: "u1", files: { frontImage: [{ buffer: Buffer.from("f") }] } })
    ).rejects.toThrow(ValidationError);
    await expect(service.submit({ userId: "u1", files: {} })).rejects.toThrow(
      "Both front and back images are required."
    );
  });

  it("moves the member into review and records the documents", async () => {
    const user = aUser();
    const { service, verificationRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(user) },
    });

    const status = await service.submit({ userId: "u1", files: files() });

    expect(status).toBe(ID_STATUS.pending);
    expect(user.verified.nationalIDVer).toBe(ID_STATUS.pending);
    expect(verificationRepository.create).toHaveBeenCalledWith({
      user: "u1",
      frontsideImage: "https://cdn/id.jpg",
      backsideImage: "https://cdn/id.jpg",
    });
  });

  it("leaves the member able to retry if the upload fails", async () => {
    // Uploading before either record is written is what keeps a storage outage
    // from stranding someone in review with no documents attached.
    const user = aUser();
    const { service, verificationRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(user) },
    });
    service.imageUploader = vi.fn().mockRejectedValue(new Error("cloudinary down"));

    await expect(service.submit({ userId: "u1", files: files() })).rejects.toThrow();
    expect(user.verified.nationalIDVer).toBe(ID_STATUS.none);
    expect(user.save).not.toHaveBeenCalled();
    expect(verificationRepository.create).not.toHaveBeenCalled();
  });
});

describe("the admin gate", () => {
  it.each([
    ["findForUser", (s) => s.findForUser({ adminId: "u1", userId: "u2" })],
    ["approve", (s) => s.approve({ adminId: "u1", verificationId: "v1" })],
    ["revert", (s) => s.revert({ adminId: "u1", verificationId: "v1" })],
  ])("blocks a non-admin from %s", async (_name, call) => {
    const { service, verificationRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await expect(call(service)).rejects.toThrow(ForbiddenError);
    expect(verificationRepository.deleteById).not.toHaveBeenCalled();
  });
});

const asAdmin = (over = {}) =>
  build({
    userRepository: {
      findById: vi
        .fn()
        .mockResolvedValueOnce({ type: "Admin" })
        .mockResolvedValue(over.target ?? aUser(ID_STATUS.pending, { _id: "u2" })),
      updateById: vi.fn().mockResolvedValue({}),
    },
    verificationRepository: over.verificationRepository,
  });

describe("findForUser", () => {
  it("404s when the member never submitted anything", async () => {
    const { service } = asAdmin({ verificationRepository: { findOne: vi.fn().mockResolvedValue(null) } });

    await expect(service.findForUser({ adminId: "a1", userId: "u2" })).rejects.toThrow(
      "Verification record not found"
    );
  });

  it("looks the record up by the member's id, not the record's", async () => {
    const { service, verificationRepository } = asAdmin();

    await service.findForUser({ adminId: "a1", userId: "u2" });

    expect(verificationRepository.findOne).toHaveBeenCalledWith({ user: "u2" });
  });
});

describe("approve", () => {
  it("grants the badge and tells the member", async () => {
    const { service, userRepository, sendEmail } = asAdmin();

    await service.approve({ adminId: "a1", verificationId: "v1" });

    expect(userRepository.updateById).toHaveBeenCalledWith("u2", {
      "verified.nationalIDVer": ID_STATUS.verified,
    });
    expect(sendEmail.mock.calls[0][1]).toBe("Your Verification Request Has Been Approved");
  });

  it("refuses to approve someone already verified", async () => {
    const { service } = asAdmin({ target: aUser(ID_STATUS.verified, { _id: "u2" }) });

    await expect(service.approve({ adminId: "a1", verificationId: "v1" })).rejects.toThrow(
      "User is already verified"
    );
  });

  it("refuses to approve someone who never submitted", async () => {
    // Otherwise the badge is granted with no document behind it.
    const { service, userRepository } = asAdmin({ target: aUser(ID_STATUS.none, { _id: "u2" }) });

    await expect(service.approve({ adminId: "a1", verificationId: "v1" })).rejects.toThrow(
      "Please submit the required documents"
    );
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("404s a verification id that does not exist", async () => {
    const { service } = asAdmin({ verificationRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.approve({ adminId: "a1", verificationId: "nope" })).rejects.toThrow(
      NotFoundError
    );
  });

  it("succeeds even if the notification email fails", async () => {
    // The decision is recorded; a mail outage must not make the admin think
    // the review failed and repeat it.
    const { service } = asAdmin();
    service.sendEmail = vi.fn().mockRejectedValue(new Error("smtp down"));

    await expect(service.approve({ adminId: "a1", verificationId: "v1" })).resolves.toBeUndefined();
  });
});

describe("revert", () => {
  it("deletes the stored documents along with the badge", async () => {
    // Holding photographs of a government ID for a check that was reverted is
    // data there is no reason to keep.
    const { service, verificationRepository, userRepository } = asAdmin();

    await service.revert({ adminId: "a1", verificationId: "v1" });

    expect(verificationRepository.deleteById).toHaveBeenCalledWith("v1");
    expect(userRepository.updateById).toHaveBeenCalledWith("u2", {
      "verified.nationalIDVer": ID_STATUS.none,
    });
  });

  it("tells the member why, and how to proceed", async () => {
    const { service, sendEmail } = asAdmin();

    await service.revert({ adminId: "a1", verificationId: "v1" });

    expect(sendEmail.mock.calls[0][1]).toBe("Your Verification Request Has Been Reverted");
    expect(sendEmail.mock.calls[0][2]).toContain("submit the required documents");
  });

  it("refuses to revert someone who was never verified", async () => {
    const { service } = asAdmin({ target: aUser(ID_STATUS.none, { _id: "u2" }) });

    await expect(service.revert({ adminId: "a1", verificationId: "v1" })).rejects.toThrow(
      ValidationError
    );
  });

  it("404s a verification id that does not exist", async () => {
    const { service } = asAdmin({
      verificationRepository: { deleteById: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.revert({ adminId: "a1", verificationId: "nope" })).rejects.toThrow(
      "Verification record not found"
    );
  });
});
