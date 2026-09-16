import "dotenv/config";
import mongoose from "mongoose";
import Blogs from "../src/modules/blog/blog.model.js";

// Move the three original resource articles into the database.
//
// ────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
//
// These three were hardcoded in the React app (frontend/src/data/articlesData.jsx)
// as JSX. That made them unreachable from the admin console — you could not fix
// a typo without a deploy — and it meant the resources page was showing two
// different kinds of thing from two different sources, one editable and one not.
//
// This script makes them ordinary blogs so they can be edited, unpublished and
// deleted like anything else. It keeps their EXACT slugs, because those URLs are
// indexed by Google and linked from the site.
//
// ── The one thing that is deliberately lost ─────────────────────────────────
//
// The JSX versions carried bespoke Tailwind styling: coloured callout panels,
// two-column comparison grids, a "Calculate My Savings" button. The admin
// editor writes semantic HTML and the server's sanitiser drops class attributes
// (Services/utils/sanitizeHtml.js allows attributes on <a>, <th> and <td> only),
// so none of that markup can survive a round trip through the CMS.
//
// Keeping it would mean an article that renders correctly until the first time
// anyone edits it, and then silently loses its layout. So the conversion is done
// once, here, deliberately: headings, paragraphs, lists and blockquote callouts,
// styled by the .article-prose rules the public page and the admin preview
// share. What you see in the editor is what publishes.
//
// Idempotent — matches on slug, so re-running updates rather than duplicating.
// Pass --force to overwrite content that has since been edited in the console.
// ────────────────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes("--force");

const ARTICLES = [
  {
    slug: "what-is-a-nanny-share",
    title: "What Is a Nanny Share?",
    category: "Tips for Parents",
    publishedAt: new Date("2026-07-06T00:00:00Z"),
    excerpt:
      "A nanny share is when two families hire one nanny together and split the cost. It's a simple way to receive personalized, in-home childcare while spending significantly less...",
    content: `<p><strong>Best for:</strong> Working parents &bull; Infants &bull; Toddlers</p>
<blockquote>
<p><strong>Quick answer.</strong> A nanny share is when two families hire one nanny together and split the cost. It's a simple way to receive personalized, in-home childcare while spending significantly less than hiring a private nanny on your own.</p>
</blockquote>

<h2>In this guide</h2>
<ul>
<li>What a nanny share is</li>
<li>How it works</li>
<li>Typical costs</li>
<li>Benefits</li>
<li>Things to consider</li>
<li>Is it right for your family?</li>
</ul>

<h2>What is a nanny share?</h2>
<p>Imagine another family in your neighborhood also needs childcare during the same hours you do. Instead of each family hiring their own nanny, you hire one nanny together and share the cost. The nanny cares for both families' children, creating a small, personalized childcare environment that is often more affordable than hiring a private nanny.</p>

<h2>How does it work?</h2>
<p>Most nanny shares include two families with similar schedules and children who are close in age. Some families host the nanny at one home every day, while others rotate between homes. Before getting started, families usually agree on schedules, expectations, and how the nanny's pay will be divided.</p>

<h2>What are the benefits?</h2>
<p>Families often choose a nanny share because it reduces childcare costs, provides more personalized attention than many daycare settings, offers flexible scheduling, and gives children the opportunity to socialize in a smaller group.</p>

<h2>Things to consider</h2>
<p>A successful nanny share depends on finding a family with compatible schedules, parenting styles, and expectations. Open communication and clear agreements help everyone stay on the same page.</p>

<h2>Is a nanny share right for you?</h2>
<p>A nanny share may be a great fit if you're looking to lower childcare costs, want more flexibility than daycare, and like the idea of your child spending time with another family. If your schedule changes frequently or you prefer one-on-one care at all times, another childcare option may be a better fit.</p>

<h2>Key takeaways</h2>
<ul>
<li>One nanny is shared by two families.</li>
<li>Families often save 30&ndash;50% compared to hiring their own nanny.</li>
<li>Children receive personalized care in a small group.</li>
<li>Finding a compatible family is one of the most important parts of a successful nanny share.</li>
</ul>`,
  },

  {
    slug: "how-does-a-nanny-share-work",
    title: "How Does a Nanny Share Work?",
    category: "Tips for Parents",
    publishedAt: new Date("2026-07-06T00:00:00Z"),
    excerpt:
      "A nanny share is a childcare arrangement where two families hire one nanny together and share the cost. The nanny cares for both families' children at the same time...",
    content: `<p><strong>Best for:</strong> Families exploring nanny shares</p>
<blockquote>
<p><strong>Quick answer.</strong> A nanny share is a childcare arrangement where two families hire one nanny together and share the cost. The nanny cares for both families' children at the same time, usually in one home or by rotating between homes.</p>
</blockquote>

<h2>In this guide</h2>
<ul>
<li>How a nanny share is set up</li>
<li>Where care takes place</li>
<li>How costs are shared</li>
<li>What families should discuss first</li>
<li>What a typical day looks like</li>
</ul>

<h2>How is a nanny share set up?</h2>
<p>Most nanny shares involve two families with similar childcare schedules. Once both families agree they're a good fit, they hire one nanny together and decide on a weekly schedule, pay, responsibilities, and communication expectations.</p>

<h2>Where does childcare happen?</h2>
<p>Some nanny shares are hosted at one family's home every day. Others rotate between both homes each week or on specific days. The best option depends on space, commuting, and what works best for everyone involved.</p>

<h2>How are costs shared?</h2>
<p>Families typically split the nanny's hourly wage based on the agreement they make together. In many cases, each family pays less than they would for a private nanny while the nanny earns more than they would working for a single family.</p>

<h2>What should families discuss first?</h2>
<p>Before starting, talk about schedules, sick-day policies, holidays, transportation, meals, naps, screen time, discipline, and communication. Having these conversations early helps avoid misunderstandings later.</p>

<h2>What does a typical day look like?</h2>
<p>A typical day looks much like a regular nanny's routine: arrival, playtime, meals, naps, outdoor activities, learning, and pickup. The biggest difference is that the nanny is caring for children from two families instead of one.</p>

<h2>Key takeaways</h2>
<ul>
<li>One nanny cares for two families' children.</li>
<li>Families agree on a shared schedule and expectations.</li>
<li>Care can happen at one home or rotate between homes.</li>
<li>Open communication is one of the biggest factors in a successful nanny share.</li>
</ul>`,
  },

  {
    slug: "nanny-share-vs-daycare",
    title: "Nanny Share vs. Daycare: Which Is Right for Your Family?",
    category: "Tips for Parents",
    publishedAt: new Date("2026-07-06T00:00:00Z"),
    excerpt:
      "A nanny share and daycare are two of the most common childcare options for working parents, but they offer very different experiences. A nanny share combines...",
    content: `<p><strong>Best for:</strong> Parents exploring childcare options</p>
<blockquote>
<p><strong>Quick answer.</strong> A nanny share and daycare are two of the most common childcare options for working parents, but they offer very different experiences. A nanny share combines the personalized care of a private nanny with the cost savings of sharing childcare with another family. Daycare provides a structured classroom setting with larger groups of children and fixed daily schedules. If you're looking for more flexibility, individualized attention, and a smaller caregiver-to-child ratio, a nanny share may be the better fit.</p>
</blockquote>

<p><strong>Curious how much you could save?</strong> Before comparing childcare options, estimate what a nanny share could cost in your area using the <a href="/calculator">FamLink Nanny Share Savings Calculator</a>.</p>

<h2>In this guide</h2>
<ul>
<li>Personalized care</li>
<li>Caregiver-to-child ratio</li>
<li>Cost</li>
<li>Flexibility</li>
<li>Illness exposure</li>
<li>Socialization</li>
<li>Which option is right for you?</li>
</ul>

<h2>Personalized care</h2>
<p>A nanny share provides care in a home environment with a much smaller group of children. This often allows for routines that match each child's needs, including naps, meals, learning activities, and outdoor play. Daycare follows a structured schedule designed for larger groups of children.</p>

<h2>Caregiver-to-child ratio</h2>
<table>
<thead>
<tr><th>Nanny share</th><th>Daycare</th></tr>
</thead>
<tbody>
<tr>
<td>Usually 2&ndash;4 children, with one dedicated nanny and more individualized attention.</td>
<td>Teacher-to-child ratios vary by state. Common examples: infants 1:3&ndash;5, toddlers 1:4&ndash;7, preschool 1:8&ndash;12.</td>
</tr>
</tbody>
</table>
<p><strong>Why it matters:</strong> smaller groups often allow caregivers to spend more one-on-one time with each child.</p>

<h2>Cost</h2>
<p>A nanny share typically costs less than hiring your own private nanny because two families split the cost. While daycare is often the lowest-cost option, many families choose a nanny share because it offers a balance between affordability and personalized care.</p>

<h2>Flexibility</h2>
<p>Most daycare centers operate on fixed hours with set drop-off and pick-up times. For parents with long commutes or changing work schedules, those schedules may not always be ideal. Nanny shares are often more flexible because families work directly with their nanny to create a schedule that fits everyone's needs.</p>

<h2>Illness exposure</h2>
<p>Because daycare centers bring together larger groups of children who share toys, classrooms, and play spaces, many children experience more frequent colds during their first year. A nanny share involves a much smaller group of children, which may reduce exposure to common illnesses while still giving children opportunities to socialize.</p>

<h2>Socialization</h2>
<p>Daycare introduces children to larger groups every day. Nanny shares also provide socialization, but in a smaller, familiar setting with the same children, helping many children build strong friendships and consistent routines.</p>

<h2>Which option is right for you?</h2>
<p><strong>A nanny share may be a great fit if you:</strong></p>
<ul>
<li>Want more personalized care</li>
<li>Prefer a smaller caregiver-to-child ratio</li>
<li>Need a flexible schedule</li>
<li>Want to share the cost of a nanny</li>
</ul>
<p><strong>Daycare may be a good fit if you:</strong></p>
<ul>
<li>Prefer a classroom environment</li>
<li>Want a highly structured daily routine</li>
<li>Are looking for a lower-cost childcare option</li>
</ul>

<h2>Key takeaways</h2>
<ul>
<li>Nanny shares combine personalized care with shared costs.</li>
<li>Smaller groups may mean more individualized attention and lower illness exposure.</li>
<li>Daycare offers structured routines and larger group interaction.</li>
<li>The best choice depends on your family's priorities.</li>
</ul>`,
  },
];

const run = async () => {
  if (!process.env.MONGO_DB_URI) {
    console.error("MONGO_DB_URI is not set. Run this from the backend directory.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_DB_URI);
  console.log(`Seeding ${ARTICLES.length} static resources${FORCE ? " (--force)" : ""}…\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const article of ARTICLES) {
    const existing = await Blogs.findOne({ slug: article.slug });

    if (!existing) {
      await Blogs.create({ ...article, isDraft: false, featuredImage: "" });
      console.log(`  created  ${article.slug}`);
      created += 1;
      continue;
    }

    // Already here. Overwriting by default would silently throw away edits made
    // in the console — the very thing this migration exists to enable — so a
    // second run leaves them alone unless --force says otherwise.
    if (!FORCE) {
      console.log(`  skipped  ${article.slug} (already exists; --force to overwrite)`);
      skipped += 1;
      continue;
    }

    existing.title = article.title;
    existing.excerpt = article.excerpt;
    existing.content = article.content;
    existing.category = article.category;
    existing.isDraft = false;
    if (!existing.publishedAt) existing.publishedAt = article.publishedAt;
    await existing.save();
    console.log(`  updated  ${article.slug}`);
    updated += 1;
  }

  console.log(`\n${created} created, ${updated} updated, ${skipped} skipped.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
