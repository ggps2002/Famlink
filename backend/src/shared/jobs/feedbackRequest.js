import cron from "node-cron";
import User from "../../modules/user/user.model.js";
import { sendFeedbackRequestEmail } from "../email/email.js";

// ── Feedback request (email 15) ─────────────────────────────────────────────
//
// "How's it going?", asked once, of members who have been here long enough for
// the answer to mean something.
//
// Per the template's own trigger note: 30 days on the platform, and only if
// they are actually using it. Both halves matter — asking someone who signed up
// and never came back what they think of the product gets you silence, or an
// answer about a product they never saw.
//
// WHO QUALIFIES
//   • Signed up TENURE_DAYS–(TENURE_DAYS + WINDOW_DAYS) days ago.
//   • Has logged in at least once since signing up — the "active" half of the
//     trigger. A never-logged-in account is a re-engagement problem (email 16),
//     not a feedback one.
//   • Has been back recently enough to still have the product in mind: their
//     last login is inside the same window rather than on day one.
//   • Has not already been asked (`feedbackRequestSentAt`, once per account,
//     ever — see the schema note on why this one is never reset).
//   • Has not opted out of the newsletter. This is not transactional: nobody
//     needs to be told we would like their opinion, so it is gated like every
//     other non-essential send and the footer Unsubscribe suppresses it.
//
// WHY A WINDOW AND NOT "createdAt <= 30 days ago"
//
// The same reason reengagementReminder.js has one, and it is worth restating
// because getting it wrong is a single-run, unrecallable mistake: an open lower
// bound makes EVERY member who predates this file eligible on the first run,
// and the first deploy mails the entire back catalogue at once. The window
// means only people crossing the 30-day mark from here on are ever asked, and
// the backlog is never touched.
//
// The upper bound also bounds the damage from a bad run: at most WINDOW_DAYS of
// signups can be in scope at any time, not the whole table.

const CRON_EXPR = process.env.FEEDBACK_REQUEST_CRON || "0 11 * * *"; // daily 11:00
const TENURE_DAYS = Number(process.env.FEEDBACK_REQUEST_TENURE_DAYS) || 30;
const WINDOW_DAYS = Number(process.env.FEEDBACK_REQUEST_WINDOW_DAYS) || 7;
const BATCH_LIMIT = Number(process.env.FEEDBACK_REQUEST_BATCH) || 200;
const SEND_GAP_MS = Number(process.env.FEEDBACK_REQUEST_GAP_MS) || 500;

const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prevent overlapping runs if a batch outlives the cron interval.
let isRunning = false;

export const runFeedbackRequest = async () => {
    if (isRunning) {
        console.log("[feedback-request] previous run still in progress — skipping.");
        return { skipped: true };
    }
    isRunning = true;

    const now = Date.now();
    // Signed up at least TENURE_DAYS ago…
    const joinedBefore = new Date(now - TENURE_DAYS * DAY_MS);
    // …but no earlier than the far edge of the window.
    const windowStart = new Date(now - (TENURE_DAYS + WINDOW_DAYS) * DAY_MS);
    // "Came back at least once."
    //
    // Deliberately the SAME boundary as `joinedBefore`, which is what makes it
    // mean anything: everyone in scope signed up 30–37 days ago, so a login
    // inside the last 30 days can only have happened AFTER they joined. Using
    // the window's far edge instead would admit a login from signup day itself
    // and let through exactly the people this is meant to exclude — the ones
    // who registered, never returned, and have no experience to report.
    const activeSince = joinedBefore;

    let sent = 0;
    let failed = 0;

    try {
        const candidates = await User.find({
            type: { $in: ["Nanny", "Parents"] },
            status: "Active",
            email: { $exists: true, $nin: [null, ""] },
            "notifications.email.newsletter": { $ne: false },
            createdAt: { $gte: windowStart, $lte: joinedBefore },
            // Logged in at all, and recently enough to remember us. `$gte` on a
            // date also excludes null, which is what keeps never-logged-in
            // accounts out — a bare `$ne: null` would let them through.
            lastLogin: { $gte: activeSince },
            // Once per account, ever.
            feedbackRequestSentAt: null,
        })
            .select("_id name email")
            .limit(BATCH_LIMIT)
            .lean();

        if (candidates.length === 0) {
            return { sent, failed, total: 0 };
        }

        console.log(`[feedback-request] ${candidates.length} member(s) to ask.`);

        for (const u of candidates) {
            try {
                await sendFeedbackRequestEmail(u.email, u.name);
                // Stamped only on success, so a transient send failure retries
                // on the next run rather than being written off — bounded by
                // the window, which eventually ages them out.
                await User.updateOne(
                    { _id: u._id },
                    { $set: { feedbackRequestSentAt: new Date() } }
                );
                sent++;
            } catch (err) {
                failed++;
                console.error(
                    `[feedback-request] failed for ${u.email}:`,
                    err?.message || err
                );
            }
            if (SEND_GAP_MS > 0) await sleep(SEND_GAP_MS);
        }

        console.log(`[feedback-request] done — sent: ${sent}, failed: ${failed}.`);
        return { sent, failed, total: candidates.length };
    } catch (err) {
        console.error("[feedback-request] run errored:", err?.message || err);
        return { sent, failed, error: true };
    } finally {
        isRunning = false;
    }
};

// Register the cron schedule. Call once at server startup.
export const startFeedbackRequestJob = () => {
    if (!cron.validate(CRON_EXPR)) {
        console.error(
            `[feedback-request] invalid cron expression "${CRON_EXPR}" — job not scheduled.`
        );
        return;
    }
    cron.schedule(CRON_EXPR, () => {
        runFeedbackRequest().catch((err) =>
            console.error("[feedback-request] unhandled error:", err)
        );
    });
    console.log(
        `[feedback-request] scheduled (cron="${CRON_EXPR}", tenure=${TENURE_DAYS}d, window=${WINDOW_DAYS}d).`
    );
};
