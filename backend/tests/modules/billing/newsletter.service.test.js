import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { NewsletterService } from "#src/modules/billing/newsletter.service.js";
import config from "#src/config/index.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "#src/core/errors/index.js";

const build = (over = {}) => {
  const subscriptionRepository = {
    exists: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    ...over.subscriptionRepository,
  };

  const userRepository = {
    findById: vi.fn().mockResolvedValue({ type: "Admin" }),
    ...over.userRepository,
  };

  const sendEmailConfirmation = vi.fn().mockResolvedValue(undefined);

  return {
    service: new NewsletterService({
      subscriptionRepository,
      userRepository,
      sendEmailConfirmation,
      escapeRegex: (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    }),
    subscriptionRepository,
    userRepository,
    sendEmailConfirmation,
  };
};

describe("requestSubscription", () => {
  it("requires an address", async () => {
    const { service } = build();

    await expect(service.requestSubscription("")).rejects.toThrow(ValidationError);
  });

  it("stores nothing when the form is submitted", async () => {
    // Double opt-in: anyone can type anyone else's address into a public form,
    // and a list built from unconfirmed submissions is a list of people who
    // never asked to be on it.
    const { service, subscriptionRepository } = build();

    await service.requestSubscription("sam@example.com");

    expect(subscriptionRepository.create).not.toHaveBeenCalled();
  });

  it("emails a link carrying a signed token for that address", async () => {
    const { service, sendEmailConfirmation } = build();

    await service.requestSubscription("sam@example.com");

    const [to, subject, html] = sendEmailConfirmation.mock.calls[0];
    expect(to).toBe("sam@example.com");
    expect(subject).toBe("Please confirm your email");

    const token = html.match(/verify-email\/([\w.-]+)"/)[1];
    expect(jwt.verify(token, config.auth.jwtSecret).email).toBe("sam@example.com");
  });

  it("409s an address already on the list", async () => {
    const { service } = build({
      subscriptionRepository: { exists: vi.fn().mockResolvedValue(true) },
    });

    await expect(service.requestSubscription("sam@example.com")).rejects.toThrow(ConflictError);
  });
});

describe("confirmSubscription", () => {
  it("adds the address only once the link is followed", async () => {
    const { service, subscriptionRepository } = build();
    const token = jwt.sign({ email: "sam@example.com" }, config.auth.jwtSecret);

    const { status } = await service.confirmSubscription(token);

    expect(status).toBe(200);
    expect(subscriptionRepository.create).toHaveBeenCalledWith({ email: "sam@example.com" });
  });

  it("returns a page rather than JSON — this opens in a mail client", async () => {
    const { service } = build();
    const token = jwt.sign({ email: "sam@example.com" }, config.auth.jwtSecret);

    const { html } = await service.confirmSubscription(token);

    expect(html).toContain("Subscription Confirmed");
  });

  it("shows one failure page for an expired link and a forged one", async () => {
    // Neither is something the reader can act on differently, and telling them
    // apart would let this page confirm whether an address is subscribed.
    const { service } = build();

    const forged = await service.confirmSubscription("not-a-token");
    const expired = await service.confirmSubscription(
      jwt.sign({ email: "sam@example.com" }, config.auth.jwtSecret, { expiresIn: -10 })
    );

    expect(forged.status).toBe(400);
    expect(expired.status).toBe(400);
    expect(forged.html).toBe(expired.html);
  });

  it("does not subscribe anyone on a bad token", async () => {
    const { service, subscriptionRepository } = build();

    await service.confirmSubscription("nope");

    expect(subscriptionRepository.create).not.toHaveBeenCalled();
  });

  it("refuses a token signed with a different secret", async () => {
    const { service } = build();
    const token = jwt.sign({ email: "sam@example.com" }, "some-other-secret");

    expect((await service.confirmSubscription(token)).status).toBe(400);
  });
});

describe("listSubscribers", () => {
  it("blocks a non-admin", async () => {
    const { service } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await expect(service.listSubscribers({ adminId: "u1" })).rejects.toThrow(ForbiddenError);
  });

  it("404s a caller whose account is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.listSubscribers({ adminId: "u1" })).rejects.toThrow(NotFoundError);
  });

  it("escapes a search term before it becomes a regex", async () => {
    // Unescaped, "a{100000}" is a denial of service against the subscriber list.
    const { service, subscriptionRepository } = build();

    await service.listSubscribers({ adminId: "a1", query: { email: "a{100}" } });

    expect(subscriptionRepository.find.mock.calls[0][0].email.$regex).toBe("a\\{100\\}");
  });

  it("lists newest first, paginated", async () => {
    const { service, subscriptionRepository } = build({
      subscriptionRepository: { count: vi.fn().mockResolvedValue(25) },
    });

    const { pagination } = await service.listSubscribers({
      adminId: "a1",
      query: { page: "2", limit: "10" },
    });

    expect(subscriptionRepository.find.mock.calls[0][1]).toMatchObject({
      skip: 10,
      limit: 10,
      sort: { createdAt: -1 },
    });
    expect(pagination).toEqual({ totalRecords: 25, totalPages: 3, currentPage: 2, limit: 10 });
  });
});
