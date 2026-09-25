import React from "react";
import CustomButton from "@shared/ui/Button";
import { NavLink } from "react-router-dom";
import { Clock } from "lucide-react";
import clsx from "classnames";
import { SectionHeading } from "@shared/ui/Section";

import { articlesData as communityResource } from "@features/resources/articlesData";

/* The resources rail, shared by /, /families and /jobSeekers.
 *
 * Each of those three pages used to wrap it in a different padding (`py-24`,
 * `p-6 sm:p-8 lg:p-12`, `p-4 sm:p-6 lg:p-8`), so the same section breathed
 * differently on every page. The wrapper is now a <Section> on all three and
 * this component brings none of its own.
 *
 * Layout is a "rich preview" blog block: the first article runs full width as
 * the featured story (image beside the copy on desktop), the rest sit two-up
 * beneath it. The whole card is the link, so there's no separate "Read More".
 */

const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

function ArticleMeta({ time, date }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="fl-eyebrow rounded-full bg-aqua text-ink px-3 py-1">
        Guide
      </span>
      <span className="fl-small flex items-center gap-2 text-ink/70">
        <span className="text-ink/70">By</span>
        <span className="flex items-center gap-1">
          <img
            src="/logo3.png"
            alt=""
            aria-hidden="true"
            className="h-5 w-5 object-contain"
          />
          <span className="text-ink font-livvic-semibold">Famlink</span>
        </span>
      </span>
      <span className="fl-meta text-ink/70 flex items-center gap-1.5">
        <Clock size={14} className="shrink-0 opacity-60" />
        {time} min read
        {date && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={date}>{formatDate(date)}</time>
          </>
        )}
      </span>
    </div>
  );
}

function ArticlePreview({ article, featured = false }) {
  const to = `/resources/${article.slug}`;
  // The featured story carries its own "Read the guide" link, so only that is
  // clickable; the smaller cards have no button and stay whole-card links.
  const Wrapper = featured ? "div" : NavLink;
  const wrapperProps = featured ? {} : { to };

  return (
    <Wrapper
      {...wrapperProps}
      className={clsx(
        "flex flex-col gap-5 rounded-2xl",
        featured
          ? "md:col-span-2 lg:flex-row lg:items-start lg:gap-10"
          : "group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-[#DDF9FD]"
      )}
    >
      {/* Lazy and async on purpose: this rail sits well below the fold and
       * must not compete with the hero (the LCP element) for bandwidth. */}
      <div
        className={clsx(
          "relative overflow-hidden rounded-2xl bg-white aspect-video shrink-0",
          featured && "lg:w-[58%]"
        )}
      >
        <img
          src={article.img}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-col gap-4">
        <ArticleMeta time={article.time} date={article.datePublished} />
        <div className="flex flex-col gap-2">
          <h3
            className={clsx(
              "text-ink transition-opacity group-hover:opacity-75",
              featured
                ? "font-livvic-bold text-2xl sm:text-3xl leading-tight tracking-tight"
                : "fl-h3"
            )}
          >
            {article.title}
          </h3>
          <p className={clsx(featured ? "fl-body" : "fl-small", "text-ink/75 line-clamp-3")}>
            {article.excerpt}
          </p>
        </div>
        {featured && (
          <NavLink
            to={to}
            className="group/read self-start inline-flex items-center gap-1.5 font-livvic-bold text-base sm:text-lg text-ink underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            Read the guide
            <span
              aria-hidden="true"
              className="transition-transform group-hover/read:translate-x-1"
            >
              →
            </span>
          </NavLink>
        )}
      </div>
    </Wrapper>
  );
}

function Community() {
  const [featured, ...rest] = communityResource;

  return (
    <>
      <SectionHeading
        title="Nanny Share Resources"
        lede="Helpful guides to help you understand nanny shares and make confident childcare decisions."
        // Sits on a light cyan band, so the heading is dark navy.
        titleClassName="text-ink"
        ledeClassName="text-ink/75"
        // Button level with the title, as in the rich-preview layout.
        actionsAlign="start"
        actions={
          <NavLink to="/resources">
            <CustomButton
              btnText="View all Resources"
              size="lg"
              className="bg-aqua hover:bg-aqua-strong text-ink w-full sm:w-auto"
            />
          </NavLink>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
        {featured && <ArticlePreview article={featured} featured />}
        {rest.map((article) => (
          <ArticlePreview key={article.slug} article={article} />
        ))}
      </div>
    </>
  );
}

export default Community;
