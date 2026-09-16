import "dotenv/config";
import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

// Rewrite every stored share schedule to one of the two the product has.
//
// ────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
//
// A share is full-time or part-time. The forms now offer exactly those two, in
// exactly that spelling. What is already in the database is neither.
//
// Two questionnaires and an edit form wrote these fields and they disagreed:
// caregivers answered "Full-time", families "Full-time care", and the share
// editor lowercased whatever it was handed. Same schedule, four spellings. The
// family form additionally offered five types the product does not run —
// "After-school care", "Summer/Seasonal", "Weekend Nanny Share",
// "Pickup/Drop-off (Carpool style)" — plus a free-text "Other (Specify)" box
// that could hold anything at all.
//
// The app already copes: normalizeShareSchedule (frontend/src/shared/lib/
// scheduleFormat.js) folds all of it into the two on the way out, and the
// browse filter applies the same rule. So this script is not what makes the
// product correct — it is what stops every future reader from having to know
// the history. Run it and the column means one thing.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// Anything recognisably full-time becomes "Full-time". Everything else that
// says something becomes "Part-time", because every retired type describes a
// partial week. A blank answer stays blank: "not stated" is not "part-time",
// and inventing an answer a member never gave is worse than showing nothing.
//
// This mirrors normalizeShareSchedule exactly. If you change one, change both.
//
// ── What it touches ─────────────────────────────────────────────────────────
//
//   nannyprofiles   nannyShareType, careType, currentSchedule
//   nannyshares     nannyShareType
//   users           additionalInfo entries keyed nannyShareType / careType /
//                   currentSchedule, including the sheet-imported rows that
//                   hold a JSON-stringified array instead of plain objects
//
// `otherShareTypeSpecify` is cleared wherever a schedule was written from it:
// the field backed an "Other" option that no longer exists, and the edit form
// no longer renders an input for it. Left in place it is a value nothing reads
// and nobody can change.
//
// NOT touched: `sharesetups.currentSchedule`. That collection has its own enum
// and no service in the codebase queries it — migrating a table nothing reads
// is churn, and its enum would reject the values anyway.
//
// Idempotent: a document already holding one of the two canonical spellings is
// skipped, so it is safe to re-run and safe to run while the new code is live.
//
//   node scripts/migrateShareSchedules.mjs [--dry]
// ────────────────────────────────────────────────────────────────────────────

const DRY = process.argv.includes("--dry");

const FULL_TIME = /^full[\s-]*time/i;
const CANONICAL = ["Full-time", "Part-time"];

/** The one rule. Null for a blank answer, so a caller can tell it apart. */
export const normalize = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return FULL_TIME.test(text) ? "Full-time" : "Part-time";
};

/** Already canonical — nothing to write. */
const isCanonical = (value) => CANONICAL.includes(value);

const SCHEDULE_KEYS = new Set(["nannyShareType", "careType", "currentSchedule"]);

// ── Plain documents ─────────────────────────────────────────────────────────

/**
 * Rewrite the named string fields on one collection.
 *
 * Returns the ops rather than executing them so the caller can batch, and so a
 * --dry run can count exactly what a real run would write.
 */
const planDocumentUpdates = async (collection, fields, { clearSpecify = false } = {}) => {
  const projection = fields.reduce((acc, field) => ({ ...acc, [field]: 1 }), {});
  const conditions = fields.map((field) => ({ [field]: { $type: "string", $ne: "" } }));

  if (clearSpecify) {
    projection.otherShareTypeSpecify = 1;
    // Selected too, because a row whose only answer is the free text still has
    // to be dealt with — see the salvage below.
    conditions.push({ otherShareTypeSpecify: { $type: "string", $ne: "" } });
  }

  const cursor = collection.find({ $or: conditions }, { projection });

  const ops = [];
  let skipped = 0;
  let salvaged = 0;

  for await (const doc of cursor) {
    const $set = {};
    const $unset = {};

    for (const field of fields) {
      const current = doc[field];
      if (typeof current !== "string" || isCanonical(current)) continue;
      const next = normalize(current);
      if (next) $set[field] = next;
    }

    if (clearSpecify) {
      const specify = doc.otherShareTypeSpecify;
      const hasSpecify = typeof specify === "string" && specify.trim() !== "";

      if (hasSpecify) {
        // The free text backed an "Other" option that no longer exists, and the
        // edit form no longer renders an input for it: left alone it is a value
        // nothing reads and nobody can change.
        //
        // Dropped only once the row has a real answer. Where the free text WAS
        // the only answer, it becomes one first — a member who typed "Saturdays
        // only" told us something, and losing that to a tidy-up would be this
        // script doing harm.
        const shareType = $set.nannyShareType ?? doc.nannyShareType;
        if (typeof shareType !== "string" || shareType.trim() === "") {
          const salvagedType = normalize(specify);
          if (salvagedType) {
            $set.nannyShareType = salvagedType;
            salvaged += 1;
          }
        }
        if ($set.nannyShareType || isCanonical(doc.nannyShareType)) {
          $unset.otherShareTypeSpecify = "";
        }
      }
    }

    const update = {};
    if (Object.keys($set).length > 0) update.$set = $set;
    if (Object.keys($unset).length > 0) update.$unset = $unset;

    if (Object.keys(update).length === 0) {
      skipped += 1;
      continue;
    }

    ops.push({ updateOne: { filter: { _id: doc._id }, update } });
  }

  return { ops, skipped, salvaged };
};

// ── users.additionalInfo ────────────────────────────────────────────────────

/**
 * Rewrite one additionalInfo array, returning the new array or null if nothing
 * in it changed.
 *
 * Two shapes reach us. Most rows are plain `{ key, value }` objects; rows
 * imported from the intake sheet carry a single JSON-stringified array instead
 * — `["[{\"key\":\"currentSchedule\",…}]"]` — which is why the app flattens
 * both before reading. Both are rewritten here, the stringified one back into
 * the same string shape it arrived in. Re-shaping it would be a second,
 * unrelated migration hiding inside this one.
 */
export const rewriteAdditionalInfo = (entries) => {
  if (!Array.isArray(entries)) return null;

  let changed = false;

  const rewriteEntry = (entry) => {
    if (!entry || typeof entry !== "object" || !SCHEDULE_KEYS.has(entry.key)) return entry;
    if (typeof entry.value !== "string" || isCanonical(entry.value)) return entry;

    const next = normalize(entry.value);
    if (!next) return entry;

    changed = true;
    return { ...entry, value: next };
  };

  const rewritten = entries.map((entry) => {
    if (entry && typeof entry === "object") return rewriteEntry(entry);

    if (typeof entry === "string") {
      let parsed;
      try {
        parsed = JSON.parse(entry);
      } catch {
        return entry; // Not JSON — nothing here to rewrite.
      }
      if (!Array.isArray(parsed)) return entry;

      const before = changed;
      const next = parsed.map(rewriteEntry);
      return changed !== before ? JSON.stringify(next) : entry;
    }

    return entry;
  });

  return changed ? rewritten : null;
};

// ── Counting what actually landed ───────────────────────────────────────────

/** Documents still holding a non-canonical value in any of `fields`. */
const countStale = (collection, fields) =>
  collection.countDocuments({
    $or: fields.map((field) => ({
      [field]: { $type: "string", $nin: ["", ...CANONICAL] },
    })),
  });

const run = async () => {
  if (!process.env.MONGO_DB_URI) {
    console.error("MONGO_DB_URI is not set. Run this from the backend directory.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_DB_URI);
  console.log(`connected to ${mongoose.connection.name}${DRY ? "  (dry run)" : ""}\n`);

  // Driver-level, not through the models: a model read applies schema casting
  // and defaults, which is exactly the layer this script needs to see under.
  const db = mongoose.connection;
  const profiles = db.collection("nannyprofiles");
  const shares = db.collection("nannyshares");
  const users = db.collection("users");

  const write = async (collection, ops) => {
    if (!ops.length || DRY) return;
    for (let i = 0; i < ops.length; i += 500) {
      await collection.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }
  };

  // ── nannyprofiles ─────────────────────────────────────────────────────────
  const profileFields = ["nannyShareType", "careType", "currentSchedule"];
  const profilePlan = await planDocumentUpdates(profiles, profileFields, {
    clearSpecify: true,
  });
  await write(profiles, profilePlan.ops);
  console.log(
    `nannyprofiles:  ${profilePlan.ops.length} rewritten, ` +
      `${profilePlan.skipped} already canonical` +
      (profilePlan.salvaged ? `, ${profilePlan.salvaged} recovered from free text` : ""),
  );

  // ── nannyshares ───────────────────────────────────────────────────────────
  const sharePlan = await planDocumentUpdates(shares, ["nannyShareType"], {
    clearSpecify: true,
  });
  await write(shares, sharePlan.ops);
  console.log(
    `nannyshares:    ${sharePlan.ops.length} rewritten, ${sharePlan.skipped} already canonical` +
      (sharePlan.salvaged ? `, ${sharePlan.salvaged} recovered from free text` : ""),
  );

  // ── users.additionalInfo ──────────────────────────────────────────────────
  const userCursor = users.find(
    { additionalInfo: { $exists: true, $ne: [] } },
    { projection: { additionalInfo: 1 } },
  );

  const userOps = [];
  let usersSkipped = 0;

  for await (const user of userCursor) {
    const rewritten = rewriteAdditionalInfo(user.additionalInfo);
    if (!rewritten) {
      usersSkipped += 1;
      continue;
    }
    userOps.push({
      updateOne: { filter: { _id: user._id }, update: { $set: { additionalInfo: rewritten } } },
    });
  }

  await write(users, userOps);
  console.log(
    `users:          ${userOps.length} rewritten, ${usersSkipped} had nothing to change`,
  );

  // ── Verification ──────────────────────────────────────────────────────────
  //
  // Counted from the database, not from the loops above: a tally of what we
  // meant to write proves nothing about what landed.
  const [staleProfiles, staleShares, staleSpecify] = await Promise.all([
    countStale(profiles, profileFields),
    countStale(shares, ["nannyShareType"]),
    Promise.all([
      profiles.countDocuments({ otherShareTypeSpecify: { $type: "string", $ne: "" } }),
      shares.countDocuments({ otherShareTypeSpecify: { $type: "string", $ne: "" } }),
    ]).then(([a, b]) => a + b),
  ]);

  // additionalInfo has to be counted in memory: the schedule lives inside an
  // array of Mixed, and for sheet-imported rows inside a JSON string within it,
  // neither of which a query can reach into.
  let staleUsers = 0;
  const verifyCursor = users.find(
    { additionalInfo: { $exists: true, $ne: [] } },
    { projection: { additionalInfo: 1 } },
  );
  for await (const user of verifyCursor) {
    if (rewriteAdditionalInfo(user.additionalInfo)) staleUsers += 1;
  }

  console.log(
    `\nverify: ${staleProfiles} profiles, ${staleShares} shares and ${staleUsers} users ` +
      `still hold a non-canonical schedule; ${staleSpecify} rows still carry ` +
      `otherShareTypeSpecify.`,
  );

  if (DRY) {
    console.log(
      "\nDry run — nothing was written. The counts above are what a real run would change.",
    );
  } else if (staleProfiles > 0 || staleShares > 0 || staleUsers > 0 || staleSpecify > 0) {
    console.error("\nIncomplete — re-run the script.");
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  process.exit(0);
};

// Only when invoked as a script. The two rules above are exported for
// tests/scripts/migrateShareSchedules.test.js, and importing this file must not
// open a connection or exit the process.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  run().catch(async (error) => {
    console.error("Migration failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
