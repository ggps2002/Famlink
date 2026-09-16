import React from "react";

// Content for the free "Nanny Share Payroll & Tax Guide" lead magnet. Kept
// plain-English and deliberately free of hard-coded dollar thresholds/rates,
// which change yearly — it points readers to the current IRS figures instead.
export default function PayrollTaxGuide() {
  return (
    <div>
      <h1 className="doc-title">The Nanny Share Payroll &amp; Tax Guide</h1>
      <p className="doc-lead">
        A nanny share saves money — but it also means you're a household employer. This guide walks
        through who's responsible for what, in plain English, so you can set up payroll correctly and
        avoid surprises at tax time.
      </p>

      <h2 className="doc-h2">1. Your nanny is an employee, not a contractor</h2>
      <p className="doc-p">
        The IRS treats a nanny who works in your home, on your schedule, as a <strong>household
        employee</strong> — not an independent contractor. That means a 1099 is generally the wrong
        form, and "nanny taxes" apply once you pay a household employee more than the IRS's annual
        threshold for the year (check the current figure at irs.gov — it changes each year).
      </p>

      <h2 className="doc-h2">2. In a share, each family is usually its own employer</h2>
      <p className="doc-p">
        The most common and cleanest setup: each family pays its own portion of the nanny's wages and
        handles its own payroll and taxes for that portion. So a two-family share typically means two
        household-employer setups — each with its own EIN, its own tax filings, and its own W-2 to the
        nanny at year end.
      </p>
      <div className="doc-callout">
        There are other structures (one family "employs" and the other reimburses), but they can shift
        tax and liability in ways that surprise people. Confirm your approach with a tax professional.
      </div>

      <h2 className="doc-h2">3. Set-up checklist (each family)</h2>
      <ol className="doc-ol">
        <li>Apply for a federal <strong>EIN</strong> (Employer Identification Number) — free at irs.gov.</li>
        <li>Register as an employer with your <strong>state</strong> (unemployment insurance, and often a state withholding account).</li>
        <li>Have your nanny complete <strong>Form I-9</strong> (work eligibility) and <strong>Form W-4</strong> (federal withholding); add the state W-4 equivalent if your state has one.</li>
        <li>Check whether your state requires <strong>workers' compensation</strong> or <strong>disability insurance</strong> for household employees.</li>
      </ol>

      <h2 className="doc-h2">4. What you withhold and pay</h2>
      <ul className="doc-ul">
        <li><strong>Social Security &amp; Medicare (FICA):</strong> shared between employer and employee — you withhold the employee's half and pay the employer's half.</li>
        <li><strong>Federal &amp; state income tax:</strong> withhold if you and your nanny agree to it (recommended so they aren't hit with a big bill).</li>
        <li><strong>Federal &amp; state unemployment (FUTA/SUTA):</strong> paid by the employer.</li>
        <li>Rates and wage bases change yearly — use current-year figures.</li>
      </ul>

      <h2 className="doc-h2">5. Run payroll on a regular schedule</h2>
      <p className="doc-p">
        Agree on a pay frequency (weekly is common for nannies) and give your nanny a pay stub showing
        gross pay, taxes withheld, and net pay each period. Pay the combined rate as gross so
        take-home is predictable and taxes are unambiguous.
      </p>

      <h2 className="doc-h2">6. Year-end forms</h2>
      <ul className="doc-ul">
        <li>Give your nanny a <strong>W-2</strong> (each employing family issues its own for its share of wages).</li>
        <li>File the <strong>W-2/W-3</strong> with the Social Security Administration.</li>
        <li>Report household-employment taxes on <strong>Schedule H</strong> with your personal Form 1040.</li>
        <li>File any required <strong>state</strong> year-end and quarterly returns.</li>
      </ul>

      <h2 className="doc-h2">7. Splitting the cost fairly</h2>
      <p className="doc-p">
        Decide how the combined hourly rate is divided — a 50/50 split is typical when both families
        use the full schedule. If one family uses fewer hours or an extra day, agree how that's
        prorated. Put the split in your Nanny Share Agreement so there's no ambiguity later.
      </p>

      <h2 className="doc-h2">8. Consider a nanny-payroll service</h2>
      <p className="doc-p">
        Household-payroll services can register your employer accounts, calculate and file taxes, and
        produce pay stubs and W-2s — several support nanny shares directly. For a two-family share it's
        often worth the fee to keep both households compliant with far less effort.
      </p>

      <h2 className="doc-h2">Quick checklist</h2>
      <ul className="doc-ul">
        <li>☐ EIN obtained (each family)</li>
        <li>☐ Registered with the state as an employer</li>
        <li>☐ I-9 and W-4 on file for the nanny</li>
        <li>☐ Workers' comp / disability checked for your state</li>
        <li>☐ Pay schedule set; gross rate and split written into the agreement</li>
        <li>☐ Payroll running with pay stubs each period</li>
        <li>☐ Plan in place for W-2, Schedule H, and state filings</li>
      </ul>

      <p className="doc-disclaimer">
        <strong>Disclaimer:</strong> This guide is general information, not tax or legal advice. Tax
        rules, thresholds, and rates change and vary by state and locality. Verify current requirements
        with the IRS, your state agencies, and a qualified tax professional before acting.
      </p>
    </div>
  );
}
