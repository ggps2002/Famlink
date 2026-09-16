import User from "../user/user.model.js";
import { sendNewMessageEmail } from "../../shared/email/email.js";

// ── New-message email batching (email 06) ────────────────────────────────────
// The template's developer note: "Batch if multiple messages arrive within
// 15 min to avoid notification spam — send one digest email."
//
// So instead of emailing on every message, the first message to an offline user
// opens a 15-minute window. Any further messages that land in that window just
// update the window (they don't queue another email). When the window closes we
// send a single email showing the most recent message, and the subject reflects
// how many arrived.
//
// Before sending we re-check the recipient: if they came online during the
// window they've already seen the messages, so we drop the email entirely. Same
// if they turned the "New Messages" email notification off.
//
// NOTE: the window is held in memory, so it is per-process. On a multi-instance
// deploy a user could receive one digest per instance that handled a message —
// still bounded, and far better than one email per message. Set
// MESSAGE_EMAIL_WINDOW_MS=0 to send immediately instead.

const WINDOW_MS =
  process.env.MESSAGE_EMAIL_WINDOW_MS !== undefined
    ? Number(process.env.MESSAGE_EMAIL_WINDOW_MS)
    : 15 * 60 * 1000; // 15 minutes

// receiverId -> { timer, count, latest: { senderName, senderId, message } }
const windows = new Map();

const flush = async (receiverId) => {
  const entry = windows.get(receiverId);
  if (!entry) return;
  windows.delete(receiverId);

  try {
    // Re-read the recipient: they may have come online (and read the messages)
    // or unsubscribed while the window was open.
    const receiver = await User.findById(receiverId).select(
      "email name online notifications"
    );
    if (!receiver?.email) return;
    if (receiver.online === true) return;
    if (receiver.notifications?.email?.platformUpdates === false) return;

    const { senderName, senderId, message } = entry.latest;

    await sendNewMessageEmail(receiver.email, receiver.name, senderName, message, {
      id: senderId,
      moreCount: entry.count - 1,
    });
  } catch (err) {
    console.error("Failed to send new-message email:", err?.message || err);
  }
};

// Called for every message delivered to an offline recipient.
export const queueNewMessageEmail = ({
  receiverId,
  senderName,
  senderId,
  message,
}) => {
  const key = String(receiverId);
  const latest = { senderName, senderId, message };

  if (WINDOW_MS <= 0) {
    windows.set(key, { count: 1, latest });
    flush(key);
    return;
  }

  const existing = windows.get(key);
  if (existing) {
    // Already inside an open window — fold this message into the pending digest.
    existing.count += 1;
    existing.latest = latest;
    return;
  }

  const entry = { count: 1, latest, timer: null };
  entry.timer = setTimeout(() => flush(key), WINDOW_MS);
  // Don't hold the process open just for a pending notification email.
  if (typeof entry.timer.unref === "function") entry.timer.unref();
  windows.set(key, entry);
};
