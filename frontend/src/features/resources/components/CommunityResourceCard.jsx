import { Clock } from "lucide-react";
import React from "react";
import { NavLink } from "react-router-dom";

/* Article teaser for the resources rail.
 *
 * Sizes were previously hand-tuned per variant down to the half-pixel
 * (text-[13.5px], text-[15px], text-[12px]) and the two variants disagreed on
 * the title size. Both now use the shared scale, so an image card and a
 * text-only card set type identically.
 */
function ResourceArticleCard({ title, exerpt, time, img, slug, hideImage }) {
  // If a slug is provided, we use it to build the link. Otherwise, we default to #
  const linkTo = slug ? `/resources/${slug}` : "#";

  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col h-full border border-gray-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      {/* Accent bar stands in for the cover image on the text-only variant. */}
      {hideImage && (
        <div className="px-5 pt-5">
          <div className="h-1.5 w-12 bg-accent rounded-full" />
        </div>
      )}

      {!hideImage && (
        <div className="relative w-full h-44 overflow-hidden shrink-0">
          {/* Lazy and async on purpose. These cards sit well below the fold on
            * the homepage, and three of them at ~60 KB each were being fetched
            * during the initial load — competing for bandwidth with the hero,
            * which is the LCP element. On the Slow 4G profile Lighthouse scores
            * mobile against, that is the difference between the hero arriving
            * and the hero queueing. */}
          <img
            src={img}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-top"
          />
        </div>
      )}

      <div className="flex flex-col flex-grow p-5">
        <h3 className="fl-h4 text-ink mb-2.5">{title}</h3>
        <p className="fl-small flex-1 mb-4">{exerpt}</p>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-3.5 mt-auto">
          <div className="fl-meta flex items-center gap-1.5">
            <Clock size={14} className="shrink-0 opacity-60" />
            <span>{time} min read</span>
          </div>

          <NavLink
            to={linkTo}
            className="font-livvic-bold text-sm text-ink inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            Read More
            <span aria-hidden="true">→</span>
          </NavLink>
        </div>
      </div>
    </div>
  );
}

export default ResourceArticleCard;
