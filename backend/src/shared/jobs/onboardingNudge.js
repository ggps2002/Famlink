import cron from "node-cron";
import OnboardingLead from "../../modules/lead/onboardingLead.model.js";
import User from "../../modules/user/user.model.js";
import { sendOnboardingIncompleteEmail, cityOf } from "../email/email.js";

// ── "You started but never signed up" nudge (email 20) ───────────────────────
// Emails someone who answered the intake questions on an onboarding form and
// then never created an account. Once each, a few hours after they dropped off.
//
// A lead is nudged when ALL of these hold:
//   • we haven't nudged them yet (nudgeSentAt is null)
//   • they haven't unsubscribed (unsubscribedAt is null)
//   • the lead is older than DELAY_HOURS but younger than WINDOW_DAYS
//   • no user account exists for that address
//
// DELAY_HOURS is the "a few hours later" of the spec, and it earns its keep:
// most people who finish the questions carry straight on to the account step,
// so mailing on the spot would nag people who were about to convert anyway.
// Registering also retires the lead directly (retireOnboardingLead, called from
// the signup path), so the users-collection check below is a backstop covering
// leads whose address signed up by some other route.
//
// The WINDOW_DAYS upper bound matters for the same reason it does in
// completeProfileReminder.js: without it the first run after deploy would mail
// the entire historical backlog at once. It also bounds retries — an address
// that keeps failing ages out of the window instead of being retried forever.

const CRON_EXPR = process.env.ONBOARDING_NUDGE_CRON || "15 * * * *"; // hourly
const DELAY_HOURS = Number(process.env.ONBOARDING_NUDGE_DELAY_HOURS) || 3;
const WINDOW_DAYS = Number(process.env.ONBOARDING_NUDGE_WINDOW_DAYS) || 7;
const BATCH_LIMIT = Number(process.env.ONBOARDING_NUDGE_BATCH) || 200;
const SEND_GAP_MS = Number(process.env.ONBOARDING_NUDGE_GAP_MS) || 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prevent overlapping runs if a batch takes longer than the cron interval.
let isRunning = false;

export const runOnboardingNudge = async () => {
    if (isRunning) {
        console.log("[onboarding-nudge] previous run still in progress — skipping.");
        return { skipped: true };
    }
    isRunning = true;

    const now = Date.now();
    const nudgeBefore = new Date(now - DELAY_HOURS * 60 * 60 * 1000);
    const windowStart = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    let sent = 0;
    let failed = 0;
    let registered = 0;

    try {
        const candidates = await OnboardingLead.find({
            nudgeSentAt: null,
            unsubscribedAt: null,
            email: { $exists: true, $nin: [null, ""] },
            createdAt: { $gte: windowStart, $lte: nudgeBefore },
        })
            .limit(BATCH_LIMIT)
            .lean();

        if (candidates.length === 0) {
            return { sent, failed, total: 0 };
        }

        // One query for the whole batch rather than a findOne per lead — this
        // runs hourly against a collection that only grows.
        const emails = candidates.map((l) => l.email);
        const existing = await User.find({ email: { $in: emails } })
            .select("email")
            .lean();
        const hasAccount = new Set(existing.map((u) => String(u.email).toLowerCase()));

        for (const lead of candidates) {
            // They signed up after all. Retire the lead through the same field
            // the filter above uses, so it is never reconsidered.
            if (hasAccount.has(lead.email)) {
                await OnboardingLead.updateOne(
                    { _id: lead._id },
                    { $set: { nudgeSentAt: new Date() } }
                );
                registered++;
                continue;
            }

            try {
                await sendOnboardingIncompleteEmail(lead.email, lead.name, {
                    city: cityOf(lead),
                    // The lead row itself stands in for a user doc — it carries
                    // the location the family cards are chosen from.
                    recipient: lead,
                    source: lead.source,
                    sheetId: lead.sheetId,
                });
                // Mark as nudged only on success so failures retry next run
                // (bounded by the WINDOW_DAYS lower limit on createdAt).
                await OnboardingLead.updateOne(
                    { _id: lead._id },
                    { $set: { nudgeSentAt: new Date() } }
                );
                sent++;
            } catch (err) {
                failed++;
                console.error(
                    `[onboarding-nudge] failed for ${lead.email}:`,
                    err?.message || err
                );
            }
            if (SEND_GAP_MS > 0) await sleep(SEND_GAP_MS);
        }

        console.log(
            `[onboarding-nudge] done — sent: ${sent}, already registered: ${registered}, failed: ${failed}.`
        );
        return { sent, failed, registered, total: candidates.length };
    } catch (err) {
        console.error("[onboarding-nudge] run errored:", err?.message || err);
        return { sent, failed, error: true };
    } finally {
        isRunning = false;
    }
};

// Register the cron schedule. Call once at server startup.
export const startOnboardingNudgeJob = () => {
    if (!cron.validate(CRON_EXPR)) {
        console.error(
            `[onboarding-nudge] invalid cron expression "${CRON_EXPR}" — job not scheduled.`
        );
        return;
    }
    cron.schedule(CRON_EXPR, () => {
        runOnboardingNudge().catch((err) =>
            console.error("[onboarding-nudge] unhandled error:", err)
        );
    });
    console.log(
        `[onboarding-nudge] scheduled (cron="${CRON_EXPR}", delay=${DELAY_HOURS}h, window=${WINDOW_DAYS}d).`
    );
};
