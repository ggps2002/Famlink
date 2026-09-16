// Accounts worth a human look.
//
// Every signal here is circumstantial. None of them means someone is acting in
// bad faith, and this module deliberately produces REASONS rather than a
// verdict — the admin decides, and they decide with the evidence in front of
// them rather than a number they are asked to trust.
//
// Kept as pure functions over plain counts so the thresholds are readable and
// testable on their own. Getting one wrong has a real cost in both directions:
// too sensitive and the genuine signal is buried under new members behaving
// normally, too blunt and nobody is looked at until they are reported.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The signals, in the order they are checked.
 *
 * `weight` orders the queue; it is not a probability and must never be rendered
 * as one. See `score` below.
 */
export const SIGNALS = {
  ALREADY_REPORTED: "already_reported",
  HIGH_OUTBOUND_NO_REPLIES: "high_outbound_no_replies",
  RAPID_MESSAGING: "rapid_messaging",
  UNVERIFIED_BUT_ACTIVE: "unverified_but_active",
  NEVER_LOGGED_IN: "never_logged_in_after_signup",
};

/**
 * Thresholds, named so they can be argued with.
 *
 * `outboundRequests: 10` is a deliberately high bar. Sending a handful of
 * requests that go unanswered is the ordinary experience of a new member on a
 * small platform; flagging that would bury the real signal under everyone
 * having a normal week.
 *
 * `signupGraceDays: 7` exists for the same reason — an account that has not
 * come back is only interesting once it has had a fair chance to.
 */
export const THRESHOLDS = {
  outboundRequests: 10,
  messagesPerWeek: 100,
  loginsWhileUnverified: 5,
  signupGraceDays: 7,
};

/**
 * Why this account is on the list, if it is.
 *
 * @param {object} user     the account, with its verification and login fields
 * @param {object} counts   `{ sent, accepted, messages, reports }`
 * @param {number} [now]    injectable clock, for testing the age thresholds
 * @returns {Array} reasons — empty means nothing stood out
 */
export const reasonsFor = (user, counts = {}, now = Date.now()) => {
  const { sent = 0, accepted = 0, messages = 0, reports = 0 } = counts;
  const reasons = [];

  if (reports > 0) {
    reasons.push({
      code: SIGNALS.ALREADY_REPORTED,
      detail: `${reports} open report${reports === 1 ? "" : "s"}`,
      weight: 40,
    });
  }

  // The shape of someone spraying every profile on the platform. Requires both
  // halves: high volume alone is a keen member, zero acceptances alone is bad
  // luck.
  if (sent >= THRESHOLDS.outboundRequests && accepted === 0) {
    reasons.push({
      code: SIGNALS.HIGH_OUTBOUND_NO_REPLIES,
      detail: `${sent} requests sent, none accepted`,
      weight: 25,
    });
  }

  if (messages >= THRESHOLDS.messagesPerWeek) {
    reasons.push({
      code: SIGNALS.RAPID_MESSAGING,
      detail: `${messages} messages in the last 7 days`,
      weight: 20,
    });
  }

  if (!user.verified?.emailVer && (user.loginCount || 0) >= THRESHOLDS.loginsWhileUnverified) {
    reasons.push({
      code: SIGNALS.UNVERIFIED_BUT_ACTIVE,
      detail: `${user.loginCount} logins, email never verified`,
      weight: 15,
    });
  }

  const ageDays = user.createdAt ? (now - new Date(user.createdAt).getTime()) / DAY_MS : 0;
  if (!user.lastLogin && ageDays > THRESHOLDS.signupGraceDays) {
    // Usually a broken funnel rather than a bad actor, and worth knowing either
    // way — hence the lowest weight on the list.
    reasons.push({
      code: SIGNALS.NEVER_LOGGED_IN,
      detail: `Signed up ${Math.round(ageDays)} days ago, never returned`,
      weight: 5,
    });
  }

  return reasons;
};

/**
 * A sort key, not a probability.
 *
 * Named "score" and never rendered as a percentage, because presenting a
 * heuristic as a confidence level is how a circumstantial signal turns into an
 * account ban.
 */
export const score = (reasons) => reasons.reduce((sum, reason) => sum + reason.weight, 0);

/** The subset of an account the console needs to show a flagged row. */
export const toFlaggedRow = (user, reasons) => ({
  user: {
    _id: user._id,
    name: user.name,
    email: user.email,
    type: user.type,
    status: user.status,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  },
  reasons,
  score: score(reasons),
  alreadyFlagged: Boolean(user.suspiciousFlaggedAt),
});
