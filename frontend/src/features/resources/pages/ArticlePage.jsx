import React, { useEffect, useState } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";
import { articlesData } from "@features/resources/articlesData";
import { api } from "@shared/api/client";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { articleNode } from "@shared/seo/jsonLd";
import CustomButton from "@shared/ui/Button";
import { ArrowLeft } from "lucide-react";
import { ARTICLE_PROSE_CSS } from "@features/resources/articleProse";

// Rough read-time estimate for DB-published blogs, which (unlike the static
// articles) don't carry one.
const readMinutes = (html) => {
  const words = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const ArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  // The hardcoded originals, kept as a FALLBACK only.
  //
  // Once seedStaticResources.mjs has run, these same three live in the database
  // under the same slugs and are editable from the admin console — so the
  // database has to win, or an admin's correction would render everywhere
  // except the page they corrected. Before the seed has run, this is what keeps
  // the three articles on the site.
  const staticArticle = articlesData.find((a) => a.slug === slug);

  const [dbArticle, setDbArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Accepts a slug or a Mongo id — resources published before slugs
        // existed are linked by id from the weekly resources email.
        const { data } = await api.get(`/blogs/${slug}`);
        const blog = data?.data?.blog;
        if (!cancelled && blog) {
          setDbArticle({
            title: blog.title,
            excerpt: blog.excerpt,
            time: readMinutes(blog.content),
            coverImage: blog.featuredImage || null,
            datePublished: blog.publishedAt || blog.createdAt,
            dateModified: blog.updatedAt,
            content: (
              <div
                className="article-prose"
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            ),
          });
        }
      } catch {
        if (!cancelled) setDbArticle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const article = dbArticle || staticArticle;

  // Scroll to top when loading a new article
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Only block on the network when there is nothing else to show. For the three
  // originals the local copy renders instantly and the database version swaps in
  // behind it — a spinner over an article we already have would be a regression
  // for the site's three most-visited pages.
  if (loading && !staticArticle) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#FDF8F5] px-4 text-center">
        <p className="text-[#666] Livvic-Medium">Loading article…</p>
      </div>
    );
  }

  // If someone types a wrong URL or the article doesn't exist
  if (!article) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#FDF8F5] px-4 text-center">
        <h1 className="Livvic-Bold text-[#001243] text-4xl mb-4">Article Not Found</h1>
        <p className="text-[#666] Livvic-Medium mb-8">We couldn't find the resource you are looking for.</p>
        <NavLink to="/resources">
          <CustomButton btnText="Back to Resources" className="bg-primary text-white" />
        </NavLink>
      </div>
    );
  }

  const canonical = `https://famlink.care/resources/${slug}`;

  return (
    <div className="bg-[#f9fafb] min-h-screen pb-20">
      {/* The rules that style a published article's HTML. Shared verbatim with
          the admin console's live preview so what an author sees while writing
          is what actually publishes — see articleProse.js. */}
      <style>{ARTICLE_PROSE_CSS}</style>

      {/* SEO Tags dynamically generated for this specific article. Static
          articles carry ogImage + dates from articlesMeta.js; DB-CMS blogs
          can't be prerendered, so this client-side JSON-LD is all Google's
          renderer sees for them. */}
      <SEOMetaData
        title={`${article.title} | FamLink Resources`}
        description={article.excerpt}
        canonical={canonical}
        image={article.ogImage}
        type="article"
        jsonLd={[
          articleNode({
            headline: article.title,
            description: article.excerpt,
            image: article.ogImage,
            canonical,
            datePublished: article.datePublished,
            dateModified: article.dateModified,
          }),
        ]}
      />

      {/* Top Navigation Bar for returning to the main list */}
      <div className="bg-white border-b border-gray-100 py-4 sticky top-0 z-50">
        <div className="fl-container max-w-4xl flex items-center">
          <CustomButton
            type="button"
            onClick={() => navigate('/resources')}
            className="flex items-center gap-2 text-muted hover:text-ink transition-colors font-livvic-medium text-sm px-0 py-0 rounded-none"
          >
            <ArrowLeft size={20} />
            Back to Resources
          </CustomButton>
        </div>
      </div>

      {/* Hero Header Section */}
      <div className="w-full relative overflow-hidden bg-accent border-b border-gray-100 pt-16 pb-24 sm:pb-32">
        <div className="fl-container max-w-4xl text-center flex flex-col items-center relative z-10">
           <span className="fl-eyebrow inline-block bg-[#e0417a] text-white px-4 py-1.5 rounded-full mb-6 shadow-sm">
              {article.time} min read
           </span>
           <h1 className="fl-display text-ink max-w-heading">
              {article.title}
           </h1>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="fl-container max-w-4xl -mt-12 sm:-mt-16 relative z-10">
        <div className="bg-white rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-6 sm:p-10 md:p-14 border border-gray-100">
           {/* Cover image, when the article has one. Optional by design: the
               three original guides have none, and a placeholder in their place
               would be worse than the clean text-led layout they already have. */}
           {article.coverImage && (
             <img
               src={article.coverImage}
               alt=""
               className="w-full h-[220px] sm:h-[320px] object-cover object-top rounded-2xl mb-8"
             />
           )}

           {/* The actual article text */}
           {article.content}

           {/* Call To Action (CTA) Section - Added to the bottom of EVERY article */}
           <div className="mt-16 text-center bg-[#FDF8F5] p-8 sm:p-12 rounded-2xl">
              <h2 className="fl-h2 text-ink">
                Ready to find your perfect Nanny Share?
              </h2>
              <p className="fl-lede mt-4 mb-8 mx-auto max-w-prose">
                FamLink helps families connect with nearby parents who have similar schedules, childcare needs, and preferences. Join today to see who is looking in your area!
              </p>
              <NavLink to="/joinNow">
                <CustomButton
                  btnText="Sign Up for Free"
                  className="bg-accent hover:bg-accent-strong text-ink px-8 py-3 w-full sm:w-auto transition-colors"
                />
              </NavLink>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ArticlePage;
