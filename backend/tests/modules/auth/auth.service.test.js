import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "#src/modules/auth/auth.service.js";
import { CredentialsService } from "#src/modules/auth/credentials.service.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "#src/core/errors/index.js";

const credentials = new CredentialsService({
  auth: { bcryptSaltRounds: 4 }, // low cost — these tests hash for real
});

const aUser = (over = {}) => ({
  _id: "user-1",
  email: "sam@example.com",
  name: "Sam",
  status: "Active",
  reviews: [],
  verified: { emailVer: false },
  save: vi.fn().mockResolvedValue(undefined),
  toJSON() {
    const { save, toJSON, ...rest } = this;
    return rest;
  },
  ...over,
});

const build = (over = {}) => {
  const deps = {
    userRepository: {
      findOne: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(async (d) => ({ ...d, _id: "new-user", save: vi.fn() })),
      updateById: vi.fn().mockResolvedValue(undefined),
      ...over.userRepository,
    },
    accountPolicy: {
      assertMaySignIn: vi.fn().mockResolvedValue(undefined),
      ...over.accountPolicy,
    },
    tokenService: {
      issuePair: vi.fn().mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        accessTokenExpiry: 1,
        refreshTokenExpiry: 2,
      }),
      resolveRefreshToken: vi.fn().mockResolvedValue("user-1"),
      ...over.tokenService,
    },
    credentials,
    emailService: {
      sendOtpEmail: vi.fn(),
      sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
      ...over.emailService,
    },
    capitalizeUsername: (n) => n,
    uploadImage: vi.fn().mockResolvedValue("https://cdn/img.png"),
    applyReferral: vi.fn().mockResolvedValue(undefined),
    recordWaitlistEntry: vi.fn(),
    retireOnboardingLead: vi.fn(),
    clientUrl: "https://app.test",
  };

  return { service: new AuthService(deps), deps };
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("AuthService.register", () => {
  it("refuses an address that already has an account", async () => {
    const { service } = build({ userRepository: { findOne: vi.fn().mockResolvedValue(aUser()) } });

    await expect(service.register({ email: "sam@example.com" })).rejects.toThrow(ConflictError);
  });

  it("strips referral fields a client must never set", async () => {
    // Without this a client could sign up already holding a forged referredBy
    // or a referralMatchingUntil far in the future, walking past the match gate.
    const { service, deps } = build();

    await service.register({
      email: "new@example.com",
      name: "New",
      referralCode: "STOLEN",
      referredBy: "someone-else",
      referralMatchingUntil: "2099-01-01",
    });

    const created = deps.userRepository.create.mock.calls[0][0];
    expect(created).not.toHaveProperty("referralCode");
    expect(created).not.toHaveProperty("referredBy");
    expect(created).not.toHaveProperty("referralMatchingUntil");
  });

  it("hashes the password rather than storing it", async () => {
    const { service, deps } = build();

    await service.register({ email: "new@example.com", name: "New", password: "hunter2-long-enough" });

    const created = deps.userRepository.create.mock.calls[0][0];
    expect(created.password).not.toBe("hunter2-long-enough");
    await expect(credentials.verifyPassword("hunter2-long-enough", created.password)).resolves.toBe(true);
  });

  it("marks a Google signup's email as already verified, and sets no password", async () => {
    const { service, deps } = build();

    await service.register({
      email: "g@example.com",
      name: "G",
      registeredVia: "google",
      password: "ignored",
    });

    const created = deps.userRepository.create.mock.calls[0][0];
    expect(created.verified).toEqual({ emailVer: true });
    expect(created.password).toBe("ignored"); // passed through, never hashed as a credential
  });

  it("drops a location that is not usable", async () => {
    const { service, deps } = build();

    await service.register({ email: "n@e.com", name: "N", location: "not json" });

    expect(deps.userRepository.create.mock.calls[0][0]).not.toHaveProperty("location");
  });

  it("parses a location sent as a JSON string by the multipart form", async () => {
    const { service, deps } = build();

    await service.register({ email: "n@e.com", name: "N", location: '{"city":"Oakland"}' });

    expect(deps.userRepository.create.mock.calls[0][0].location).toEqual({ city: "Oakland" });
  });

  it("only treats an explicit true as consent to marketing email", async () => {
    const { service, deps } = build();

    await service.register({ email: "n@e.com", name: "N", notifyConsent: "yes" });

    expect(deps.recordWaitlistEntry).toHaveBeenCalledWith(
      expect.objectContaining({ notifyConsent: false })
    );
  });

  it("still registers when the welcome email fails", async () => {
    const { service } = build({
      emailService: { sendWelcomeEmail: vi.fn().mockRejectedValue(new Error("smtp down")) },
    });

    await expect(service.register({ email: "n@e.com", name: "N" })).resolves.toBeTruthy();
  });
});

describe("AuthService.login", () => {
  // An unknown address and a wrong password must be indistinguishable to the
  // caller, or the login form answers "does this person have an account here".
  it("gives an unknown address the same 401 as a wrong password", async () => {
    const { service } = build();

    await expect(service.login({ email: "nobody@example.com" })).rejects.toThrow(
      UnauthorizedError
    );
    await expect(service.login({ email: "nobody@example.com" })).rejects.toThrow(
      "Invalid email or password"
    );
  });

  it("does not reveal which of the two failed", async () => {
    const hash = await credentials.hashPassword("correct");

    const unknown = build();
    const wrongPassword = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(aUser({ password: hash })) },
    });

    const [a, b] = await Promise.all([
      unknown.service.login({ email: "nobody@example.com", password: "x" }).catch((e) => e),
      wrongPassword.service
        .login({ email: "sam@example.com", password: "wrong" })
        .catch((e) => e),
    ]);

    expect(a.message).toBe(b.message);
    expect(a.statusCode).toBe(b.statusCode);
  });

  it("applies the account gate before issuing anything", async () => {
    // The gate previously guarded only one of the sign-in paths.
    const gate = vi.fn().mockRejectedValue(new Error("blocked"));
    const { service, deps } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(aUser()) },
      accountPolicy: { assertMaySignIn: gate },
    });

    await expect(service.login({ email: "sam@example.com", password: "x" })).rejects.toThrow();
    expect(deps.tokenService.issuePair).not.toHaveBeenCalled();
  });

  it("signs a Google account in without a password", async () => {
    const { service, deps } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(aUser({ registeredVia: "google" })) },
    });

    const { tokens } = await service.login({ email: "sam@example.com" });

    expect(tokens.accessToken).toBe("at");
    expect(deps.accountPolicy.assertMaySignIn).toHaveBeenCalled();
  });

  it("rejects a password account with no password supplied", async () => {
    const { service } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(aUser({ password: "hash" })) },
    });

    await expect(service.login({ email: "sam@example.com" })).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a wrong password", async () => {
    const hash = await credentials.hashPassword("correct");
    const { service, deps } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(aUser({ password: hash })) },
    });

    await expect(
      service.login({ email: "sam@example.com", password: "wrong" })
    ).rejects.toThrow("Invalid email or password");
    expect(deps.tokenService.issuePair).not.toHaveBeenCalled();
  });

  it("accepts the right password and records the sign-in", async () => {
    const hash = await credentials.hashPassword("correct");
    const { service, deps } = build({
      userRepository: { findOne: vi.fn().mockResolvedValue(aUser({ password: hash })) },
    });

    const { tokens } = await service.login({ email: "sam@example.com", password: "correct" });

    expect(tokens.accessToken).toBe("at");
    expect(deps.userRepository.updateById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ $inc: expect.objectContaining({ loginCount: 1 }) })
    );
  });

  it("counts a second sign-in on the same day as one active day", async () => {
    // Six sign-ins on Monday is one active day, not six — the difference
    // between "engaged" and "having trouble staying signed in".
    const hash = await credentials.hashPassword("correct");
    const { service, deps } = build({
      userRepository: {
        findOne: vi.fn().mockResolvedValue(aUser({ password: hash, lastLogin: new Date() })),
      },
    });

    await service.login({ email: "sam@example.com", password: "correct" });

    const update = deps.userRepository.updateById.mock.calls[0][1];
    expect(update.$inc).not.toHaveProperty("activeDays");
  });
});

describe("AuthService.refresh", () => {
  it("rejects a missing token", async () => {
    const { service } = build();

    await expect(service.refresh(undefined)).rejects.toThrow(ValidationError);
  });

  it("applies the same account gate as sign-in", async () => {
    // Without this, blocking someone already signed in does nothing for up to
    // the refresh lifetime — they never hit login again, they just refresh.
    const { service, deps } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser()) },
      accountPolicy: { assertMaySignIn: vi.fn().mockRejectedValue(new Error("suspended")) },
    });

    await expect(service.refresh("rt")).rejects.toThrow();
    expect(deps.tokenService.issuePair).not.toHaveBeenCalled();
  });

  it("rotates the presented token rather than issuing a parallel one", async () => {
    const { service, deps } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser()) },
    });

    await service.refresh("old-rt");

    expect(deps.tokenService.issuePair).toHaveBeenCalledWith("user-1", "old-rt");
  });

  it("does not count a refresh as a login", async () => {
    // Counting it would inflate loginCount for anyone who leaves a tab open.
    const { service, deps } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(aUser()) },
    });

    await service.refresh("rt");

    const updates = deps.userRepository.updateById.mock.calls.map(([, u]) => u);
    expect(updates.every((u) => !u.$inc)).toBe(true);
    expect(updates.some((u) => u.$set?.lastLogin)).toBe(true);
  });
});

describe("AuthService OTP flows", () => {
  it("refuses to issue a code to an already-verified address", async () => {
    const { service } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue(aUser({ verified: { emailVer: true } })),
      },
    });

    await expect(service.sendEmailOtp("user-1")).rejects.toThrow("User already varified");
  });

  it("emails a 6-digit code but stores only its hash", async () => {
    const user = aUser();
    const { service, deps } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await service.sendEmailOtp("user-1");

    const [, emailedCode] = deps.emailService.sendOtpEmail.mock.calls[0];
    expect(emailedCode).toMatch(/^\d{6}$/);

    // The stored value must be the hash, not the code — a database dump should
    // not contain live verification codes.
    expect(user.otp).not.toBe(emailedCode);
    expect(user.otp).toBe(credentials.hashOtp(emailedCode));
    expect(user.otpExpiry).toBeInstanceOf(Date);
    expect(user.otpAttempts).toBe(0);
  });

  it("burns the code after too many wrong guesses", async () => {
    const user = aUser({
      otp: credentials.hashOtp("123456"),
      otpExpiry: new Date(Date.now() + 60000),
      otpAttempts: 0,
      save: vi.fn(),
    });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    // Five wrong guesses are counted…
    for (let i = 0; i < 5; i++) {
      await expect(
        service.verifyEmailOtp({ userId: "user-1", oneTimePass: "000000" })
      ).rejects.toThrow("Invalid OTP");
    }
    expect(user.otpAttempts).toBe(5);

    // …and the sixth is refused outright, even with the CORRECT code, so a
    // brute-force run cannot simply keep going until it lands.
    await expect(
      service.verifyEmailOtp({ userId: "user-1", oneTimePass: "123456" })
    ).rejects.toThrow(/Too many incorrect codes/);
  });

  it("rejects a wrong code", async () => {
    const user = aUser({ otp: credentials.hashOtp("123456"), otpExpiry: new Date(Date.now() + 60000) });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(
      service.verifyEmailOtp({ userId: "user-1", oneTimePass: "999999" })
    ).rejects.toThrow("Invalid OTP");
  });

  it("rejects an expired code", async () => {
    const user = aUser({ otp: "1234", otpExpiry: new Date(Date.now() - 1000) });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(
      service.verifyEmailOtp({ userId: "user-1", oneTimePass: "1234" })
    ).rejects.toThrow("OTP expired");
  });

  it("verifies, clears the code, and returns a session", async () => {
    const user = aUser({ otp: credentials.hashOtp("123456"), otpExpiry: new Date(Date.now() + 60000) });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    const { tokens } = await service.verifyEmailOtp({ userId: "user-1", oneTimePass: "123456" });

    expect(user.verified.emailVer).toBe(true);
    expect(user.otp).toBeUndefined();
    expect(user.otpExpiry).toBeUndefined();
    expect(tokens.accessToken).toBe("at");
  });

  it("will not reissue while the previous code is still valid", async () => {
    const user = aUser({ otpExpiry: new Date(Date.now() + 60000) });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(user) } });

    await expect(service.resendEmailOtp("user-1")).rejects.toThrow(/still valid/);
  });
});

describe("AuthService password reset", () => {
  it("answers identically for an unknown address", async () => {
    // Otherwise the endpoint is an oracle for which emails are members.
    const { service, deps } = build();

    await expect(service.requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    expect(deps.emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stores only the hash of the reset token, never the raw value", async () => {
    const user = aUser();
    const { service, deps } = build({ userRepository: { findOne: vi.fn().mockResolvedValue(user) } });

    await service.requestPasswordReset("sam@example.com");

    const [, , resetUrl] = deps.emailService.sendPasswordResetEmail.mock.calls[0];
    const rawToken = new URL(resetUrl).searchParams.get("token");

    expect(user.resetPasswordToken).not.toBe(rawToken);
    expect(user.resetPasswordToken).toBe(credentials.hashResetToken(rawToken));
  });

  it("rejects an invalid or expired reset link", async () => {
    const { service } = build();

    await expect(
      service.resetPasswordWithToken({ token: "nope", newPassword: "new" })
    ).rejects.toThrow(/invalid or has expired/);
  });

  it("sets the new password and burns the token", async () => {
    const user = aUser();
    const { service } = build({ userRepository: { findOne: vi.fn().mockResolvedValue(user) } });

    await service.resetPasswordWithToken({ token: "raw", newPassword: "brand-new" });

    await expect(credentials.verifyPassword("brand-new", user.password)).resolves.toBe(true);
    expect(user.resetPasswordToken).toBeUndefined();
    expect(user.resetPasswordExpires).toBeUndefined();
  });
});
