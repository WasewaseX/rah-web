// Fuzzy answer matching for Rah exams.
// The learner must never be marked wrong for a correct answer. This engine
// normalizes what they typed and compares it against every accepted variant,
// recognizing synonyms, article freedom, and near misses with precise notes.

export type Verdict = "correct" | "close" | "wrong" | "skipped";

export interface MatchResult {
  verdict: Verdict;
  matched: string | null; // which accepted answer matched
  note: string; // precise, human feedback about what actually happened
}

export interface MatchOpts {
  articlesMatter?: boolean; // true when the item itself tests articles
}

// ---------- normalization ----------

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, "will not"],
  [/\bcan't\b/g, "cannot"],
  [/\bn't\b/g, " not"],
  [/\bI'm\b/g, "I am"],
  [/\bit's\b/g, "it is"],
  [/\bthat's\b/g, "that is"],
  [/\bthere's\b/g, "there is"],
  [/\bI've\b/g, "I have"],
  [/\bwe've\b/g, "we have"],
  [/\bthey've\b/g, "they have"],
  [/\bdon't\b/g, "do not"],
  [/\bdoesn't\b/g, "does not"],
  [/\bdidn't\b/g, "did not"],
];

export function normalize(s: string): string {
  let t = s.toLowerCase().trim();
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to);
  t = t
    .replace(/['’`]/g, "")
    .replace(/[.!?,;:""''()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

function isArticle(t: string): boolean {
  return t === "a" || t === "an" || t === "the";
}

function articlesOf(ts: string[]): string[] {
  return ts.filter(isArticle);
}

function dropArticles(ts: string[]): string[] {
  return ts.filter((t) => !isArticle(t));
}

// ---------- light stemming (for near-miss detection only) ----------

const IRREGULAR: Record<string, string> = {
  took: "take", taken: "take", got: "get", gotten: "get", made: "make",
  did: "do", done: "do", had: "have", went: "go", gone: "go", gave: "give",
  given: "give", saw: "see", seen: "see", said: "say", told: "tell",
  kept: "keep", held: "hold", paid: "pay", sent: "send", met: "meet",
  built: "build", found: "find", thought: "think", brought: "bring",
  bought: "buy", caught: "catch", taught: "teach", left: "leave",
  felt: "feel", fell: "fall", wrote: "write", written: "write",
  grew: "grow", knew: "know", known: "know", threw: "throw",
  broke: "break", broken: "break", spoke: "speak", spoken: "speak",
  chose: "choose", chosen: "choose", forgot: "forget", drove: "drive",
  driven: "drive", ate: "eat", eaten: "eat", drank: "drink", ran: "run",
};

function stemCandidates(t: string): string[] {
  const out = new Set<string>([t]);
  if (IRREGULAR[t]) out.add(IRREGULAR[t]);
  if (t.length > 4 && t.endsWith("ed")) {
    out.add(t.slice(0, -1)); // raised -> raise
    out.add(t.slice(0, -2)); // walked -> walk
  }
  if (t.length > 5 && t.endsWith("ing")) {
    out.add(t.slice(0, -3)); // taking -> tak
    out.add(t.slice(0, -3) + "e"); // taking -> take
  }
  if (t.length > 4 && t.endsWith("es")) out.add(t.slice(0, -2));
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) out.add(t.slice(0, -1));
  return [...out];
}

function tokenEq(a: string, b: string): boolean {
  if (a === b) return true;
  if (synonymous(a, b)) return true;
  if (isArticle(a) || isArticle(b)) return a === b;
  // participle confusion (bored/boring) is a real error: keep the pairs apart
  const partA = a.endsWith("ing") ? "ing" : a.endsWith("ed") ? "ed" : "";
  const partB = b.endsWith("ing") ? "ing" : b.endsWith("ed") ? "ed" : "";
  if (partA && partB && partA !== partB) return false;
  const A = stemCandidates(a);
  const B = stemCandidates(b);
  return A.some((x) => B.includes(x));
}

// ---------- synonym equivalence sets ----------
// Used ONLY to widen accepted answers, never to narrow them.

const SYNONYM_SETS: string[][] = [
  ["heavy", "intense", "severe", "strong", "torrential", "pouring", "driving"],
  ["rain", "rains", "rainfall"],
  ["wind", "winds", "gale", "gust"],
  ["often", "frequently", "regularly", "commonly"],
  ["big", "major", "important", "significant", "serious", "momentous"],
  ["small", "minor", "slight", "tiny", "modest"],
  ["fast", "quick", "rapid", "swift", "speedy", "brisk"],
  ["hard", "difficult", "tough", "challenging", "demanding"],
  ["easy", "simple", "straightforward", "effortless"],
  ["good", "solid", "strong", "excellent", "fine"],
  ["bad", "poor", "weak", "terrible", "awful"],
  ["raise", "address", "tackle", "handle", "resolve", "settle"],
  ["make", "take", "reach"],
  ["get", "obtain", "receive", "gain", "acquire"],
  ["improve", "enhance", "boost", "strengthen", "upgrade", "refine", "sharpen"],
  ["increase", "rise", "grow", "climb", "expand"],
  ["decrease", "fall", "drop", "decline", "shrink", "reduce"],
  ["start", "begin", "launch", "commence", "initiate"],
  ["stop", "cease", "halt", "quit", "end"],
  ["show", "demonstrate", "reveal", "display", "indicate"],
  ["think", "believe", "reckon", "consider", "hold"],
  ["hurry", "rush", "dash", "race"],
  ["pay", "settle", "cover"],
  ["keep", "maintain", "hold", "preserve"],
  ["say", "tell", "state", "mention", "note"],
  ["help", "assist", "support", "aid"],
  ["ask", "request", "inquire", "enquire"],
  ["answer", "reply to", "respond to"],
  ["issue", "problem", "matter", "concern", "point"],
  ["decision", "call", "choice"],
  ["mistake", "error", "slip", "lapse"],
  ["job", "work", "position", "role", "post"],
  ["idea", "thought", "notion", "concept"],
  ["chance", "opportunity", "shot", "opening"],
  ["plan", "scheme", "strategy"],
  ["progress", "headway", "ground"],
  ["effort", "attempt", "push"],
  ["reason", "cause", "explanation", "rationale"],
  ["result", "outcome", "consequence", "effect"],
  ["advice", "guidance", "counsel", "recommendation"],
  ["information", "details"],
];

let synonymIndex: Map<string, number> | null = null;

function synIndex(): Map<string, number> {
  if (synonymIndex) return synonymIndex;
  const m = new Map<string, number>();
  SYNONYM_SETS.forEach((set, i) => {
    for (const w of set) {
      const k = normalize(w);
      if (!m.has(k)) m.set(k, i);
    }
  });
  synonymIndex = m;
  return m;
}

function synonymous(a: string, b: string): boolean {
  if (a === b) return true;
  const ia = synIndex().get(a);
  const ib = synIndex().get(b);
  return ia !== undefined && ia === ib;
}

function synonymMatch(given: string[], accepted: string[]): boolean {
  if (given.length !== accepted.length) return false;
  return given.every((g, i) => tokenEq(g, accepted[i]));
}

function matchesIgnoringArticles(given: string[], accepted: string[]): boolean {
  return synonymMatch(dropArticles(given), dropArticles(accepted));
}

// Order-preserving match after removing exactly one article from `full`
// and comparing the rest with synonym/stem tolerance.
function matchesMinusOneArticle(given: string[], accepted: string[]): string | null {
  const tryPair = (short: string[], full: string[]): string | null => {
    if (short.length !== full.length - 1) return null;
    for (let skip = 0; skip < full.length; skip++) {
      if (!isArticle(full[skip])) continue;
      const rest = full.filter((_, i) => i !== skip);
      if (dropArticles(short).length === dropArticles(rest).length && synonymMatch(dropArticles(short), dropArticles(rest))) {
        return full[skip];
      }
    }
    return null;
  };
  return tryPair(given, accepted) ?? null;
}

function matchesPlusOneArticle(given: string[], accepted: string[]): string | null {
  const tryPair = (full: string[], short: string[]): string | null => {
    if (full.length !== short.length + 1) return null;
    for (let skip = 0; skip < full.length; skip++) {
      if (!isArticle(full[skip])) continue;
      const rest = full.filter((_, i) => i !== skip);
      if (dropArticles(rest).length === dropArticles(short).length && synonymMatch(dropArticles(rest), dropArticles(short))) {
        return full[skip];
      }
    }
    return null;
  };
  return tryPair(given, accepted) ?? null;
}

// ---------- public API ----------

export function matchShort(givenRaw: string, acceptedRaw: string[], opts: MatchOpts = {}): MatchResult {
  const given = normalize(givenRaw);
  const acceptedList = acceptedRaw.map((a) => normalize(a)).filter(Boolean);
  if (!given) return { verdict: "skipped", matched: null, note: "No answer given." };

  if (acceptedList.includes(given)) return { verdict: "correct", matched: givenRaw.trim(), note: "" };

  const gT = tokens(givenRaw);
  for (let i = 0; i < acceptedRaw.length; i++) {
    const aRaw = acceptedRaw[i];
    const aT = tokens(aRaw);

    // 1. same shape, synonyms allowed: plainly correct
    if (gT.length === aT.length && synonymMatch(gT, aT)) {
      return { verdict: "correct", matched: aRaw, note: "" };
    }

    // 2. identical once articles are ignored
    if (matchesIgnoringArticles(gT, aT)) {
      const gA = articlesOf(gT);
      const aA = articlesOf(aT);
      if (gA.length > 0 && aA.length > 0 && gA.join(" ") !== aA.join(" ")) {
        // the/an/the swaps are grammatical in most contexts
        if (opts.articlesMatter) {
          return { verdict: "close", matched: aRaw, note: `Article: "${gA.join(" ")}" vs "${aA.join(" ")}". Watch which one the sentence needs.` };
        }
        return { verdict: "correct", matched: aRaw, note: "" };
      }
      if (gA.length < aA.length) {
        const missing = aA.filter((x) => !gA.includes(x));
        return {
          verdict: "close",
          matched: aRaw,
          note: `You dropped "${missing.join(" ")}". The meaning landed; the collocation carries the article.`,
        };
      }
      if (gA.length > aA.length) {
        return {
          verdict: "close",
          matched: aRaw,
          note: `"${gA.filter((x) => !aA.includes(x)).join(" ")}" is not needed here. Small thing, worth catching.`,
        };
      }
      return { verdict: "correct", matched: aRaw, note: "" };
    }

    // 3. same phrase minus exactly one article (stem-tolerant)
    const dropped = matchesMinusOneArticle(gT, aT);
    if (dropped) {
      return {
        verdict: "close",
        matched: aRaw,
        note: `You dropped "${dropped}". Everything else was right.`,
      };
    }
    const extra = matchesPlusOneArticle(gT, aT);
    if (extra) {
      return {
        verdict: "close",
        matched: aRaw,
        note: `"${extra}" is not needed here. Everything else was right.`,
      };
    }
  }

  // 4. near-miss fallback: enough real overlap to deserve "close", not silence
  for (const aRaw of acceptedRaw) {
    const aT = tokens(aRaw);
    if (!aT.length || !gT.length) continue;
    const overlap = gT.filter((g) => aT.some((a) => a === g || synonymous(a, g)));
    const ratio = overlap.length / Math.max(aT.length, gT.length);
    if (ratio >= 0.75) {
      return {
        verdict: "close",
        matched: aRaw,
        note: `Almost. The natural form here is "${aRaw.trim()}".`,
      };
    }
  }

  return { verdict: "wrong", matched: null, note: "" };
}

// Heuristic check used before sending open answers (rewrites, translations)
// to the deeper grader: did the answer clearly contain the target pattern?
export function containsAll(givenRaw: string, required: string[]): boolean {
  const g = " " + normalize(givenRaw) + " ";
  return required.every((r) => g.includes(normalize(r)));
}
