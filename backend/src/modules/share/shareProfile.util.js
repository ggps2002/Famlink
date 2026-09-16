import crypto from "node:crypto";
import nannyProfile from "../profile/nannyProfile.model.js";
import { resolvePublicBaseUrl } from "../../shared/utils/publicUrl.js";

// Public "Share Profile" links.
//
// Every member — family or caregiver, looking or already paired — can publish a
// privacy-safe version of their nanny share profile at /share/<token>. The point
// is that people already hunt for shares in Facebook groups, Nextdoor and
// neighborhood threads; rather than making them write that post themselves,
// FamLink generates it, presents it as an available opportunity, and gives the
// reader a way in.
//
// Two rules shape everything below:
//
//   1. The page must never identify the owner. Name, photo and initials are
//      stripped here, on the server, so a curious reader can't pull them out of
//      a network response the way they could if the client did the redaction.
//   2. The link must keep working. The token is minted once and never rotated —
//      a post in a Facebook group from three weeks ago still has to resolve.

// A shared link is opened by a stranger on another machine, so it resolves
// through the public-origin filter rather than FRONTEND_URL — see publicUrl.js
// for why a localhost value here is invisible locally and fatal in a Facebook
// post.
const CLIENT_URL = resolvePublicBaseUrl("Share links");

// URL-safe, unambiguous, and long enough that the space can't be walked: these
// tokens are the only thing standing between a stranger and a profile, so unlike
// the referral code (which is read aloud and retyped) legibility doesn't matter
// and entropy does.
const TOKEN_BYTES = 12; // 96 bits → 16 base64url chars

const generateShareToken = () =>
  crypto.randomBytes(TOKEN_BYTES).toString("base64url");

// Allocate a token no other profile holds. The unique index is the real arbiter
// — a findOne check alone would race two concurrent requests onto one token —
// so this retries on the duplicate-key error rather than trusting a lookup.
//
// `source` records who minted it: "member" when the owner asked for their own
// link, "admin" when the console generated one for them. It goes into the SAME
// $set as the token rather than a follow-up write, so it is impossible to end
// up with a token whose origin is unrecorded — and so the losing side of a race
// (whose filter no longer matches) cannot overwrite the winner's provenance
// with its own.
export const assignShareToken = async (
  profileId,
  { attempts = 5, source = "member", createdBy = null } = {}
) => {
  for (let i = 0; i < attempts; i++) {
    const token = generateShareToken();
    try {
      const updated = await nannyProfile.findOneAndUpdate(
        { _id: profileId, shareToken: { $in: [null, ""] } },
        {
          $set: {
            shareToken: token,
            shareTokenCreatedAt: new Date(),
            shareTokenSource: source === "admin" ? "admin" : "member",
            shareTokenCreatedBy: source === "admin" ? createdBy : null,
          },
        },
        { new: true }
      );
      // No match means the profile already had a token (a concurrent request
      // beat us to it, or this is a re-run). Read it back rather than
      // overwriting — a changed token would break every link already shared.
      if (!updated) {
        const existing = await nannyProfile
          .findById(profileId)
          .select("shareToken")
          .lean();
        return existing?.shareToken || null;
      }
      return updated.shareToken;
    } catch (err) {
      if (err?.code === 11000) continue; // collision — draw again
      throw err;
    }
  }
  console.error(
    `Could not allocate a share token for profile ${profileId} in ${attempts} attempts`
  );
  return null;
};

// Returns the existing token untouched, or mints one on first share.
//
// Callers pass who is asking. It only takes effect on a first mint — an
// existing token keeps the origin it was created with, because that is the
// question being answered ("who published this listing"), and an admin opening
// a member's link later did not publish it.
export const ensureShareToken = async (profile, { source = "member", createdBy = null } = {}) => {
  if (profile?.shareToken) return profile.shareToken;
  if (!profile?._id) return null;
  return assignShareToken(profile._id, { source, createdBy });
};

export const shareLinkFor = (token) =>
  token ? `${CLIENT_URL}/share/${encodeURIComponent(token)}` : null;

/* ────────────────────────── privacy-safe serializer ───────────────────────── */

// hasNanny / hasFamily arrive as real booleans or as the strings "true"/"false"
// depending on which save path wrote the profile (FormData stringifies them).
// Getting this wrong picks the wrong headline and the wrong CTA, so normalise
// before branching on either.
const asBool = (v) => v === true || v === "true";

// The four share types, keyed the same way the frontend keys them
// (src/Config/shareTypeTheme.jsx). The public page reads this to choose its
// headline, subheadline and call to action.
const variantFor = (type, profile) =>
  type === "Parents"
    ? asBool(profile.hasNanny)
      ? "familyHasNanny"
      : "familyLooking"
    : asBool(profile.hasFamily)
      ? "nannyHasFamily"
      : "nannyLooking";

// additionalInfo is a [{key, value}] bag on the user that older family profiles
// still lean on for a few fields. Flatten it so the fallbacks below read the
// same way the dashboard's do.
const flattenAdditionalInfo = (user) =>
  (user?.additionalInfo || []).reduce(
    (acc, curr) => ({ ...acc, [curr.key]: curr.value }),
    {}
  );

// Only what the card actually renders: the neighborhood and city. Coordinates
// and the full formatted address (which starts with a street number) never
// leave the server. When neither field was captured we fall back to the same
// "City, State" slice the dashboard card shows, which still contains no street.
const publicLocation = (location) => {
  if (!location) return null;
  const { neighborhood, city, format_location } = location;
  if (neighborhood || city) return { neighborhood: neighborhood || null, city: city || null };
  if (!format_location) return null;
  const area = format_location
    .split(",")
    .slice(-3, -1)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return area ? { neighborhood: null, city: area } : null;
};

// Days only — the card renders "Mon–Fri" from the checked flags and nothing
// else, so the start/end times stay on the server.
const publicSchedule = (schedule) => {
  if (!schedule || typeof schedule !== "object") return null;
  const days = {};
  for (const [day, value] of Object.entries(schedule)) {
    if (value?.checked) days[day] = { checked: true };
  }
  return Object.keys(days).length ? days : null;
};

// A ready-to-render range, e.g. "~$20 - 25/hr per family". Mirrors the strings
// the dashboard builds in profileList.jsx, with one deliberate difference: the
// bounds are ordered low-to-high. The dashboard renders max first, which reads
// as "$25 - 20" — tolerable on a private screen, but this page is the one that
// gets pasted into a Facebook group.
// Whole dollars stay whole; anything with cents gets both digits, so a $12.50
// split reads as money rather than as "$12.5".
const money = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num % 1 === 0 ? String(num) : num.toFixed(2);
};

const rangeText = (min, max, suffix) => {
  if (min == null && max == null) return "N/A";
  if (min != null && max != null) {
    const [lo, hi] = Number(min) <= Number(max) ? [min, max] : [max, min];
    return lo === hi
      ? `~$${money(lo)}${suffix}`
      : `~$${money(lo)} - $${money(hi)}${suffix}`;
  }
  return `~$${money(min ?? max)}+${suffix}`;
};

// The caregiver questionnaire stores its rate as the option's own value —
// "25-30", "45-50+" — and that value is the CAREGIVER'S COMBINED rate for both
// families. Halved here, because the public card has room for one number and
// the one a reader is deciding on is their own side of the split. Shown whole,
// a share advertised as costing more than hiring the same person alone.
const storedRateText = (storedRate, suffix, divisor = 1) => {
  const amounts = String(storedRate ?? "").match(/\d+(?:\.\d+)?/g);
  if (!amounts) return null;

  const [low, high = low] = amounts.map(Number);
  if (!Number.isFinite(low)) return null;

  const open = String(storedRate).includes("+") ? "+" : "";
  const lo = money(low / divisor);
  const hi = money((Number.isFinite(high) ? high : low) / divisor);
  return lo === hi ? `~$${lo}${open}${suffix}` : `~$${lo} - $${hi}${open}${suffix}`;
};

/** What one family pays: half of the caregiver's combined rate for the share. */
const eachFamilyText = (storedRate, suffix) => storedRateText(storedRate, suffix, 2);

// A usable positive number, or undefined. Rejects "", null, NaN and the string
// "undefined" — all of which turn up in stored budgets.
const rateNumber = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

// hourlyBudget is stored three ways, because three questionnaires have written
// it: the object below, that object stringified by a FormData save, and a
// legacy display label like "$20 - $25 per hour (Each family pays $10 - $12.50)".
// Some of those labels are malformed — an edit form built them from a budget
// with no ceiling and produced "$20 - $undefined per hour" — so parsing has to
// salvage what it can rather than pass the text through. This page is public;
// "$undefined" on it is worse than a missing row.
const normalizeBudget = (hourlyBudget) => {
  if (!hourlyBudget) return {};

  const pick = (obj) => {
    const out = {};
    for (const key of ["min", "max", "minShare", "maxShare"]) {
      const n = rateNumber(obj?.[key]);
      if (n !== undefined) out[key] = n;
    }
    return out;
  };

  if (typeof hourlyBudget !== "string") return pick(hourlyBudget);

  const str = hourlyBudget.trim();
  if (!str) return {};
  if (str.startsWith("{")) {
    try {
      return pick(JSON.parse(str));
    } catch {
      /* not JSON after all — fall through to the label parser */
    }
  }

  const out = {};
  const hasShareClause = /each family pays/i.test(str);

  // "(Each family pays $10 - $12.50)" — the per-family split.
  const shareRange = str.match(/each family pays \$([\d.]+)\s*-\s*\$([\d.]+)/i);
  const sharePlus = str.match(/each family pays \$([\d.]+)\+/i);
  if (shareRange) {
    out.minShare = rateNumber(shareRange[1]);
    out.maxShare = rateNumber(shareRange[2]);
  } else if (sharePlus) {
    out.minShare = rateNumber(sharePlus[1]);
  }

  // The leading range. With a share clause it's the combined rate; without one
  // the label was built from the per-family numbers, so it IS the split.
  const lead = str.match(/\$([\d.]+)\s*-\s*\$([\d.]+)/);
  const leadPlus = str.match(/\$([\d.]+)\+/);
  const leadLow = rateNumber(lead?.[1] ?? leadPlus?.[1] ?? str.match(/\$\s*([\d.]+)/)?.[1]);
  const leadHigh = lead ? rateNumber(lead[2]) : undefined;

  if (hasShareClause) {
    if (leadLow !== undefined) out.min = leadLow;
    if (leadHigh !== undefined) out.max = leadHigh;
  } else if (out.minShare === undefined) {
    if (leadLow !== undefined) out.minShare = leadLow;
    if (leadHigh !== undefined) out.maxShare = leadHigh;
  }

  return out;
};

// Family (and caregiver-with-a-family) rates: `min`/`max` is what one family
// pays solo, `minShare`/`maxShare` what each family pays in the share.
const budgetRates = (hourlyBudget) => {
  const { min, max, minShare, maxShare } = normalizeBudget(hourlyBudget);
  return {
    sharedRate: rangeText(minShare, maxShare, "/hr per family"),
    soloRate: rangeText(min, max, "/hr"),
  };
};

// numberOfChildren is authoritative when present; older profiles only recorded
// the children on the user document, sometimes as a JSON string.
const childCount = (profile, user) => {
  if (profile.numberOfChildren !== undefined && profile.numberOfChildren !== null) {
    return profile.numberOfChildren;
  }
  let children = user?.noOfChildren;
  if (typeof children === "string") {
    try {
      children = JSON.parse(children);
    } catch {
      /* not JSON — treat as unknown below */
    }
  }
  return Array.isArray(children) ? children.length : 0;
};

const ageLabels = (ages) =>
  Array.isArray(ages) ? ages.map((a) => a?.label).filter(Boolean) : [];

// Everything the public page is allowed to know, and nothing else.
//
// `profile` must have userId populated with at least
// name/type/location/noOfChildren/additionalInfo. Name and imageUrl are read off
// it for the count/label fallbacks but are deliberately absent from the result.
export const toPublicSharedProfile = (profile) => {
  const user = profile.userId || {};
  const type = user.type === "Parents" ? "Parents" : "Nanny";
  const extra = flattenAdditionalInfo(user);
  const isFamily = type === "Parents";
  const hasFamily = asBool(profile.hasFamily);

  const base = {
    token: profile.shareToken,
    // The owner's user id. Not identifying on its own, and a signed-in reader
    // needs it to open the real in-app profile — which is the whole point of
    // the loop this page starts.
    ownerId: user._id || profile.userId,
    role: isFamily ? "Family" : "Nanny",
    variant: variantFor(type, profile),
    hasNanny: asBool(profile.hasNanny),
    hasFamily,
    location: publicLocation(user.location),
    createdAt: profile.createdAt || null,
  };

  if (isFamily) {
    // Only the per-family share. A family states what THEY pay; the combined
    // figure stored beside it is the caregiver's rate for the whole share, and
    // publishing it on a family's card read as a standalone price they were
    // offering.
    const { sharedRate } = budgetRates(profile.hourlyBudget);
    return {
      ...base,
      careType: profile.nannyShareType || extra.nannyShareType || profile.careType || null,
      schedule: publicSchedule(profile.specificDays || extra.specificDaysAndTime),
      hosting: profile.hostingPreference || extra.hosting || null,
      start: profile.nannyshareStart || extra.urgency || null,
      childrenCount: childCount(profile, user),
      ages: ageLabels(profile.childrenAges),
      sharedRate,
      soloRate: null,
      rateType: null,
      experience: null,
    };
  }

  // ── Caregiver ──
  // A nanny who already has a family is describing that family's share (their
  // children, their hosting, a per-family rate). One looking for a position is
  // describing themselves — experience, the ages they take, and a single
  // combined rate the two families will split.
  const shared = {
    ...base,
    careType: profile.careType || profile.currentSchedule || null,
    schedule: publicSchedule(profile.specificDays),
    start: profile.startAvailability || null,
  };

  if (hasFamily) {
    const { sharedRate, soloRate } = budgetRates(profile.hourlyBudget);
    const rateLabel = profile.rateType === "weekly" ? "wk" : "hr";
    return {
      ...shared,
      hosting: profile.whereCare || null,
      childrenCount: childCount(profile, user),
      ages: ageLabels(profile.childrenAges),
      // hourlyBudget is the newer shape; the flat sharedRate/soloRate strings
      // are what the older caregiver questionnaire wrote.
      sharedRate:
        sharedRate !== "N/A"
          ? sharedRate
          : profile.sharedRate
            ? `$${profile.sharedRate}/${rateLabel} per family`
            : "N/A",
      soloRate:
        soloRate !== "N/A"
          ? soloRate
          : profile.soloRate
            ? `$${profile.soloRate}/${rateLabel}`
            : "N/A",
      rateType: profile.rateType || null,
      experience: null,
    };
  }

  return {
    ...shared,
    hosting: null,
    childrenCount: null,
    ages: ageLabels(profile.preferredAges),
    // Halved into what one family pays, and paired with what that family would
    // pay for this caregiver alone — the comparison the card exists to make,
    // and the same pair the dashboard card and the profile page now show.
    sharedRate: eachFamilyText(
      profile.sharedRate,
      `/${profile.rateType === "weekly" ? "wk" : "hr"} per family`
    ),
    soloRate: storedRateText(
      profile.soloRate,
      `/${profile.rateType === "weekly" ? "wk" : "hr"}`
    ),
    rateType: profile.rateType || null,
    experience: profile.careExperience || null,
  };
};
