import cron from "node-cron";
import User from "../../modules/user/user.model.js";
import { sendReengagementEmail, cityOf } from "../email/email.js";

// ── Re-engagement / win-back email for inactive users (email 16) ─────────────
// Per the template's developer notes:
//   • sent to users inactive for ~30 days who have a COMPLETE profile
//   • founder-voice nudge (from Ari) — so it honours the email unsubscribe
//   • at most once per inactivity streak: a nudged user becomes eligible again
//     only after they log in (which pushes lastLogin past reengagementSentAt)
//
// "Inactive" = lastLogin between INACTIVE_DAYS and (INACTIVE_DAYS + WINDOW_DAYS)
// days ago. Two things make this window matter:
//   1. It bounds the query and, because lastLogin is a NEW field that starts
//      null, means nothing is emailed until real logins age past INACTIVE_DAYS
//      — so the historical backlog is never blasted on first deploy.
//   2. The `$gte: windowStart` lower bound is what EXCLUDES null lastLogin:
//      in BSON sort order null < any date, so a bare `$lte` would wrongly match
//      brand-new users who have never logged in.
// Re-sends inside the window are prevented by reengagementSentAt (below), so a
// user isn't emailed every day they sit in the 30–37-day band.

const CRON_EXPR = process.env.REENGAGEMENT_CRON || "0 10 * * *"; // daily 10:00
const INACTIVE_DAYS = Number(process.env.REENGAGEMENT_INACTIVE_DAYS) || 30;
const WINDOW_DAYS = Number(process.env.REENGAGEMENT_WINDOW_DAYS) || 7;
const BATCH_LIMIT = Number(process.env.REENGAGEMENT_BATCH) || 300;
const SEND_GAP_MS = Number(process.env.REENGAGEMENT_GAP_MS) || 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prevent overlapping runs if a batch takes longer than the cron interval.
let isRunning = false;

export const runReengagement = async () => {
    if (isRunning) {
        console.log("[reengagement] previous run still in progress — skipping.");
        return { skipped: true };
    }
    isRunning = true;

    const now = Date.now();
    const inactiveBefore = new Date(now - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
    const windowStart = new Date(
        now - (INACTIVE_DAYS + WINDOW_DAYS) * 24 * 60 * 60 * 1000
    );

    let sent = 0;
    let failed = 0;

    try {
        const candidates = await User.find({
            type: { $in: ["Nanny", "Parents"] },
            status: "Active",
            nannyProfileCompleted: true,
            email: { $exists: true, $nin: [null, ""] },
            // Marketing nudge → gated on the newsletter opt-in, not platform
            // updates. The footer Unsubscribe link switches both off, so an
            // unsubscribe suppresses this send either way.
            "notifications.email.newsletter": { $ne: false },
            // Inactive 30–37 days. $gte also excludes never-logged-in users
            // (lastLogin null), which $lte alone would match — see note above.
            lastLogin: { $gte: windowStart, $lte: inactiveBefore },
            // Not already nudged since their most recent login.
            $or: [
                { reengagementSentAt: null },
                { $expr: { $lt: ["$reengagementSentAt", "$lastLogin"] } },
            ],
        })
            .select("_id name email location noOfChildren")
            .limit(BATCH_LIMIT)
            .lean();

        if (candidates.length === 0) {
            return { sent, failed, total: 0 };
        }

        console.log(`[reengagement] ${candidates.length} inactive user(s) to nudge.`);

        for (const u of candidates) {
            try {
                await sendReengagementEmail(u.email, u.name, {
                    city: cityOf(u),
                    recipient: u,
                });
                // Mark as nudged only on success so failures retry next run
                // (bounded by the WINDOW_DAYS upper limit on lastLogin).
                await User.updateOne(
                    { _id: u._id },
                    { $set: { reengagementSentAt: new Date() } }
                );
                sent++;
            } catch (err) {
                failed++;
                console.error(
                    `[reengagement] failed for ${u.email}:`,
                    err?.message || err
                );
            }
            if (SEND_GAP_MS > 0) await sleep(SEND_GAP_MS);
        }

        console.log(`[reengagement] done — sent: ${sent}, failed: ${failed}.`);
        return { sent, failed, total: candidates.length };
    } catch (err) {
        console.error("[reengagement] run errored:", err?.message || err);
        return { sent, failed, error: true };
    } finally {
        isRunning = false;
    }
};

// Register the cron schedule. Call once at server startup.
export const startReengagementJob = () => {
    if (!cron.validate(CRON_EXPR)) {
        console.error(
            `[reengagement] invalid cron expression "${CRON_EXPR}" — job not scheduled.`
        );
        return;
    }
    cron.schedule(CRON_EXPR, () => {
        runReengagement().catch((err) =>
            console.error("[reengagement] unhandled error:", err)
        );
    });
    console.log(
        `[reengagement] scheduled (cron="${CRON_EXPR}", inactive=${INACTIVE_DAYS}d, window=${WINDOW_DAYS}d).`
    );
};
