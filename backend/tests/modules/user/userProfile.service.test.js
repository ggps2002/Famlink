import { describe, it, expect, vi } from "vitest";
import { UserProfileService } from "#src/modules/user/userProfile.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "#src/core/errors/index.js";

const aDoc = (over = {}) => ({
  _id: "u1",
  email: "sam@example.com",
  name: "Sam Ortiz",
  additionalInfo: [],
  reviews: [],
  markModified: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  toObject() {
    const { save, markModified, toObject, ...rest } = this;
    return rest;
  },
  ...over,
});

const build = (over = {}) => {
  const doc = over.doc ?? aDoc();
  const userRepository = {
    // First call loads the document to mutate; the second re-reads it for the
    // response, which is exactly what the route does.
    findById: vi.fn().mockResolvedValue(doc),
    updateById: vi.fn().mockImplementation(async (_id, update) => ({ ...aDoc(), ...update })),
    ...over.userRepository,
  };

  const imageUploader = vi.fn().mockResolvedValue("https://cdn/new.jpg");
  const sendProfileUpdatedEmail = vi.fn().mockResolvedValue(undefined);

  return {
    service: new UserProfileService({ userRepository, imageUploader, sendProfileUpdatedEmail }),
    doc,
    userRepository,
    imageUploader,
    sendProfileUpdatedEmail,
  };
};

describe("updateOwn", () => {
  it("404s a caller whose account is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.updateOwn({ userId: "u1" })).rejects.toThrow(NotFoundError);
  });

  it("writes only the fields the request carried", async () => {
    // The form posts one section at a time; an absent key must not blank the
    // stored value.
    const doc = aDoc({ name: "Sam Ortiz", aboutMe: "Original" });
    const { service } = build({ doc });

    await service.updateOwn({ userId: "u1", body: { name: "Sam O" } });

    expect(doc.name).toBe("Sam O");
    expect(doc.aboutMe).toBe("Original");
  });

  it("accepts an empty string as a deliberate clear, except for the zip", async () => {
    // An empty zip is never an intentional edit, and storing it would break the
    // zip fallback the dashboard search depends on.
    const doc = aDoc({ aboutMe: "Original", zipCode: "78701" });
    const { service } = build({ doc });

    await service.updateOwn({ userId: "u1", body: { aboutMe: "", zipCode: "" } });

    expect(doc.aboutMe).toBe("");
    expect(doc.zipCode).toBe("78701");
  });

  it("400s malformed JSON rather than failing as a server error", async () => {
    // Before the move only additionalInfo was guarded; a malformed location
    // threw a raw SyntaxError and surfaced as a 500.
    const { service } = build();

    await expect(
      service.updateOwn({ userId: "u1", body: { location: "{not json" } })
    ).rejects.toThrow(ValidationError);
    await expect(
      service.updateOwn({ userId: "u1", body: { additionalInfo: "{not json" } })
    ).rejects.toThrow("Invalid JSON format for additionalInfo");
  });

  it("replaces a questionnaire answer in place and marks it modified", async () => {
    // Assigning into an array element is not change-tracked by Mongoose, so
    // without the mark the edit is silently dropped on save.
    const doc = aDoc({
      additionalInfo: [
        { key: "experience", value: "5 years" },
        { key: "jobDescription", value: "Old" },
      ],
    });
    const { service } = build({ doc });

    await service.updateOwn({
      userId: "u1",
      body: { additionalInfo: JSON.stringify([{ key: "jobDescription", value: "New" }]) },
    });

    expect(doc.additionalInfo).toHaveLength(2);
    expect(doc.additionalInfo[1].value).toBe("New");
    expect(doc.markModified).toHaveBeenCalledWith("additionalInfo.1.value");
  });

  it("appends an answer to a question that was never asked before", async () => {
    const doc = aDoc({ additionalInfo: [{ key: "experience", value: "5 years" }] });
    const { service } = build({ doc });

    await service.updateOwn({
      userId: "u1",
      body: { additionalInfo: JSON.stringify([{ key: "start", value: "immediately" }]) },
    });

    expect(doc.additionalInfo.map((info) => info.key)).toEqual(["experience", "start"]);
  });

  it("does not wipe the other answers when three are posted", async () => {
    const doc = aDoc({
      additionalInfo: Array.from({ length: 20 }, (_, i) => ({ key: `q${i}`, value: i })),
    });
    const { service } = build({ doc });

    await service.updateOwn({
      userId: "u1",
      body: { additionalInfo: JSON.stringify([{ key: "q3", value: "changed" }]) },
    });

    expect(doc.additionalInfo).toHaveLength(20);
  });

  it("stores the uploaded avatar", async () => {
    const doc = aDoc();
    const { service, imageUploader } = build({ doc });

    await service.updateOwn({
      userId: "u1",
      body: {},
      files: [{ buffer: Buffer.from("img") }],
    });

    expect(imageUploader).toHaveBeenCalled();
    expect(doc.imageUrl).toBe("https://cdn/new.jpg");
  });

  it("tells the member which fields changed", async () => {
    // So an edit they did not make is visible to them.
    const { service, sendProfileUpdatedEmail } = build();

    await service.updateOwn({ userId: "u1", body: { name: "Sam O", zipCode: "78702" } });

    expect(sendProfileUpdatedEmail).toHaveBeenCalledWith(
      "sam@example.com",
      expect.any(String),
      "name, zip code"
    );
  });

  it("names questionnaire changes collectively, never individually", async () => {
    // Listing which answers moved would put the answers themselves in an email.
    const { service, sendProfileUpdatedEmail } = build();

    await service.updateOwn({
      userId: "u1",
      body: { additionalInfo: JSON.stringify([{ key: "salaryExp", value: { min: 30 } }]) },
    });

    expect(sendProfileUpdatedEmail.mock.calls[0][2]).toBe("profile details");
  });

  it("sends nothing when the request changed nothing", async () => {
    const { service, sendProfileUpdatedEmail } = build();

    await service.updateOwn({ userId: "u1", body: {} });

    expect(sendProfileUpdatedEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the confirmation email fails", async () => {
    // The profile is already saved; a mail outage must not turn a successful
    // edit into an error the member sees.
    const { service } = build();
    service.sendProfileUpdatedEmail = vi.fn().mockRejectedValue(new Error("smtp down"));

    await expect(service.updateOwn({ userId: "u1", body: { name: "Sam O" } })).resolves.toBeTruthy();
  });

  it("returns the saved record with its average rating", async () => {
    const doc = aDoc({ reviews: [{ rating: 4 }, { rating: 5 }] });
    const { service } = build({ doc });

    const result = await service.updateOwn({ userId: "u1", body: { name: "Sam O" } });

    expect(result.averageRating).toBe("4.5");
    expect(result.name).toBe("Sam O");
  });
});

describe("updateAsAdmin", () => {
  it("refuses a caller who is not an admin", async () => {
    const { service, userRepository } = build({
      userRepository: { findById: vi.fn().mockResolvedValue({ type: "Nanny" }) },
    });

    await expect(service.updateAsAdmin({ adminId: "u1", body: { userId: "u2" } })).rejects.toThrow(
      ForbiddenError
    );
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it("404s a target that does not exist", async () => {
    const { service } = build({
      userRepository: {
        findById: vi
          .fn()
          .mockResolvedValueOnce({ type: "Admin" })
          .mockResolvedValueOnce(null),
      },
    });

    await expect(
      service.updateAsAdmin({ adminId: "u1", body: { userId: "gone" } })
    ).rejects.toThrow(NotFoundError);
  });

  it("writes only the fields that changed, not the whole document", async () => {
    // The pre-refactor code read the record, mutated a copy and wrote all of it
    // back, so a concurrent change to any unrelated field — a login timestamp,
    // a subscription webhook — was overwritten by whatever the console loaded.
    const { service, userRepository } = build({
      userRepository: {
        findById: vi
          .fn()
          .mockResolvedValueOnce({ type: "Admin" })
          .mockResolvedValueOnce(aDoc({ additionalInfo: [] })),
      },
    });

    await service.updateAsAdmin({ adminId: "u1", body: { userId: "u2", name: "New Name" } });

    expect(userRepository.updateById.mock.calls[0][1]).toEqual({ name: "New Name" });
  });

  it("clears the avatar when the console asks, in either form", async () => {
    // The console posts multipart, so `true` arrives as the string "true".
    for (const removePfp of ["true", true]) {
      const { service, userRepository } = build({
        userRepository: {
          findById: vi
            .fn()
            .mockResolvedValueOnce({ type: "Admin" })
            .mockResolvedValueOnce(aDoc()),
        },
      });

      await service.updateAsAdmin({ adminId: "u1", body: { userId: "u2", removePfp } });

      expect(userRepository.updateById.mock.calls[0][1].imageUrl).toBeNull();
    }
  });

  it("lets a fresh upload win over a removal in the same request", async () => {
    const { service, userRepository } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValueOnce({ type: "Admin" }).mockResolvedValueOnce(aDoc()),
      },
    });

    await service.updateAsAdmin({
      adminId: "u1",
      body: { userId: "u2", removePfp: "true" },
      files: [{ buffer: Buffer.from("img") }],
    });

    expect(userRepository.updateById.mock.calls[0][1].imageUrl).toBe("https://cdn/new.jpg");
  });

  it("returns the console's table row, not the raw record", async () => {
    const { service } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValueOnce({ type: "Admin" }).mockResolvedValueOnce(aDoc()),
        updateById: vi.fn().mockResolvedValue({
          _id: "u2",
          name: "Sam Ortiz",
          email: "sam@example.com",
          type: "Nanny",
          reviews: [],
          additionalInfo: [],
        }),
      },
    });

    const row = await service.updateAsAdmin({ adminId: "u1", body: { userId: "u2" } });

    expect(row).toMatchObject({ id: "u2", username: "sam", role: "Nanny", firstName: "Sam" });
  });
});
