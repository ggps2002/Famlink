import cron from "node-cron";
import User from "../../modules/user/user.model.js";
import { sendCompleteProfileEmail } from "../email/email.js";

// ── "Complete your profile" reminder ────────────────────────────────────────
// Emails users who signed up but never finished their profile, once each.
//
// A user is reminded when ALL of these hold:
//   • account is Active and a Nanny/Parents account (Admins excluded)
//   • nannyProfileCompleted is still falsy
//   • we haven't reminded them yet (profileReminderSentAt is null)
//   • the account is older than DELAY_HOURS but younger than WINDOW_DAYS
//
// The WINDOW_DAYS upper bound is important: without it, the first run after
// deploy would email the entire historical backlog of incomplete accounts at
// once. It also bounds retries — a permanently-failing address simply ages out
// of the window instead of being retried forever.

const CRON_EXPR = process.env.PROFILE_REMINDER_CRON || "0 * * * *"; // hourly
const DELAY_HOURS = Number(process.env.PROFILE_REMINDER_DELAY_HOURS) || 24;
const WINDOW_DAYS = Number(process.env.PROFILE_REMINDER_WINDOW_DAYS) || 7;
const BATCH_LIMIT = Number(process.env.PROFILE_REMINDER_BATCH) || 200;
const SEND_GAP_MS = Number(process.env.PROFILE_REMINDER_GAP_MS) || 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prevent overlapping runs if a batch takes longer than the cron interval.
let isRunning = false;

export const runCompleteProfileReminder = async () => {
    if (isRunning) {
        console.log("[profile-reminder] previous run still in progress — skipping.");
        return { skipped: true };
    }
    isRunning = true;

    const now = Date.now();
    const remindBefore = new Date(now - DELAY_HOURS * 60 * 60 * 1000);
    const windowStart = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    let sent = 0;
    let failed = 0;

    try {
        const candidates = await User.find({
            type: { $in: ["Nanny", "Parents"] },
            status: "Active",
            nannyProfileCompleted: { $ne: true },
            profileReminderSentAt: null,
            email: { $exists: true, $nin: [null, ""] },
            createdAt: { $gte: windowStart, $lte: remindBefore },
        })
            .select("_id name email location noOfChildren")
            .limit(BATCH_LIMIT)
            .lean();

        if (candidates.length === 0) {
            return { sent, failed, total: 0 };
        }

        console.log(`[profile-reminder] ${candidates.length} user(s) to remind.`);

        for (const u of candidates) {
            try {
                await sendCompleteProfileEmail(u.email, u.name, u);
                // Mark as reminded only on success so failures retry next run
                // (bounded by the WINDOW_DAYS upper limit on createdAt).
                await User.updateOne(
                    { _id: u._id },
                    { $set: { profileReminderSentAt: new Date() } }
                );
                sent++;
            } catch (err) {
                failed++;
                console.error(
                    `[profile-reminder] failed for ${u.email}:`,
                    err?.message || err
                );
            }
            if (SEND_GAP_MS > 0) await sleep(SEND_GAP_MS);
        }

        console.log(`[profile-reminder] done — sent: ${sent}, failed: ${failed}.`);
        return { sent, failed, total: candidates.length };
    } catch (err) {
        console.error("[profile-reminder] run errored:", err?.message || err);
        return { sent, failed, error: true };
    } finally {
        isRunning = false;
    }
};

// Register the cron schedule. Call once at server startup.
export const startCompleteProfileReminderJob = () => {
    if (!cron.validate(CRON_EXPR)) {
        console.error(
            `[profile-reminder] invalid cron expression "${CRON_EXPR}" — job not scheduled.`
        );
        return;
    }
    cron.schedule(CRON_EXPR, () => {
        runCompleteProfileReminder().catch((err) =>
            console.error("[profile-reminder] unhandled error:", err)
        );
    });
    console.log(
        `[profile-reminder] scheduled (cron="${CRON_EXPR}", delay=${DELAY_HOURS}h, window=${WINDOW_DAYS}d).`
    );
};
