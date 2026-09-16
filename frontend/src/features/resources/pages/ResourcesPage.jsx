import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { articlesData } from "@features/resources/articlesData";
import { api } from "@shared/api/client";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { resourcesIndexMeta } from "@shared/seo/routeMeta";
import CommunityResourceCard from "@features/resources/components/CommunityResourceCard";
import { ArrowLeft } from "lucide-react";
import { Section, CardGrid } from "@shared/ui/Section";

// Read-time estimate for database articles, which don't store one.
const readMinutes = (html) => {
  const words = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const ResourcesPage = () => {
  const navigate = useNavigate();

  // Everything published through the admin console. This page used to render
  // only the three hardcoded articles, so nothing written in the CMS ever
  // reached the resources directory — a blog could be published and still be
  // invisible unless you had its direct URL.
  const [published, setPublished] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The endpoint returns published articles only; drafts are admin-side.
        const { data } = await api.get("/blogs", { params: { limit: 100 } });
        if (!cancelled) setPublished(Array.isArray(data?.data) ? data.data : []);
      } catch {
        // A failed fetch leaves the static fallback below in place rather than
        // emptying the page.
        if (!cancelled) setPublished([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Database articles win; the hardcoded three fill in only while they haven't
  // been seeded yet. Matching on slug is what stops a seeded article appearing
  // twice — once from the API and once from the local copy of itself.
  const articles = useMemo(() => {
    const fromDb = published.map((blog) => ({
      key: blog._id,
      // Published before slugs existed? Fall back to the id, which is what the
      // article route resolves for those.
      slug: blog.slug || blog._id,
      title: blog.title,
      excerpt: blog.excerpt,
      time: readMinutes(blog.content),
      img: blog.featuredImage || null,
    }));

    const seeded = new Set(fromDb.map((a) => a.slug));
    const fallback = articlesData
      .filter((a) => !seeded.has(a.slug))
      .map((a) => ({
        key: `static-${a.id}`,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        time: a.time,
        img: a.img,
      }));

    return [...fromDb, ...fallback];
  }, [published]);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-white min-h-screen">
      {/* SEO for the Resources directory page */}
      <SEOMetaData {...resourcesIndexMeta()} />

      {/* Navy band, same as the Resource Center and city-page heroes. The back
          link sits inside it rather than above, so it doesn't need its own band. */}
      <Section tone="ink" size="hero" className="relative">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white hover:text-accent transition-colors font-livvic-medium text-sm mb-8"
        >
          <ArrowLeft size={18} />
          Back to FamLink
        </button>

        <div className="text-center">
          <h1 className="fl-display text-white mx-auto max-w-heading">
            Nanny Share Resources
          </h1>
          <p className="fl-lede text-white/60 mt-5 mx-auto max-w-prose">
            Helpful guides to help you understand nanny shares and make confident
            childcare decisions.
          </p>
        </div>
      </Section>

      <Section tone="white">
        <CardGrid cols={3} className="items-stretch">
          {articles.map((article) => (
            <CommunityResourceCard
              key={article.key}
              title={article.title}
              exerpt={article.excerpt}
              time={article.time}
              img={article.img}
              // We pass the slug here so the card knows where to link to
              slug={article.slug}
              // Was hardcoded true, so a cover image uploaded in the admin
              // console rendered nowhere. Now per-article: one with a cover
              // shows it, one without keeps the text-led card it has today.
              hideImage={!article.img}
            />
          ))}
        </CardGrid>
      </Section>
    </div>
  );
};

export default ResourcesPage;
