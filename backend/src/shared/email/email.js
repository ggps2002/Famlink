import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import User from "../../modules/user/user.model.js";
import nannyProfile from "../../modules/profile/nannyProfile.model.js";
import NannyShare from "../../modules/nannyShare/nannyShare.model.js";
import { signUnsubscribe } from "./unsubscribeToken.js";
import { recordEmail } from "./emailLog.js";
import { enqueueEmail } from "./emailQueue.js";
import {
    EMAIL_FROM,
    FROM_AUTOMATED,
    FROM_FOUNDER,
    REPLY_SUPPORT,
    REPLY_FOUNDER,
} from "./transport.js";

// Base URLs for links/assets used in transactional emails.
// Host the `Automated Emails/images` folder somewhere public and point
// EMAIL_ASSET_BASE at it so the hero images resolve in the email.
const APP_URL = process.env.APP_URL || process.env.CLIENT_URL || "https://www.famlink.care";
const EMAIL_ASSET_BASE = process.env.EMAIL_ASSET_BASE || `${APP_URL}/email-assets`;

// Folder holding the canonical HTML email templates. These files are the single
// source of truth for transactional email markup — edit the .html, not JS.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../../Automated Emails");

/* ─────────────────── classification, for the queue's use ───────────────── */

// Which templates are marketing, and therefore suppressed for an address that
// has unsubscribed. Everything absent from this set is transactional: a reply
// to something the recipient just did, sent whatever their marketing
// preferences say, because withholding an OTP or a password reset over a
// newsletter opt-out would lock someone out of their own account.
const MARKETING_TYPES = new Set([
    "platform_launch_new_account",
    "platform_launch_update",
    "oakland_awareness",
    "weekly_resources",
    "new_users_in_area",
    "reengagement",
    "onboarding_incomplete",
    "feedback",
    "broadcast",
]);

const categoryFor = (type) =>
    MARKETING_TYPES.has(type) ? "marketing" : "transactional";

// Lower is claimed first. The three tiers exist so that a signup at 09:01 on a
// Wednesday is not queued behind the several hundred recipients of the weekly
// digest that started at 09:00 — which is what made "some users don't get the
// welcome email" look random when it was really a function of the clock.
const PRIORITY = { urgent: 0, transactional: 5, bulk: 10 };

// Anything blocking someone mid-flow: they are looking at a screen that is
// waiting for this email.
const URGENT_TYPES = new Set(["otp_verification", "password_reset", "email_confirmation"]);

const priorityFor = (type) => {
    if (URGENT_TYPES.has(type)) return PRIORITY.urgent;
    return MARKETING_TYPES.has(type) ? PRIORITY.bulk : PRIORITY.transactional;
};


// Function to send OTP email
export const sendOtpEmail = (email, otp) => {
    const mailOptions = {
        from: EMAIL_FROM, // sender (must be verified with your email provider)
        to: email,
        subject: "🔐 Verify Your Email - OTP Inside!",
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; text-align: center;">
                <div style="max-width: 500px; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #4A90E2; font-size: 22px; margin-bottom: 10px;">🔒 Email Verification</h2>
                    <p style="font-size: 16px; color: #333;">Hey there! You're one step away from unlocking full access.</p>
                    <p style="font-size: 18px; font-weight: bold; color: #ff6b6b;">Your OTP Code:</p>
                    <p style="font-size: 24px; font-weight: bold; color: #4A90E2; background: #f0f0f0; padding: 10px 20px; border-radius: 8px; display: inline-block;">
                        ${otp}
                    </p>
                    <p style="font-size: 14px; color: #666;">This code expires in 2 minutes. Please do not share it with anyone.</p>
                    <p style="font-size: 12px; color: #999; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
                </div>
            </div>
        `
    };


    // Queued at the top priority: someone is sitting on a verification screen
    // waiting for this, so it must not be stuck behind a digest run.
    //
    // The OTP itself is NOT logged — the queue row holds the body only until it
    // is sent, and the permanent email log stores the subject and never the
    // body. That matters more here than anywhere else in this file: a log row
    // containing a live verification code would turn read access on the admin
    // console into account takeover.
    return enqueueEmail({
        ...mailOptions,
        to: mailOptions.to,
        type: "otp_verification",
        category: "transactional",
        priority: PRIORITY.urgent,
    });
};

// ── Shared template emails (see backend/Automated Emails/) ───────────────────

const firstNameOf = (name) =>
    (name || "there").toString().trim().split(" ")[0] || "there";

// Escape user-provided values interpolated into HTML (names, etc.).
const escapeHtml = (value) =>
    (value === undefined || value === null ? "" : String(value))
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// Read a template from backend/Automated Emails/ once and cache it.
const TEMPLATE_CACHE = new Map();
const loadTemplate = (fileName) => {
    let html = TEMPLATE_CACHE.get(fileName);
    if (html === undefined) {
        html = readFileSync(path.join(TEMPLATES_DIR, fileName), "utf8");
        TEMPLATE_CACHE.set(fileName, html);
    }
    return html;
};

// Render a template: substitute every {{token}} from `values`, then rewrite the
// templates' relative `images/...` hero paths to the hosted EMAIL_ASSET_BASE so
// they resolve in email clients (relative paths don't work in email).
// Escape a string for safe use inside a RegExp.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Render a template:
//
//  1. Strip HTML comments. The templates carry extensive developer notes in
//     their header comment (trigger, sender config, DB query hints). Those are
//     for us, not for recipients — without this they'd ship inside every email's
//     source. Stripping first also prevents a subtle bug: those notes *document*
//     token names like {{ family_preview_section }}, and substitution would
//     otherwise inject the generated markup into the comment as well as the body.
//  2. Substitute every {{ token }} (whitespace inside the braces is tolerated,
//     so both {{first_name}} and {{ first_name }} match).
//  3. Rewrite relative `images/...` asset paths to the hosted EMAIL_ASSET_BASE
//     so they resolve in email clients.
//
// A function replacer is used throughout so a literal `$` inside a value is
// never treated as a RegExp back-reference.
const renderTemplate = (fileName, values) => {
    let html = loadTemplate(fileName).replace(/<!--[\s\S]*?-->/g, "");

    // Two passes, because a substituted value can itself contain tokens.
    //
    // The launch templates inject their whole body through `body_content`, and
    // that body says "Hi {{first_name}}". With a single pass the outcome
    // depends on key order: `first_name` is replaced before `body_content`
    // exists, so the name inside the injected body survives into the sent mail
    // and real recipients get a literal "{{first_name}}".
    //
    // Bounded at two rather than looped to a fixed point: two resolves every
    // real case, and a value that contains its own token cannot spin forever.
    for (let pass = 0; pass < 2; pass += 1) {
        const before = html;
        for (const [token, value] of Object.entries(values)) {
            const re = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, "g");
            html = html.replace(re, () => (value == null ? "" : String(value)));
        }
        if (html === before) break;
    }
    return html
        .split("url('images/").join(`url('${EMAIL_ASSET_BASE}/`)
        .split('src="images/').join(`src="${EMAIL_ASSET_BASE}/`);
};

// Footer links shared by every template. Each points at a route that exists in
// frontend/src/App.jsx. The unsubscribe link is signed with an HMAC of the
// recipient's address so /unsubscribe works with one click and no login, as
// CAN-SPAM requires — see src/modules/unsubscribe/unsubscribe.module.js for the matching verification.
const footerLinks = (email) => ({
    unsubscribe_url: email
        ? `${APP_URL}/unsubscribe?email=${encodeURIComponent(
              email
          )}&token=${signUnsubscribe(email)}`
        : `${APP_URL}/dashboard/setting`,
    privacy_url: `${APP_URL}/terms-and-conditions`,
    // Automated emails point at the system mailbox; founder emails (sent from
    // the campaign app) use ari@famlink.care instead.
    contact_url: "mailto:system@famlink.care",
});

// ── Avatar + family-preview-card helpers ─────────────────────────────────────
// Several templates show contact "cards" (a sender/match card, or a list of
// nearby families). These helpers turn raw user/profile records into the exact
// markup the templates expect. Everything is defensive: any missing field falls
// back to a sensible default and any query error yields an empty section rather
// than a broken email.

const AVATAR_COLORS = ["avatar-lavender", "avatar-mint", "avatar-coral", "avatar-sky"];

// Deterministically pick one of the four avatar tints from a seed (id or name)
// so the same person always gets the same colour.
const pickAvatarColor = (seed) => {
    const s = String(seed || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

// Surnames are stored however the user typed them ("Gabriele muratori"), so a
// raw surname would ship as "The muratori Family".
const titleCase = (s) =>
    String(s || "")
        .trim()
        .replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

const surnameOf = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
};

// "Jane doe" -> "The Doe Family". Falls back gracefully for single-word names.
const familyLabelFrom = (name) => {
    const surname = surnameOf(name);
    if (!surname) return "A FamLink Family";
    return `The ${titleCase(surname)} Family`;
};

// Avatar letter — the surname's initial, so it matches the family label.
const initialOf = (name) => (surnameOf(name).charAt(0) || "F").toUpperCase();

// Where a family is, in words a neighbour would recognise.
//
// Only 8 of 140 families have location.city set, but 136 have a Google-style
// `format_location` ("Jackson St, Hayward, CA 94541, USA"). We parse the
// locality out of it and deliberately NEVER fall back to the raw string: it
// begins with a street address, and these cards show strangers to each other.
const STREET_RE = /\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|ct|court|pl|place|hwy|highway|pkwy|terrace|circle|cir)\.?$/i;

// "Downtown San Jose, San Jose, CA, USA" -> { neighborhood, city }
const parseFormattedAddress = (formatted) => {
    const parts = String(formatted || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 2) return {};
    // The state sits as "CA" or "CA 94541"; the city is just before it.
    const stateIdx = parts.findIndex((p) => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(p));
    if (stateIdx < 1) return {};
    const city = parts[stateIdx - 1];
    if (STREET_RE.test(city) || /^\d/.test(city)) return {};
    // The part before the city is a neighbourhood ("Downtown San Jose") — unless
    // it's a street, which we must not reveal.
    const finer = stateIdx >= 2 ? parts[stateIdx - 2] : "";
    const neighborhood =
        finer && !STREET_RE.test(finer) && !/^\d/.test(finer) ? finer : "";
    return { city, neighborhood };
};

// The most specific place worth printing on a card.
const localityFrom = (user) => {
    const parsed = parseFormattedAddress(user?.location?.format_location);
    return (
        user?.location?.neighborhood ||
        user?.location?.city ||
        parsed.neighborhood ||
        parsed.city ||
        "Nearby"
    );
};

// City only — used to group people into an "area" and to fill {{ city }}.
// Never a neighbourhood, or "3 new families joined Rockridge" would fragment
// one city into several.
export const cityOf = (user) =>
    user?.location?.city ||
    parseFormattedAddress(user?.location?.format_location).city ||
    "";

// Truncate a message body to a short preview for the new-message email.
const previewOf = (text, max = 100) => {
    const s = String(text || "").replace(/\s+/g, " ").trim();
    if (!s) return "You've got a new message";
    return s.length > max ? s.slice(0, max) : s;
};

// A family's share details live in one of two collections, with different
// shapes. Both are live, so the card has to read either:
//
//   nannyprofiles (userId) — current: hasNanny Boolean,
//                            childrenAges [{ label, value, unit }]
//   nannyshares   (user)   — legacy:  hasNanny String ("yes – we already
//                            have a nanny"), childrenAges ["2 yrs"]
//
// Everything below normalises across the two. `value` is stored in YEARS in
// both, even when `unit` is "months".

// One child's age, as a person would write it: "3 yrs", "1 yr", "9 mo".
//
// The stored labels can't be trusted verbatim — the platform writes "1 yrs"
// (wrong plural) and "0.75 yrs" (a 9-month-old) — so we always re-derive from
// the number. `value` is in YEARS in both collections, even when unit is
// "months"; the string form ("2 yrs") is parsed the same way.
const ageLabelOf = (entry) => {
    if (entry == null) return "";
    const raw = String(typeof entry === "string" ? entry : entry.label ?? "").trim();

    let years =
        typeof entry === "object" && entry.value != null ? Number(entry.value) : NaN;
    if (!Number.isFinite(years) && raw) {
        const m = raw.match(/^([\d.]+)\s*(mo|mos|month|months|yr|yrs|year|years)?\b/i);
        if (m) {
            const n = parseFloat(m[1]);
            years = /^mo/i.test(m[2] || "yr") ? n / 12 : n;
        }
    }
    if (!Number.isFinite(years) || years <= 0) return raw; // unparseable → as stored

    // Babies and toddlers are counted in months, as parents actually speak:
    // 0.75 → "9 mo", 1.5 → "18 mo". Exactly 1 stays "1 yr".
    if (years < 1 || (years > 1 && years < 2)) return `${Math.round(years * 12)} mo`;
    const whole = Math.round(years);
    return `${whole} ${whole === 1 ? "yr" : "yrs"}`;
};

// "1 child, 3 yrs" / "2 children, 3 yrs & 13 months". "" when unknown.
const childSummaryFrom = (profile, user) => {
    const ages = profile?.childrenAges;
    if (Array.isArray(ages) && ages.length) {
        const label = ages.length === 1 ? "1 child" : `${ages.length} children`;
        const ageStrs = ages.map(ageLabelOf).filter(Boolean);
        if (ageStrs.length) return `${label}, ${ageStrs.join(" & ")}`;
        return label;
    }
    const num = profile?.numberOfChildren;
    if (num) return Number(num) === 1 ? "1 child" : `${num} children`;
    const raw = user?.noOfChildren;
    const n = typeof raw === "number" ? raw : parseInt(raw, 10);
    if (n && !Number.isNaN(n)) return n === 1 ? "1 child" : `${n} children`;
    return "";
};

// true / false / null — null means "we don't know", and an email must not
// guess: telling a family that already has a nanny they're "Looking for nanny"
// is worse than showing no pill at all.
const hasNannyFrom = (profile) => {
    const v = profile?.hasNanny;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
        if (/^\s*yes/i.test(v)) return true;
        if (/^\s*no\b/i.test(v)) return false;
        return null; // "not sure / open to either"
    }
    return null;
};

// A share is full-time or part-time; there is nothing else. Stored answers
// include four spellings of those two ("Full-time", "Full-time care",
// "full-time care", "Full Time") and five retired types ("After-school care",
// "Summer/Seasonal", "Weekend Nanny Share", "Pickup/Drop-off (Carpool style)",
// "Other"), every one of which is a part-time week.
//
// The same rule as `normalizeShareSchedule` in
// frontend/src/shared/lib/scheduleFormat.js. Duplicated rather than imported —
// the two packages share no code — so change them together: an email pill that
// disagrees with the profile it links to is worse than either wording alone.
const shareTypeLabel = (profile) => {
    const raw = String(profile?.nannyShareType || "").trim();
    if (!raw) return "";
    return /^full[\s-]*time/i.test(raw) ? "Full-time" : "Part-time";
};

// Find up to `limit` other active, complete family profiles near the recipient.
// Prefers a geo ($near) query and falls back to same-city; returns [] on any
// problem (no location, query error, etc.).
const getNearbyFamilies = async (recipient, limit = 3) => {
    try {
        // A recipient is usually a user doc, but email 20 goes to someone who
        // has no account yet — they exist only as an onboardingLeads row with
        // the location they typed into the intake form. What this query needs
        // is a place, not an id, so gate on the location and treat the id as
        // optional.
        if (!recipient?.location) return [];
        const baseFilter = {
            type: "Parents",
            status: "Active",
            nannyProfileCompleted: true,
        };
        // "Don't show me myself" only means something for a recipient who is
        // in this collection. A lead has no _id, and building the clause from a
        // missing one is a way to get a filter that quietly matches nothing.
        if (recipient._id) baseFilter._id = { $ne: recipient._id };
        const coords = recipient?.location?.coordinates;
        let users = [];
        if (Array.isArray(coords) && coords.length === 2) {
            users = await User.find({
                ...baseFilter,
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: coords },
                        $maxDistance: 40000, // ~25 miles
                    },
                },
            })
                .limit(limit)
                .lean();
        }
        const city = recipient?.location?.city;
        if ((!users || users.length === 0) && city) {
            users = await User.find({ ...baseFilter, "location.city": city })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
        }
        return users || [];
    } catch (err) {
        console.error("getNearbyFamilies failed:", err?.message || err);
        return [];
    }
};

// Load each family's share details, whichever collection they live in.
// nannyprofiles is the current one, so it wins when a user somehow has both.
const loadFamilyProfiles = async (userIds) => {
    const byUser = new Map();
    if (!userIds.length) return byUser;
    const [legacy, current] = await Promise.all([
        NannyShare.find({ user: { $in: userIds } })
            .lean()
            .catch((err) => {
                console.error("nannyshares lookup failed:", err?.message || err);
                return [];
            }),
        nannyProfile
            .find({ userId: { $in: userIds } })
            .lean()
            .catch((err) => {
                console.error("nannyprofiles lookup failed:", err?.message || err);
                return [];
            }),
    ]);
    for (const p of legacy) byUser.set(String(p.user), p);
    for (const p of current) byUser.set(String(p.userId), p);
    return byUser;
};

// Render a single family card matching the templates' markup.
const renderFamilyCard = (user, profile, { showLock = false, showNewBadge = false } = {}) => {
    const color = pickAvatarColor(user?._id || user?.name);
    const initial = escapeHtml(initialOf(user?.name));
    const name = escapeHtml(familyLabelFrom(user?.name));
    const hood = escapeHtml(localityFrom(user));
    const kids = escapeHtml(childSummaryFrom(profile, user));
    const meta = kids ? `${hood} &middot; ${kids}` : hood;
    const schedule = escapeHtml(shareTypeLabel(profile));
    const hasNanny = hasNannyFrom(profile);

    const pills = [];
    if (schedule) pills.push(`<span class="pill pill-blue">${schedule}</span>`);
    if (hasNanny !== null) {
        pills.push(
            hasNanny
                ? `<span class="pill pill-green">Has a nanny</span>`
                : `<span class="pill pill-beige">Looking for nanny</span>`
        );
    }
    if (showNewBadge) pills.push(`<span class="new-badge">New</span>`);
    const lock = showLock ? `<div class="family-lock">🔒</div>` : "";

    return `
        <div class="family-card">
          <div class="family-avatar ${color}">${initial}</div>
          <div class="family-info">
            <div class="family-name">${name}</div>
            <div class="family-meta">${meta}</div>
            <div class="family-pills">${pills.join("")}</div>
          </div>${lock}
        </div>`;
};

// Build the full "families near you" section (label + cards + optional note) for
// the {{ family_preview_section }} token. Returns "" when there are no nearby
// families so the surrounding email renders cleanly with nothing missing.
const buildFamilyPreviewSection = async (
    recipient,
    {
        label,
        showLock = false,
        showNote = false,
        showNewBadge = false,
        // The note's wording assumes the reader has an account to complete.
        // Email 20 goes to someone who doesn't have one yet, so it can say what
        // is actually true for them.
        noteText = "Complete your profile to see full details and connect.",
    } = {}
) => {
    // Pull a wider pool than we need: most "completed" families still have no
    // share details on file, and a card with no schedule/children on it is a
    // weak advert. Nearest-first is preserved within each group, so this
    // promotes the richest cards without ever showing a family who is further
    // away when a fully-detailed nearer one exists.
    const pool = await getNearbyFamilies(recipient, 12);
    if (!pool.length) return "";
    const byUser = await loadFamilyProfiles(pool.map((u) => u._id));
    const withProfile = pool.filter((u) => byUser.has(String(u._id)));
    const without = pool.filter((u) => !byUser.has(String(u._id)));
    const users = [...withProfile, ...without].slice(0, 3);

    const cards = users
        .map((u) => renderFamilyCard(u, byUser.get(String(u._id)), { showLock, showNewBadge }))
        .join("\n");
    const note = showNote
        ? `<div class="preview-blur-note">${escapeHtml(noteText)}</div>`
        : "";
    return `
    <div class="preview-section">
      <div class="preview-section-label">${escapeHtml(label || "Families near you")}</div>
      <div class="family-cards">${cards}
      </div>
      ${note}
    </div>`;
};

// The log's stable name for a template, derived from its filename:
// "14_waitlist_confirmation.html" → "waitlist_confirmation".
//
// Derived rather than passed in by each sender, so that adding template 21
// tomorrow logs correctly without its author knowing the log exists. The
// leading number is dropped because it is a filing convention that has already
// been renumbered once, and a log keyed on it would have silently split one
// email type into two.
const emailTypeFromFile = (fileName) =>
    String(fileName || "unknown")
        .replace(/\.html$/i, "")
        .replace(/^\d+_/, "");

/**
 * Render a template and put the result on the queue.
 *
 * Every one of the twenty senders below funnels through here rather than each
 * building its own mailOptions, and that choke point is what carries the
 * properties nobody should have to remember per call site: the message is
 * logged, it is classified transactional or marketing, it is prioritised, and
 * it is durable the moment this returns.
 *
 * This used to open an SMTP conversation and wait for it. It now writes one row
 * and returns — see emailQueue.model.js for why that is the whole fix. The
 * signature is unchanged for every existing caller; `dedupeKey`, `userId`,
 * `priority` and `maxAttempts` are new and optional.
 *
 * The return value is a queue receipt (`{ id, queued, deduped }`), not
 * nodemailer's info object. Nothing downstream reads a delivery result from
 * here any more, because at this point there isn't one to read: acceptance by
 * the mail server is recorded on the row and in the email log by the
 * dispatcher, once it actually happens.
 */
const sendTemplateEmail = async ({
    email,
    subject,
    fileName,
    values,
    from,
    replyTo,
    campaign = null,
    triggeredBy = null,
    userId = null,
    priority,
    dedupeKey = null,
    maxAttempts,
}) => {
    const type = emailTypeFromFile(fileName);

    let html;
    try {
        html = renderTemplate(fileName, { ...footerLinks(email), ...values });
    } catch (error) {
        console.error(`Error rendering email template "${fileName}":`, error);
        // A template that fails to render never reaches the queue, so the
        // dispatcher would never see it. Logged here instead — otherwise a
        // broken template is the one failure mode invisible to the console,
        // and it is the one that silently affects every recipient at once.
        await recordEmail({
            recipient: email,
            type,
            subject,
            status: "failed",
            error: `Template render failed: ${error.message}`,
            campaign,
            triggeredBy,
        });
        throw error;
    }

    return enqueueEmail({
        to: email,
        from: from || FROM_AUTOMATED,
        replyTo: replyTo || REPLY_SUPPORT,
        subject,
        html,
        type,
        category: categoryFor(type),
        priority: priority ?? priorityFor(type),
        campaign,
        triggeredBy,
        userId,
        dedupeKey,
        maxAttempts,
    });
};

// 01. Welcome — after sign up / email verification.
// `recipient` (the full user doc, optional) powers the "families near you" cards.
//
// Sent from two places — account creation, and again on OTP verification —
// because either can be the moment someone first has a usable account. Both
// call sites are correct and neither should be removed, so the duplicate is
// resolved here instead: keyed on the user id, the second enqueue collides with
// the unique index and returns the first row rather than sending a second copy.
//
// That duplicate was not cosmetic. Two identical messages minutes apart is what
// a bulk classifier reads as a misconfigured sender, and the cost lands on
// every *other* message to that domain.
// `dedupe: false` is for the admin test-email endpoint, which mails an arbitrary
// address using the caller's own record for the preview cards. Left keyed on the
// caller, one admin could send one test email ever.
export const sendWelcomeEmail = async (email, name, recipient, { dedupe = true } = {}) =>
    sendTemplateEmail({
        email,
        userId: recipient?._id || null,
        dedupeKey: dedupe && recipient?._id ? `welcome:${recipient._id}` : null,
        subject: "Welcome to FamLink! 🎉",
        fileName: "01_welcome.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            family_preview_section: await buildFamilyPreviewSection(recipient, {
                label: "🏠 Families near you already on FamLink",
                showLock: true,
                showNote: true,
            }),
        },
    });

// 02. Complete your profile (reminder — sent by the cron job in
// src/shared/jobs/completeProfileReminder.js). `recipient` powers the cards.
export const sendCompleteProfileEmail = async (email, name, recipient) =>
    sendTemplateEmail({
        email,
        subject: "You're almost there — finish your profile",
        fileName: "02_complete_profile.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            family_preview_section: await buildFamilyPreviewSection(recipient, {
                label: "🏠 Families near you waiting to connect",
                showLock: true,
                showNote: true,
            }),
        },
    });

// 03. Subscription confirmed (FamLink Plus).
export const sendSubscriptionConfirmedEmail = (email, name) =>
    sendTemplateEmail({
        email,
        subject: "You're all set! Your FamLink Plus membership is active 🎉",
        fileName: "03_famlink_plus.html",
        values: { first_name: escapeHtml(firstNameOf(name)) },
    });

// 04. New match request received. `sender` = { name, location, summary, id }
// describes the person who sent the request (shown on the sender card).
export const sendMatchRequestEmail = (email, name, sender = {}) =>
    sendTemplateEmail({
        email,
        subject: "Someone wants to connect with you on FamLink 👋",
        fileName: "04_match_request.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            sender_name: escapeHtml(sender.name || "A FamLink member"),
            sender_location: escapeHtml(sender.location || "Nearby"),
            sender_summary: escapeHtml(
                sender.summary || "Exploring a nanny share on FamLink."
            ),
            sender_avatar_initial: escapeHtml(initialOf(sender.name)),
            sender_avatar_color: pickAvatarColor(sender.id || sender.name),
            request_url: `${APP_URL}/dashboard/requests`,
        },
    });

// 05. Match request accepted ("It's a match"). `match` = { name, location,
// summary, id } describes the person who accepted (shown on the match card).
export const sendMatchAcceptedEmail = (email, name, matchName, match = {}) => {
    const displayMatch = matchName || match.name || "Someone";
    return sendTemplateEmail({
        email,
        subject: `It's a match! 🎉 ${displayMatch} accepted your request`,
        fileName: "05_match_accepted.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            match_name: escapeHtml(displayMatch),
            match_location: escapeHtml(match.location || "Nearby"),
            match_summary: escapeHtml(
                match.summary || "You're now connected on FamLink."
            ),
            match_avatar_initial: escapeHtml(initialOf(displayMatch)),
            match_avatar_color: pickAvatarColor(match.id || displayMatch),
            message_url: `${APP_URL}/dashboard/message`,
        },
    });
};

// 06. New message received (recipient offline). `messagePreview` is the raw
// message body; it's truncated to ~100 chars for the preview card.
// Sends are batched over a 15-minute window (see messageDigest.js), so
// `sender.moreCount` is how many further messages arrived in that window — the
// card shows the most recent one and the subject reflects the total.
export const sendNewMessageEmail = (email, name, senderName, messagePreview = "", sender = {}) => {
    const more = Number(sender.moreCount) || 0;
    return sendTemplateEmail({
        email,
        subject:
            more > 0
                ? `You have ${more + 1} new messages on FamLink 💬`
                : `${senderName || "Someone"} sent you a message on FamLink 💬`,
        fileName: "06_new_message.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            sender_name: escapeHtml(senderName || "Someone"),
            sender_avatar_initial: escapeHtml(initialOf(senderName)),
            sender_avatar_color: pickAvatarColor(sender.id || senderName),
            message_preview: escapeHtml(previewOf(messagePreview)),
            reply_url: `${APP_URL}/dashboard/message`,
        },
    });
};

// Templates 07 & 08 (platform-launch founder broadcasts) are sent from the
// email campaign app, not from here.

// 09. Oakland awareness / city campaign (no per-user variables).
//
// Sent from the admin console's waitlist screen — POST /admin/waitlist/awareness
// — not on a schedule: which city to push, and when, is a decision rather than a
// condition. `campaign` and `triggeredBy` are threaded through so the send is
// attributable in the email log like every other campaign send.
export const sendOaklandAwarenessEmail = (email, { campaign = null, triggeredBy = null } = {}) =>
    sendTemplateEmail({
        email,
        subject: "The childcare option most Oakland families overlook",
        fileName: "09_oakland_awareness.html",
        values: {},
        campaign,
        triggeredBy,
    });

// 10. Password reset. `resetUrl` is the one-time reset-link (expires 1h).
export const sendPasswordResetEmail = (email, name, resetUrl, requestTime) =>
    sendTemplateEmail({
        email,
        subject: "Reset your FamLink password",
        fileName: "10_password_reset.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            reset_url: resetUrl,
            request_time: escapeHtml(
                requestTime ||
                    new Date().toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                    })
            ),
        },
    });

// 11. Profile updated confirmation. `updatedFields` is a human-readable list.
export const sendProfileUpdatedEmail = (email, name, updatedFields) =>
    sendTemplateEmail({
        email,
        subject: "Your FamLink profile has been updated",
        fileName: "11_profile_updated.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            updated_fields: escapeHtml(updatedFields || "your profile details"),
            profile_url: `${APP_URL}/dashboard/edit`,
        },
    });

// Render 1–3 resource cards for the weekly digest. The template no longer has
// fixed _1/_2/_3 slots, so a light week (2 resources, or even 1) renders exactly
// that many cards instead of leaving empty ones behind.
const renderResourceCards = (resources) =>
    resources
        .map(
            (r) => `
      <a href="${r.url}" class="resource-card">
        <div class="resource-tag">${escapeHtml(r.tag || "Guide")}</div>
        <div class="resource-title">${escapeHtml(r.title || "")}</div>
        <div class="resource-desc">${escapeHtml(r.desc || "")}</div>
        <div class="resource-link">Read more →</div>
      </a>`
        )
        .join("\n");

// 12. Weekly nanny-share resources digest. `resources` is an array of 1–3
// { title, desc, url, tag } objects, newest first — see
// src/shared/jobs/weeklyResources.js, which pulls them from the blogs collection.
export const sendWeeklyResourcesEmail = (email, name, { weekOf, resources = [] } = {}) => {
    const list = resources.slice(0, 3);
    const lead = list[0]?.title;
    return sendTemplateEmail({
        email,
        subject: lead
            ? `This week on FamLink: ${lead}${list.length > 1 ? " + more" : ""}`
            : "This week's nanny share resources from FamLink",
        fileName: "12_weekly_resources.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            week_of: escapeHtml(weekOf || ""),
            resource_cards: renderResourceCards(list),
        },
    });
};

// 13. New users in the recipient's area (weekly digest). `recipient` powers the
// new-user cards. Call from a weekly cron when ready.
export const sendNewUsersInAreaEmail = async (email, name, { city, newCount, recipient } = {}) =>
    sendTemplateEmail({
        email,
        subject: "New families just joined FamLink in your area 👋",
        fileName: "13_new_users_in_area.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            city: escapeHtml(city || "your area"),
            new_count: escapeHtml(String(newCount ?? "")),
            family_word: Number(newCount) === 1 ? "family" : "families",
            family_preview_section: await buildFamilyPreviewSection(recipient, {
                label: `🆕 New this week in ${city || "your area"}`,
                showNewBadge: true,
            }),
        },
    });

// 14. Waitlist confirmation — sent the moment someone joins the waitlist from
// any of the frontend's waitlist forms (see src/modules/waitlist/waitlist.module.js). Written in the
// founder's voice, so it goes out with her Reply-To; see FROM_FOUNDER above.
//
// `name` and `city` are both optional: two of the four waitlist forms only ask
// for an email address, and a city is only known when the visitor picked a
// place from the Google autocomplete.
export const sendWaitlistConfirmationEmail = (email, name, city) =>
    sendTemplateEmail({
        email,
        subject: "You're on the FamLink waitlist 🎉",
        fileName: "14_waitlist_confirmation.html",
        values: {
            // "Hi there," rather than a stranded "Hi ," when no name was asked for.
            first_name: escapeHtml(firstNameOf(name)) || "there",
            city: escapeHtml(city || "your area"),
            // Founder email — replies and the footer "Contact Us" go to her
            // mailbox, not the system mailbox footerLinks() defaults to.
            contact_url: `mailto:${REPLY_FOUNDER}`,
        },
        // Founder email — sent from her mailbox so the reply this email
        // invites actually reaches her. That mailbox is monitored.
        from: FROM_FOUNDER,
        replyTo: REPLY_FOUNDER,
    });

// 15. Feedback request. A founder-voice ask, sent once per member, to people
// who have been around long enough to have an opinion worth asking for.
//
// The README listed this as a campaign-app broadcast. That does not survive
// contact with the trigger: "30 days on the platform, and only if they are
// actually using it" is a query over `createdAt`, `lastLogin` and a
// once-ever guard, none of which an external campaign tool can see. Sending it
// from here also means it is logged like every other send and honours the same
// unsubscribe. See src/shared/jobs/feedbackRequest.js for who qualifies.
export const sendFeedbackRequestEmail = (email, name) =>
    sendTemplateEmail({
        email,
        subject: "Quick question about your FamLink experience",
        fileName: "15_feedback.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)) || "there",
            // Founder email — replies and the footer "Contact Us" go to her
            // mailbox, not the system mailbox footerLinks() defaults to.
            contact_url: `mailto:${REPLY_FOUNDER}`,
        },
        // Founder email — sent from her mailbox so the reply this email
        // invites actually reaches her. That mailbox is monitored.
        from: FROM_FOUNDER,
        replyTo: REPLY_FOUNDER,
    });

// 21. Feedback received — the acknowledgement for email 15's ask, and for
// anyone who finds the feedback form on their own.
//
// Sent immediately on submit, and NOT gated on any notification preference:
// it is a receipt for something the person just did, in the same class as a
// password reset. Somebody who writes to you and hears nothing back assumes it
// went nowhere, which is the opposite of what asking for feedback is for.
//
// Their own words are echoed back so the receipt is real rather than generic.
// That text is submitted through a PUBLIC form, so it is escaped — it is the
// one value in this file that an untrusted stranger controls, and it is going
// straight into an HTML document.
export const sendFeedbackReceivedEmail = (email, name, { category, message } = {}) => {
    // The Feedback page and the Contact page post to the same endpoint;
    // Contact sends "Support". Calling somebody's support request "your
    // feedback" reads as though nobody looked at it, so the noun follows the
    // category through both the subject and the template.
    const isSupport = String(category || "").trim().toLowerCase() === "support";
    const noun = isSupport ? "message" : "feedback";

    return sendTemplateEmail({
        email,
        subject: `Thank you — we've got your ${noun}`,
        fileName: "21_feedback_received.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)) || "there",
            submission_noun: noun,
            feedback_category: escapeHtml(category || "Feedback"),
            // Truncated: the quote card is a reminder of what they said, not a
            // reproduction of an essay. The full text is in the admin queue.
            feedback_message: escapeHtml(
                String(message || "").trim().slice(0, 600) +
                    (String(message || "").trim().length > 600 ? "…" : "")
            ),
            // Founder email — replies and the footer "Contact Us" go to her
            // mailbox, not the system mailbox footerLinks() defaults to.
            contact_url: `mailto:${REPLY_FOUNDER}`,
        },
        // Founder email — sent from her mailbox so the reply this email
        // invites actually reaches her. That mailbox is monitored.
        from: FROM_FOUNDER,
        replyTo: REPLY_FOUNDER,
    });
};

// 16. Re-engagement / win-back (email 16). Founder-voice nudge to users who
// have a complete profile but haven't been active for ~30 days. `recipient`
// (the full user doc) powers the "families near you" cards and {{ city }}.
// Sent from the founder mailbox like the waitlist email; scheduled by
// src/shared/jobs/reengagementReminder.js.
export const sendReengagementEmail = async (email, name, { city, recipient } = {}) => {
    const place = city || "your area";
    return sendTemplateEmail({
        email,
        // Subject is plain text (not HTML), so the first name is used raw —
        // escaping here would turn an "&" in a name into "&amp;".
        subject: `Still looking for a nanny share, ${firstNameOf(name)}?`,
        fileName: "16_reengagement.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            city: escapeHtml(place),
            family_preview_section: await buildFamilyPreviewSection(recipient, {
                label: `Families in ${place}`,
            }),
            // Founder email — replies and the footer "Contact Us" go to her
            // mailbox, not the system mailbox footerLinks() defaults to.
            contact_url: `mailto:${REPLY_FOUNDER}`,
        },
        // Founder email — sent from her mailbox so the reply this email
        // invites actually reaches her. That mailbox is monitored.
        from: FROM_FOUNDER,
        replyTo: REPLY_FOUNDER,
    });
};

// 18. Resource Center download — sent when a top-of-funnel visitor requests a
// free guide/template from the Resource Center (Category 4.2). Delivers the
// download link and nudges them toward finding a match. Automated voice.
// 07/08. "FamLink is live in your area" — the launch announcement, sent from
// the admin console's waitlist screen to everyone in a city who consented.
//
// The README lists templates 07 and 08 as founder broadcasts sent from the
// campaign app rather than from here. That was true while launching a city was
// a one-off the founder did by hand. It stops being true the moment the console
// has a "notify this city" button: the send has to be keyed on the waitlist's
// own consent flag and stamp `launchNotifiedAt`, and neither of those is
// reachable from an external campaign tool. So both templates get a sender.
//
// `hasAccount` picks between them — 07 asks a stranger to create an account, 08
// tells an existing member their area is open. Sending the wrong one is the
// difference between "welcome" and "please sign up" landing in the inbox of
// someone who signed up months ago.
export const sendPlatformLaunchEmail = (
    email,
    name,
    { hasAccount = false, campaign = null, triggeredBy = null } = {}
) =>
    sendTemplateEmail({
        email,
        subject: hasAccount
            ? "FamLink is now live in your area 🎉"
            : "FamLink just launched near you — come join 🎉",
        fileName: hasAccount
            ? "08_platform_launch_update.html"
            : "07_platform_launch_new_account.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            hero_content: renderHero(heroFor(null, hasAccount), false),
            cta_content: renderCta(ctaFor(null, hasAccount), false),
            body_content: hasAccount ? LAUNCH_BODY_UPDATE : LAUNCH_BODY_NEW_ACCOUNT,
        },
        // Founder voice, so replies reach her rather than the system mailbox —
        // matching how the waitlist confirmation (14) is already sent.
        from: FROM_FOUNDER,
        replyTo: REPLY_FOUNDER,
        campaign,
        triggeredBy,
    });

/**
 * The launch announcement, written by an admin for one city.
 *
 * Wraps the admin's own body in template 07's shell so it carries the same
 * header, footer and one-click unsubscribe link as every other email — CAN-SPAM
 * requires that link, and an admin composing copy in a textarea will not
 * remember to add it.
 *
 * Falls back to the stock templates when a city has no draft, so this is purely
 * additive: `sendPlatformLaunchEmail` still behaves exactly as it did.
 */
/* ─────────────────── launch announcement: the stock copy ──────────────────
 *
 * Lifted verbatim out of templates 07 and 08, which now carry a
 * `{{body_content}}` slot where this used to sit.
 *
 * Moving it here is what makes the launch email editable per city: the shell —
 * header, hero, call-to-action, signature, footer — stays in the template and
 * is identical for everyone, while the paragraphs in the middle can be replaced
 * with copy an admin wrote for one city. A city with no draft gets exactly the
 * bytes below, so nothing about the default send changed.
 */
const LAUNCH_BODY_NEW_ACCOUNT = `
    <p>Hi {{first_name}},</p>

    <p>I have some exciting news — and one small ask.</p>

    <p><strong>FamLink is back, and it's been completely rebuilt from the ground up.</strong></p>

    <p>Not a refresh. Not a redesign. A brand new platform — built specifically around one thing: <strong>making nanny shares simple.</strong> From finding a compatible family, to connecting with a caregiver together, to getting your share off the ground without the chaos of Facebook groups and spreadsheets.</p>

    <div class="highlight-box">
      Because the platform is entirely new, <strong>your previous account won't carry over automatically.</strong> You'll need to create a fresh one — it only takes about two minutes.
    </div>

    <p>I know that's a small inconvenience, and I'm sorry for it. But I think once you see what we've built, you'll understand why we started fresh.</p>

    <p>I'd love to have you back.</p>

    <hr class="divider">
  `;

const LAUNCH_BODY_UPDATE = `
    <p>Hi {{first_name}},</p>

    <p>Something I've been working on for a long time is finally ready — and I wanted you to hear it from me first.</p>

    <p><strong>FamLink just launched a completely redesigned platform.</strong></p>

    <p>We rebuilt everything specifically around the way nanny shares actually work — from finding a compatible family, to connecting with a caregiver together, to getting your share off the ground. No more piecing it together across group chats and spreadsheets.</p>

    <p>Log in with your existing email and take a look around. If anything looks off or you have trouble accessing your account, just reply to this email — I'll take care of it personally.</p>

    <hr class="divider">
  `;

/* ────────────────── launch announcement: the hero heading ─────────────────
 *
 * The band above the message: an eyebrow chip, the headline, and a subtitle.
 * Lifted out of templates 07 and 08, which now carry a `{{hero_content}}` slot.
 *
 * Stored and edited as THREE PLAIN STRINGS, not as HTML. The band's appearance
 * comes entirely from `.hero-eyebrow`, `.hero-band h1` and `.hero-sub` — and
 * class attributes do not survive the sanitiser. Letting an admin write markup
 * here would mean either weakening that filter or watching the headline lose
 * its styling on save. Text in, fixed structure around it, styling untouched.
 */
const DEFAULT_HERO = {
    guest: {
        eyebrow: `🚀 We're back`,
        headline: `FamLink just launched a brand new platform.`,
        sub: `And I wanted you to hear it from me first.`,
    },
    member: {
        eyebrow: `🎉 Big update`,
        headline: `FamLink just got a whole lot better.`,
        sub: `Same mission. A completely new experience.`,
    },
};

/* The hero band's inner markup. `editable` adds anchors the admin console
 * attaches to; they are absent from anything actually sent, so a delivered
 * email is byte-for-byte what it was before this became editable. */
const renderHero = (hero, editable) => {
    const id = (name) => (editable ? ` id="famlink-editable-${name}"` : "");
    // Indentation reproduced exactly, including the leading newline and the
    // trailing indent before the band's closing tag. A delivered email has to
    // stay byte-for-byte what it was before the hero became editable.
    return (
        `\n    <div class="hero-eyebrow"${id("eyebrow")}>${escapeHtml(hero.eyebrow)}</div>\n` +
        `    <h1${id("headline")}>${escapeHtml(hero.headline)}</h1>\n` +
        `    <div class="hero-sub"${id("sub")}>${escapeHtml(hero.sub)}</div>\n  `
    );
};

/* A saved draft's hero, falling back per field so a half-filled draft still
 * renders a complete band rather than an empty chip above a missing headline. */
const heroFor = (draft, hasAccount) => {
    const stock = hasAccount ? DEFAULT_HERO.member : DEFAULT_HERO.guest;
    return {
        eyebrow: draft?.heroEyebrow || stock.eyebrow,
        headline: draft?.heroHeadline || stock.headline,
        sub: draft?.heroSub || stock.sub,
    };
};

/* ─────────────── launch announcement: the call-to-action ──────────────────
 *
 * The button and the small note under it. Editable as TEXT only — the
 * destination stays fixed, because it is what distinguishes the two audiences:
 * someone without an account is sent to sign-up, an existing member to the
 * site. Letting an admin retarget it is how a long-standing member ends up
 * being asked to register again.
 */
const DEFAULT_CTA = {
    guest: { href: `https://www.famlink.care/joinNow`, label: `Create My New Account`, note: `Takes about 2 minutes` },
    member: { href: `https://www.famlink.care`, label: `See the New FamLink`, note: `` },
};

const renderCta = (cta, editable) => {
    const id = (name) => (editable ? ` id="famlink-editable-${name}"` : "");
    const note = cta.note
        ? `\n    <span class="cta-note"${id("ctanote")}>${escapeHtml(cta.note)}</span>`
        : "";
    return (
        `\n    <a href="${cta.href}" class="cta-btn"${id("ctalabel")}>${escapeHtml(cta.label)}</a>` +
        note +
        `\n  `
    );
};

const ctaFor = (draft, hasAccount) => {
    const stock = hasAccount ? DEFAULT_CTA.member : DEFAULT_CTA.guest;
    return {
        // Never taken from the draft: see above.
        href: stock.href,
        label: draft?.ctaLabel || stock.label,
        // An empty stock note stays empty unless the admin writes one, so
        // template 08 doesn't grow a note it never had.
        note: draft?.ctaNote || stock.note,
    };
};

export const sendCustomLaunchEmail = (
    email,
    name,
    { subject, bodyHtml, hero, hasAccount = false, campaign = null, triggeredBy = null } = {}
) =>
    sendTemplateEmail({
        email,
        subject,
        // The shell is chosen by audience even for a custom body, because the
        // two templates' calls-to-action differ: one links to sign-up, the
        // other to the dashboard.
        fileName: hasAccount
            ? "08_platform_launch_update.html"
            : "07_platform_launch_new_account.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            hero_content: renderHero(heroFor(hero, hasAccount), false),
            cta_content: renderCta(ctaFor(hero, hasAccount), false),
            // The admin's HTML, already sanitised when the draft was saved.
            // Falls back to the stock copy so an empty draft still sends
            // something coherent rather than a header above a footer.
            body_content:
                bodyHtml || (hasAccount ? LAUNCH_BODY_UPDATE : LAUNCH_BODY_NEW_ACCOUNT),
        },
        from: FROM_FOUNDER,
        replyTo: REPLY_FOUNDER,
        campaign,
        triggeredBy,
    });

/**
 * The launch email exactly as a recipient would receive it — header, hero,
 * call-to-action, signature, footer and all — without sending anything.
 *
 * Goes through the same `renderTemplate` + `footerLinks` path as a real send
 * rather than reconstructing the shell in the console. A preview assembled
 * separately is a preview of a different email: it drifts the first time a
 * template changes, and the one thing this has to be is trustworthy, because
 * what it is previewing cannot be recalled.
 */
export const renderLaunchEmailPreview = ({
    name = "Ada",
    // A real-looking address so the footer's signed unsubscribe link renders at
    // its true length. It is never mailed.
    email = "preview@famlink.care",
    bodyHtml = "",
    hero = null,
    hasAccount = false,
    // Wraps the message region in a marked container so the console can make
    // exactly that part editable inside the rendered email — the admin types on
    // the real thing, with the real header and footer around it, and everything
    // outside the marker stays untouchable.
    editable = false,
} = {}) => {
    const body = bodyHtml || (hasAccount ? LAUNCH_BODY_UPDATE : LAUNCH_BODY_NEW_ACCOUNT);

    return renderTemplate(
        hasAccount ? "08_platform_launch_update.html" : "07_platform_launch_new_account.html",
        {
            ...footerLinks(email),
            first_name: escapeHtml(firstNameOf(name)),
            hero_content: renderHero(heroFor(hero, hasAccount), editable),
            cta_content: renderCta(ctaFor(hero, hasAccount), editable),
            body_content: editable
                ? `<div id="famlink-editable-body">${body}</div>`
                : body,
        }
    );
};

export const sendResourceDownloadEmail = (email, name, { resourceTitle, downloadUrl } = {}) =>
    sendTemplateEmail({
        email,
        subject: `Your download: ${resourceTitle || "your FamLink resource"}`,
        fileName: "18_resource_download.html",
        values: {
            // Falls back to "there" — the capture form only requires an email.
            first_name: escapeHtml(firstNameOf(name)) || "there",
            resource_title: escapeHtml(resourceTitle || "your resource"),
            download_url: downloadUrl || APP_URL,
            find_share_url: `${APP_URL}/find-nanny-share`,
        },
    });

// Template 15 (feedback) is a founder broadcast — sent from the email campaign
// app, not from here.

// 17. Account deactivated / suspended. Keep `reason` vague for admin actions.
export const sendAccountDeactivatedEmail = (email, name, reason) =>
    sendTemplateEmail({
        email,
        subject: "Your FamLink account has been deactivated",
        fileName: "17_account_deactivated.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            reason: escapeHtml(reason || "a change to your account status"),
            // A deactivated user can't reach /dashboard, and this is an
            // automated email — so the appeal goes to the system mailbox.
            appeal_url: "mailto:system@famlink.care",
        },
    });

// 19. Referral reward — a friend signed up with this caregiver's code, so
// they've earned another month of free matching. `monthsEarned` is the lifetime
// referral count (not months remaining); `matchingUntil` is the new expiry.
export const sendReferralRewardEmail = (
    email,
    name,
    { friendName, monthsEarned = 1, matchingUntil } = {}
) => {
    const until = matchingUntil ? new Date(matchingUntil) : null;
    const friend = friendName || "Your friend";
    return sendTemplateEmail({
        email,
        subject: `${friend} joined — you've earned a free month 🎉`,
        fileName: "19_referral_reward.html",
        values: {
            first_name: escapeHtml(firstNameOf(name)),
            friend_name: escapeHtml(firstNameOf(friend)),
            matching_until: until
                ? until.toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                  })
                : "next month",
            referral_summary:
                monthsEarned === 1
                    ? "That's your first referral — thank you!"
                    : `${monthsEarned} friends have joined through your link.`,
            referral_url: `${APP_URL}/dashboard/setting?option=Refer%20a%20Friend`,
        },
    });
};

// Where to send someone back to so they land in the questionnaire they
// abandoned rather than at the top of the funnel. The record id is the `:id`
// segment of the questionnaire routes in frontend/src/App.jsx, and each intake
// form leads to a different one. No id (or an unrecognised source) falls back
// to the public entry page, which still works — they just re-answer.
const RESUME_PATHS = {
    "family-match": (id) => `/find-nanny-share/family/${id}`,
    "caregiver-job": (id) =>
        `/caregiver/nanny-share/looking-for-nanny-share-job/${id}`,
    "caregiver-share": (id) =>
        `/caregiver/nanny-share/looking-for-another-family/${id}`,
};

const resumeUrlFor = (source, sheetId) => {
    const build = RESUME_PATHS[source];
    if (!build || !sheetId) return `${APP_URL}/find-nanny-share`;
    return `${APP_URL}${build(encodeURIComponent(sheetId))}`;
};

// 20. Onboarding started, account never created. Goes to someone who answered
// the intake questions and stopped before signing up — see
// src/shared/jobs/onboardingNudge.js, which sends it a few hours later and only
// while the address still has no account.
//
// `recipient` here is NOT a user doc: it's the onboardingLeads row, which
// carries the location they typed into the form. That's all the family cards
// need, and it's why getNearbyFamilies() gates on a location rather than an id.
//
// Founder-voice, like the other pre-account email (14 waitlist) — this is a
// personal nudge, and the reply-to has to reach someone who can unblock them.
export const sendOnboardingIncompleteEmail = async (
    email,
    name,
    { city, recipient, source, sheetId } = {}
) => {
    const place = city || "your area";
    return sendTemplateEmail({
        email,
        // Plain text, not HTML — escaping here would turn an "&" in a name into
        // "&amp;" in the subject line.
        subject: `You're one step away, ${firstNameOf(name)}`,
        fileName: "20_onboarding_incomplete.html",
        values: {
            // The caregiver intake form asks for a name, the family one asks
            // for name and email, and neither guarantees it — fall back to
            // "there" rather than stranding a "Hi ,".
            first_name: escapeHtml(firstNameOf(name)) || "there",
            city: escapeHtml(place),
            family_preview_section: await buildFamilyPreviewSection(recipient, {
                label: `Families near ${place}`,
                showLock: true,
                showNote: true,
                noteText:
                    "Finish creating your account to see full details and connect.",
            }),
            resume_url: resumeUrlFor(source, sheetId),
            // Founder email — replies and the footer "Contact Us" go to her
            // mailbox, not the system mailbox footerLinks() defaults to.
            contact_url: `mailto:${REPLY_FOUNDER}`,
        },
        // Founder email — sent from her mailbox so the reply this email
        // invites actually reaches her. That mailbox is monitored.
        from: FROM_FOUNDER,
        replyTo: REPLY_FOUNDER,
    });
};

// The ad-hoc senders below take a subject and a blob of HTML rather than a
// template, so there is no filename to derive a log type from. They take an
// explicit `type` instead, defaulted so existing callers keep working — the
// admin-notification and broadcast paths pass a real one.
export const sendEmail = (email, subject, text, type = "adhoc") => {
    const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject,
        html: text,
    };

    // Returns a promise now, but callers that ignore it still behave correctly:
    // the row is written or it is not, and nothing further is awaited. The
    // difference from the old fire-and-forget is that "written" is a durable
    // fact rather than a hope about a socket nobody is watching.
    return enqueueEmail({
        ...mailOptions,
        type,
        category: categoryFor(type),
        priority: priorityFor(type),
    }).catch((error) => {
        console.error("Failed to queue email:", error?.message || error);
        return { id: null, queued: false, deduped: false };
    });
};

export const sendAutoEmail = async (from, email, subject, text, type = "adhoc") => {
    const mailOptions = {
        from: from || EMAIL_FROM,
        to: email,
        subject,
        html: text,
    };

    return enqueueEmail({
        ...mailOptions,
        type,
        category: categoryFor(type),
        priority: priorityFor(type),
    });
};

export const sendEmailConfirmation = (email, subject, text) => {
    const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject,
        html: text,
    };

    return enqueueEmail({
        ...mailOptions,
        type: "email_confirmation",
        category: "transactional",
        priority: PRIORITY.urgent,
    }).catch((error) => {
        console.error("Failed to queue confirmation email:", error?.message || error);
        return { id: null, queued: false, deduped: false };
    });
};

/**
 * Enqueue a broadcast.
 *
 * The batching and the inter-batch sleep are gone, and their absence is the
 * point. They existed to pace SMTP submission from inside the request that
 * triggered the run, which meant a launch announcement to 400 people held a
 * request open for ten minutes and lost everything still unsent if it was
 * interrupted. Pacing is the dispatcher's job now, so this writes 400 rows and
 * returns in well under a second.
 *
 * `campaign` groups the whole run under one key, so the admin console can
 * report a broadcast as a single job rather than as several hundred unrelated
 * rows.
 *
 * The counts mean something different from before, and the field names say so:
 * `queued` is a promise that these will be delivered, where `successCount`
 * claimed they already had been. Delivery is reported against the campaign in
 * the email log once the dispatcher has worked through them.
 */
export const sendWithLimit = async (
    emails,
    subject,
    html,
    // Kept in the signature because callers pass them positionally. Both are
    // now the dispatcher's concern; accepting and ignoring them is less
    // disruptive than changing every call site in this refactor.
    _batchSize,
    _delayMs,
    { type = "broadcast", campaign = null, triggeredBy = null } = {}
) => {
    let queued = 0;
    let rejected = 0;

    for (const email of emails) {
        try {
            await enqueueEmail({
                to: email,
                from: EMAIL_FROM,
                subject,
                html,
                type,
                category: categoryFor(type),
                // Never ahead of a password reset or a match notification.
                priority: PRIORITY.bulk,
                campaign,
                triggeredBy,
            });
            queued++;
        } catch (error) {
            // A row that could not even be written — a malformed address, a
            // database error. Nothing will retry it, so it is counted and
            // reported rather than lost in a Promise.allSettled summary.
            rejected++;
            console.error(`Failed to queue broadcast to ${email}:`, error?.message || error);
        }
    }

    console.log(`✅ Broadcast queued: ${queued}, rejected: ${rejected} (campaign: ${campaign || "none"})`);
    return { queued, rejected, total: emails.length, successCount: queued, failCount: rejected };
};
