// P4 of the mega-update: the proximity engine behind the listening lab v2.
//
// Dictation and read-aloud checks both reduce to the same question: for each
// token of the target sentence, did the learner produce it? This module is
// the single source of truth for that answer, so the client's per-word
// highlighting and the server's scheduling decisions can never disagree.
//
// Matching is generous exactly where retrieval science wants it to be:
//  - exact match after normalization (case, punctuation),
//  - similarity >= 0.8 counts as NEAR (a typo'd or barely-slurred word is
//    not a miss - the learner retrieved it),
//  - everything else is a slip.
// Content tokens (not on the function-word stoplist) are the ones that get
// scheduled; "a", "of", "the" slips are feedback, not FSRS events.

import { editDistance } from "@/lib/agent/fuzzy";

// Function words never become FSRS targets: they are everywhere, so a slip
// carries almost no information and would flood the schedule.
const STOP = new Set([
  "a", "an", "the", "of", "to", "in", "on", "at", "by", "or", "and", "as", "is", "it", "its", "it's",
  "be", "am", "are", "was", "were", "do", "does", "did", "so", "if", "but", "not", "no", "yes",
  "he", "she", "we", "they", "them", "his", "her", "our", "your", "my", "me", "us", "him",
  "for", "with", "from", "that", "this", "these", "those", "there", "here", "you", "i",
]);

export interface TokenVerdict {
  token: string; // the target token, punctuation trimmed
  ok: boolean; // exact retrieval
  near: boolean; // fuzzy retrieval (typo / slurred) - counts as recalled
  slip: boolean; // not produced
  scheduled: boolean; // content token AND slipped - becomes a review target
}

export interface ProximityResult {
  verdicts: TokenVerdict[];
  score: number; // 0..1, exact+near over content tokens (1.0 when no content tokens)
  slips: string[]; // scheduled (content) slip tokens, lowercase
}

function trimToken(t: string): string {
  return t.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "");
}

// Character-level similarity for single words: the fuzzy module's
// similarity() is token-set overlap (built for full answers), useless for
// one word. Edit distance over the longer length is the honest measure.
function charSim(a: string, b: string): number {
  const m = Math.max(a.length, b.length);
  if (m === 0) return 1;
  return 1 - editDistance(a, b) / m;
}

export function proximity(target: string, produced: string): ProximityResult {
  const targetTokens = String(target ?? "")
    .split(/\s+/)
    .map(trimToken)
    .filter(Boolean);
  const producedList = String(produced ?? "")
    .split(/\s+/)
    .map(trimToken)
    .filter(Boolean)
    .map((t) => t.toLowerCase());

  const verdicts: TokenVerdict[] = [];
  const slips: string[] = [];
  let content = 0;
  let retrieved = 0;

  // Greedy consume: each target token eats the best remaining produced
  // candidate (exact first, then best similarity). Order-preserving enough
  // for sentence-length inputs and deterministic by construction.
  const used = new Set<number>();
  for (const raw of targetTokens) {
    const token = raw.toLowerCase();
    const isContent = token.length >= 2 && !STOP.has(token);
    if (isContent) content += 1;

    let bestIdx = -1;
    let bestSim = -1;
    let exact = false;
    for (let i = 0; i < producedList.length; i++) {
      if (used.has(i)) continue;
      if (producedList[i] === token) {
        bestIdx = i;
        bestSim = 1;
        exact = true;
        break;
      }
      const sim = charSim(producedList[i], token);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    const near = !exact && bestIdx >= 0 && bestSim >= 0.8;
    if (exact || near) {
      used.add(bestIdx);
      if (isContent) retrieved += 1;
    }
    const slip = !(exact || near);
    const scheduled = slip && isContent;
    if (scheduled) slips.push(token);
    verdicts.push({ token: raw, ok: exact, near, slip, scheduled });
  }

  return { verdicts, score: content === 0 ? 1 : retrieved / content, slips };
}
