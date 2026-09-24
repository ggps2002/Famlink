import React from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import SEOMetaData from "@shared/seo/SEOMetaData";
import NannyShareAgreement from "@features/resources/content/NannyShareAgreement";
import PayrollTaxGuide from "@features/resources/content/PayrollTaxGuide";
import { DOWNLOADS_META, downloadMeta } from "@shared/seo/routeMeta";

import CustomButton from "@shared/ui/Button";
// The printable resource documents delivered by the Resource Center lead magnets.
// Reached from the capture modal (and from the emailed link). Each renders as a
// clean, print-optimized document — the toolbar is hidden when printing so a
// browser "Save as PDF" produces a tidy handout. Titles/descriptions live in
// routeMeta's DOWNLOADS_META so the prerender script shares them.
const DOCUMENTS = {
  "nanny-share-agreement": {
    ...DOWNLOADS_META["nanny-share-agreement"],
    Component: NannyShareAgreement,
  },
  "payroll-tax-guide": {
    ...DOWNLOADS_META["payroll-tax-guide"],
    Component: PayrollTaxGuide,
  },
};

export default function ResourceDownloadPage() {
  const { slug } = useParams();
  const doc = DOCUMENTS[slug];

  // Unknown slug → send them back to the hub rather than showing an empty page.
  if (!doc) return <Navigate to="/nanny-share-resources" replace />;

  const { Component } = doc;

  return (
    <div className="resource-doc-page">
      <SEOMetaData {...downloadMeta(slug)} />

      {/* Toolbar — hidden when printing.
          The document body below deliberately does NOT use the marketing type
          scale: the `.doc-*` rules are sized for a printed handout, and the
          web scale would blow the layout across page breaks. Only this
          chrome follows the design tokens. */}
      <div className="no-print sticky top-0 z-10 bg-ink text-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/nanny-share-resources"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Back to resources
          </Link>
          <CustomButton
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-strong text-ink font-livvic-bold text-sm px-4 py-2 rounded-full transition-colors"
          >
            <Printer size={16} /> Print / Save as PDF
          </CustomButton>
        </div>
      </div>

      {/* Document */}
      <div className="doc-sheet">
        <div className="doc-brand">
          <span className="doc-brand-mark">FamLink</span>
          <span className="doc-brand-sub">Nanny share made simple · famlink.care</span>
        </div>
        <Component />
        <p className="doc-footer-note">
          Provided free by FamLink. Find a nanny share family near you at{" "}
          <span className="doc-link">famlink.care/find-nanny-share</span>.
        </p>
      </div>

      <style>{`
        .resource-doc-page { background: #E9E6E0; min-height: 100vh; }
        .doc-sheet {
          max-width: 800px; margin: 24px auto; background: #fff;
          padding: 56px 64px; border-radius: 4px;
          box-shadow: 0 4px 24px rgba(0,18,67,0.12);
          font-family: 'Livvic', Arial, sans-serif; color: #1f2937;
        }
        .doc-brand { border-bottom: 2px solid #001243; padding-bottom: 12px; margin-bottom: 28px; }
        .doc-brand-mark { display: block; font-size: 22px; font-weight: 900; color: #001243; letter-spacing: -0.3px; }
        .doc-brand-sub { display: block; font-size: 12px; color: #6b7280; margin-top: 2px; }
        .doc-title { font-size: 28px; font-weight: 900; color: #001243; line-height: 1.2; margin-bottom: 6px; }
        .doc-lead { font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px; }
        .doc-h2 { font-size: 16px; font-weight: 700; color: #001243; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #E5E7EB; }
        .doc-p { font-size: 13.5px; line-height: 1.7; color: #374151; margin-bottom: 10px; }
        .doc-ul { margin: 8px 0 12px 18px; }
        .doc-ul li { font-size: 13.5px; line-height: 1.7; color: #374151; margin-bottom: 5px; list-style: disc; }
        .doc-ol { margin: 8px 0 12px 20px; }
        .doc-ol li { font-size: 13.5px; line-height: 1.7; color: #374151; margin-bottom: 6px; list-style: decimal; }
        .doc-blank { display: inline-block; min-width: 160px; border-bottom: 1px solid #9ca3af; height: 1em; vertical-align: baseline; }
        .doc-blank.short { min-width: 90px; }
        .doc-blank.long { min-width: 100%; }
        .doc-callout { background: #F6F3EE; border-left: 4px solid #AEC4FF; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #4b5563; line-height: 1.6; margin: 16px 0; }
        .doc-sign-row { display: flex; gap: 32px; margin-top: 16px; flex-wrap: wrap; }
        .doc-sign-col { flex: 1; min-width: 200px; }
        .doc-sign-line { border-bottom: 1px solid #6b7280; height: 40px; margin-bottom: 4px; }
        .doc-sign-label { font-size: 11px; color: #6b7280; }
        .doc-disclaimer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9ca3af; line-height: 1.6; }
        .doc-footer-note { margin-top: 28px; font-size: 12px; color: #6b7280; text-align: center; }
        .doc-link { color: #185FA5; font-weight: 600; }

        @media (max-width: 640px) {
          .doc-sheet { padding: 32px 24px; margin: 12px; }
        }
        @media print {
          .no-print { display: none !important; }
          .resource-doc-page { background: #fff; }
          .doc-sheet { box-shadow: none; margin: 0; max-width: 100%; padding: 0; border-radius: 0; }
          .doc-h2 { break-after: avoid; }
        }
      `}</style>
    </div>
  );
}
