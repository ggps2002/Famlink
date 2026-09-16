import WaitlistEntry from "./waitlistEntry.model.js";
import { isInsideLaunchRadius, cityFromLocation, zipFromLocation } from "../../shared/utils/serviceArea.js";

// Capture layer for src/modules/waitlist/waitlistEntry.model.js.
//
// Called from the public funnels (waitlist form, onboarding-lead capture) and
// from registration. Everything that decides what a waitlist row looks like —
// which location fields are kept, how the launch-radius flag is resolved, what
// counts as consent — lives here so the three call sites can't drift apart,
// which is exactly how the frontend ended up with three copies of the zip list.

// Reduce whatever location shape the caller has into the coarse subset the
// waitlist stores. THE COORDINATES ARE DROPPED HERE, deliberately: this is the
// only lead collection that gets serialised back to a client, and the admin
// table shows a city, never a point. See the schema's comment.
const coarseLocation = (raw) => {
  if (!raw || typeof raw !== "object") {
    // A bare string still yields a zip and sometimes a city.
    const zip = zipFromLocation(raw) || "";
    return {
      city: "",
      region: "",
      neighborhood: "",
      zip,
      formatted: typeof raw === "string" ? raw.trim().slice(0, 300) : "",
    };
  }

  const formatted = String(raw.formatted || raw.format_location || "").trim();
  const city = String(raw.city || "").trim() || (cityFromLocation(raw) || "");

  // "1 Broadway, Oakland, CA 94607, USA" → "CA 94607" is second from the end.
  let region = String(raw.region || raw.state || "").trim();
  if (!region && formatted) {
    const parts = formatted.split(",").map((p) => p.trim());
    if (parts.length >= 2) region = parts[parts.length - 2].replace(/\s*\d{5}(-\d{4})?$/, "").trim();
  }

  return {
    // Title-cased for display; the filter lowercases both sides so casing here
    // never affects matching.
    city: city ? city.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 100) : "",
    region: region.slice(0, 100),
    neighborhood: String(raw.neighborhood || "").trim().slice(0, 100),
    zip: zipFromLocation(raw) || "",
    formatted: formatted.slice(0, 300),
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* The intake forms already summarise their own answers as
   "Children: 2 years | Care needed: Full-time" (buildDetails in the frontend's
   waitlistSubmit.js). Split that back into pairs so the console can filter on
   an answer rather than only search for a substring of it.

   Tolerant by design: a value containing a colon ("Budget: $20: negotiable")
   keeps everything after the FIRST colon, and a fragment with no colon at all
   is kept as a labelless value rather than dropped. Losing an answer because it
   was punctuated unusually is worse than keeping a slightly odd label. */
const MAX_ANSWERS = 40;

export const parseOnboardingAnswers = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return [];

  return text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_ANSWERS)
    .map((part) => {
      const at = part.indexOf(":");
      if (at === -1) return { label: "Note", value: part.slice(0, 300) };
      return {
        label: part.slice(0, at).trim().slice(0, 100),
        value: part.slice(at + 1).trim().slice(0, 300),
      };
    })
    .filter((pair) => pair.value);
};

/**
 * Upsert one waitlist row. Idempotent on email.
 *
 * NEVER THROWS. Registration and the public capture endpoints call this as a
 * side-effect, and a bookkeeping failure must not fail someone's signup — the
 * admin console has a backfill that recovers anything missed.
 *
 * @returns {Promise<boolean>} whether a row was written
 */
export const recordWaitlistEntry = async ({
  email,
  name = "",
  userType = "unknown",
  location = null,
  source = "unknown",
  notifyConsent = false,
  userId = null,
  onboardingCompletedAt = null,
  details = "",
}) => {
  const address = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return false;

  try {
    const coarse = coarseLocation(location);
    const now = new Date();

    // Fields that a later visit is allowed to improve. `$set` on a repeat visit
    // refreshes what they told us most recently.
    const set = {
      name: String(name || "").trim().slice(0, 200),
      location: coarse,
      insideLaunchRadius: isInsideLaunchRadius(location || coarse),
      updatedAt: now,
    };

    if (userType === "Parents" || userType === "Nanny") set.userType = userType;
    if (userId) set.userId = userId;

    // Consent is one-way here: ticking the box sets it, and NOT ticking it on a
    // later visit does not clear it. Withdrawing consent goes through
    // unsubscribe, which stamps `unsubscribedAt` and is checked separately —
    // so a second visit with the box unticked can't quietly re-subscribe or
    // un-subscribe anyone, and both states have an explicit provenance.
    if (notifyConsent === true) set.notifyConsent = true;

    // Only overwrite when this visit actually carried answers. A later touch
    // that knows nothing about the questionnaire — a registration, a backfill
    // pass — must not blank what the intake form recorded.
    const answers = parseOnboardingAnswers(details);
    if (answers.length) {
      set.onboarding = { raw: String(details).trim().slice(0, 4000), answers };
    }

    await WaitlistEntry.updateOne(
      { email: address },
      {
        $set: set,
        $setOnInsert: {
          email: address,
          source,
          // When they actually finished the questions. Falls back to now for a
          // live capture; the backfill passes the real historical date.
          onboardingCompletedAt: onboardingCompletedAt || now,
          createdAt: now,
          launchNotifiedAt: null,
        },
      },
      { upsert: true }
    );

    return true;
  } catch (err) {
    // A duplicate-key race means the row this call wanted already exists, which
    // is the desired end state rather than a failure.
    if (err?.code === 11000) return true;
    console.error("recordWaitlistEntry failed:", err?.message || err);
    return false;
  }
};

/* ═══════════════════ WHAT "EMAIL CONSENT" ACTUALLY MEANS ══════════════════ */

// FamLink's email policy is opt-OUT, everywhere and for everyone: we may email
// you until you tell us not to. This is the one place that decides what that
// means for a given row, and every consumer goes through it.
//
//   has an account → consented if subscribed to EITHER of the two categories
//                    in src/modules/user/user.model.js. Both are ON from signup and an absent
//                    flag means on as well (the $ne:false rule every send path
//                    already uses), so this is a Yes until they switch one off
//                    in Settings → Email Notifications. One category is enough:
//                    the two are different kinds of mail, and someone who kept
//                    either has not opted out of hearing from us.
//   no account     → yes. They handed us their address in one of our own
//                    funnels and have never asked us to stop.
//   either         → `unsubscribedAt` on the row overrules both. Withdrawal
//                    outranks every other signal.
//
// `notifyConsent` as STORED answers a narrower question — did this person tick
// the box on the waitlist form — and it survives as provenance only, carried
// through as `formConsent`. It is deliberately no longer what decides a send:
// the box was on a form most of these people never saw. Registration doesn't
// show it, so members sat at false while the account they hold said they were
// subscribed to everything; leads are captured mid-questionnaire, so they sat
// at false too. The flag was describing our forms, not the people.
//
// A deleted account never resolves to consented, and does NOT fall through to
// the no-account rule. Two of the three delete paths clear the email flags;
// src/modules/admin/reports.module.js does not, and reading a tombstone as permission to
// email is not a risk worth carrying.

const DELETED_STATUS = "Deleted";

// The two categories, absent-means-on. Same rule as src/modules/admin/users.module.js and
// the Settings screen, stated once so the waitlist can't drift from them.
export const accountEmailPrefs = (user) =>
  user
    ? {
        platformUpdates: user.notifications?.email?.platformUpdates !== false,
        newsletter: user.notifications?.email?.newsletter !== false,
      }
    : null;

/**
 * Resolve one row's consent against the account behind it, if any.
 *
 * `consentSource` says which rule produced the answer, and `formConsent` keeps
 * the stored checkbox. Neither changes who gets emailed — they are there so the
 * console can show that a Yes came from an account's settings rather than from
 * a box this person actually ticked, which is a distinction worth keeping
 * visible even though it no longer gates anything.
 *
 * @param {object} entry waitlist row
 * @param {object|null} user the account it converted into, already fetched
 * @returns {{ notifyConsent: boolean, emailPrefs: object|null, consentSource: "account"|"waitlist", formConsent: boolean }}
 */
export const resolveEmailConsent = (entry, user = null) => {
  const deleted = user?.status === DELETED_STATUS;
  const account = user && !deleted ? user : null;
  const emailPrefs = accountEmailPrefs(account);
  const consentSource = account ? "account" : "waitlist";
  const formConsent = entry?.notifyConsent === true;

  // A deleted account is a No outright, NOT a fall-through to the no-account
  // rule below — otherwise closing an account would quietly re-subscribe it.
  if (deleted || entry?.unsubscribedAt) {
    return { notifyConsent: false, emailPrefs, consentSource, formConsent };
  }

  if (account) {
    return {
      notifyConsent: emailPrefs.platformUpdates || emailPrefs.newsletter,
      emailPrefs,
      consentSource,
      formConsent,
    };
  }

  // No account, not unsubscribed: opt-out means yes. The stored checkbox rides
  // along as `formConsent` so the console can still say which of these people
  // asked to be told and which we defaulted in.
  return { notifyConsent: true, emailPrefs: null, consentSource, formConsent };
};

/**
 * The same rule as `resolveEmailConsent`, expressed as aggregation stages so it
 * can be filtered, counted and grouped on rather than only computed after the
 * fact — a consent filter that ran in JS after paging would silently return
 * short pages.
 *
 * Overwrites `notifyConsent` with the resolved value and adds `emailPrefs`
 * (null when the row has no account) and `consentSource`.
 */
export const emailConsentStages = () => [
  {
    $lookup: {
      from: "users",
      let: { uid: "$userId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
        { $project: { "notifications.email": 1, status: 1 } },
      ],
      as: "account",
    },
  },
  {
    $addFields: {
      // The stored checkbox, captured before the field below overwrites it.
      formConsent: { $eq: ["$notifyConsent", true] },
      // A deleted account is fetched rather than filtered out of the lookup,
      // because "deleted" and "never had an account" have to end differently:
      // the first is a No outright, the second is a Yes.
      deletedAccount: {
        $eq: [{ $arrayElemAt: ["$account.status", 0] }, DELETED_STATUS],
      },
      // Kept apart from the prefs below because they answer different
      // questions: whether an account exists at all, and what it is subscribed
      // to. An account with no `notifications.email` subdocument still has an
      // account, and both its categories are on.
      liveAccount: {
        $and: [
          { $gt: [{ $size: "$account" }, 0] },
          { $ne: [{ $arrayElemAt: ["$account.status", 0] }, DELETED_STATUS] },
        ],
      },
      accountEmail: { $arrayElemAt: ["$account.notifications.email", 0] },
    },
  },
  {
    $addFields: {
      emailPrefs: {
        $cond: [
          "$liveAccount",
          {
            platformUpdates: { $ne: ["$accountEmail.platformUpdates", false] },
            newsletter: { $ne: ["$accountEmail.newsletter", false] },
          },
          null,
        ],
      },
    },
  },
  {
    $addFields: {
      consentSource: { $cond: ["$liveAccount", "account", "waitlist"] },
      notifyConsent: {
        $switch: {
          branches: [
            { case: { $ne: ["$unsubscribedAt", null] }, then: false },
            { case: "$deletedAccount", then: false },
            {
              case: "$liveAccount",
              then: {
                $or: ["$emailPrefs.platformUpdates", "$emailPrefs.newsletter"],
              },
            },
          ],
          // No account and never unsubscribed. Opt-out means yes.
          default: true,
        },
      },
    },
  },
  { $project: { account: 0, liveAccount: 0, deletedAccount: 0, accountEmail: 0 } },
];

// Everyone in a city who may be told about launch and hasn't been told.
//
// The three conditions are the whole contract of the launch email, so they live
// in one place rather than being retyped in the route: consented (resolved, as
// above), not unsubscribed since, not already notified.
export const pendingLaunchRecipients = async (city, { limit = 5000 } = {}) => {
  const match = {
    unsubscribedAt: null,
    launchNotifiedAt: null,
  };

  if (city) {
    // Anchored, case-insensitive exact match rather than a substring: "Oakland"
    // must not also select "West Oakland Heights" in a mail-everyone action.
    match["location.city"] = new RegExp(
      `^${String(city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i"
    );
  }

  return WaitlistEntry.aggregate([
    { $match: match },
    ...emailConsentStages(),
    { $match: { notifyConsent: true } },
    { $project: { email: 1, name: 1, userId: 1, location: 1, userType: 1 } },
    { $limit: limit },
  ]);
};

// How many people are waiting to be told, across every city. The dashboard's
// "ready to email" figure — the same query as the send, counted rather than
// listed, so the two can't report different numbers.
export const countPendingLaunchRecipients = async () => {
  const [row] = await WaitlistEntry.aggregate([
    { $match: { unsubscribedAt: null, launchNotifiedAt: null } },
    ...emailConsentStages(),
    { $match: { notifyConsent: true } },
    { $count: "total" },
  ]);
  return row?.total || 0;
};
