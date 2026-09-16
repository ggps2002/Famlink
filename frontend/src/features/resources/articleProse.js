// How a published resource article looks.
//
// ────────────────────────────────────────────────────────────────────────────
// This is a CSS STRING rather than a stylesheet or Tailwind classes, and that
// is the whole point: the identical text is pasted into the admin console
// (Famylink-admin/lib/articleProse.ts) so the editor's live preview renders
// articles with exactly the rules the public page uses.
//
// The admin writes in a WYSIWYG that edits the rendered article directly. That
// promise is only true if both sides style the same HTML the same way — if the
// console styled an <h2> differently from the site, the editor would be showing
// a confident lie, which is worse than a plain textarea.
//
// Articles are stored as SEMANTIC HTML with no classes, because the server's
// sanitiser drops class attributes (Services/utils/sanitizeHtml.js allows
// attributes on <a>, <th> and <td> only). Everything below therefore hangs off
// element selectors under one wrapper class.
//
// KEEP THE TWO COPIES IN SYNC. If you change a rule here, change it there.
// ────────────────────────────────────────────────────────────────────────────

export const ARTICLE_PROSE_CSS = `
.article-prose {
  color: #444;
  font-size: 16px;
  line-height: 1.75;
  /* Stated explicitly rather than inherited. The public site sets this
     globally with a universal font-family rule in App.css; the admin console
     has no such rule, so without naming it here the editor would preview the
     right layout in the wrong typeface. */
  font-family: Livvic, system-ui, sans-serif;
}

.article-prose > * + * { margin-top: 1.15em; }

.article-prose h2,
.article-prose h3 {
  color: #111;
  font-family: "Livvic-Bold", system-ui, sans-serif;
  font-weight: 700;
  line-height: 1.3;
  margin-top: 2em;
  margin-bottom: 0.6em;
}
.article-prose h2 { font-size: 24px; }
.article-prose h3 { font-size: 19px; }
.article-prose > h2:first-child,
.article-prose > h3:first-child { margin-top: 0; }

.article-prose p { margin: 0; }

.article-prose a {
  color: #304B9E;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.article-prose a:hover { color: #001243; }

.article-prose strong, .article-prose b {
  color: #222;
  font-family: "Livvic-SemiBold", system-ui, sans-serif;
  font-weight: 600;
}

.article-prose ul,
.article-prose ol {
  padding-left: 1.4em;
  margin: 0;
}
.article-prose ul { list-style: disc; }
.article-prose ol { list-style: decimal; }
.article-prose li { margin-top: 0.5em; }
.article-prose li::marker { color: #AEC4FF; }

/* The callout. Every coloured panel the original hand-written articles used —
   "Quick Answer", the savings prompt — collapses to this one treatment, because
   a class-free document cannot express more than one kind of aside. */
.article-prose blockquote {
  background: #f8f9fa;
  border-left: 4px solid #AEC4FF;
  border-radius: 12px;
  padding: 18px 22px;
  margin: 1.6em 0;
  color: #333;
}
.article-prose blockquote > * + * { margin-top: 0.75em; }
.article-prose blockquote p { margin: 0; }

.article-prose table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
  /* Wide tables scroll inside their own wrapper rather than pushing the page
     sideways — see the .article-prose-scroll wrapper the pages apply. */
  display: table;
}
.article-prose th,
.article-prose td {
  border: 1px solid #e5e7eb;
  padding: 10px 14px;
  text-align: left;
  vertical-align: top;
}
.article-prose th {
  background: #f8f9fa;
  color: #001243;
  font-family: "Livvic-SemiBold", system-ui, sans-serif;
  font-weight: 600;
}

.article-prose hr {
  border: 0;
  border-top: 1px solid #e5e7eb;
  margin: 2em 0;
}

.article-prose code {
  background: #f3f4f6;
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 0.9em;
}
.article-prose pre {
  background: #f3f4f6;
  border-radius: 10px;
  padding: 14px 16px;
  overflow-x: auto;
}
.article-prose pre code { background: none; padding: 0; }

@media (min-width: 640px) {
  .article-prose { font-size: 17px; }
  .article-prose h2 { font-size: 28px; }
  .article-prose h3 { font-size: 21px; }
}
`;
