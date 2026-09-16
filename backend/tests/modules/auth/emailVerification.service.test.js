import { describe, it, expect, vi } from "vitest";
import { EmailVerificationService } from "#src/modules/auth/emailVerification.service.js";
import { CredentialsService } from "#src/modules/auth/credentials.service.js";

const build = (storeOverrides = {}) => {
  const store = {
    read: vi.fn().mockResolvedValue(null),
    issue: vi.fn().mockResolvedValue(undefined),
    recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...storeOverrides,
  };
  const emailService = { sendOtpEmail: vi.fn().mockResolvedValue(undefined) };

  return {
    service: new EmailVerificationService({
      store,
      credentials: new CredentialsService(),
      emailService,
    }),
    store,
    emailService,
  };
};

describe("EmailVerificationService.issue", () => {
  it("rejects a missing or malformed address", async () => {
    const { service } = build();

    await expect(service.issue("")).rejects.toThrow("Email address is required");
    await expect(service.issue("not-an-email")).rejects.toThrow("Invalid email format");
  });

  it("stores a code and mails it", async () => {
    const { service, store, emailService } = build();

    await service.issue("a@b.com");

    const [, code] = store.issue.mock.calls[0];
    expect(code).toMatch(/^\d{6}$/);
    expect(emailService.sendOtpEmail).toHaveBeenCalledWith("a@b.com", code);
  });

  it("refuses to issue while a code is still live", async () => {
    const { service, emailService } = build({
      read: vi.fn().mockResolvedValue({ otp: "1234", attempts: 0 }),
    });

    await expect(service.issue("a@b.com")).rejects.toThrow(/already sent/);
    expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
  });

  it("gives the resend path its own wording for the same condition", async () => {
    const { service } = build({ read: vi.fn().mockResolvedValue({ otp: "1", attempts: 0 }) });

    await expect(service.issue("a@b.com", "resend")).rejects.toThrow("OTP is still active. Please wait.");
  });
});

describe("EmailVerificationService.verify", () => {
  it("requires both fields", async () => {
    const { service } = build();

    await expect(service.verify({ email: "a@b.com" })).rejects.toThrow("Email and OTP are required");
  });

  it("rejects when no code is stored", async () => {
    const { service } = build();

    await expect(service.verify({ email: "a@b.com", otp: "1234" })).rejects.toThrow(
      "OTP expired or not found"
    );
  });

  it("counts a wrong guess without extending the code's life", async () => {
    // Re-issuing with a fresh TTL would let an attacker keep a code alive
    // indefinitely by guessing wrong at intervals.
    const stored = { otp: "1234", attempts: 0 };
    const { service, store } = build({ read: vi.fn().mockResolvedValue(stored) });

    await expect(service.verify({ email: "a@b.com", otp: "9999" })).rejects.toThrow("Invalid OTP");

    expect(store.recordFailedAttempt).toHaveBeenCalledWith("a@b.com", stored);
    expect(store.issue).not.toHaveBeenCalled();
  });

  it("burns the code after too many attempts", async () => {
    // Destroyed rather than merely refused — otherwise an attacker just waits.
    const { service, store } = build({
      read: vi.fn().mockResolvedValue({ otp: "1234", attempts: 3 }),
    });

    await expect(service.verify({ email: "a@b.com", otp: "1234" })).rejects.toThrow(
      "Too many attempts. Request a new OTP."
    );
    expect(store.clear).toHaveBeenCalledWith("a@b.com");
  });

  it("refuses a correct code once the attempt limit is spent", async () => {
    // The limit is checked before the comparison, so knowing the code late is
    // not a way back in.
    const { service } = build({ read: vi.fn().mockResolvedValue({ otp: "1234", attempts: 5 }) });

    await expect(service.verify({ email: "a@b.com", otp: "1234" })).rejects.toThrow(/Too many/);
  });

  it("accepts the right code and destroys it", async () => {
    const { service, store } = build({
      read: vi.fn().mockResolvedValue({ otp: "1234", attempts: 1 }),
    });

    await expect(service.verify({ email: "a@b.com", otp: "1234" })).resolves.toBeUndefined();
    expect(store.clear).toHaveBeenCalledWith("a@b.com");
  });
});
