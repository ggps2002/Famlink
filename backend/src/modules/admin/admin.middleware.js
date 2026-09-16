// Admin gate for the admin console.
//
// Before the module refactor, every admin route repeated the same six lines
// inline: look the caller up by req.userId, 404 if they're gone, 403 if
// type !== "Admin". That pattern is load-bearing and easy to get subtly wrong —
// the old Routes/adminUser.js had a route that shadowed the fetched admin with
// the target user of the same variable name — so the check lives here once and
// is mounted as middleware.
//
// A route behind `adminOnly` can assume `req.admin` is a real, non-blocked
// Admin document. Read the admin's own id off `req.admin._id`, never off
// `req.userId` alone, so an action log always names an account that existed at
// the moment it was written.

import User from "../user/user.model.js";
import { authMiddleware } from "../../shared/auth/middlewareAuth.js";

// The projection the console needs about the admin themselves. Never the full
// document: an admin has a bcrypt hash and a Stripe id like anyone else, and
// there is no reason for either to sit on `req` for the life of the request.
const ADMIN_SELECT = "_id name email type status";

// Verifies the bearer token, then that the bearer is an Admin. Mount as a pair:
// `router.use(adminOnly)` at the top of an admin router covers every route
// under it, so a route added next month is protected by default rather than by
// the author remembering.
export const adminOnly = [
  authMiddleware,
  async (req, res, next) => {
    try {
      const admin = await User.findById(req.userId).select(ADMIN_SELECT).lean();

      if (!admin) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (admin.type !== "Admin") {
        // Same message and status for "not an admin" as the console gives for a
        // route that doesn't exist, so a member poking at /admin/* can't map
        // which endpoints are real.
        return res
          .status(403)
          .json({ message: "Access denied. Admins only." });
      }

      // An admin whose own account was blocked loses the console with everyone
      // else. Otherwise revoking a departing admin means remembering to change
      // their `type` as well as their `status`.
      if (admin.status === "Block" || admin.status === "Suspended") {
        return res.status(403).json({ message: "This admin account is not active." });
      }

      req.admin = admin;
      return next();
    } catch (error) {
      console.error("adminOnly middleware failed:", error);
      return res.status(500).json({ message: "Could not verify admin access" });
    }
  },
];

/* ────────────────────────────── query helpers ───────────────────────────── */

// Pagination the console's tables all share. Capped at 200 because every admin
// list endpoint returns full user records — an uncapped `limit` turns one
// request into a dump of the entire user table.
export const parsePaging = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
};

export const pagingMeta = (totalRecords, { page, limit }) => ({
  totalRecords,
  totalPages: Math.max(1, Math.ceil(totalRecords / limit)),
  currentPage: page,
  limit,
});

// Turn `?sort=-createdAt` into a mongo sort object, restricted to a route's own
// allow-list. Passing user input straight to .sort() lets a caller sort by an
// unindexed field and table-scan the collection.
export const parseSort = (value, allowed, fallback = { createdAt: -1 }) => {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const desc = value.startsWith("-");
  const field = desc ? value.slice(1) : value;
  if (!allowed.includes(field)) return fallback;
  return { [field]: desc ? -1 : 1 };
};

// Escape a user-supplied search term before it becomes a RegExp. Without this a
// search for "a{100000}" is a regex denial of service against the user table.
export const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Turn `?from=&to=` into a Mongo range, or undefined if neither was given.
//
// `to` is stretched to the end of its day. The console's date picker sends a
// plain date, which parses to midnight — so an unstretched `to` excludes every
// record from the day the admin actually selected, and a single-day filter
// returns nothing at all.
export const dateRange = ({ from, to } = {}) => {
  if (!from && !to) return undefined;

  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return range;
};

// A case-insensitive "contains" match, safe to build from user input.
export const searchTerm = (value) => new RegExp(escapeRegex(String(value ?? "").trim()), "i");
