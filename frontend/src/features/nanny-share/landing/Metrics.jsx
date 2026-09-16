import React from "react";
import MetricCard from "@features/marketing/components/MetricCard";

const metrics = [
  {
    title: "",
    metric: "2,300+",
    subText: "Families actively looking to nanny share",
  },
  {
    title: "",
    metric: "5,800+",
    subText: "Nannies open to shared arrangements",
  },
  {
    title: "",
    metric: "720",
    subText: "Nanny share posts added this month",
  },
];

function Metrics() {
  return (
    <div className="container py-12 sm:py-24 px-4 sm:px-0">
      <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap sm:justify-between gap-4 sm:gap-6 py-6">
        {metrics.map((metric) => (
          <MetricCard 
            key={metric.title} 
            title={metric.title} 
            metric={metric.metric} 
            subText={metric.subText}
          />
        ))}
      </div>
    </div>
  );
}

export default Metrics;