// Fuzzy answer matching. The old exam failed learners who were RIGHT but
// spelled, inflected, or worded differently from the key. This module makes
// grading generous to meaning and strict on the target pattern.

const STOP = new Set(["a", "an", "the", "to", "of", "please"]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2019\u2018`]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(a|an|the) /, "");
}

function stem(w: string): string {
  return w
    .replace(/(ings?)$/, "")
    .replace(/(edly|ed)$/, "")
    .replace(/(ies)$/, "y")
    .replace(/(es)$/, "")
    .replace(/(s)$/, "");
}

function tokenSet(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((w) => w.length > 0 && !STOP.has(w));
}

// Token-set overlap with light stemming, order free: "took advantage of the
// situation" matches "take advantage of situation". 0..1.
export function similarity(a: string, b: string): number {
  const ta = tokenSet(a).map(stem);
  const tb = new Set(tokenSet(b).map(stem));
  if (ta.length === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  return hit / Math.max(ta.length, tb.size);
}

// Containment check that tolerates inflection: does `pattern` appear in
// `text` when both are stemmed token sequences (allowing gaps for articles)?
export function containsPattern(text: string, pattern: string): boolean {
  const t = tokenSet(text).map(stem);
  const p = tokenSet(pattern).map(stem);
  if (p.length === 0) return false;
  for (let i = 0; i <= t.length - p.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) {
      if (t[i + j] !== p[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export interface GradeInput {
  given: string;
  type: string;
  a: string;
  accept?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  choices?: string[];
}

// Grade one answer. MCQ is exact; cloze/short are fuzzy against the key and
// its accepted variants; rewrite items demand the target patterns.
export function gradeAnswer(inp: GradeInput): boolean {
  const given = (inp.given ?? "").trim();
  if (!given) return false;

  if (inp.type === "mcq") {
    const norm = (x: string) => normalize(x).replace(/\s+/g, " ");
    return norm(given) === norm(inp.a) || (inp.accept ?? []).some((v) => norm(given) === norm(v));
  }

  if (inp.type === "rewrite") {
    const inc = inp.mustInclude ?? [];
    if (inc.length === 0) return similarity(given, inp.a) >= 0.8;
    const allIn = inc.every((p) => containsPattern(given, p));
    const banned = (inp.mustNotInclude ?? []).some((p) => containsPattern(given, p));
    return allIn && !banned;
  }

  // cloze / short
  const g = normalize(given);
  if (g.length === 0) return false;
  const keys = [inp.a, ...(inp.accept ?? [])].map(normalize);
  if (keys.some((k) => k.length > 0 && (g === k || similarity(g, k) >= 0.85))) return true;
  // Single-token keys: allow inflection slips ("rains" for "rain").
  if (tokenSet(inp.a).length === 1 && tokenSet(given).length === 1) {
    return stem(tokenSet(given)[0]) === stem(tokenSet(inp.a)[0]);
  }
  return false;
}
