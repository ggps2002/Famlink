import cron from "node-cron";
import Blogs from "../../modules/blog/blog.model.js";
import User from "../../modules/user/user.model.js";
import { sendWeeklyResourcesEmail } from "../email/email.js";

// ── Weekly nanny share resources digest (email 12) ───────────────────────────
// Per the template's developer notes:
//   • Ari publishes ~3 resources per week
//   • pull the 3 most recently published resources, newest first
//   • if fewer than 3 exist, show 2 or 1 (the card markup is generated from the
//     array, so a short week simply renders fewer cards)
//   • send weekly, Tuesday or Wednesday morning
//   • only to users who have the resources ("Tips and Tricks") email enabled
//
// A published blog is one with isDraft === false. If nothing is published we
// skip the run entirely rather than send an empty digest.

const CRON_EXPR = process.env.WEEKLY_RESOURCES_CRON || "0 9 * * 2"; // Tue 09:00
const BATCH_LIMIT = Number(process.env.WEEKLY_RESOURCES_BATCH) || 500;
const SEND_GAP_MS = Number(process.env.WEEKLY_RESOURCES_GAP_MS) || 500;
const APP_URL =
    process.env.APP_URL || process.env.CLIENT_URL || "https://www.famlink.care";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let isRunning = false;

// "July 7–13, 2026" — the week the digest covers (Mon..Sun containing today).
const weekOfLabel = (now = new Date()) => {
    const day = (now.getDay() + 6) % 7; // Mon = 0
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const month = (d) => d.toLocaleString("en-US", { month: "long" });
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
        ? `${month(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
        : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
};

export const runWeeklyResources = async () => {
    if (isRunning) {
        console.log("[weekly-resources] previous run still in progress — skipping.");
        return { skipped: true };
    }
    isRunning = true;

    let sent = 0;
    let failed = 0;

    try {
        // 3 most recently published resources, newest first.
        const blogs = await Blogs.find({ isDraft: false })
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();

        if (blogs.length === 0) {
            console.log("[weekly-resources] no published resources — skipping.");
            return { sent, failed, total: 0, skipped: true };
        }

        const resources = blogs.map((b) => ({
            title: b.title,
            desc: b.excerpt,
            tag: b.category,
            // /resources/:slug also resolves a blog id — see ArticlePage.
            url: `${APP_URL}/resources/${b._id}`,
        }));
        const weekOf = weekOfLabel();

        const recipients = await User.find({
            type: { $in: ["Nanny", "Parents"] },
            status: "Active",
            email: { $exists: true, $nin: [null, ""] },
            // Default-on: only skip users who explicitly turned it off (which is
            // also what the footer Unsubscribe link does).
            "notifications.email.newsletter": { $ne: false },
        })
            .select("_id name email")
            .limit(BATCH_LIMIT)
            .lean();

        if (recipients.length === 0) {
            return { sent, failed, total: 0 };
        }

        console.log(
            `[weekly-resources] ${blogs.length} resource(s) → ${recipients.length} recipient(s).`
        );

        for (const u of recipients) {
            try {
                await sendWeeklyResourcesEmail(u.email, u.name, { weekOf, resources });
                sent++;
            } catch (err) {
                failed++;
                console.error(
                    `[weekly-resources] failed for ${u.email}:`,
                    err?.message || err
                );
            }
            if (SEND_GAP_MS > 0) await sleep(SEND_GAP_MS);
        }

        console.log(`[weekly-resources] done — sent: ${sent}, failed: ${failed}.`);
        return { sent, failed, total: recipients.length };
    } catch (err) {
        console.error("[weekly-resources] run errored:", err?.message || err);
        return { sent, failed, error: true };
    } finally {
        isRunning = false;
    }
};

export const startWeeklyResourcesJob = () => {
    if (!cron.validate(CRON_EXPR)) {
        console.error(
            `[weekly-resources] invalid cron expression "${CRON_EXPR}" — job not scheduled.`
        );
        return;
    }
    cron.schedule(CRON_EXPR, () => {
        runWeeklyResources().catch((err) =>
            console.error("[weekly-resources] unhandled error:", err)
        );
    });
    console.log(`[weekly-resources] scheduled (cron="${CRON_EXPR}").`);
};
