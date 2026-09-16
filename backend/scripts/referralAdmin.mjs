// Referral operations tool — inspect, recover, and credit referrals directly
// against the database in the environment's MONGO_DB_URI. Run it from the
// backend directory so it picks up the same .env the server uses.
//
//   node scripts/referralAdmin.mjs inspect <email-or-CODE>
//       Show one account's referral chain: their code, who referred them, and
//       everyone they referred with each one's linked/credited state. Read-only.
//
//   node scripts/referralAdmin.mjs credit <friendEmail> --yes
//       Run the payout for a friend who was linked (referredBy set) but never
//       credited — e.g. they completed their profile before the fix shipped.
//       Idempotent: a friend already credited can't pay their referrer twice.
//
//   node scripts/referralAdmin.mjs link <friendEmail> <referrerCODE> --yes
//       Recovery for a referral whose link never carried the code to signup:
//       set the friend's referredBy from the referrer's code, then credit.
//       Only works if the friend isn't already linked.
//
// Writes require the --yes flag so an inspect can never mutate data by mistake.

import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/modules/user/user.model.js";
import {
  creditReferrerForProfileCompletion,
  findReferrerByCode,
  hasActiveReferralMatching,
} from "../src/modules/referral/referral.util.js";

const [, , cmd, ...rest] = process.argv;
const args = rest.filter((a) => a !== "--yes");
const confirmed = rest.includes("--yes");

const uri = process.env.MONGO_DB_URI;
if (!uri) {
  console.error("MONGO_DB_URI is not set — run this from the backend dir with the right .env");
  process.exit(1);
}

const view = (u, label) => {
  if (!u) return console.log(`  ${label}: (none)`);
  console.log(`  ${label}: ${u.name} <${u.email}>`);
  console.log(`      code=${u.referralCode || "—"}  referredBy=${u.referredBy || "—"}`);
  console.log(
    `      referralCount=${u.referralCount || 0}  matchingUntil=${u.referralMatchingUntil || "—"}` +
      `  active=${hasActiveReferralMatching(u)}`
  );
  console.log(
    `      nannyProfileCompleted=${u.nannyProfileCompleted}  matchRequestsSent=${u.matchRequestsSent || 0}` +
      `  referralCreditedAt=${u.referralCreditedAt || "—"}`
  );
};

const findAccount = async (needle) => {
  const s = String(needle || "").trim();
  if (s.includes("@")) return User.findById((await User.findOne({ email: s }))?._id);
  return User.findOne({ referralCode: s.toUpperCase() });
};

await mongoose.connect(uri);
console.log(`connected to ${mongoose.connection.name}\n`);

try {
  if (cmd === "inspect") {
    const acct = await findAccount(args[0]);
    if (!acct) throw new Error(`no account for "${args[0]}"`);
    console.log("ACCOUNT");
    view(acct, "self");
    const referrer = acct.referredBy ? await User.findById(acct.referredBy) : null;
    console.log("\nREFERRED BY");
    view(referrer, "referrer");
    console.log(
      acct.referredBy
        ? acct.referralCreditedAt
          ? "  → linked & credited"
          : "  → linked, NOT yet credited (run `credit`)"
        : "  → not linked to anyone (the ?ref code never reached signup)"
    );

    const friends = await User.find({ referredBy: acct._id }).sort({ createdAt: -1 });
    console.log(`\nPEOPLE THIS ACCOUNT REFERRED (${friends.length})`);
    if (!friends.length) {
      console.log("  (none — no signup has carried this account's code)");
    }
    for (const f of friends) {
      console.log(
        `  • ${f.name} <${f.email}>  profileComplete=${f.nannyProfileCompleted}  ` +
          `credited=${Boolean(f.referralCreditedAt)}`
      );
    }
  } else if (cmd === "credit") {
    const friend = await User.findOne({ email: String(args[0]).trim() });
    if (!friend) throw new Error(`no account with email "${args[0]}"`);
    if (!friend.referredBy) throw new Error("friend has no referredBy — use `link` first");
    if (!confirmed) {
      console.log(`Would credit the referrer of ${friend.email}. Re-run with --yes to apply.`);
    } else {
      const result = await creditReferrerForProfileCompletion(friend._id);
      if (!result) console.log("Nothing to do — already credited.");
      else {
        console.log("Credited ✓");
        view(result.referrer, "referrer (updated)");
      }
    }
  } else if (cmd === "link") {
    const friend = await User.findOne({ email: String(args[0]).trim() });
    if (!friend) throw new Error(`no account with email "${args[0]}"`);
    if (friend.referredBy) throw new Error("friend is already linked — use `credit`");
    const referrer = await findReferrerByCode(args[1]);
    if (!referrer) throw new Error(`no account with code "${args[1]}"`);
    if (String(referrer._id) === String(friend._id)) throw new Error("cannot self-refer");
    if (!confirmed) {
      console.log(
        `Would link ${friend.email} → referrer ${referrer.email} (${args[1]}) and credit. Re-run with --yes.`
      );
    } else {
      await User.updateOne({ _id: friend._id }, { $set: { referredBy: referrer._id } });
      const result = await creditReferrerForProfileCompletion(friend._id);
      console.log("Linked ✓" + (result ? " and credited ✓" : " (credit skipped — already credited)"));
      view(await User.findById(referrer._id), "referrer (updated)");
    }
  } else {
    console.log("Usage:\n  inspect <email-or-CODE>\n  credit <friendEmail> --yes\n  link <friendEmail> <referrerCODE> --yes");
  }
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await mongoose.disconnect();
}
