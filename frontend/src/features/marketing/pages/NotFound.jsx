import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowLeft } from "lucide-react";
import SEOMetaData from "@shared/seo/SEOMetaData";
import NotFoundIllustration from "@shared/ui/NotFoundIllustration";

/* The page for a URL that doesn't exist — a mistyped address, an old link, a
 * profile that was removed. It says so plainly and offers the one useful next
 * step: back to where this visitor can actually do something (the dashboard
 * for a member, the homepage for everyone else).
 *
 * Rendered by the "*" route (and by the dashboard's own "*" for unknown member
 * pages), so it sits inside whatever header and footer that path gets. */
export default function NotFound() {
  const { pathname } = useLocation();
  const { user } = useSelector((s) => s.auth);
  const isMember = user?.type === "Parents" || user?.type === "Nanny";

  const home = isMember
    ? { to: "/dashboard", label: "Go to your dashboard" }
    : { to: "/", label: "Back to homepage" };

  return (
    <div className="bg-white">
      <SEOMetaData
        title="Page not found | FamLink"
        description="The page you were looking for doesn't exist or has moved."
        noIndex
      />

      <section className="fl-container fl-section-y flex flex-col items-center text-center">
        <NotFoundIllustration className="w-full max-w-[420px] sm:max-w-[480px] text-accent" />

        <h1 className="fl-h1 text-ink mt-10">We couldn&rsquo;t find that page</h1>
        <p className="fl-lede mt-4 max-w-xl">
          The link may be out of date, or the page may have moved. Let&rsquo;s get you back on track.
        </p>

        {/* The path they asked for, so a mistyped URL is easy to spot. */}
        <p className="fl-meta mt-3 max-w-full truncate" title={pathname}>
          {pathname}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <Link
            to={home.to}
            className="inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-strong text-ink font-livvic-semibold px-7 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {home.label}
          </Link>

          {!isMember && (
            <Link
              to="/find-nanny-share"
              className="inline-flex items-center rounded-full border border-line bg-white hover:bg-canvas text-ink font-livvic-semibold px-7 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
            >
              Find a nanny share
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
