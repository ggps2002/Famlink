import { describe, it, expect } from "vitest";
import { createRegistry, migratedPrefixes } from "#src/modules/index.js";
import baseline from "./route-baseline.json" with { type: "json" };

/**
 * The refactor's contract with the outside world: the URLs do not change.
 *
 * `route-baseline.json` is the route table extracted from the Routes/ tree.
 * Every module that migrates must reproduce its own prefix exactly — same
 * paths, same methods. A handler that gets dropped, renamed, or has its method
 * changed during the move fails here rather than becoming a 404 for whoever
 * calls it first.
 *
 * The baseline is regenerated ONLY when a prefix is deliberately retired, and
 * the retirement is recorded in RETIRED_PREFIXES below. Regenerating it to make
 * a failure go away would defeat the whole test — the point is that a route
 * disappears on purpose or not at all.
 *
 * ── Individual routes removed from the baseline ──────────────────────────────
 *
 * Two entries were taken out on 2026-09-12, both under a prefix that otherwise
 * stays. Recorded here because the rule above is about intent, and a whole
 * prefix retiring is not the only way a route can go on purpose:
 *
 *   POST /auth/forgot-password   the OTP password-reset pair. `resetPassword`
 *   POST /auth/reset-password    looked its user up by the submitted code
 *                                ALONE — `findOne({ otp })`, not scoped to an
 *                                email — so guessing 4-digit codes in a loop
 *                                reset whichever account happened to hold the
 *                                match, including an admin's. Unauthenticated
 *                                account takeover, not fixable by lengthening
 *                                the code, because the flaw is the unscoped
 *                                lookup. Neither route had a frontend caller:
 *                                ForgotPassword.jsx and ResetPassword.jsx both
 *                                use the link-based flow, which is correct and
 *                                remains. See SECURITY.md.
 *
 * ── Individual routes added to the baseline ──────────────────────────────────
 *
 * Three entries were added, for the same reason the removals above are written
 * down: the baseline is the record of what this API serves, and it changing
 * quietly is exactly what this test exists to prevent.
 *
 *   GET /match/pending-incoming-count
 *                                added 2026-09-15. The dashboard navbar shows
 *                                how many match requests are waiting on an
 *                                answer, on every screen. The existing
 *                                /match/get-incoming-requests reads the whole
 *                                inbox and resolves a profile per request to
 *                                build cards the badge does not render, and it
 *                                returns `totalRecords` for all statuses rather
 *                                than the pending ones. This counts, in two
 *                                indexed queries, applying the same
 *                                visibility rule the listing does. See
 *                                modules/match/match.service.js.
 *
 *   POST /payment/stripe/confirm-checkout
 *                                added 2026-09-15. Stripe redirects the buyer
 *                                back before it delivers
 *                                checkout.session.completed, so a member who
 *                                had paid was shown the free tier until the
 *                                webhook landed — and on a developer machine,
 *                                which Stripe cannot reach, it never landed at
 *                                all. The browser now names the session it just
 *                                paid for and the server re-reads it FROM
 *                                STRIPE, refusing any session whose
 *                                metadata.userId is not the caller's. The
 *                                webhook remains the authority and the only
 *                                writer of revenue; this only settles
 *                                entitlement, which is idempotent. See
 *                                modules/billing/payment.service.js.
 *
 *   GET  /admin/email-queue      added 2026-09-17. The outbound email queue and
 *   GET  /admin/email-queue/health   its controls. Automated email moved from
 *   GET  /admin/email-queue/stats    being sent inline by the web app to being
 *   POST /admin/email-queue/flush    written to a queue and delivered by a
 *   POST /admin/email-queue/retry-all  dispatcher, which is what made a failed
 *   POST /admin/email-queue/:id/retry  send recoverable at all. Before this a
 *                                message that failed was gone — support could
 *                                see a `failed` row in the email log and could
 *                                do nothing with it. `retry` and `retry-all`
 *                                are that missing verb. See
 *                                shared/email/emailQueue.model.js.
 *
 *   POST /auth/logout            added 2026-09-12. Ending a session became something only the
 *                                server can do. The refresh token now lives in
 *                                an httpOnly cookie, so signing out can no
 *                                longer be a matter of the browser dropping its
 *                                own copy — JavaScript cannot delete the cookie,
 *                                and the stored row outlived every previous
 *                                "sign out" by up to seven days regardless. See
 *                                modules/auth/refreshCookie.js and SECURITY.md.
 */

/**
 * Prefixes removed by decision rather than by migration.
 *
 * /community — the Tips & Articles discussion feature, deleted 2026-08-12 along
 * with its model, Redux slice, and the two screens that rendered it. Recorded
 * here rather than silently dropped so that "these 23 routes are gone" stays a
 * reviewable statement in the test suite.
 */
const RETIRED_PREFIXES = ["/community"];

/**
 * Prefixes still served by the legacy router, deliberately not migrated.
 *
 * All four remain live and working — nothing here was deleted or broken, which
 * is the difference between these and RETIRED_PREFIXES above. Three are simply
 * out of scope; the fourth is a different kind of exclusion.
 *
 *   /nannyShare   — 7 frontend call sites; backs the six-step questionnaire.
 *   /postJob      — 6 call sites; post-a-job and the job listing screens.
 *   /book-hire    — 30 call sites across five Redux slices.
 *
 *   /phantombuster — the intake for scraped Facebook profile data, which is
 *     AI-classified into "Parent" / "Caregiver" / "Nanny Share" lead lists of
 *     people who never opted in. Left exactly as it was, running, and not
 *     rewritten: this is the same automation declined on 2026-07-18, and
 *     restructuring it is still authoring it. Nothing about its behaviour
 *     changed in this refactor.
 */
const UNMIGRATED_PREFIXES = ["/postJob", "/nannyShare", "/book-hire", "/phantombuster"];

const key = ({ method, path }) => `${method} ${path}`;
const under = (routes, prefix) =>
  routes.filter((r) => r.path === prefix || r.path.startsWith(`${prefix}/`));

const registry = createRegistry();
const current = registry.describe();

describe("route parity with the pre-refactor API", () => {
  it.each(migratedPrefixes())("%s serves exactly the routes it always did", (prefix) => {
    const expected = under(baseline, prefix).map(key).sort();
    const actual = under(current, prefix).map(key).sort();

    expect(actual).toEqual(expected);
  });

  it("registers no route outside a migrated prefix", () => {
    // Guards against a module quietly claiming a path another one still owns.
    const prefixes = migratedPrefixes();
    const strays = current.filter(
      (route) => !prefixes.some((p) => route.path === p || route.path.startsWith(`${p}/`))
    );

    expect(strays).toEqual([]);
  });

  it("has no duplicate method+path across modules", () => {
    // Two layers matching the same request means one is unreachable, and which
    // one wins is registration order rather than anything a reader would see.
    const seen = new Set();
    const duplicates = [];

    for (const route of current) {
      if (seen.has(key(route))) duplicates.push(key(route));
      seen.add(key(route));
    }

    expect(duplicates).toEqual([]);
  });
});

describe("retired routes", () => {
  it("no longer serves a prefix that was deliberately removed", () => {
    // The other direction from parity: these must be gone, and a module that
    // reintroduced one would be resurrecting a deleted feature.
    const resurrected = current.filter((route) =>
      RETIRED_PREFIXES.some((p) => route.path === p || route.path.startsWith(`${p}/`))
    );

    expect(resurrected).toEqual([]);
  });

  it("has no retired prefix left in the baseline", () => {
    // Guards the baseline itself: if /community reappears here, the file was
    // regenerated from a tree where the deletion had been reverted.
    const stale = baseline.filter((route) =>
      RETIRED_PREFIXES.some((p) => route.path === p || route.path.startsWith(`${p}/`))
    );

    expect(stale).toEqual([]);
  });
});

describe("migration progress", () => {
  it("reports how much of the API has moved", () => {
    const prefixes = migratedPrefixes();
    const isUnmigrated = (route) =>
      UNMIGRATED_PREFIXES.some((p) => route.path === p || route.path.startsWith(`${p}/`));

    const inScope = baseline.filter((route) => !isUnmigrated(route));
    const migrated = inScope.filter((route) =>
      prefixes.some((p) => route.path === p || route.path.startsWith(`${p}/`))
    );

    // Not an assertion about the target — it prints where the migration is, so
    // the number is visible in CI while the work is in progress.
    console.log(
      `[migration] ${migrated.length}/${inScope.length} in-scope routes moved ` +
        `(${prefixes.length} modules: ${prefixes.join(", ")}); ` +
        `${baseline.length - inScope.length} left on the legacy router by choice`
    );

    expect(migrated.length).toBeGreaterThan(0);
  });
});
