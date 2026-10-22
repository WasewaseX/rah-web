// Read-aloud pronunciation scorer (Task 64 - the measured acoustic tier).
//
// Honesty doctrine, unchanged from Sound Lab: what the recognizer HEARD is a
// measurement (server-side ASR of the learner's actual audio); everything
// behind the word labels is alignment arithmetic - deterministic, no AI, no
// network. Same (target, transcript) pair in, same report out. The battery
// pins these numbers.
//
// Tier labels are load-bearing: the UI must always say WHICH tier produced a
// score. "measured:asr-alignment" = word-level, from real audio. The Azure
// phoneme tier (azure-speech.ts) only appears when the learner configures a
// key - until then no phoneme-level claims are made anywhere.

import { alignWords } from "./phonemes";

export interface PronWord {
  target: string;
  heard: string | null;
  status: "hit" | "near" | "miss";
}

export interface PronReport {
  accuracy: number; // 0-100, (hits + 0.5*near) / total
  hits: number;
  near: number;
  misses: number;
  total: number;
  words: PronWord[]; // target order
  extra: string[]; // heard words the target never had (insertions)
  tier: "measured:asr-alignment";
  note: string;
}

export const PRON_NOTE =
  "Measured tier: a speech recognizer transcribed your audio and the words were aligned to the target. It measures words, not phonemes - the sound behind a near-miss is a spelling-pattern inference (Sound Lab), never a measurement.";

function normWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()\u060C]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Small deterministic edit distance (Levenshtein, no transposition) - "near"
// means the recognizer heard a word that is one or two edits from the target:
// a mispronunciation the recognizer still partly caught. Used for half credit
// and the amber chip in the UI.
function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[m];
}

function isNear(target: string, heard: string): boolean {
  const cap = target.length >= 4 ? 2 : 1;
  return editDistance(target, heard) <= cap;
}

interface FullAlign {
  matched: (string | null)[]; // per target token: heard token or null
  extra: string[];
}

// Needleman-Wunsch over the same scoring shape as Sound Lab's alignWords
// (exact=2, near-ish=1, else -1; gap=-1) but returns the FULL pairing so every
// target word gets a status. Deterministic; no AI.
function align(t: string[], g: string[]): FullAlign {
  const n = t.length;
  const m = g.length;
  const score = (a: string, b: string): number => (a === b ? 2 : editDistance(a, b) <= (a.length >= 4 ? 2 : 1) ? 1 : -1);
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i][0] = dp[i - 1][0] - 1;
  for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] - 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.max(dp[i - 1][j - 1] + score(t[i - 1], g[j - 1]), dp[i - 1][j] - 1, dp[i][j - 1] - 1);
    }
  }
  const matched: (string | null)[] = new Array(n).fill(null);
  const extra: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const diag = dp[i - 1][j - 1] + score(t[i - 1], g[j - 1]);
    const up = dp[i - 1][j] - 1;
    if (dp[i][j] === diag) {
      matched[i - 1] = g[j - 1];
      i--;
      j--;
    } else if (dp[i][j] === up) {
      i--;
    } else {
      extra.unshift(g[j - 1]);
      j--;
    }
  }
  while (j > 0) {
    extra.unshift(g[j - 1]);
    j--;
  }
  return { matched, extra };
}

export function scorePronunciation(target: string, transcript: string): PronReport {
  const t = normWords(target);
  const g = normWords(transcript);
  const { matched, extra } = align(t, g);

  const words: PronWord[] = t.map((tw, i) => {
    const heard = matched[i];
    if (heard === null) return { target: tw, heard: null, status: "miss" as const };
    if (heard === tw) return { target: tw, heard, status: "hit" as const };
    return { target: tw, heard, status: isNear(tw, heard) ? "near" : ("miss" as const) };
  });

  const hits = words.filter((w) => w.status === "hit").length;
  const near = words.filter((w) => w.status === "near").length;
  const misses = words.length - hits - near;
  const accuracy = words.length ? Math.round(((hits + 0.5 * near) / words.length) * 100) : 0;

  return { accuracy, hits, near, misses, total: words.length, words, extra, tier: "measured:asr-alignment", note: PRON_NOTE };
}

// Re-exported for the route: Sound Lab's contrast finder stays the single
// source of the "why" behind near-misses (kept out of the report itself -
// the report measures, Sound Lab infers, and the UI labels each accordingly).
export { alignWords };
