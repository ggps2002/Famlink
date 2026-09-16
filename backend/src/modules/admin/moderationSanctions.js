// What each moderation outcome does to an account.
//
// Separated from the report queue because these are the writes that change
// somebody's access to the platform, and they should be readable as a list of
// consequences rather than found inside a request handler.
//
// Every one of them records `moderationReason` — the moderator's own words.
// That field is INTERNAL (see INTERNAL_USER_FIELDS in user.privacy.js) and must
// never reach the member: in a two-sided marketplace with a small local user
// base, "reported twice for pressuring caregivers about rates" identifies the
// reporter. The member gets generic copy; the reasoning stays in the console.

const DAY_MS = 24 * 60 * 60 * 1000;

export const OUTCOMES = ["warned", "suspended", "blocked", "deleted", "dismissed"];

/** Suspension bounds. A day is the shortest useful pause; a year is not a pause. */
export const MIN_SUSPEND_DAYS = 1;
export const MAX_SUSPEND_DAYS = 365;

/**
 * The update that applies an outcome, or null when the outcome changes nothing.
 *
 * `warned` and `dismissed` both return null and that is the point: a warning is
 * recorded on the report so a second complaint shows this person has already
 * been spoken to, but it does not touch the account. Making it a no-op here
 * rather than a status change is what keeps "warned" distinct from "suspended
 * for zero days".
 *
 * @returns {{ update: object, sanction: object } | { update: null, sanction: object }}
 */
export const sanctionFor = ({ action, note, userId, suspendDays, now = Date.now() }) => {
  if (action === "warned") return { update: null, sanction: { type: "warned" } };
  if (action === "dismissed") return { update: null, sanction: null };

  if (action === "suspended") {
    const until = new Date(now + suspendDays * DAY_MS);
    return {
      update: {
        $set: {
          status: "Suspended",
          suspendedUntil: until,
          suspendedAt: new Date(now),
          moderationReason: note,
        },
      },
      sanction: { type: "suspended", until, days: suspendDays },
    };
  }

  if (action === "blocked") {
    return {
      update: {
        $set: {
          status: "Block",
          suspendedAt: new Date(now),
          // Cleared, not left behind: a block is indefinite, and a stale
          // `suspendedUntil` would let the account come back on its own.
          suspendedUntil: null,
          moderationReason: note,
        },
      },
      sanction: { type: "blocked" },
    };
  }

  if (action === "deleted") {
    return {
      update: {
        $set: {
          status: "Deleted",
          deletedAt: new Date(now),
          moderationReason: note,
          // The address is overwritten rather than removed so the unique index
          // still holds and the person can register again. It also means the
          // sheets screen reports them as "never signed up", which is a known
          // and accepted consequence.
          email: `deleted+${userId}@famlink.invalid`,
          password: null,
          phoneNo: null,
          imageUrl: null,
          premium: false,
          online: false,
        },
        // Removed outright — a home address and a live password-reset token are
        // not things a soft delete should keep.
        $unset: { location: "", otp: "", resetPasswordToken: "" },
      },
      sanction: { type: "deleted" },
    };
  }

  return { update: null, sanction: null };
};

/** Whether a suspension length is one this system will accept. */
export const isValidSuspendDays = (value) => {
  const days = Number(value);
  return Number.isFinite(days) && days >= MIN_SUSPEND_DAYS && days <= MAX_SUSPEND_DAYS;
};
