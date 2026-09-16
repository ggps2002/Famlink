import React from "react";
import { Card } from "@shared/ui/Section";

/* A single headline number. Sits in a CardGrid, so the card no longer carries
 * its own `sm:w-[25rem]` — that fixed 400px was what made the metric row
 * overflow on small phones and stop short of the column on wide ones.
 */
function MetricCard({ title, subText, metric }) {
  return (
    <Card className="flex flex-col gap-2">
      {/* nanny-share/landing/Metrics.jsx passes "" for every title — guard so
          that doesn't reserve an empty line's worth of space. */}
      {title ? <p className="fl-h4 text-subtle">{title}</p> : null}
      <p className="fl-metric">{metric}</p>
      <p className="fl-body">{subText}</p>
    </Card>
  );
}

export default MetricCard;
