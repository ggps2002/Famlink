import { describe, it, expect } from "vitest";
import { extractRoutes, GROUPS } from "./extractRoutes.mjs";
import baseline from "./route-baseline.json";

/**
 * The refactor's contract with the browser: the URLs do not change, and neither
 * does who can reach them.
 *
 * `route-baseline.json` is the route table as it stood before any file moved.
 * Every entry records three things, and all three matter:
 *
 *   path       — what someone typed, bookmarked, or clicked in an email.
 *   component  — what renders there. A move that repoints a route at the wrong
 *                screen still builds and still routes.
 *   group      — which auth branch registers it. This is the one a build cannot
 *                catch: a route in the wrong group is not a 404, it falls
 *                through to the "*" fallback and silently redirects. That is
 *                how an unsubscribe link ends up bouncing its recipient to a
 *                dashboard.
 *
 * Regenerate this file only when a route is deliberately added or removed, and
 * say so in the commit. Regenerating it to make a failure go away defeats the
 * entire point — the table changes on purpose or not at all.
 */

const current = extractRoutes();
const key = (route) => `${route.group} ${route.path}`;

describe("route parity with the pre-refactor table", () => {
  it("serves exactly the paths it always did", () => {
    expect(current.map(key).sort()).toEqual(baseline.map(key).sort());
  });

  it("points every path at the same component", () => {
    const before = new Map(baseline.map((route) => [key(route), route.component]));
    const drifted = current
      .filter((route) => before.get(key(route)) !== route.component)
      .map((route) => `${route.path}: ${before.get(key(route))} → ${route.component}`);

    expect(drifted).toEqual([]);
  });

  it("keeps every route in the auth branch that registered it", () => {
    // Checked separately from the path so a failure names the real problem.
    // Moving a route between branches changes who can reach it without
    // changing its URL, and nothing else in the suite would notice.
    const before = new Map(baseline.map((route) => [route.path, route.group]));
    const moved = current
      .filter((route) => before.has(route.path) && before.get(route.path) !== route.group)
      .map((route) => `${route.path}: ${before.get(route.path)} → ${route.group}`);

    expect(moved).toEqual([]);
  });
});

describe("the shape the extractor depends on", () => {
  it("resolves a component for every route", () => {
    // A null here means the parser lost the element — which would let a
    // repointed route slip past the drift check above.
    expect(current.filter((route) => !route.component)).toEqual([]);
  });

  it("finds routes in all three registration groups", () => {
    // Guards the extractor itself: if a refactor changed how the conditionals
    // are written, `groupAt` could silently collapse every route into "always"
    // and the group assertions above would pass while meaning nothing.
    expect(new Set(current.map((route) => route.group))).toEqual(
      new Set([GROUPS.ALWAYS, GROUPS.LOGGED_OUT, GROUPS.MEMBER])
    );
  });

  it("has no duplicate path within a group", () => {
    // Two entries for one path means one is unreachable, decided by
    // registration order rather than by anything a reader would see.
    const seen = new Set();
    const duplicates = current.filter((route) => {
      if (seen.has(key(route))) return true;
      seen.add(key(route));
      return false;
    });

    expect(duplicates).toEqual([]);
  });
});
