// LanguageTool integration - the rule-based, non-generative baseline that
// grounds the writing coach. Reverse-engineered from the LanguageTool public
// API (api.languagetool.org/v2/check, the same service powering
// languagetool.org): POST text, get back offset-accurate matches with rule
// ids, categories and replacement candidates.
//
// Architecture role (per the English Learning Engine brief):
//   rule engine FIRST (deterministic, free, explainable)
//     -> LLM SECOND (confirms, explains, teaches)
// Errors (grammar/spelling/punctuation/confused words) are separated from
// style (wordiness/redundancy/informal register): errors feed the mistake
// memory; style never contaminates it.

export interface LtFinding {
  offset: number;
  length: number;
  excerpt: string;
  message: string;
  ruleId: string;
  ruleDesc: string;
  category: string;
  severity: "error" | "style";
  replacements: string[];
  trapTag: string;
}

export interface LtReport {
  engine: "languagetool";
  checkedChars: number;
  errors: LtFinding[];
  style: LtFinding[];
}

// Categories that are real ERRORS (wrong English), not taste.
const ERROR_CATEGORIES = new Set([
  "typos", "grammar", "punctuation", "confused_words", "casing", "semantics",
  "misc", "grammar_mechanics", "redistribution",
]);

// Style/taste categories: surfaced as notes, never as mistakes.
const STYLE_CATEGORIES = new Set([
  "style", "redundancy", "wordiness", "colloquialisms", "informalisms",
  "plain_english", "gender_neutral", "typographical", "creativity",
]);

// Map a finding onto our mistake-family tags so rule-engine errors land in
// the same healing loop the exam/arbiter errors use. Conservative: only map
// when the rule id is unambiguous; everything else falls back to word_choice.
export function trapTagFor(ruleId: string, category: string): string {
  const r = ruleId.toLowerCase();
  const c = category.toLowerCase();
  if (c === "typos" || r.includes("spell") || r.includes("typo")) return "spelling";
  if (r.includes("preposition") || r.includes("in_on_at") || r.includes("prep_")) return "prepositions";
  if (r.includes("article") || r.includes("determiner") || r.includes("missing_det")) return "articles";
  if (r.includes("plural") || r.includes("countable") || r.includes("uncountable") || r.includes("noun_inf") || r.includes("singular")) return "countability";
  if (r.includes("agreement") || r.includes("concord") || r.includes("third_person") || r.includes("subject_verb")) return "statives";
  if (r.includes("perfect") || r.includes("have_been") || r.includes("present_perfect")) return "perfect";
  if (r.includes("passive") || r.includes("active")) return "copula";
  if (r.includes("comparative") || r.includes("superlative") || r.includes("adjective")) return "adjectives";
  if (r.includes("question") || r.includes("auxiliary_missing") || r.includes("inversion")) return "question_order";
  if (r.includes("confus")) return "word_choice";
  if (r.includes("collocation")) return "collocation";
  if (r.includes("register") || r.includes("formal") || r.includes("informal") || r.includes("slang")) return "register";
  return "word_choice";
}

export function severityFor(category: string, ruleId: string): "error" | "style" {
  const c = category.toLowerCase();
  if (ERROR_CATEGORIES.has(c)) return "error";
  if (STYLE_CATEGORIES.has(c)) return "style";
  // Unknown categories: spelling-shaped rule ids are errors, the rest style.
  const rid = ruleId.toLowerCase();
  if (rid.includes("typo") || rid.includes("spell")) return "error";
  return "style";
}

interface LtMatch {
  offset?: number;
  length?: number;
  message?: string;
  shortMessage?: string;
  context?: { text?: string; offset?: number; length?: number };
  replacements?: { value?: string }[];
  rule?: {
    id?: string;
    description?: string;
    category?: { id?: string; name?: string };
  };
}

const ENDPOINT = "https://api.languagetool.org/v2/check";
const TIMEOUT_MS = 10000;
const MIN_SPACING_MS = 2500; // public API politeness: ~20 req/min per IP
const RETRY_BACKOFF_MS = 6000; // burst-throttle recovery
let lastCallAt = 0;

function normalize(text: string, json: { matches?: LtMatch[] }): LtReport {
  const errors: LtFinding[] = [];
  const style: LtFinding[] = [];
  for (const m of json.matches ?? []) {
    const offset = Number(m.offset ?? m.context?.offset ?? 0);
    const length = Number(m.length ?? m.context?.length ?? 0);
    if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) continue;
    const excerpt = text.slice(offset, offset + length);
    if (!excerpt.trim()) continue;
    const category = String(m.rule?.category?.id ?? "").toUpperCase();
    const ruleId = String(m.rule?.id ?? "");
    const severity = severityFor(category, ruleId);
    const finding: LtFinding = {
      offset,
      length,
      excerpt,
      message: String(m.message ?? m.shortMessage ?? "").trim(),
      ruleId,
      ruleDesc: String(m.rule?.description ?? "").trim(),
      category,
      severity,
      replacements: (m.replacements ?? []).map((r) => String(r.value ?? "")).filter(Boolean).slice(0, 4),
      trapTag: trapTagFor(ruleId, category),
    };
    if (severity === "error") errors.push(finding);
    else style.push(finding);
  }
  return { engine: "languagetool", checkedChars: text.length, errors, style };
}

async function callLt(text: string): Promise<LtReport | null> {
  // Space out calls; the public endpoint rate-limits anonymous traffic and a
  // 429 would only teach callers to fear the fast path.
  const wait = lastCallAt + MIN_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  lastCallAt = Date.now();

  const body = new URLSearchParams({
    text: text.slice(0, 6000), // public API cap; essays beyond this are rare
    language: "en-US",
    level: "picky", // catch more; the style/error split keeps signal clean
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: ctl.signal,
      });
      if (res.status === 429 && attempt === 0) {
        await new Promise((res2) => setTimeout(res2, RETRY_BACKOFF_MS));
        continue;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as { matches?: LtMatch[] };
      return normalize(text, json);
    } catch {
      if (attempt === 1) return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Screen text through the LanguageTool rule engine. Returns null on any
 *  failure - callers must degrade gracefully to the LLM-only path.
 *  Offset fidelity (Grammarly RE, Task 85): the text is screened AS-IS - the
 *  old internal .trim() made every LT offset relative to the trimmed string,
 *  so editor splices landed leading-whitespace widths off. The length guard
 *  still trims; the screened text does not. */
export async function screenText(text: string): Promise<LtReport | null> {
  const raw = String(text ?? "");
  if (raw.trim().length < 20) return null;
  return callLt(raw);
}

// ---------------------------------------------------------------------------
// Merge: fold rule-engine ERRORS the LLM missed back into the graded result.
// Overlap-aware (an excerpt already covered by an LLM error is skipped), and
// capped so a noisy screen cannot flood the learner's error list.
// ---------------------------------------------------------------------------

function overlaps(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, " ").trim();
  const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function mergeRuleErrors(
  existing: { bad: string; good: string; fa: string; type: string }[],
  report: LtReport | null,
  cap = 6,
): { merged: { bad: string; good: string; fa: string; type: string }[]; added: number } {
  const merged = [...existing];
  if (!report) return { merged, added: 0 };
  let added = 0;
  for (const f of report.errors) {
    if (added >= cap) break;
    if (f.replacements.length && f.replacements.some((r) => overlaps(r, f.excerpt))) continue; // no-op suggestion
    const covered = merged.some((e) => overlaps(e.bad, f.excerpt));
    if (covered) continue;
    merged.push({
      bad: f.excerpt,
      good: f.replacements[0] ?? "",
      fa: "",
      type: f.trapTag,
    });
    added += 1;
  }
  return { merged, added };
}

/** Compact prompt block: hands the LLM the rule engine's findings so its
 *  explanation layer is grounded, not guessed. */
export function findingsBlock(report: LtReport | null): string {
  if (!report || (report.errors.length === 0 && report.style.length === 0)) {
    return "RULE ENGINE: no rule-based findings.";
  }
  const line = (f: LtFinding) =>
    `- [${f.severity}] "${f.excerpt}" (${f.ruleId}): ${f.message}${f.replacements.length ? ` suggestions: ${f.replacements.map((r) => JSON.stringify(r)).join(", ")}` : ""}`;
  const errs = report.errors.slice(0, 12).map(line).join("\n");
  const sty = report.style.slice(0, 6).map(line).join("\n");
  return [
    `RULE ENGINE FINDINGS (LanguageTool, deterministic - candidates, not gospel):`,
    errs || "(none)",
    sty ? `STYLE NOTES (not errors; mention only in upgrades):\n${sty}` : "",
    "Confirm real errors into your errors list with better explanations; discard false positives silently; never duplicate a finding the rule engine already reported unless you can add real teaching value.",
  ].filter(Boolean).join("\n");
}
