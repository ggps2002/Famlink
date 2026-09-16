// Per-caller rate limiting for the public, unauthenticated routes.
//
// Anything reachable without a token is reachable by a script, and a few of
// these routes cost real money or real database work per call: the geocoding
// proxy spends Google Maps credit on our API key, and the map-pins endpoint
// scans up to 2,000 user documents. Without a ceiling, one loop run overnight is
// an unbounded bill.
//
// Redis-backed when Redis is up, so the ceiling holds across every machine in
// the fly.io app. Falls back to a per-process counter when it isn't — a limit
// that only holds per machine is still far better than none, and a Redis outage
// must not take down signup.

import { client, connectRedis } from "../../../shared/cache/RedisClient.js";

// Fixed windows, not a sliding log: a burst can straddle a boundary and get up
// to 2x the limit for a moment. That is the accepted trade for one INCR per
// request instead of a sorted-set read-modify-write. We are stopping runaway
// scripts, not shaving a precise quota.

/* ─────────────────────────── who is calling ─────────────────────────── */

// The caller's IP, as trustworthy as we can make it.
//
// `req.ip` is the fly.io proxy for every request, so limiting on it would put
// the whole internet in one bucket and lock everyone out together. Fly sets
// `Fly-Client-IP` itself and overwrites whatever the client sent, so it is the
// one header here a caller cannot forge. X-Forwarded-For is the fallback for
// other environments and IS forgeable — someone determined can rotate it and
// evade this. That is acceptable: the goal is a ceiling on accidental and
// casual abuse, and the response trimming in the routes themselves is what
// limits the value of getting past it.
export const clientIp = (req) => {
  const flyIp = req.headers["fly-client-ip"];
  if (typeof flyIp === "string" && flyIp.trim()) return flyIp.trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

/* ───────────────────────────── counters ─────────────────────────────── */

// Per-process fallback. Keyed the same way as Redis so behaviour matches.
const memoryHits = new Map();

// Drop expired buckets so a long-running process doesn't accumulate one entry
// per IP per window forever.
const sweepMemory = (now) => {
  for (const [key, entry] of memoryHits) {
    if (entry.resetAt <= now) memoryHits.delete(key);
  }
};

let lastSweep = 0;
const SWEEP_EVERY_MS = 60_000;

const hitMemory = (key, windowMs) => {
  const now = Date.now();
  if (now - lastSweep > SWEEP_EVERY_MS) {
    sweepMemory(now);
    lastSweep = now;
  }

  const existing = memoryHits.get(key);
  if (!existing || existing.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowMs };
    memoryHits.set(key, entry);
    return entry;
  }

  existing.count += 1;
  return existing;
};

const hitRedis = async (key, windowSec) => {
  const count = await client.incr(key);
  // Only the request that created the key sets the TTL, so a busy window can't
  // keep pushing its own expiry out and lock a caller out indefinitely.
  if (count === 1) await client.expire(key, windowSec);

  let ttl = await client.ttl(key);
  // -1 = key exists with no TTL (the EXPIRE above lost a race). Repair it
  // rather than leaving a counter that never resets.
  if (ttl < 0) {
    await client.expire(key, windowSec);
    ttl = windowSec;
  }

  return { count, resetAt: Date.now() + ttl * 1000 };
};

/* ──────────────────────────── middleware ────────────────────────────── */

/**
 * @param {object}  options
 * @param {string}  options.name      bucket name, so two routes don't share a counter
 * @param {number}  options.limit     requests allowed per window
 * @param {number}  options.windowSec window length in seconds
 * @param {string}  [options.message] what the caller is told on 429
 * @param {(req: import("express").Request) => string|null|undefined} [options.identify]
 *   What to count per, instead of the caller's IP.
 *
 *   IP is the right default for "stop a runaway script", and the wrong one for
 *   "stop someone guessing one account's password": an attacker spreading
 *   guesses across a botnet gets the full per-IP allowance from each address,
 *   while the account under attack has no ceiling of its own. Bucketing by the
 *   submitted email instead gives that account a ceiling no matter where the
 *   guesses come from.
 *
 *   The two are complementary, so login mounts both — one limiter keyed by IP,
 *   one by email — rather than trying to express both in a single counter.
 *
 *   Returning null skips the limiter, which is what a request with no email in
 *   the body should do: it has nothing to attribute the attempt to, and the
 *   per-IP limiter is still in front of it.
 */
export const rateLimit = ({ name, limit, windowSec, message, identify }) => {
  // Connect once, lazily. Failure is fine — hitRedis will throw and we fall
  // through to the in-memory counter.
  connectRedis().catch(() => {});

  const windowMs = windowSec * 1000;

  return async (req, res, next) => {
    const identity = identify ? identify(req) : clientIp(req);
    if (!identity) return next();

    // Bucket by window so the key rotates on its own even if a TTL is lost.
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `rl:${name}:${identity}:${bucket}`;

    let hit;
    try {
      if (!client.isOpen) throw new Error("redis unavailable");
      hit = await hitRedis(key, windowSec);
    } catch {
      hit = hitMemory(key, windowMs);
    }

    const remaining = Math.max(0, limit - hit.count);
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(hit.resetAt / 1000)));

    if (hit.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        message: message || "Too many requests. Please try again shortly.",
        retryAfter,
      });
    }

    return next();
  };
};
