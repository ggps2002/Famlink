// Content rules for member-to-member messages.
//
// Until now a message was whatever the client sent: the socket handler took
// `content.content` and wrote it straight to the database. On a platform where
// parents are handing over their address and caregivers are handing over their
// bank details, "anything goes" is the wrong default — the two populations most
// attracted to that are advance-fee scammers and people sending unsolicited
// sexual content.
//
// ────────────────────────────────────────────────────────────────────────────
// THE DESIGN, AND WHY IT IS NOT A PROFANITY FILTER
//
// A single banned-word list has one setting, and it is always wrong: strict
// enough to stop harassment and it eats "this job is a bloody nightmare";
// loose enough to leave that alone and it passes everything that matters.
//
// So each rule carries its own WEIGHT, and the weights add up to a score that
// decides one of three outcomes:
//
//   allow  — delivered, nothing recorded.
//   flag   — DELIVERED, and recorded for an admin to look at.
//   block  — NOT delivered. The sender is told why. Recorded.
//
// The asymmetry is deliberate. Blocking is reserved for content where delivery
// is itself the harm — sexual content aimed at a person, threats, and the
// specific money-movement patterns that make up nearly every scam on a
// marketplace like this. Everything else is delivered and flagged, because a
// false positive that silently eats a real message between a parent and their
// caregiver is a worse failure than a rude message an admin reads later.
//
// This is a floor, not a ceiling. It stops the obvious and the automated; it
// will not stop someone careful. That is what the report button and the
// moderation queue are for, and why every flag lands in a queue a human works
// rather than triggering an automatic sanction.
// ────────────────────────────────────────────────────────────────────────────

/* ───────────────────────────── normalisation ────────────────────────────── */

// Defeat the cheap evasions before any rule runs: "f.r.e.e   m0ney", "ѕcam"
// with a Cyrillic es, "𝗪𝗵𝗮𝘁𝘀𝗔𝗽𝗽" in maths-bold.
//
// This is intentionally shallow. Full confusable-mapping is a large table and
// an arms race; these four steps cover what actually appears in spam without
// pretending to be exhaustive.
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

const normalise = (input) => {
  let text = String(input || "")
    // NFKD folds mathematical-alphanumeric and fullwidth forms back to ASCII.
    .normalize("NFKD")
    // Strip the combining marks NFKD just separated out, so "ｅ" and "é" both
    // become "e" rather than one of them surviving as a distinct character.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  text = text.replace(/[0134579@$!]/g, (char) => LEET[char] || char);

  // Collapse runs: "heyyyyy" → "heyy". Two is kept because doubled letters are
  // real English ("bee", "off"); three or more never are.
  text = text.replace(/(.)\1{2,}/g, "$1$1");

  return text;
};

// A second view of the text with every separator removed, so "f r e e" and
// "w-h-a-t-s-a-p-p" match a rule written as one word. Checked in addition to
// the normal form, never instead of it — collapsing separators makes innocent
// text collide ("as sis" → "assis"), so only rules that are safe under that
// collapse are tested against it.
const deSpaced = (text) => text.replace(/[\s._\-*+~|/\\]/g, "");

/* ──────────────────────────────── the rules ─────────────────────────────── */

// Weights, and what each band means:
//
//   1–2   noise on its own; only matters when it stacks with something else.
//   3     one of these plus anything → flagged.
//   4     flagged on its own.
//   6+    blocked on its own.
//
// `deSpaced: true` means the pattern is also tried against the separator-free
// view. Only set it where a false match is implausible.
//
// `ambiguous: true` marks a rule whose match has a plausible innocent reading.
// A message that trips ONLY ambiguous rules is never blocked, however many it
// trips — see the cap in moderateMessage. This is what stops soft signals
// summing their way to a refusal: "we're currently abroad and our relocation
// agent will handle the paperwork" is two scam-setup hits and also an entirely
// real sentence from an international family, and eating it silently is the
// failure this file's header says to avoid.

const RULES = [
  /* ── sexual content ────────────────────────────────────────────────────
     Blocked on its own, not flagged. This is a childcare platform; an
     unsolicited sexual message to a caregiver is the thing most likely to
     make someone leave and never come back, and "we let it through and
     reviewed it on Monday" is not an acceptable answer to it. */
  {
    id: "sexual_explicit",
    category: "sexual_content",
    weight: 6,
    deSpaced: true,
    pattern:
      /\b(?:d[i1]ck p[i1]c|s[e3]nd nud[e3]s?|nud[e3] p[i1]cs?|c[o0]ck|p[u\*]ssy|blowj[o0]b|handj[o0]b|cum[mn]?[i1]ng?|jerk[i1]ng? [o0]ff|h[o0]rny|s[e3]xt[i1]ng?|fuck m[e3]|s[u\*]ck my|[e3]at my)\b/,
  },
  {
    id: "sexual_solicitation",
    category: "sexual_content",
    weight: 6,
    pattern:
      /\b(?:sugar (?:daddy|baby|momm?[ay])|escort service|pay(?:ing)? for s[e3]x|s[e3]xual favou?rs?|with benefits|friends? with b)\b/,
  },
  // Sexualised comment on the other person's body. Separate from the explicit
  // list because the words are innocuous apart — it is the construction that
  // carries it.
  {
    id: "sexual_personal",
    category: "sexual_content",
    weight: 4,
    pattern:
      /\b(?:your? (?:body|boobs|tits|ass|butt|legs|figure)|how (?:hot|sexy) (?:you|u) (?:are|r|look)|(?:send|show) (?:me )?(?:a )?(?:pic|photo|picture)s? (?:of )?(?:you(?:r)?|u) (?:in|without|wearing))\b/,
  },

  /* ── threats and harassment ───────────────────────────────────────────
     Blocked. A threat delivered has already done its work; reviewing it
     afterwards does not undo that. */
  {
    id: "threat_violence",
    category: "threat",
    weight: 7,
    pattern:
      /\b(?:i(?:'?ll| will| am gonna| a?m going to) (?:kill|hurt|beat|destroy|end|find) (?:you|u|your|ur)|watch your back|you(?:'?re| are) dead|i know where you live|come to your (?:house|home) and)\b/,
  },
  {
    id: "harassment_slur",
    category: "harassment",
    weight: 6,
    deSpaced: true,
    // Slurs, kept as a narrow list of the unambiguous. A wider list would need
    // reclamation and in-group use handled, which a regex cannot do.
    pattern: /\b(?:n[i1]gg(?:er|a)|f[a4]gg?[o0]t|r[e3]t[a4]rd|tr[a4]nn[yi]|k[i1]k[e3]|sp[i1]c|ch[i1]nk|w[e3]tb[a4]ck)\b/,
  },
  {
    id: "harassment_abuse",
    category: "harassment",
    weight: 4,
    pattern:
      /\b(?:kill your ?self|kys\b|go die|piece of sh[i1]t|stupid b[i1]tch|dumb b[i1]tch|worthless (?:cunt|whore|slut)|shut the f[u\*]ck up)\b/,
  },
  // Ordinary swearing. Weight 2: never blocks, never flags on its own, but
  // pushes something already borderline over the line — which is roughly how a
  // human reads it too.
  {
    id: "profanity_general",
    ambiguous: true,
    category: "vulgar",
    weight: 2,
    pattern: /\b(?:f[u\*]ck(?:ing|er|ed)?|sh[i1]t(?:ty)?|b[i1]tch|bastard|assh[o0]l[e3]|wanker|prick|twat|cunt)\b/,
  },

  /* ── scams ────────────────────────────────────────────────────────────
     The highest-value rules on this platform. A caregiver being paid by a
     family they have not met is a normal-looking transaction, which is
     exactly what the overpayment scam relies on.

     Money movement is blocked; the softer setup lines are flagged. */
  {
    id: "scam_advance_fee",
    category: "scam",
    weight: 7,
    // The `(?:\S+ ){0,3}` before the card nouns absorbs whatever people put
    // between the verb and the thing: "send me a $200 gift card", "send me two
    // Apple gift cards". Bounded rather than `.*` so it can't span a sentence
    // and match a "send" in one clause against a "gift card" in the next.
    pattern:
      /\b(?:western union|money ?gram|wire (?:me|the|you) (?:the )?(?:money|funds|payment)|cash ?app me|zelle me|(?:send|buy|get|purchase) (?:me )?(?:a |the |two |some )?(?:\S+ ){0,3}(?:gift ?cards?|itunes cards?|steam cards?|apple cards?)|bitcoin address|btc wallet|crypto ?wallet|usdt|send (?:the )?(?:money|funds|deposit) (?:first|upfront|in advance))\b/,
  },
  // The classic overpayment scam, near-verbatim. It is this specific because
  // the specificity is what makes it safe to block: no honest arrangement is
  // phrased as "I will send extra, wire the difference back".
  {
    id: "scam_overpayment",
    category: "scam",
    weight: 7,
    pattern:
      /\b(?:(?:send|mail|post) (?:you )?a (?:cashier'?s? )?che(?:ck|que)|(?:i(?:'?ll| will) )?(?:over ?pay|pay (?:you )?(?:extra|more than))|(?:send|wire|transfer) (?:back|the (?:rest|difference|balance|excess|remaining)))\b/,
  },
  {
    id: "scam_credentials",
    category: "scam",
    weight: 7,
    // "bank account details" and "card number" are the same request with a
    // different number of words in the middle, so the noun run is repeatable
    // rather than a fixed pair — an earlier version matched "bank details" and
    // missed "bank account details", which is how people actually write it.
    pattern:
      /\b(?:(?:your|ur|the|my) (?:bank|card|account|debit|credit)(?: (?:bank|card|account|number))* (?:details|number|info(?:rmation)?)|routing number|sort code|(?:social security|ssn)\b|(?:cvv|pin) (?:code|number)?|verification code|otp code|one[- ]time (?:code|password)|password (?:is|:))\b/,
  },
  // Setup lines. Flagged rather than blocked — each has a legitimate reading
  // ("I need to pay a deposit for the agency" is a real sentence), so this is
  // for a human to judge, and one of these plus a money rule is a block anyway.
  {
    id: "scam_setup",
    ambiguous: true,
    category: "scam",
    weight: 3,
    pattern:
      /\b(?:upfront (?:fee|payment|deposit)|processing fee|registration fee|(?:background )?check fee|refundable deposit|(?:my|the) (?:secretary|assistant|attorney|lawyer) will (?:contact|handle|send)|currently (?:abroad|overseas|out of (?:the )?country)|relocating (?:to|from) (?:the )?(?:us|uk|usa)|(?:my )?(?:husband|wife) (?:is )?(?:on (?:a )?)?(?:oil rig|deployment|military))\b/,
  },
  {
    id: "scam_urgency",
    ambiguous: true,
    category: "scam",
    weight: 3,
    pattern:
      /\b(?:act (?:now|fast|immediately)|limited time offer|guaranteed (?:income|profit|returns?)|(?:make|earn) \$?\d+[k]? (?:a|per) (?:day|week)|work from home opportunity|investment opportunity|double your money|no experience (?:needed|required) \$)\b/,
  },

  /* ── moving the conversation off-platform ─────────────────────────────
     Flagged, never blocked. Two people who have matched and want to text
     each other are doing something completely normal, and blocking it would
     be a product decision dressed up as a safety control.

     It is worth RECORDING because it is step one of nearly every scam here:
     get off the system that has the logs, then ask for the money. One of
     these next to a scam rule is what turns a flag into a block. */
  {
    id: "offsite_contact",
    ambiguous: true,
    category: "offsite_contact",
    weight: 3,
    deSpaced: true,
    pattern:
      /\b(?:whats ?app|telegram|signal app|kik\b|snap ?chat|wechat|viber|hangouts|text me (?:on|at)|dm me (?:on|at)|add me on)\b/,
  },
  // A phone number or an email address in the body. Weight 2 on its own: it is
  // ordinary between matched users, and only interesting alongside something
  // else. Written to tolerate the ways people space out digits.
  {
    id: "contact_details",
    ambiguous: true,
    category: "offsite_contact",
    weight: 2,
    pattern:
      /(?:\+?\d[\d\s().-]{8,}\d)|(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/,
  },

  /* ── other unethical requests ─────────────────────────────────────────
     Things that are specific to this platform and would not appear on a
     generic list: cash-in-hand to dodge tax, asking someone to work without
     the checks, or to lie on a profile. */
  {
    id: "unethical_conduct",
    category: "unethical",
    weight: 4,
    pattern:
      /\b(?:(?:pay(?:ing)? )?(?:you )?(?:cash )?(?:in hand )?(?:off|under) the books?|under the table|(?:avoid|dodge|skip) (?:the )?(?:tax(?:es)?|payroll)|(?:skip|without|no need for) (?:the |a )?(?:background check|dbs|reference)s?|don'?t (?:tell|report|mention) (?:the |any)|(?:fake|forge) (?:a |the |your )?(?:reference|certificate|document|id)|lie (?:on|about) your (?:profile|application))\b/,
  },
  {
    id: "child_safety",
    category: "child_safety",
    weight: 8,
    // Deliberately narrow and deliberately the heaviest weight in the file.
    // Anything matching here blocks on its own and arrives in the queue at the
    // top. A false positive costs one confused message; a false negative on a
    // childcare platform does not have a comparable cost.
    pattern:
      /\b(?:leave (?:the )?(?:kids?|children|baby) alone (?:with me|overnight)|don'?t tell (?:the )?(?:parents?|mum|mom|dad)|(?:our|its? a) (?:little )?secret|no cameras?|turn off the (?:camera|monitor)s?)\b/,
  },
];

/* ─────────────────────────── compiled once, at load ─────────────────────── */

// Each rule's pattern with the global flag, so a message can be scanned for
// EVERY distinct thing a rule catches rather than just the first.
//
// This matters more than it looks. "I'm currently abroad but my attorney will
// handle the paperwork" trips two independent scam-setup signals, and counting
// the rule once scored it the same as a message with one — which put a textbook
// advance-fee opener below the flag threshold. Two signals is meaningfully more
// suspicious than one, and the score should say so.
//
// Compiled at module load rather than per call: building a RegExp on every
// message, for every rule, in the path of every message on the platform, is the
// kind of cost that eventually gets the whole check made optional.
const COMPILED = RULES.map((rule) => ({
  ...rule,
  global: new RegExp(rule.pattern.source, `${rule.pattern.flags}g`),
}));

// How many distinct matches within one rule can count toward the score. Two,
// because the jump from one signal to two is where the meaning is — a message
// with five swear words is not two and a half times worse than one with two,
// and without a cap a single ranty message would outscore an actual threat.
const MAX_HITS_PER_RULE = 2;

// Collect the distinct matches of one rule. Distinct rather than total: someone
// who writes "whatsapp whatsapp whatsapp" has said one thing three times, and
// counting it as three signals would make repetition a way of manufacturing a
// block against themselves.
const distinctMatches = (regex, text) => {
  regex.lastIndex = 0;
  const found = new Set();
  for (const match of text.matchAll(regex)) {
    found.add(match[0]);
    if (found.size >= MAX_HITS_PER_RULE) break;
  }
  return [...found];
};

/* ────────────────────────────── the decision ────────────────────────────── */

// Score at or above this and the message does not get delivered.
const BLOCK_AT = 6;
// Score at or above this and it is delivered but recorded.
const FLAG_AT = 4;

// Hard ceiling on message length. Not a moderation rule as such — it stops a
// single socket frame writing a megabyte into the database, which is a denial
// of service against the chat, not a content problem.
export const MAX_MESSAGE_LENGTH = 5000;

// What the sender is told, per category. Specific enough to be actionable and
// vague enough not to be a tuning guide: naming the matched term would turn
// every rejection into a free hint about how to rephrase and get through.
const REFUSALS = {
  sexual_content:
    "This message wasn't sent. Sexual or explicit content isn't allowed on Famylink.",
  threat:
    "This message wasn't sent. Threatening language isn't allowed on Famylink.",
  harassment:
    "This message wasn't sent. Abusive language and slurs aren't allowed on Famylink.",
  scam:
    "This message wasn't sent. It looks like a request to move money or share financial details — a common scam pattern. Never send money or bank details to someone you haven't met.",
  child_safety:
    "This message wasn't sent. It raises a child safety concern and has been passed to our team.",
  unethical:
    "This message wasn't sent. It appears to ask for something that breaks our community guidelines.",
  vulgar:
    "This message wasn't sent. Please keep it civil.",
  offsite_contact:
    "This message wasn't sent. Please keep the conversation on Famylink until you've met.",
};

/**
 * Run the rules over one message.
 *
 * Pure and synchronous — no database, no network. That matters: this sits in
 * the path of every message sent on the platform, so it has to be cheap enough
 * that nobody is ever tempted to make it optional.
 *
 * @param {string} content   the raw message body
 * @param {object} [options]
 * @param {string} [options.type] "Text" | "Audio". Audio is passed through:
 *        the content is base64 of a recording and there is nothing to read.
 * @returns {{
 *   action: "allow" | "flag" | "block",
 *   score: number,
 *   severity: "low" | "medium" | "high",
 *   categories: string[],
 *   matchedRules: string[],
 *   matchedTerms: string[],
 *   reason: string | null,
 * }}
 */
export const moderateMessage = (content, options = {}) => {
  const clean = {
    action: "allow",
    score: 0,
    severity: "low",
    categories: [],
    matchedRules: [],
    matchedTerms: [],
    reason: null,
  };

  // Voice notes arrive as base64. There is no text to scan, and running the
  // rules over base64 would match on random substrings — a flag with no
  // possible human meaning behind it.
  if (options.type === "Audio") return clean;

  const raw = String(content || "");
  if (!raw.trim()) return clean;

  const text = normalise(raw);
  const squashed = deSpaced(text);

  let score = 0;
  const categories = new Set();
  const matchedRules = [];
  const matchedTerms = [];
  // Did anything with an unambiguous reading fire? If not, the message is
  // flagged at most, whatever the score adds up to.
  let hasUnambiguousHit = false;
  // The category that contributed the most weight — it decides which refusal
  // the sender sees, so a message that trips three rules is explained by the
  // one that actually mattered.
  let topCategory = null;
  let topWeight = 0;

  for (const rule of COMPILED) {
    let hits = distinctMatches(rule.global, text);
    // Only fall back to the separator-free view if the normal one found
    // nothing, and only for rules marked safe under that collapse — checking
    // both and summing would double-count every match.
    if (!hits.length && rule.deSpaced) hits = distinctMatches(rule.global, squashed);
    if (!hits.length) continue;

    const contribution = rule.weight * hits.length;
    score += contribution;
    categories.add(rule.category);
    matchedRules.push(rule.id);
    if (!rule.ambiguous) hasUnambiguousHit = true;
    // The matched text, capped. This is the evidence an admin reads; it is
    // stored on the flag record, never sent back to the sender.
    for (const hit of hits) matchedTerms.push(String(hit).slice(0, 80));

    // The category that explains the refusal is the one that contributed most
    // weight overall — not the single heaviest rule. A message that trips two
    // scam signals is a scam message even if it also contains one swear word
    // from a rule with a higher per-match weight.
    if (contribution > topWeight) {
      topWeight = contribution;
      topCategory = rule.category;
    }
  }

  if (score === 0) return clean;

  let action = score >= BLOCK_AT ? "block" : score >= FLAG_AT ? "flag" : "allow";

  // Soft signals never add up to a refusal. Each ambiguous rule matches things
  // that have a real innocent reading, and a pile of maybes is still a pile of
  // maybes — "message me on WhatsApp about the upfront fee" is very probably a
  // scam and also very possibly an agency explaining its fees.
  //
  // Those get delivered and land in the flagged queue, where a person decides.
  // Refusing them outright would put this file in the business of guessing at
  // intent, which is the one thing a regex is worst at.
  if (action === "block" && !hasUnambiguousHit) action = "flag";

  return {
    action,
    score,
    severity: score >= BLOCK_AT ? "high" : score >= FLAG_AT ? "medium" : "low",
    categories: [...categories],
    matchedRules,
    matchedTerms,
    // Only populated when we actually refuse. A flagged message is delivered,
    // and the sender is told nothing — telling them would let anyone map the
    // rules by sending probes and watching for the notice.
    reason: action === "block" ? REFUSALS[topCategory] || REFUSALS.vulgar : null,
  };
};

// Categories that should reach a human quickly rather than sit in the queue at
// normal priority. Used by the flag recorder to set priority and to decide
// whether repeated offences auto-open a report.
export const URGENT_CATEGORIES = new Set(["child_safety", "threat", "sexual_content"]);

// Map a moderation category onto the `reason` enum the reports queue uses, so
// an auto-opened case lands in the right filter rather than under "other".
export const CATEGORY_TO_REPORT_REASON = {
  sexual_content: "inappropriate_content",
  vulgar: "inappropriate_content",
  threat: "harassment",
  harassment: "harassment",
  scam: "scam",
  offsite_contact: "spam",
  unethical: "safety_concern",
  child_safety: "safety_concern",
};
