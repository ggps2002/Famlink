// The gate every outgoing message passes through.
//
// Sits between the two send paths (src/modules/messaging/chat.socket.js for the live app,
// src/modules/messaging/message.module.js for the REST equivalent) and the database. Both used to
// write straight to `messages`, which meant the rules in messageModeration.js
// could be bypassed entirely by using the endpoint the app itself doesn't use —
// so the check lives here once and both callers await it.
//
// Four things are checked, in this order, because each is cheaper than the next
// and a failure of an earlier one makes the later ones moot:
//
//   1. Is the sender who they say they are, and in this conversation?
//   2. Is the message a sane size?
//   3. Are they sending faster than a person can type?
//   4. Does the content break the rules?
//
// (1) is not a content rule but belongs here for the same reason: it was the
// other half of "users can send whatever they want". The socket handler took
// `senderId` from the client payload and trusted it, so anyone with a browser
// console could post messages into any conversation as any member.

import mongoose from "mongoose";

import Chat from "./chat.model.js";
import MessageFlag from "./messageFlag.model.js";
import Report from "../report/report.model.js";
import MatchRequest from "../match/matchRequest.model.js";
import {
  moderateMessage,
  MAX_MESSAGE_LENGTH,
  URGENT_CATEGORIES,
  CATEGORY_TO_REPORT_REASON,
} from "./messageModeration.js";

/* ─────────────────────────────── flood control ──────────────────────────── */

// Per-process, in memory. The chat socket is stateful and long-lived, so a
// sender is pinned to one machine for the life of their connection and a local
// counter holds for them — unlike the HTTP rate limiter, which needs Redis
// because consecutive requests land anywhere.
//
// 20 messages per 10 seconds. Far above human typing, far below what it takes
// to make the chat unusable for the person on the other end.
const FLOOD_LIMIT = 20;
const FLOOD_WINDOW_MS = 10_000;
const floodBuckets = new Map();

let lastFloodSweep = 0;

const isFlooding = (senderId) => {
  const now = Date.now();

  // Drop expired buckets occasionally so a long-running process doesn't hold
  // one entry per user who has ever sent a message.
  if (now - lastFloodSweep > 60_000) {
    for (const [key, entry] of floodBuckets) {
      if (entry.resetAt <= now) floodBuckets.delete(key);
    }
    lastFloodSweep = now;
  }

  const existing = floodBuckets.get(senderId);
  if (!existing || existing.resetAt <= now) {
    floodBuckets.set(senderId, { count: 1, resetAt: now + FLOOD_WINDOW_MS });
    return false;
  }

  existing.count += 1;
  return existing.count > FLOOD_LIMIT;
};

/* ──────────────────────────── repeat offenders ──────────────────────────── */

// How many blocked attempts inside the window before a case is opened against
// the sender automatically.
//
// Three, because one is a misunderstanding and two is someone testing where the
// line is — but a third means they have read the refusal twice and kept going,
// which is the point it stops being an accident. The case is opened for a human
// to look at; nothing is applied to the account automatically. An auto-sanction
// on a regex match is how you suspend a parent for swearing about traffic.
const STRIKE_THRESHOLD = 3;
const STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000;

// Open a report if this sender has now tripped the block rule enough times in
// the last day — unless there is already an open case about them, in which case
// a second one adds noise rather than information.
const escalateIfRepeated = async ({ senderId, flag }) => {
  try {
    const since = new Date(Date.now() - STRIKE_WINDOW_MS);
    const strikes = await MessageFlag.countDocuments({
      senderId,
      action: "blocked",
      createdAt: { $gte: since },
    });

    const urgent = flag.categories.some((c) => URGENT_CATEGORIES.has(c));
    // Anything in the urgent set goes to a human on the first occurrence.
    // Waiting for a third child-safety hit before anyone looks is not a
    // threshold worth having.
    if (!urgent && strikes < STRIKE_THRESHOLD) return null;

    const existing = await Report.findOne({
      reportedUserId: senderId,
      status: { $ne: "resolved" },
      targetType: "activity",
    })
      .select("_id")
      .lean();
    if (existing) return existing._id;

    const primary = flag.categories[0];
    const report = await Report.create({
      // No reporterId: nobody complained. This was the system noticing, and
      // recording a member as the reporter would misattribute it — the person
      // it was aimed at never even received the message.
      reporterId: null,
      reportedUserId: senderId,
      targetType: "activity",
      messageId: flag.messageId,
      chatId: flag.chatId,
      reason: CATEGORY_TO_REPORT_REASON[primary] || "other",
      details:
        `Opened automatically: ${strikes} message(s) blocked by the content rules in the last 24 hours. ` +
        `Categories: ${flag.categories.join(", ")}.`,
      evidenceSnapshot: String(flag.content || "").slice(0, 2000),
      status: "open",
      priority: "high",
    });

    await MessageFlag.updateOne({ _id: flag._id }, { $set: { reportId: report._id } });
    return report._id;
  } catch (error) {
    // Escalation failing must never fail the send. The flag is already
    // recorded, so the incident is not lost — only the case that would have
    // been opened from it, which an admin can still open by hand.
    console.error("moderation escalation failed:", error?.message || error);
    return null;
  }
};

/* ──────────────────────────────── the gate ──────────────────────────────── */

/**
 * Decide whether a message may be sent, and record it if it broke a rule.
 *
 * @param {object} params
 * @param {string} params.chatId
 * @param {string} params.senderId    the AUTHENTICATED sender — never a value
 *                                    taken from the client's payload
 * @param {string} params.content
 * @param {string} [params.type]      "Text" | "Audio"
 * @returns {Promise<{
 *   ok: boolean,
 *   reason?: string,
 *   code?: string,
 *   moderation?: { flagged: boolean, categories: string[], severity: string },
 * }>}
 */
export const guardOutgoingMessage = async ({ chatId, senderId, content, type = "Text" }) => {
  if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(senderId)) {
    return { ok: false, code: "invalid", reason: "That conversation could not be found." };
  }

  // The sender must actually be in the conversation. This is the check that was
  // missing entirely: without it, `chatId` and `senderId` were just two strings
  // from the client, and any pair of them wrote a message.
  const chat = await Chat.findOne({ _id: chatId, participants: senderId })
    .select("participants")
    .lean();
  if (!chat) {
    return { ok: false, code: "not_participant", reason: "You are not part of this conversation." };
  }

  const recipientId =
    chat.participants.find((p) => String(p) !== String(senderId)) || null;

  // A blocked match means the conversation is closed. The frontend already
  // hides the composer, but "the UI doesn't show the button" is not a control —
  // the socket event can still be emitted by hand.
  if (recipientId) {
    const blockedMatch = await MatchRequest.findOne({
      status: "blocked",
      $or: [
        { senderId: senderId, receiverId: recipientId },
        { senderId: recipientId, receiverId: senderId },
      ],
    })
      .select("_id")
      .lean();
    if (blockedMatch) {
      return {
        ok: false,
        code: "blocked",
        reason: "You can't send messages in this conversation.",
      };
    }
  }

  const raw = String(content ?? "");
  if (!raw.trim()) {
    return { ok: false, code: "empty", reason: "Write something first." };
  }

  // Audio arrives base64-encoded and is legitimately large, so the text ceiling
  // would reject every voice note. The cap that matters for audio is the
  // socket's own frame size, which is configured on the server.
  if (type !== "Audio" && raw.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "too_long",
      reason: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  if (isFlooding(String(senderId))) {
    return {
      ok: false,
      code: "rate_limited",
      reason: "You're sending messages too quickly. Give it a moment.",
    };
  }

  const verdict = moderateMessage(raw, { type });

  if (verdict.action === "allow") return { ok: true };

  // Record it. Awaited rather than fired off, so a message is never delivered
  // with its flag lost to an error nobody sees — for a blocked message this is
  // the ONLY record that the attempt happened at all.
  let flag = null;
  try {
    flag = await MessageFlag.create({
      messageId: null, // filled in by the caller for delivered messages
      chatId,
      senderId,
      recipientId,
      action: verdict.action === "block" ? "blocked" : "flagged",
      categories: verdict.categories,
      severity: verdict.severity,
      score: verdict.score,
      matchedRules: verdict.matchedRules,
      matchedTerms: verdict.matchedTerms,
      content: raw.slice(0, 4000),
      messageType: type,
    });
  } catch (error) {
    console.error("could not record message flag:", error?.message || error);
  }

  if (verdict.action === "block") {
    if (flag) await escalateIfRepeated({ senderId, flag });
    return {
      ok: false,
      code: "content_blocked",
      reason: verdict.reason,
      categories: verdict.categories,
    };
  }

  // Delivered, but marked. `flagId` goes back to the caller so it can attach
  // the message id once the message has been saved and has one.
  return {
    ok: true,
    flagId: flag?._id || null,
    moderation: {
      flagged: true,
      categories: verdict.categories,
      severity: verdict.severity,
    },
  };
};

// Link a flag to the message that was ultimately saved. Called after the insert,
// because the message has no id before it. Best-effort: a flag without a
// messageId still carries the content snapshot, which is the part that matters.
export const attachFlagToMessage = async (flagId, messageId) => {
  if (!flagId || !messageId) return;
  try {
    await MessageFlag.updateOne({ _id: flagId }, { $set: { messageId } });
  } catch (error) {
    console.error("could not link flag to message:", error?.message || error);
  }
};
