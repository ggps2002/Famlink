import React from "react";

const Blank = ({ w }) => <span className={`doc-blank ${w || ""}`} />;

// Content for the free "Nanny Share Agreement" template. Fill-in blanks are
// rendered as underlined spaces so the printed PDF can be completed by hand or
// the on-screen copy adapted in a word processor.
export default function NannyShareAgreement() {
  return (
    <div>
      <h1 className="doc-title">Nanny Share Agreement</h1>
      <p className="doc-lead">
        A nanny share works best when both families and the nanny agree on the details up front.
        Fill in the blanks below together, review it with your nanny, and keep a signed copy for
        each household.
      </p>

      <h2 className="doc-h2">1. Parties</h2>
      <p className="doc-p">This agreement is made on <Blank w="short" />, 20<Blank w="short" /> between:</p>
      <ul className="doc-ul">
        <li><strong>Family A:</strong> <Blank /> — address <Blank /></li>
        <li><strong>Family B:</strong> <Blank /> — address <Blank /></li>
        <li><strong>Nanny:</strong> <Blank /> — address <Blank /></li>
      </ul>

      <h2 className="doc-h2">2. Term &amp; location</h2>
      <p className="doc-p">
        Care begins on <Blank w="short" /> and continues until ended under Section 11.
        Care will primarily take place at: <Blank w="long" />.
        Any change of location will be agreed by all parties in advance.
      </p>

      <h2 className="doc-h2">3. Schedule</h2>
      <p className="doc-p">The nanny will care for the children of both families on the following schedule:</p>
      <ul className="doc-ul">
        <li>Days &amp; hours: <Blank w="long" /></li>
        <li>Total hours per week: <Blank w="short" /></li>
        <li>Family A children (names &amp; ages): <Blank w="long" /></li>
        <li>Family B children (names &amp; ages): <Blank w="long" /></li>
      </ul>

      <h2 className="doc-h2">4. Compensation &amp; cost split</h2>
      <ul className="doc-ul">
        <li>Combined gross hourly rate paid to the nanny: $<Blank w="short" /> / hour</li>
        <li>Split between families: Family A <Blank w="short" />% · Family B <Blank w="short" />%</li>
        <li>Pay frequency: ☐ Weekly ☐ Bi-weekly ☐ Monthly, paid on <Blank w="short" /></li>
        <li>Method of payment: <Blank /></li>
      </ul>
      <div className="doc-callout">
        A common arrangement is a 50/50 split of a rate that is higher than a solo nanny's but lower
        per family — so the nanny earns more and each family pays less. Agree whether the rate is
        <strong> gross</strong> (before the nanny's taxes) or <strong>net</strong> (take-home). Gross
        is strongly recommended so tax responsibility is clear. See the Payroll &amp; Tax Guide.
      </div>

      <h2 className="doc-h2">5. Overtime</h2>
      <p className="doc-p">
        Hours beyond <Blank w="short" /> per week are paid at <Blank w="short" />× the hourly rate,
        consistent with applicable law. Overtime requested by one family only is paid by that family.
      </p>

      <h2 className="doc-h2">6. Guaranteed hours</h2>
      <p className="doc-p">
        Each family guarantees payment for <Blank w="short" /> hours per week even if the children are
        absent (for example, travel or illness), unless the nanny is unavailable.
      </p>

      <h2 className="doc-h2">7. Paid time off, holidays &amp; sick days</h2>
      <ul className="doc-ul">
        <li>Paid vacation days per year: <Blank w="short" /> (how scheduled: <Blank />)</li>
        <li>Paid sick days per year: <Blank w="short" /></li>
        <li>Paid holidays: <Blank w="long" /></li>
      </ul>

      <h2 className="doc-h2">8. Taxes &amp; payroll</h2>
      <p className="doc-p">
        The families understand that a nanny is a household employee, not an independent contractor.
        In a share, each family is generally treated as a separate employer for its share of wages.
        Responsibility for withholding and remitting taxes: <Blank w="long" />.
      </p>
      <div className="doc-callout">
        This is a common point of confusion — read the free FamLink Nanny Share Payroll &amp; Tax Guide
        before finalizing, and consider a payroll service that supports nanny shares.
      </div>

      <h2 className="doc-h2">9. Expenses &amp; supplies</h2>
      <p className="doc-p">
        Shared supplies (food, activities, outings) will be handled as follows:
        <Blank w="long" />. Mileage/transportation reimbursement: <Blank />.
      </p>

      <h2 className="doc-h2">10. House rules, health &amp; safety</h2>
      <ul className="doc-ul">
        <li>Discipline &amp; screen-time approach: <Blank w="long" /></li>
        <li>Sick-child policy (when a child stays home): <Blank w="long" /></li>
        <li>Allergies / medical needs: <Blank w="long" /></li>
        <li>Emergency contacts &amp; authorization to seek medical care: <Blank w="long" /></li>
        <li>Photos / social media of the children: ☐ Allowed ☐ Not allowed</li>
      </ul>

      <h2 className="doc-h2">11. Termination</h2>
      <p className="doc-p">
        Any party may end this agreement with <Blank w="short" /> days' written notice. If one family
        leaves the share, the families and nanny will discuss in good faith whether the arrangement
        continues. Immediate termination may occur for a serious safety concern or breach.
      </p>

      <h2 className="doc-h2">12. Confidentiality</h2>
      <p className="doc-p">
        Each party agrees to keep the other families' and the nanny's personal information private.
      </p>

      <h2 className="doc-h2">13. Signatures</h2>
      <div className="doc-sign-row">
        <div className="doc-sign-col">
          <div className="doc-sign-line" />
          <div className="doc-sign-label">Family A — signature &amp; date</div>
        </div>
        <div className="doc-sign-col">
          <div className="doc-sign-line" />
          <div className="doc-sign-label">Family B — signature &amp; date</div>
        </div>
      </div>
      <div className="doc-sign-row">
        <div className="doc-sign-col">
          <div className="doc-sign-line" />
          <div className="doc-sign-label">Nanny — signature &amp; date</div>
        </div>
      </div>

      <p className="doc-disclaimer">
        <strong>Disclaimer:</strong> This template is provided for general informational purposes only
        and is not legal advice. Employment, tax, and childcare laws vary by state and locality. Have a
        qualified attorney and/or tax professional review your final agreement before signing.
      </p>
    </div>
  );
}
