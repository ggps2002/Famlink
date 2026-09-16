import { describe, it, expect, vi } from "vitest";
import { AdminUserService } from "#src/modules/admin/adminUser.service.js";
import { CredentialsService } from "#src/modules/auth/credentials.service.js";
import { NotFoundError, ValidationError } from "#src/core/errors/index.js";

const credentials = new CredentialsService({ auth: { bcryptSaltRounds: 4 } });

const aUser = (over = {}) => ({
  _id: "u2",
  email: "sam@example.com",
  name: "Sam",
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const build = (over = {}) => {
  const userRepository = {
    findById: vi.fn().mockResolvedValue(aUser()),
    updateById: vi.fn().mockResolvedValue(aUser()),
    ...over.userRepository,
  };

  const stripe = {
    listCards: vi.fn().mockResolvedValue({ data: [] }),
    detachPaymentMethod: vi.fn().mockResolvedValue({}),
    ...over.stripe,
  };

  const sendAccountDeactivatedEmail = vi.fn().mockResolvedValue(undefined);

  return {
    service: new AdminUserService({
      userRepository,
      credentials,
      stripe,
      sendAccountDeactivatedEmail,
    }),
    userRepository,
    stripe,
    sendAccountDeactivatedEmail,
  };
};

describe("setStatus", () => {
  it("accepts only the two statuses this endpoint may set", async () => {
    const { service, userRepository } = build();

    await expect(service.setStatus({ userId: "u2", status: "Suspended" })).rejects.toThrow(
      ValidationError
    );
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("404s a member who is already gone", async () => {
    const { service } = build({ userRepository: { updateById: vi.fn().mockResolvedValue(null) } });

    await expect(service.setStatus({ userId: "gone", status: "Block" })).rejects.toThrow(
      NotFoundError
    );
  });

  it("emails a generic reason when blocking", async () => {
    // The moderator's actual note is an internal field; repeating it would tell
    // the member they were reported, roughly when, and by how many people.
    const { service, sendAccountDeactivatedEmail } = build();

    await service.setStatus({ userId: "u2", status: "Block" });

    expect(sendAccountDeactivatedEmail).toHaveBeenCalledWith(
      "sam@example.com",
      "Sam",
      "a violation of our community guidelines"
    );
  });

  it("sends nothing when reactivating", async () => {
    const { service, sendAccountDeactivatedEmail } = build();

    await service.setStatus({ userId: "u2", status: "Active" });

    expect(sendAccountDeactivatedEmail).not.toHaveBeenCalled();
  });

  it("blocks even if the email fails", async () => {
    const { service } = build();
    service.sendAccountDeactivatedEmail = vi.fn().mockRejectedValue(new Error("smtp down"));

    await expect(service.setStatus({ userId: "u2", status: "Block" })).resolves.toBeTruthy();
  });
});

describe("edit", () => {
  it("requires a target id", async () => {
    const { service } = build();

    await expect(service.edit({ userId: undefined })).rejects.toThrow("User ID is required");
  });

  it("404s a member who does not exist", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.edit({ userId: "gone" })).rejects.toThrow(NotFoundError);
  });

  it("writes only the fields the request carried", async () => {
    const user = aUser({ name: "Original", zipCode: "78701" });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.edit({ userId: "u2", name: "Changed" });

    expect(user.name).toBe("Changed");
    expect(user.zipCode).toBe("78701");
  });

  it("rejects an unparseable date of birth", async () => {
    const { service } = build();

    await expect(service.edit({ userId: "u2", dob: "not a date" })).rejects.toThrow(
      "Invalid date format for dob"
    );
  });

  it("stores a valid date of birth as a Date", async () => {
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.edit({ userId: "u2", dob: "1990-04-02" });

    expect(user.dob).toBeInstanceOf(Date);
  });

  it("does not clear email verification when an admin changes the address", async () => {
    // Documented, not endorsed: the member's own settings screen does clear it,
    // so this leaves a "verified" badge on an address nobody proved they own.
    const user = aUser({ verified: { emailVer: true } });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.edit({ userId: "u2", email: "new@example.com" });

    expect(user.email).toBe("new@example.com");
    expect(user.verified.emailVer).toBe(true);
  });
});

describe("setPassword", () => {
  it("404s a member who does not exist", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.setPassword({ userId: "gone", password: "x" })).rejects.toThrow(
      NotFoundError
    );
  });

  it("requires a password", async () => {
    const { service } = build();

    await expect(service.setPassword({ userId: "u2" })).rejects.toThrow(
      "New password is required."
    );
  });

  it("stores it hashed, never in the clear", async () => {
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.setPassword({ userId: "u2", password: "brand-new" });

    expect(user.password).not.toBe("brand-new");
    await expect(credentials.verifyPassword("brand-new", user.password)).resolves.toBe(true);
  });

  it("asks for no current password — this is the locked-out path", async () => {
    const user = aUser({ password: "old-hash" });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(
      service.setPassword({ userId: "u2", password: "reset" })
    ).resolves.toBeUndefined();
  });
});

describe("saved cards", () => {
  it("404s a member with no Stripe customer when listing", async () => {
    const { service } = build();

    await expect(service.listCards("u2")).rejects.toThrow("No Cards found for the user!");
  });

  it("lists the member's cards", async () => {
    const { service, stripe } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser({ stripeId: "cus_1" })) },
    });

    await service.listCards("u2");

    expect(stripe.listCards).toHaveBeenCalledWith("cus_1");
  });

  it("400s a removal for a member with no Stripe customer", async () => {
    const { service, stripe } = build();

    await expect(
      service.deleteCard({ userId: "u2", paymentMethodId: "pm_1" })
    ).rejects.toThrow(ValidationError);
    expect(stripe.detachPaymentMethod).not.toHaveBeenCalled();
  });

  it("detaches the card", async () => {
    const { service, stripe } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser({ stripeId: "cus_1" })) },
    });

    await service.deleteCard({ userId: "u2", paymentMethodId: "pm_1" });

    expect(stripe.detachPaymentMethod).toHaveBeenCalledWith("pm_1");
  });
});
