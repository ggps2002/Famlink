import React from "react";
import Button from "@shared/ui/Button";
import CommunityResourceCard from "@features/resources/components/CommunityResourceCard";
import { NavLink } from "react-router-dom";
import { SectionHeading, CardGrid } from "@shared/ui/Section";

import { articlesData as communityResource } from "@features/resources/articlesData";

/* The resources rail, shared by /, /families and /jobSeekers.
 *
 * Each of those three pages used to wrap it in a different padding (`py-24`,
 * `p-6 sm:p-8 lg:p-12`, `p-4 sm:p-6 lg:p-8`), so the same section breathed
 * differently on every page. The wrapper is now <Section tone="mist"> on all
 * three and this component brings none of its own.
 */
function Community() {
  return (
    <>
      <SectionHeading
        title="Nanny Share Resources"
        lede="Helpful guides to help you understand nanny shares and make confident childcare decisions."
        actions={
          <NavLink to="/resources">
            <Button
              btnText="View all Resources"
              size="lg"
              className="bg-aqua hover:bg-aqua-strong text-ink w-full sm:w-auto"
            />
          </NavLink>
        }
      />

      <CardGrid cols={3} className="items-stretch">
        {communityResource.map((resource, i) => (
          <CommunityResourceCard
            key={resource.slug ?? i}
            title={resource.title}
            exerpt={resource.excerpt}
            author={resource.author}
            time={resource.time}
            replyCount={resource.replyCount}
            img={resource.img}
            slug={resource.slug}
          />
        ))}
      </CardGrid>
    </>
  );
}

export default Community;
