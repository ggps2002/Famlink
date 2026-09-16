import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Read off disk, not imported, so this is a filesystem path rather than a
// module specifier — the "@app" alias means nothing to fs.readFileSync.
export const APP_JSX = path.resolve(here, "../../src/app/App.jsx");

/**
 * The route table, read out of App.jsx's source.
 *
 * Read statically rather than by rendering, because the routes are registered
 * conditionally on `user?.type` — rendering would only ever reveal the branch
 * matching whatever auth state the test happened to set up, and the whole point
 * of this snapshot is that all three branches survive the refactor.
 *
 * Which branch a route lives in is as load-bearing as its path. A route in the
 * wrong group is not a 404: it falls through to the "*" fallback and silently
 * redirects. That is how an unsubscribe link in an email ends up bouncing the
 * recipient to a dashboard, and it is invisible to a build.
 */

/** The three registration groups, in the order App.jsx declares them. */
export const GROUPS = {
  ALWAYS: "always",
  LOGGED_OUT: "logged-out",
  MEMBER: "member",
};

const stripComments = (source) =>
  source
    // JSX comment blocks: {/* … */}
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * Which group a source offset falls in.
 *
 * The boundaries are the two conditional blocks. Anything outside both is
 * registered unconditionally.
 */
const groupAt = (source, index) => {
  const loggedOut = source.indexOf("{!user?.type &&");
  const member = source.indexOf('{(user?.type === "Parents" || user?.type === "Nanny") &&');

  // The logged-out block runs from its opening to the start of the member block.
  if (loggedOut !== -1 && member !== -1 && index > loggedOut && index < member) {
    return GROUPS.LOGGED_OUT;
  }
  if (member !== -1 && index > member) {
    // Everything after the member block opens is nested inside it, except the
    // trailing "*" fallback — which is handled by the caller, since a wildcard
    // is not a route anyone links to.
    return GROUPS.MEMBER;
  }
  return GROUPS.ALWAYS;
};

/** `element={<Foo bar />}` → "Foo". */
const componentOf = (attributes) => {
  const direct = attributes.match(/element=\{\s*<\s*([A-Za-z0-9_]+)/);
  if (direct) return direct[1];

  // `element={cond ? <A /> : <B />}` — both branches are recorded, because
  // swapping which one renders is a behaviour change worth failing on.
  const ternary = [...attributes.matchAll(/<\s*([A-Za-z0-9_]+)[\s/]/g)].map((m) => m[1]);
  return ternary.length ? [...new Set(ternary)].join(" | ") : null;
};

/**
 * The attribute text of every `<Route …>` opening tag, with its source offset.
 *
 * Scanned by tracking brace depth rather than matched with a regex, because an
 * `element={<Foo />}` attribute contains a `>` of its own — a regex stopping at
 * the first `>` truncates the tag, which drops the element and, for a route
 * whose path follows the element, drops the route entirely. Silently: the
 * result is a shorter baseline that still looks plausible.
 */
const routeTags = (source) => {
  const tags = [];
  const OPEN = "<Route";

  for (let i = source.indexOf(OPEN); i !== -1; i = source.indexOf(OPEN, i + 1)) {
    // Guard against matching <RouteSomething>.
    const after = source[i + OPEN.length];
    if (after && /[A-Za-z0-9_]/.test(after)) continue;

    let depth = 0;
    let end = -1;

    for (let j = i + OPEN.length; j < source.length; j += 1) {
      const char = source[j];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) {
        end = j;
        break;
      }
    }

    if (end === -1) continue;
    tags.push({ index: i, attributes: source.slice(i + OPEN.length, end) });
  }

  return tags;
};

export const extractRoutes = (source = fs.readFileSync(APP_JSX, "utf8")) => {
  const clean = stripComments(source);
  const routes = [];

  // Every <Route …> with a path. Self-closing and container forms both match,
  // since the opening tag is all that carries the path and element.
  for (const { index, attributes } of routeTags(clean)) {
    const pathMatch = attributes.match(/path=["']([^"']+)["']/);
    if (!pathMatch) continue; // The layout <Route element={<PageLayout />}> wrapper.

    const routePath = pathMatch[1];
    if (routePath === "*") continue; // The fallback, not a linkable route.

    routes.push({
      path: routePath,
      component: componentOf(attributes),
      group: groupAt(clean, index),
    });
  }

  return routes.sort(
    (a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path)
  );
};

export default extractRoutes;
