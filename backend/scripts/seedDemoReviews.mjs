/**
 * Demo reviews on ONE profile, so a design change can be looked at with the
 * Reviews panel populated instead of showing its empty state.
 *
 *   node scripts/seedDemoReviews.mjs                      dry run (default)
 *   node scripts/seedDemoReviews.mjs --apply              write them
 *   node scripts/seedDemoReviews.mjs --undo --apply       remove them again
 *   node scripts/seedDemoReviews.mjs --user=<id> --apply  a different profile
 *
 * Writes wherever config.db.uri resolves, which outside production is the local
 * database unless ALLOW_REMOTE_DB is deliberately set — the same guard every
 * other entry point uses, so this cannot quietly reach a cluster real members
 * share. Belt and braces on top of that:
 *
 *   * It is a DRY RUN unless you pass --apply, and it prints the database it
 *     would write to (and whether that is local) before doing anything.
 *   * Every review it writes carries a fixed sentinel `_id` (see DEMO_IDS).
 *     Undo is therefore exact — a `$pull` on those five ids removes precisely
 *     what this script added and cannot touch a real review, even if the run
 *     that created them is long forgotten and nobody kept a log.
 *   * Re-running is idempotent: the same ids are pulled before being pushed.
 *
 * Reviewers are picked from real members so the byline and avatar populate the
 * way they do in production; only the rating and the text are invented.
 */
import mongoose from "mongoose";

import { config } from "../src/config/index.js";
import { describeMongoUri, isLocalMongoUri } from "../src/config/mongoUri.js";
import User from "../src/modules/user/user.model.js";

/* ─────────────────────────────── constants ─────────────────────────────── */

// The profile the design is being checked on.
const DEFAULT_TARGET = "6aa47961e449ea2a3e2d549c";

// Fixed, obviously-synthetic ObjectIds. These ARE the undo key — nothing else
// about a review distinguishes a seeded one from a real one, and the subdocument
// schema is strict, so an extra `demo: true` field would simply be dropped.
const DEMO_IDS = [
  "deadbeefdeadbeefdeadbe01",
  "deadbeefdeadbeefdeadbe02",
  "deadbeefdeadbeefdeadbe03",
  "deadbeefdeadbeefdeadbe04",
  "deadbeefdeadbeefdeadbe05",
].map((hex) => new mongoose.Types.ObjectId(hex));

// Ratings are deliberately mixed. All-fives would leave the distribution bars
// as one full row and four empty ones, which is exactly the part of the design
// that needs looking at.
const DEMO_REVIEWS = [
  {
    rating: 5,
    msg: "Sasha took care of our newborn twins during a hectic period, and she was a total lifesaver. She was calm, punctual, and incredibly knowledgeable about sleep routines. We trusted her completely.",
  },
  {
    rating: 5,
    msg: "Wonderful with our toddler from day one. She kept a consistent nap routine, sent photos through the afternoon, and always left the kitchen tidier than she found it.",
  },
  {
    rating: 4,
    msg: "Reliable and warm, and our daughter adored her. Occasionally ran a few minutes late in the mornings, but she always let us know in advance.",
  },
  {
    rating: 5,
    msg: "We shared her between two families for eight months and it could not have gone more smoothly. Fair, organised, and genuinely good at keeping both sets of parents in the loop.",
  },
  {
    rating: 3,
    msg: "Good with the kids and never a safety concern. We wanted a bit more help with meal prep than we ended up getting, so the fit was not quite right for us.",
  },
];

/* ──────────────────────────────── helpers ──────────────────────────────── */

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const flag = (name) => process.argv.includes(`--${name}`);

const main = async () => {
  const apply = flag("apply");
  const undo = flag("undo");
  const targetId = arg("user") || DEFAULT_TARGET;

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new Error(`Not a valid user id: ${targetId}`);
  }

  await mongoose.connect(config.db.uri);

  const where = describeMongoUri(config.db.uri);
  const shared = isLocalMongoUri(config.db.uri) ? "local" : "REMOTE — shared data";
  console.log(`database : ${where}  (${shared})`);
  console.log(`profile  : ${targetId}`);
  console.log(`mode     : ${undo ? "undo" : "seed"}${apply ? "" : "  (DRY RUN — pass --apply to write)"}`);

  const target = await User.findById(targetId).select("name reviews").lean();
  if (!target) throw new Error(`No user with id ${targetId}`);
  console.log(`name     : ${target.name}`);

  const seededNow = (target.reviews || []).filter((r) =>
    DEMO_IDS.some((id) => id.equals(r._id))
  ).length;
  console.log(`existing : ${target.reviews?.length ?? 0} reviews, of which ${seededNow} are demo rows`);

  if (undo) {
    if (!apply) {
      console.log(`\nWould remove ${seededNow} demo review(s).`);
      return;
    }
    const res = await User.updateOne(
      { _id: targetId },
      { $pull: { reviews: { _id: { $in: DEMO_IDS } } } }
    );
    console.log(`\nRemoved demo reviews. modified=${res.modifiedCount}`);
    return;
  }

  // Real members as reviewers, so the byline and avatar render as they would in
  // production. Anyone but the person being reviewed.
  const reviewers = await User.find({
    _id: { $ne: targetId },
    status: "Active",
    deletedAt: null,
  })
    .select("name imageUrl")
    .limit(DEMO_REVIEWS.length)
    .lean();

  if (reviewers.length === 0) throw new Error("No other members to attribute reviews to");

  const reviews = DEMO_REVIEWS.map((review, index) => ({
    _id: DEMO_IDS[index],
    userId: reviewers[index % reviewers.length]._id,
    rating: review.rating,
    msg: review.msg,
    // Spread over recent weeks so the cards do not all carry one date.
    createdAt: new Date(Date.now() - (index + 1) * 9 * 24 * 60 * 60 * 1000),
  }));

  console.log("\nwould write:");
  for (const [i, review] of reviews.entries()) {
    const by = reviewers[i % reviewers.length];
    console.log(`  ${review._id}  ${review.rating}★  by ${by.name}`);
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  // Pull first so a re-run replaces rather than duplicates.
  await User.updateOne({ _id: targetId }, { $pull: { reviews: { _id: { $in: DEMO_IDS } } } });
  await User.updateOne({ _id: targetId }, { $push: { reviews: { $each: reviews, $position: 0 } } });

  const after = await User.findById(targetId).select("reviews").lean();
  console.log(`\nWrote ${reviews.length} demo reviews. Profile now has ${after.reviews.length}.`);
  console.log("Undo with: node scripts/seedDemoReviews.mjs --undo --apply");
};

main()
  .catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
