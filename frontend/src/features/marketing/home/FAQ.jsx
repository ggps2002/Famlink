import React, { useState } from "react";
import { Section } from "@shared/ui/Section";

const businessFaqs = [
  {
    question: "I own a childcare-related business. How can Famlink help me?",
    answer:
      "Whether you run a daycare, a tutoring center, or an after-school program, Famlink helps you connect with families searching for your services. You can create a business profile, list your services, and even hire staff through our job board.",
  },
  {
    question: "Can I post job listings for my business?",
    answer:
      "Yes! Businesses can post job listings for positions like childcare providers, private instructors, or administrative staff.",
  },
  {
    question: "How does Famlink help businesses get discovered?",
    answer:
      "Business listings appear in family searches based on location and service needs. Premium businesses also receive priority placement and additional marketing tools.",
  },
];

const caregiverFaqs = [
  {
    question:
      "Do I need nanny share experience?",
    answer:
      "No — you can join with or without nanny share experience. Families care most about your childcare background.",
  },
  {
    question: "Can I use FamLink if I don’t have a family yet?",
    answer:
      "Yes — you can get matched with families who are already looking for a nanny share.",
  },
  {
    question: "Can I add a second family to my current job?",
    answer:
      "Yes — you can open your schedule to another family and turn your current role into a nanny share.",
  },
  {
    question: "How does matching work?",
    answer:
      "We show you families nearby based on your availability and preferences. You can request matches and connect once there’s mutual interest.",
  },
  {
    question: "How is pay handled in a nanny share?  ",
    answer:
      "Each family pays a portion of your rate, so you typically earn more than working with just one family.",
  },
  {
    question: "Do I get to choose which families I work with?",
    answer:
      "Yes — you’re always in control. You decide who you connect with and move forward only if it feels right.",
  },
  {
    question: "Can I do a nanny share with my own child as a caregiver?",
    answer: (
      <>
        Yes — you can create a nanny share while caring for your own child.
        Many caregivers choose this setup to stay with their child while also
        earning income.
        <br />
        <br />
        Just keep in mind that this is still a nanny share, meaning you are
        caring for children from another family at the same time. Your rate,
        responsibilities, and expectations should reflect a nanny share
        arrangement.
      </>
    ),
  }
];

const faqs = [
  {
    question:
      "What is a nanny share?",
    answer:
      "A nanny share is a childcare arrangement where two families share one nanny. Families split the cost while children receive personalized care in a smaller home-based setting.",
  },
  {
    question: "Do I need to already have a nanny to use Famlink?",
    answer: (
      <>
        No. Families can:
        <ul>
          <li>• Look for another family to join their current nanny arrangement</li>
          <li>• Look for both a nanny and another family</li>
          <li>• Connect directly with nannies seeking nanny share positions</li>
        </ul>
      </>
    ),
  },
  {
    question: "How does matching work on Famlink?",
    answer:
      "Families and nannies create profiles with details like schedule, location, childcare preferences, and hosting preferences. Users can browse compatible profiles and send match requests  through the platform.",
  },
  {
    question: "What happens after a mutual match?",
    answer:
      "Once there’s a mutual match, families can connect directly through FamLink to discuss schedules, care needs, hosting arrangements, and next steps.",
  },
  {
    question: "How much can families save with a nanny share?",
    answer:
      "Many families pay significantly less than hiring a private nanny on their own since the cost is shared between families. Pricing varies depending on schedule, location, and nanny rates.",
  },
  {
    question: "How close do families need to live?",
    answer:
      "Most nanny shares work best when families live within a short driving distance of each other. Many families prefer matches within 1–5 miles.",
  },
  {
    question: "Can families with different schedules still share a nanny?",
    answer:
      "Yes. Some families share full-time schedules, while others coordinate part-time or after-school care depending on availability and needs.",
  },
  {
    question: "Where does the nanny share take place?",
    answer:
      "Every arrangement is different. Some families host in one consistent home, while others alternate between homes throughout the week.",
  },
  {
    question: "Can children of different ages participate in a nanny share?",
    answer:
      "Yes. Many nanny shares include children of different ages depending on the families' preferences and the nanny’s experience.",
  },
  {
    question: "Can I browse matches before subscribing?",
    answer:
      "Yes. Families can explore profiles and browse compatible matches on Famlink before deciding to upgrade or connect.",
  },
  {
    question: "What types of caregivers are on Famlink?",
    answer: (
      <>
        Famlink includes:
        <ul>
          <li>• Nannies</li>
          <li>• Nanny share caregivers</li>
          <li>• Caregivers already working with families</li>
          <li>• Caregivers looking for nanny share positions</li>
        </ul>
      </>
    ),
  },
  {
    question: "Does Famlink provide payroll services?",
    answer:
      "Famlink helps families connect and manage nanny share arrangements, but families are responsible for handling payroll, taxes, and employment compliance.",
  },
  {
    question: "Can I use Famlink if I only need part-time care?",
    answer: (
      <>
        Famlink includes:
        <ul>
          <li>• Full-time shares</li>
          <li>• Part-time shares</li>
        </ul>
      </>
    ),
  },
    {
    question: "Is nanny sharing better than daycare?",
        answer: (
      <>
        Every family is different, but many parents choose nanny sharing because it offers:
        <ul>
          <li>• Smaller group care </li>
          <li>• More flexibility</li>
          <li>• Personalized attention  </li>
          <li>• A home-based environment  </li>
          <li>• Built-in socialization  </li>
        </ul>
      </>
    ),
  },
    {
    question: "What if a match doesn’t work out?",
    answer:
      "Families can continue browsing and connecting with other compatible matches on the platform.",
  },
];

function FAQ({ business, caregiver }) {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const currentFaqs = business ? businessFaqs : caregiver ? caregiverFaqs : faqs;

  // Pages render <FAQ /> directly rather than inside a <Section>, so this
  // brings its own band. The heading was an <h1> at a one-off text-[52px];
  // it's now the same h2 as every other section heading on the site.
  return (
    <Section tone="white">
      <div className="mx-auto w-full max-w-3xl">
        <div className="fl-heading-gap flex flex-col items-center">
          <p className="fl-eyebrow text-muted rounded-full border-2 border-line py-2 px-5 mb-5">
            FAQ
          </p>
          <h2 className="fl-h2 text-ink text-center">Frequently Asked Questions</h2>
        </div>

        {/* One <button> per row: the rows used to be click-handled <div>s, which
            meant no keyboard access and nothing announced to a screen reader. */}
        <div className="flex flex-col gap-3">
          {currentFaqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`bg-white border-2 border-line overflow-hidden transition-all duration-200 ${
                  isOpen ? "rounded-3xl" : "rounded-3xl sm:rounded-full"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFAQ(i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}
                  className="font-livvic-bold text-ink text-base flex justify-between items-center gap-4 w-full text-left px-6 py-4 sm:px-7 sm:py-5"
                >
                  <span>{faq.question}</span>
                  <span aria-hidden="true" className="text-2xl font-light text-muted shrink-0">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div id={`faq-answer-${i}`} className="fl-small px-6 pb-5 sm:px-7">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

export default FAQ;
