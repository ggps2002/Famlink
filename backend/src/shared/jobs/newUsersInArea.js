import cron from "node-cron";
import User from "../../modules/user/user.model.js";
import { sendNewUsersInAreaEmail, cityOf } from "../email/email.js";

// ── "New users in your area" weekly digest (email 13) ────────────────────────
// Per the template's developer notes:
//   • batch new local signups — do NOT send one email per new user (too noisy)
//   • send only if 1+ new local users joined that week
//   • weekly digest
//   • honours the "Platform Updates" email toggle
//     (notifications.email.platformUpdates — this used to have its own
//      "New Subscriber in area" switch, folded into the two categories)
//
// A recipient is emailed when, in the last WINDOW_DAYS, at least one new active
// family with a completed profile joined in their city. The family cards in the
// email are rendered by email.js from the recipient's own location.

const CRON_EXPR = process.env.NEW_USERS_AREA_CRON || "0 9 * * 3"; // Wed 09:00
const WINDOW_DAYS = Number(process.env.NEW_USERS_AREA_WINDOW_DAYS) || 7;
const BATCH_LIMIT = Number(process.env.NEW_USERS_AREA_BATCH) || 500;
const SEND_GAP_MS = Number(process.env.NEW_USERS_AREA_GAP_MS) || 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let isRunning = false;

export const runNewUsersInArea = async () => {
    if (isRunning) {
        console.log("[new-users-area] previous run still in progress — skipping.");
        return { skipped: true };
    }
    isRunning = true;

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    try {
        const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

        // Recipients: active users who haven't turned this off. We can't filter
        // on `location.city` in the query — almost nobody has it set. The city
        // is resolved in JS by cityOf(), which falls back to parsing
        // `location.format_location` (set on nearly every user).
        const recipients = (
            await User.find({
                type: { $in: ["Nanny", "Parents"] },
                status: "Active",
                email: { $exists: true, $nin: [null, ""] },
                "notifications.email.platformUpdates": { $ne: false },
            })
                .select("_id name email location noOfChildren type nannyProfileCompleted createdAt")
                .limit(BATCH_LIMIT)
                .lean()
        ).filter((u) => cityOf(u));

        if (recipients.length === 0) {
            return { sent, failed, total: 0 };
        }

        // New families this week, tallied by city once for the whole run.
        const countsByCity = new Map();
        const newFamilies = await User.find({
            type: "Parents",
            status: "Active",
            nannyProfileCompleted: true,
            createdAt: { $gte: since },
        })
            .select("_id location")
            .lean();

        for (const f of newFamilies) {
            const c = cityOf(f);
            if (c) countsByCity.set(c, (countsByCity.get(c) || 0) + 1);
        }

        for (const u of recipients) {
            const city = cityOf(u);
            try {
                const total = countsByCity.get(city) || 0;

                // A recipient who joined this week is inside their own city's
                // count — don't let them be told about themselves.
                const countsAsNew =
                    u.type === "Parents" &&
                    u.nannyProfileCompleted === true &&
                    u.createdAt &&
                    new Date(u.createdAt) >= since;
                const newCount = total - (countsAsNew ? 1 : 0);

                if (newCount < 1) {
                    skipped++;
                    continue;
                }

                await sendNewUsersInAreaEmail(u.email, u.name, {
                    city,
                    newCount,
                    recipient: u,
                });
                sent++;
            } catch (err) {
                failed++;
                console.error(
                    `[new-users-area] failed for ${u.email}:`,
                    err?.message || err
                );
            }
            if (SEND_GAP_MS > 0) await sleep(SEND_GAP_MS);
        }

        console.log(
            `[new-users-area] done — sent: ${sent}, skipped (no new locals): ${skipped}, failed: ${failed}.`
        );
        return { sent, failed, skipped, total: recipients.length };
    } catch (err) {
        console.error("[new-users-area] run errored:", err?.message || err);
        return { sent, failed, error: true };
    } finally {
        isRunning = false;
    }
};

export const startNewUsersInAreaJob = () => {
    if (!cron.validate(CRON_EXPR)) {
        console.error(
            `[new-users-area] invalid cron expression "${CRON_EXPR}" — job not scheduled.`
        );
        return;
    }
    cron.schedule(CRON_EXPR, () => {
        runNewUsersInArea().catch((err) =>
            console.error("[new-users-area] unhandled error:", err)
        );
    });
    console.log(
        `[new-users-area] scheduled (cron="${CRON_EXPR}", window=${WINDOW_DAYS}d).`
    );
};
