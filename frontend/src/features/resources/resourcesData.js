import { Calculator, FileText, Receipt } from "lucide-react";

// The three Resource Center lead magnets (Category 4.2). `type: "tool"` is the
// interactive calculator rendered inline on the hub; `type: "download"` items
// open the email-capture modal, then reveal a printable resource page.
export const RESOURCES = [
  {
    slug: "cost-calculator",
    type: "tool",
    icon: Calculator,
    eyebrow: "Interactive tool",
    title: "Nanny Share Cost Calculator",
    description:
      "Compare a solo nanny vs. a nanny share and see how much your family could save each month — based on your ZIP code and the hours you need.",
    cta: "Open the calculator",
    accent: { bg: "#E6F1FB", fg: "#185FA5" },
  },
  {
    slug: "nanny-share-agreement",
    type: "download",
    icon: FileText,
    eyebrow: "Free template",
    title: "Nanny Share Agreement Template",
    description:
      "Get it in writing. A ready-to-fill agreement covering the schedule, cost split, time off, and house rules for both families and your nanny.",
    cta: "Get the template",
    accent: { bg: "#E1F5EE", fg: "#0F6E56" },
  },
  {
    slug: "payroll-tax-guide",
    type: "download",
    icon: Receipt,
    eyebrow: "Free guide",
    title: "Nanny Share Payroll & Tax Guide",
    description:
      "Who's the employer? How do you split the taxes? A plain-English walkthrough of payroll, withholding, and year-end forms for a two-family share.",
    cta: "Get the guide",
    accent: { bg: "#EEEDFE", fg: "#534AB7" },
  },
];

export const RESOURCE_BY_SLUG = Object.fromEntries(
  RESOURCES.map((r) => [r.slug, r])
);

// Care-timeline options offered on the capture form. The value is stored on the
// lead and used to prioritise follow-up in the drip sequence.
export const CARE_TIMELINE_OPTIONS = [
  "As soon as possible",
  "Within 1 month",
  "1–3 months",
  "3+ months",
  "Just researching",
];
