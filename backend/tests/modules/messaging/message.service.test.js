import { describe, it, expect, vi } from "vitest";
import { MessageService } from "#src/modules/messaging/message.service.js";
import { ForbiddenError, NotFoundError } from "#src/core/errors/index.js";

const AUTHOR = "user-1";
const OTHER = "user-2";
const STRANGER = "user-3";

const aMessage = (over = {}) => ({
  _id: "msg-1",
  chatId: "chat-1",
  sender: AUTHOR,
  content: "hello",
  type: "Text",
  save: vi.fn().mockResolvedValue(undefined),
  deleteOne: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const build = (over = {}) => {
  const deps = {
    messageRepository: {
      findById: vi.fn().mockResolvedValue(aMessage()),
      create: vi.fn(async (d) => ({ ...d, _id: "new-msg" })),
      ...over.messageRepository,
    },
    chatRepository: {
      // Participants of chat-1 are AUTHOR and OTHER.
      isParticipant: vi.fn(async (_chatId, userId) => userId === AUTHOR || userId === OTHER),
      ...over.chatRepository,
    },
    guardOutgoingMessage: vi.fn().mockResolvedValue({ ok: true }),
    attachFlagToMessage: vi.fn().mockResolvedValue(undefined),
    ...over.extra,
  };

  return { service: new MessageService(deps), deps };
};

describe("MessageService.send", () => {
  it("takes the sender from the session, never the body", async () => {
    // Otherwise a caller posts messages as somebody else.
    const { service, deps } = build();

    await service.send({ userId: AUTHOR, chatId: "chat-1", content: "hi", sender: STRANGER });

    expect(deps.messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sender: AUTHOR })
    );
  });

  it("runs the same content guard the socket path uses", async () => {
    // Checking only participation here would leave this route as the way to
    // send exactly the content the app itself refuses to send.
    const { service, deps } = build();

    await service.send({ userId: AUTHOR, chatId: "chat-1", content: "hi" });

    expect(deps.guardOutgoingMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "chat-1", senderId: AUTHOR, content: "hi" })
    );
  });

  it("reports a participation refusal as 403", async () => {
    const { service } = build({
      extra: {
        guardOutgoingMessage: vi
          .fn()
          .mockResolvedValue({ ok: false, code: "not_participant", reason: "Not yours" }),
      },
    });

    await expect(
      service.send({ userId: STRANGER, chatId: "chat-1", content: "hi" })
    ).rejects.toMatchObject({ statusCode: 403, code: "not_participant" });
  });

  it("reports a content refusal as 422, distinctly from a permission failure", async () => {
    const { service } = build({
      extra: {
        guardOutgoingMessage: vi
          .fn()
          .mockResolvedValue({ ok: false, code: "contains_contact", reason: "No phone numbers" }),
      },
    });

    await expect(
      service.send({ userId: AUTHOR, chatId: "chat-1", content: "call me 555" })
    ).rejects.toMatchObject({ statusCode: 422, code: "contains_contact" });
  });

  it("writes nothing when the guard refuses", async () => {
    const { service, deps } = build({
      extra: {
        guardOutgoingMessage: vi.fn().mockResolvedValue({ ok: false, code: "blocked", reason: "x" }),
      },
    });

    await expect(service.send({ userId: AUTHOR, chatId: "chat-1", content: "hi" })).rejects.toThrow();
    expect(deps.messageRepository.create).not.toHaveBeenCalled();
  });

  it("links a moderation flag to the stored message", async () => {
    const { service, deps } = build({
      extra: {
        guardOutgoingMessage: vi
          .fn()
          .mockResolvedValue({ ok: true, flagId: "flag-1", moderation: { flagged: true } }),
      },
    });

    await service.send({ userId: AUTHOR, chatId: "chat-1", content: "hi" });

    expect(deps.attachFlagToMessage).toHaveBeenCalledWith("flag-1", "new-msg");
  });
});

describe("MessageService.read", () => {
  it("hides a message from a non-participant behind the same 404 as a missing one", async () => {
    // Anything more specific turns this into a way to probe which ids are real.
    const { service } = build();

    await expect(service.read({ userId: STRANGER, messageId: "msg-1" })).rejects.toThrow(
      NotFoundError
    );
    await expect(service.read({ userId: STRANGER, messageId: "msg-1" })).rejects.toThrow(
      "Message not found"
    );
  });

  it("projects the sender rather than returning their whole record", async () => {
    const { service, deps } = build();

    await service.read({ userId: OTHER, messageId: "msg-1" });

    const [, options] = deps.messageRepository.findById.mock.calls[0];
    const senderPopulate = options.populate.find((p) => p.path === "sender");
    expect(senderPopulate.select).toBeTruthy();
  });

  it("lets a participant read it", async () => {
    const { service } = build();

    await expect(service.read({ userId: OTHER, messageId: "msg-1" })).resolves.toBeTruthy();
  });
});

describe("MessageService.update", () => {
  it("lets the recipient set a read receipt without owning the message", async () => {
    // Read receipts are the recipient's to set; the text is the author's.
    const message = aMessage();
    const { service } = build({
      messageRepository: { findById: vi.fn().mockResolvedValue(message) },
    });

    await service.update({ userId: OTHER, messageId: "msg-1", seen: true });

    expect(message.seen).toBe(true);
    expect(message.save).toHaveBeenCalled();
  });

  it("refuses a non-author editing the text", async () => {
    const { service } = build();

    await expect(
      service.update({ userId: OTHER, messageId: "msg-1", content: "rewritten" })
    ).rejects.toThrow(ForbiddenError);
  });

  it("re-runs the content guard on an edit", async () => {
    // Without this, the rules are one clean message and one PUT away from
    // being irrelevant: post "hi", then edit it into anything.
    const { service, deps } = build();

    await service.update({ userId: AUTHOR, messageId: "msg-1", content: "new text" });

    expect(deps.guardOutgoingMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: "new text" })
    );
  });

  it("rejects an edit the guard refuses, leaving the original text", async () => {
    const message = aMessage();
    const { service } = build({
      messageRepository: { findById: vi.fn().mockResolvedValue(message) },
      extra: {
        guardOutgoingMessage: vi.fn().mockResolvedValue({ ok: false, code: "x", reason: "no" }),
      },
    });

    await expect(
      service.update({ userId: AUTHOR, messageId: "msg-1", content: "bad" })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(message.content).toBe("hello");
    expect(message.save).not.toHaveBeenCalled();
  });

  it("resets the moderation verdict on an accepted edit", async () => {
    // The previous verdict described text that is no longer there.
    const message = aMessage({ moderation: { flagged: true, categories: ["spam"] } });
    const { service } = build({
      messageRepository: { findById: vi.fn().mockResolvedValue(message) },
    });

    await service.update({ userId: AUTHOR, messageId: "msg-1", content: "clean now" });

    expect(message.moderation).toEqual({ flagged: false, categories: [], severity: null });
  });

  it("404s a non-participant before any ownership question arises", async () => {
    const { service } = build();

    await expect(
      service.update({ userId: STRANGER, messageId: "msg-1", seen: true })
    ).rejects.toThrow("Message not found");
  });
});

describe("MessageService.remove", () => {
  it("lets the author delete their own message", async () => {
    const message = aMessage();
    const { service } = build({
      messageRepository: { findById: vi.fn().mockResolvedValue(message) },
    });

    await service.remove({ userId: AUTHOR, messageId: "msg-1" });

    expect(message.deleteOne).toHaveBeenCalled();
  });

  it("refuses another participant, as a 403 rather than a 404", async () => {
    // They already know it exists — they can see it in the conversation.
    const { service } = build();

    await expect(service.remove({ userId: OTHER, messageId: "msg-1" })).rejects.toThrow(
      ForbiddenError
    );
  });
});
