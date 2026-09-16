import Blogs from "./blog.model.js";

// URL slugs for resource articles.
//
// The public page lives at /resources/<slug>, which is what the weekly
// resources email links to and what Google indexes. Two rules follow from that,
// and they are the whole of this file:
//
//   1. A slug is generated once, from the title, and then never changes.
//      Retitling "Nanny Share vs Daycare" to "Nanny Share or Daycare?" must not
//      move the article — every link already sent out would 404, and the search
//      ranking it accumulated would reset.
//
//   2. It must be unique, decided by the unique index rather than by a lookup.
//      A findOne check alone races two admins publishing at the same moment
//      onto one slug, and the loser's save then fails with a duplicate-key
//      error they cannot act on.

// "What Is a Nanny Share?" → "what-is-a-nanny-share"
export const slugify = (title) =>
  String(title || "")
    .normalize("NFKD")
    // Strip accents rather than transliterating them: "café" → "cafe", which is
    // what a reader typing the URL by hand will produce.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")        // don't turn "don't" into "don-t"
    .replace(/[^a-z0-9]+/g, "-") // everything else becomes a separator
    .replace(/^-+|-+$/g, "")     // no leading or trailing dashes
    .slice(0, 80);

/**
 * A slug for `title` that no other blog holds.
 *
 * Collisions get a numeric suffix rather than a random one — "nanny-share-tips"
 * and "nanny-share-tips-2" tell an admin at a glance that they have two
 * similarly named articles, where a hash would just look broken.
 *
 * @param {string} title
 * @param {string} [excludeId]  the blog being edited, so it doesn't collide
 *                              with its own existing slug
 */
export const uniqueSlug = async (title, excludeId = null) => {
  const base = slugify(title) || "resource";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };

    const taken = await Blogs.exists(query);
    if (!taken) return candidate;
  }

  // Fifty articles with the same title is not a real scenario, but returning
  // something unique beats returning a slug that will fail the unique index on
  // save and surface as an unexplained 500.
  return `${base}-${Date.now().toString(36)}`;
};

/**
 * Whether `value` looks like a Mongo id rather than a slug.
 *
 * The public article route accepts either, because the three original resources
 * are addressed by slug and everything the CMS produced before slugs existed is
 * addressed by id — and links to both are already out in the world.
 */
export const looksLikeObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));
