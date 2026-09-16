// HTML sanitiser for admin-authored legal copy.
//
// The terms editor stores HTML and the public terms page renders it with
// dangerouslySetInnerHTML. That is a stored-XSS sink pointed at every user of
// the site, so the content is cleaned on the way IN — once, at publish — rather
// than on every read.
//
// Cleaning on write is the right side to do it on here for a specific reason:
// the terms are read by anonymous visitors, by the signup checkbox, by the
// dashboard modal and by whatever surface is added next. Each of those would
// have to remember to sanitise. There is one writer, and it is behind the admin
// gate, so one call covers every reader forever.
//
// THIS IS AN ALLOW-LIST, and it is deliberately not a general-purpose
// sanitiser. It handles the tags a rich-text legal document uses and drops
// everything else. If the editor ever needs tables or images, add them here
// rather than loosening the filter — and do not replace this with a blocklist,
// which is the approach that has never once worked against XSS.

// Tags a legal document legitimately contains. No <img> (tracking pixels in
// terms are a dark pattern), no <iframe>, no <form>, no <style>.
const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "s",
  "blockquote", "code", "pre",
  "a", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
]);

// Per-tag attribute allow-list. Anything not named here is dropped, which is
// what removes every on* event handler without needing to enumerate them.
const ALLOWED_ATTRS = {
  a: new Set(["href", "title", "target", "rel"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
};

// Only these can appear in an href. `javascript:` is the obvious one; `data:`
// is the one people forget, and data:text/html executes just as happily.
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

const escapeText = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const cleanAttributes = (tag, rawAttrs) => {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed || !rawAttrs) return "";

  const out = [];
  // name="value" | name='value' | name=value | name
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

  let match;
  while ((match = attrPattern.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.has(name)) continue;

    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (name === "href" && !SAFE_URL.test(value.trim())) continue;

    // A link that opens a new tab and can reach back through window.opener is
    // a tabnabbing vector, so target=_blank always carries the counter-measure
    // rather than trusting the author to have typed it.
    if (name === "target") {
      out.push('target="_blank"', 'rel="noopener noreferrer"');
      continue;
    }
    if (name === "rel") continue; // handled with target above

    out.push(`${name}="${escapeText(value).replace(/"/g, "&quot;")}"`);
  }

  return out.length ? ` ${out.join(" ")}` : "";
};

export const sanitizeHtml = (input) => {
  if (typeof input !== "string" || !input.trim()) return "";

  let html = input;

  // Strip whole dangerous elements INCLUDING their contents. Removing only the
  // tags would leave the script body behind as text, which — once the browser
  // re-parses the surrounding markup — can end up executing anyway.
  html = html.replace(
    /<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  // The same elements left unclosed, which the pass above cannot match.
  html = html.replace(/<(script|style|iframe|object|embed|noscript|template)\b[^>]*>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Walk every remaining tag; anything not in the allow-list is removed while
  // its text content is kept, so dropping an unknown wrapper doesn't silently
  // delete a clause of the contract.
  html = html.replace(
    /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_full, closing, tagName, attrs) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return `</${tag}>`;
      const selfClosing = tag === "br" || tag === "hr";
      return `<${tag}${cleanAttributes(tag, attrs)}${selfClosing ? " /" : ""}>`;
    }
  );

  // Any `<` that survived the pass above was never part of a tag — it is
  // literal text such as "if x < y". Escape it so it can't combine with
  // later input to reopen a tag.
  html = html.replace(/<(?![/a-zA-Z])/g, "&lt;");

  return html.trim();
};

// Plain-text version, for a summary or a search index. Never render this as
// HTML — it has been unescaped and is not safe to reinsert.
export const htmlToText = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
