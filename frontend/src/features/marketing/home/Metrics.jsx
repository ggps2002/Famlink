import React from "react";
import MetricCard from "@features/marketing/components/MetricCard";
import { SectionHeading, CardGrid } from "@shared/ui/Section";

const metrics = [
  {
    title: "Verified Providers",
    metric: "89+",
    subText: "Across all caregiving categories",
  },
  {
    title: "Families Served",
    metric: "158+",
    subText: "With personalized matches",
  },
  {
    title: "Provider Rating",
    metric: "4.8★",
    subText: "Average caregiver rating across the platform",
  },
];

/* NOTE FOR MARKETING: this section's heading is "Care Options That Fit Your
 * Life" — the exact same string as the Services section higher up the same
 * page, and it doesn't describe these numbers. Left as-is because copy isn't
 * the design system's call; worth replacing.
 */
function Metrics() {
  return (
    <>
      <SectionHeading title="Care Options That Fit Your Life" />

      <CardGrid cols={3}>
        {metrics.map((metric) => (
          <MetricCard
            key={metric.title}
            title={metric.title}
            metric={metric.metric}
            subText={metric.subText}
          />
        ))}
      </CardGrid>
    </>
  );
}

export default Metrics;
