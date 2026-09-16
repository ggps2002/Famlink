/**
 * The card chrome every profile screen is built from.
 *
 * Taken from the Figma profile page (node 16:994): a white 20px-radius card
 * under the "Light-shadow" style, 25px side padding, 30px top padding, and
 * section titles at 20px Livvic-SemiBold in Darkblue.
 *
 * The dividers are the reason these are components rather than a class string.
 * In the design a card like "Educations / Language / Additional details" is ONE
 * card whose sections are separated by rules that run the full card width — so
 * the padding belongs to each section, not to the card. Built as three separate
 * cards (or one padded card with inset rules) it reads noticeably differently.
 */
import { Fragment } from "react";

import InfoTip from "@shared/ui/InfoTip";
import { sentenceCase } from "@shared/lib/toCamelCase";

export const ProfileCard = ({ className = "", children }) => (
  <div className={`bg-white rounded-[20px] shadow-profile ${className}`}>{children}</div>
);

/** A padded band inside a ProfileCard. Stack several with CardDivider between. */
export const CardSection = ({ className = "", children }) => (
  <div className={`px-[25px] py-[25px] ${className}`}>{children}</div>
);

/** Edge-to-edge rule between two CardSections — no side padding, by design. */
export const CardDivider = () => <hr className="border-0 border-t border-[#EEEEEE]" />;

export const SectionTitle = ({ className = "", children }) => (
  <p className={`Livvic-SemiBold text-[20px] leading-[20px] text-[#001243] ${className}`}>
    {children}
  </p>
);

/** The bulleted lists used for educations, credentials and work experience. */
export const BulletList = ({ items }) => (
  <ul className="list-disc ps-[24px] space-y-[4px]">
    {items.map((item, index) => (
      <li key={index} className="Livvic-Medium text-[16px] leading-[24px] text-[#555555]">
        {sentenceCase(item)}
      </li>
    ))}
  </ul>
);

/**
 * "Label: value" on one line.
 *
 * Type is the design's Services row — label Livvic-SemiBold 18px in #555,
 * value Livvic-Medium 16px in #666 — but set inline rather than pushed to
 * opposite edges. At a column this wide, justified ends leave a gulf between a
 * question and its answer and the eye has to travel to pair them up; adjacent,
 * the pair reads as one fact.
 *
 * Line height is 24px rather than the frame's 16px because these values wrap,
 * and a wrapped value at 16/16 collides with the line under it.
 */
export const LabelledRows = ({ items }) => (
  <div className="flex flex-col gap-[16px]">
    {items.map((row) => (
      <p key={row.label} className="Livvic-Medium text-[16px] leading-[24px] text-[#666666]">
        <span className="Livvic-SemiBold text-[18px] leading-[24px] text-[#555555]">
          {`${row.label}: `}
        </span>
        {typeof row.value === "string" ? sentenceCase(row.value) : row.value}
      </p>
    ))}
  </div>
);

/**
 * The design's Services box verbatim: a label on the left and a price against
 * the right edge (1 Child … $25/h). Kept justified because that IS the frame —
 * a short price at a fixed right edge is a column you read down.
 *
 * A row may carry a `hint`, which puts an ⓘ after its label. Two prices in one
 * box are two different things — each family's share and a solo rate are not
 * the same question — and the label alone was never enough to tell them apart.
 */
export const PriceRows = ({ items }) => (
  <div className="flex flex-col gap-[30px]">
    {items.map((row) => (
      <div key={row.label} className="flex items-center justify-between gap-4">
        <span className="Livvic-SemiBold text-[18px] leading-[16px] text-[#555555] inline-flex items-center gap-[6px]">
          {row.label}
          <InfoTip text={row.hint} size={15} />
        </span>
        <span className="Livvic-Medium text-[16px] leading-[16px] text-[#666666] text-right">
          {row.value}
        </span>
      </div>
    ))}
  </div>
);

/** The ✔ list — a set of things that are true, with no label to read past. */
export const CheckList = ({ items }) => (
  <div className="flex flex-col">
    {items.map((item) => (
      <p
        key={String(item)}
        className="Livvic-Medium text-[16px] leading-[24px] text-[#555555]"
      >
        {`✔  ${sentenceCase(item)}`}
      </p>
    ))}
  </div>
);

/** The day-over-time schedule box. */
export const ScheduleList = ({ items }) => (
  <div className="flex flex-col gap-[22px]">
    {items.map(({ day, time }) => (
      <div key={day} className="flex flex-col gap-[16px]">
        <p className="Livvic-SemiBold text-[18px] leading-[16px] text-[#555555]">{day}</p>
        {time && (
          <p className="Livvic-Medium text-[16px] leading-[16px] text-[#666666]">{time}</p>
        )}
      </div>
    ))}
  </div>
);

const SectionBody = ({ section }) => {
  if (section.type === "text") {
    return <p className="Livvic text-[16px] leading-[24px] text-[#555555]">{section.value}</p>;
  }
  if (section.type === "rows") return <LabelledRows items={section.items} />;
  if (section.type === "bullets") return <BulletList items={section.items} />;
  if (section.type === "schedule") return <ScheduleList items={section.items} />;
  return <CheckList items={section.items} />;
};

const hasContent = (section) =>
  section.type === "text" ? Boolean(section.value) : (section.items?.length ?? 0) > 0;

/**
 * Renders a list of card specs, dropping any section with nothing to say and
 * any card left empty by that. Sections within a card get the full-width rules
 * between them, which is how the design groups related boxes.
 */
export const ProfileSectionCards = ({ cards }) =>
  cards
    .map((card) => ({ ...card, sections: (card.sections || []).filter(hasContent) }))
    .filter((card) => card.sections.length > 0)
    .map((card, cardIndex) => (
      <ProfileCard key={card.key ?? cardIndex}>
        {card.sections.map((section, index) => (
          <Fragment key={section.title}>
            {index > 0 && <CardDivider />}
            <CardSection className={index === 0 ? "pt-[30px]" : ""}>
              <SectionTitle className="mb-[16px]">{section.title}</SectionTitle>
              <SectionBody section={section} />
            </CardSection>
          </Fragment>
        ))}
      </ProfileCard>
    ));
