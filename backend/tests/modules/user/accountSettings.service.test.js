import { describe, it, expect, vi } from "vitest";
import { AccountSettingsService } from "#src/modules/user/accountSettings.service.js";
import { CredentialsService } from "#src/modules/auth/credentials.service.js";
import { NotFoundError, ValidationError } from "#src/core/errors/index.js";

const credentials = new CredentialsService({ auth: { bcryptSaltRounds: 4 } });

const aUser = (over = {}) => ({
  _id: "user-1",
  email: "sam@example.com",
  verified: { emailVer: true, phoneVer: true },
  notifications: { sms: true, email: { platformUpdates: true, newsletter: true } },
  markModified: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  toJSON() {
    const { save, markModified, toJSON, ...rest } = this;
    return rest;
  },
  ...over,
});

const build = (over = {}) => {
  const deps = {
    userRepository: {
      findById: vi.fn().mockResolvedValue(aUser()),
      exists: vi.fn().mockResolvedValue(false),
      ...over.userRepository,
    },
    credentials,
    tokenService: {
      issuePair: vi.fn().mockResolvedValue({ accessToken: "at", refreshToken: "rt" }),
    },
  };

  return { service: new AccountSettingsService(deps), deps };
};

describe("changeEmail", () => {
  it("404s a caller whose account is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(
      service.changeEmail({ userId: "x", currentEmail: "a@b.com", newEmail: "c@d.com" })
    ).rejects.toThrow(NotFoundError);
  });

  it("requires the current address to match", async () => {
    // The caller is already authenticated, but proving they know the current
    // address stops an unattended session silently moving the account.
    const { service } = build();

    await expect(
      service.changeEmail({ userId: "user-1", currentEmail: "wrong@x.com", newEmail: "c@d.com" })
    ).rejects.toThrow("The current email does not match the user's email.");
  });

  it("rejects a no-op change", async () => {
    const { service } = build();

    await expect(
      service.changeEmail({
        userId: "user-1",
        currentEmail: "sam@example.com",
        newEmail: "sam@example.com",
      })
    ).rejects.toThrow("New email must be different");
  });

  it("rejects an address already in use", async () => {
    const { service } = build({ userRepository: { exists: vi.fn().mockResolvedValue(true) } });

    await expect(
      service.changeEmail({
        userId: "user-1",
        currentEmail: "sam@example.com",
        newEmail: "taken@x.com",
      })
    ).rejects.toThrow("New email is already in use.");
  });

  it("clears email verification when the address changes", async () => {
    // The new address is unproven; keeping the badge would make verification
    // meaningless.
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.changeEmail({
      userId: "user-1",
      currentEmail: "sam@example.com",
      newEmail: "new@x.com",
    });

    expect(user.email).toBe("new@x.com");
    expect(user.verified.emailVer).toBe(false);
  });
});

describe("changePassword", () => {
  it("requires the current password to be correct", async () => {
    const user = aUser({ password: await credentials.hashPassword("right") });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(
      service.changePassword({ userId: "user-1", currentPassword: "wrong", newPassword: "new" })
    ).rejects.toThrow("Current password is incorrect.");
    expect(user.save).not.toHaveBeenCalled();
  });

  it("rejects reusing the same password", async () => {
    const user = aUser({ password: await credentials.hashPassword("same") });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(
      service.changePassword({ userId: "user-1", currentPassword: "same", newPassword: "same" })
    ).rejects.toThrow("New password must be different");
  });

  it("stores the new password hashed", async () => {
    const user = aUser({ password: await credentials.hashPassword("old") });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.changePassword({
      userId: "user-1",
      currentPassword: "old",
      newPassword: "brand-new",
    });

    expect(user.password).not.toBe("brand-new");
    await expect(credentials.verifyPassword("brand-new", user.password)).resolves.toBe(true);
  });
});

describe("changePhone", () => {
  it("clears phone verification and switches SMS off", async () => {
    // The badge belonged to the old number, and SMS must not keep going to a
    // number this account has not proven it owns.
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.changePhone({ userId: "user-1", phoneNo: "+15550001111" });

    expect(user.phoneNo).toBe("+15550001111");
    expect(user.verified.phoneVer).toBe(false);
    expect(user.notifications.sms).toBe(false);
  });

  it("requires a number", async () => {
    const { service } = build();

    await expect(service.changePhone({ userId: "user-1" })).rejects.toThrow(ValidationError);
  });

  it("hands back a fresh session, since the client replaces its auth slice", async () => {
    const { service, deps } = build();

    const { tokens } = await service.changePhone({ userId: "user-1", phoneNo: "+1555" });

    expect(deps.tokenService.issuePair).toHaveBeenCalled();
    expect(tokens.accessToken).toBe("at");
  });
});

describe("setSmsNotifications", () => {
  it("accepts only a real boolean", async () => {
    // A truthy string would silently opt someone in.
    const { service } = build();

    await expect(service.setSmsNotifications({ userId: "user-1", sms: "true" })).rejects.toThrow(
      "Invalid sms value"
    );
  });

  it("stores the preference", async () => {
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(service.setSmsNotifications({ userId: "user-1", sms: false })).resolves.toBe(false);
    expect(user.notifications.sms).toBe(false);
  });
});

describe("setEmailNotifications", () => {
  it("requires an array", async () => {
    const { service } = build();

    await expect(
      service.setEmailNotifications({ userId: "user-1", notifications: "all" })
    ).rejects.toThrow(ValidationError);
  });

  it("treats the array as the full ON set, switching off anything absent", async () => {
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    const result = await service.setEmailNotifications({
      userId: "user-1",
      notifications: ["newsletter"],
    });

    expect(result.email).toEqual({ platformUpdates: false, newsletter: true });
  });

  it("ignores unknown categories rather than writing them", async () => {
    // Otherwise a stale client resurrects one of the eight per-topic flags
    // these two replaced.
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    const result = await service.setEmailNotifications({
      userId: "user-1",
      notifications: ["newsletter", "weeklyDigest", "matchAlerts"],
    });

    expect(Object.keys(result.email)).toEqual(["platformUpdates", "newsletter"]);
  });

  it("marks the nested path modified so Mongoose persists it", async () => {
    // Reassigning a nested object is not change-tracked on its own.
    const user = aUser();
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.setEmailNotifications({ userId: "user-1", notifications: [] });

    expect(user.markModified).toHaveBeenCalledWith("notifications.email");
  });

  it("lets an unverified address opt out", async () => {
    // Refusing the opt-out because we cannot prove they own the inbox we are
    // mailing is backwards.
    const user = aUser({ verified: { emailVer: false } });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(
      service.setEmailNotifications({ userId: "user-1", notifications: [] })
    ).resolves.toBeTruthy();
  });
});
