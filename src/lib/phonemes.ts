// Sound Lab - phoneme-proxy feedback for the Voice Arena (review feature #2:
// "phoneme-level pronunciation feedback").
//
// Honesty doctrine, same as the rest of Rah: the ASR transcript is MEASURED
// (the recognizer really heard "vant" where the target said "want"); the SOUND
// behind the mismatch is an INFERENCE from the letter pattern. So this engine
// only claims a sound contrast when the pattern matches a documented
// Farsi-speaker confusion cleanly - everything else is reported as a plain
// word mismatch, never a made-up phoneme label.
//
// Deterministic end to end: same (target, transcript) pair in, same report
// out. No AI, no network. The battery pins the pairs below.

export interface SoundEvidence {
  target: string;
  heard: string;
}

export interface SoundContrast {
  key: string;
  label: string;
  tip: string;
  evidence: SoundEvidence[];
  drill: { front: string; back: string }[];
}

export interface SoundReport {
  contrasts: SoundContrast[];
  other: SoundEvidence[]; // word pairs that differ but match no known contrast
  note: string;
}

const HONEST_NOTE =
  "What the mic heard is measured. The sound behind it is inferred from the pattern - the drills are the point, not the label.";

// ---------- word model ----------

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()\u060C]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function sim(a: string, b: string): number {
  if (a === b) return 2;
  // cheap similarity: shared length-normalized prefix+suffix agreement
  const max = Math.max(a.length, b.length);
  if (!max) return 0;
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
  return same / max >= 0.5 ? 1 : -1;
}

// Needleman-Wunsch word alignment: pairs substitutions instead of just
// splitting into missed/extra like the word-level LCS in arena-score.ts.
export function alignWords(t: string[], g: string[]): { pairs: [string, string][]; missed: string[]; extra: string[] } {
  const n = t.length;
  const m = g.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i][0] = dp[i - 1][0] - 1;
  for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] - 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.max(dp[i - 1][j - 1] + sim(t[i - 1], g[j - 1]), dp[i - 1][j] - 1, dp[i][j - 1] - 1);
    }
  }
  const pairs: [string, string][] = [];
  const missed: string[] = [];
  const extra: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const diag = dp[i - 1][j - 1] + sim(t[i - 1], g[j - 1]);
    const up = dp[i - 1][j] - 1;
    const left = dp[i][j - 1] - 1;
    if (dp[i][j] === diag) {
      if (t[i - 1] === g[j - 1]) {
        /* clean match: not interesting */
      } else {
        pairs.push([t[i - 1], g[j - 1]]);
      }
      i--;
      j--;
    } else if (dp[i][j] === up) {
      missed.unshift(t[i - 1]);
      i--;
    } else {
      extra.unshift(g[j - 1]);
      j--;
    }
  }
  while (i > 0) {
    missed.unshift(t[i - 1]);
    i--;
  }
  while (j > 0) {
    extra.unshift(g[j - 1]);
    j--;
  }
  return { pairs, missed, extra };
}

// ---------- single-letter substitution helper ----------

// True when a and b differ by exactly one letter, and that letter is x in a / y in b.
function sub1(a: string, b: string, x: string, y: string): boolean {
  if (a.length !== b.length) return false;
  let diff = -1;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (count > 0) return false;
      diff = i;
      count++;
    }
  }
  return count === 1 && a[diff] === x && b[diff] === y;
}

// Replace the first occurrence of `from` with `to`; helper for digraph rules.
function swapOnce(word: string, from: string, to: string): string | null {
  const idx = word.indexOf(from);
  if (idx < 0) return null;
  return word.slice(0, idx) + to + word.slice(idx + from.length);
}

// b is a with exactly one letter deleted (order-preserving subsequence).
// Real speech stacks changes: "where" -> "vere" is w->v PLUS the silent h
// dropping. The signature swap is claimed; one co-occurring drop is tolerated.
function delOne(a: string, b: string): boolean {
  if (a.length - b.length !== 1) return false;
  let skipped = false;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    i++;
  }
  return j === b.length;
}

const isVowel = (c: string) => "aeiou".includes(c);

// Consonant-cluster detection: ANY run of 2+ consonants inside the word
// (asked has "sk", best has "st", world has "rld") - reduction can hit them
// all, not only word-finally.
function hasConsonantRun(w: string): boolean {
  let run = 0;
  for (const ch of w) {
    if (isVowel(ch)) run = 0;
    else {
      run++;
      if (run >= 2) return true;
    }
  }
  return false;
}

// ---------- contrast detection per word pair ----------

// The documented Farsi-speaker set. Persian has no /w/, no dental fricatives
// (th), tense/lax vowel pairs collapse, final clusters reduce, and unaspirated
// /p/ reads as /b/. Each detector returns a contrast key or null.
function detectContrast(target: string, heard: string): string | null {
  // w <-> v (no /w/ in Persian: want -> vant, very -> wery), tolerating one
  // co-occurring dropped letter (where -> vere: w->v plus the silent h).
  if ((target.includes("w") || heard.includes("w")) && (target.includes("v") || heard.includes("v"))) {
    const nt = target.replaceAll("w", "v");
    const nh = heard.replaceAll("w", "v");
    if (nt === nh || delOne(nt, nh) || delOne(nh, nt)) return "w-v";
  }

  // p <-> b (unaspirated p reads as b: park -> bark)
  if (sub1(target, heard, "p", "b") || sub1(target, heard, "b", "p")) return "p-b";

  // th digraph simplifies to t/s/d/z (think -> tink/sink, this -> dis/zis,
  // brother -> broder: th->d plus the h of the digraph itself is already gone)
  if (target.includes("th")) {
    const idx = target.indexOf("th");
    const before = target.slice(0, idx);
    const after = target.slice(idx + 2);
    for (const x of ["t", "s", "d", "z"]) {
      const r = before + x + after;
      if (r === heard || delOne(r, heard) || delOne(heard, r)) return "th";
    }
  }

  // final ng -> n (singing -> sinin, sing -> sin)
  if (target.includes("ng") && heard === target.replaceAll("ng", "n")) return "ng";
  if (target.endsWith("ng") && heard === target.slice(0, -1)) return "ng";

  // s <-> sh digraph (sip -> ship, seat -> sheet, mass -> mash)
  {
    const a = swapOnce(target, "s", "sh");
    if (a === heard) return "s-sh";
    const b = swapOnce(target, "sh", "s");
    if (b === heard) return "s-sh";
    // mass -> mash pattern: trailing "ss" -> "sh"
    if (target.endsWith("ss") && heard === target.slice(0, -2) + "sh") return "s-sh";
    if (heard.endsWith("ss") && target === heard.slice(0, -2) + "sh") return "s-sh";
  }

  // vowel collapse: exactly one vowel slot differs, consonants identical
  const v = vowelContrast(target, heard);
  if (v) return v;

  // final cluster reduction: only deletions (plus a t/d voicing swap), target has a cluster
  if (hasConsonantRun(target) && clusterReduced(target, heard)) return "clusters";

  return null;
}

// Tense/lax vowel pairs: i vs ee/ea (ship/sheep, live/leave), a vs e (bad/bed),
// u vs oo (full/fool), o vs u (not/nut - reported sparingly).
const VOWEL_SWAPS: Record<string, string[]> = {
  a: ["e"],
  e: ["a"],
  i: ["ee", "ea", "e"],
  ee: ["i"],
  ea: ["i", "e"],
  u: ["oo", "o"],
  oo: ["u"],
  o: ["u"],
};

function vowelContrast(target: string, heard: string): string | null {
  const re = /ee|ea|oo|[aeiou]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(target))) {
    const alts = VOWEL_SWAPS[m[0]];
    if (!alts) continue;
    for (const alt of alts) {
      if (target.slice(0, m.index) + alt + target.slice(m.index + m[0].length) === heard) {
        const pair = [m[0], alt].sort().join("-");
        return `vowel:${pair}`;
      }
    }
  }
  return null;
}

// asked -> ast: deletions only (k, e dropped) with at most a t/d swap at the end.
function clusterReduced(target: string, heard: string): boolean {
  if (heard.length >= target.length) return false;
  let i = 0;
  let j = 0;
  let dels = 0;
  let subs = 0;
  while (i < target.length && j < heard.length) {
    if (target[i] === heard[j]) {
      i++;
      j++;
      continue;
    }
    // allow one t/d voicing swap before treating it as a deletion
    if (
      subs === 0 &&
      ((target[i] === "t" && heard[j] === "d") || (target[i] === "d" && heard[j] === "t"))
    ) {
      subs++;
      i++;
      j++;
      continue;
    }
    dels++;
    i++;
    if (dels > 3) return false;
  }
  return j === heard.length && dels > 0;
}

// ---------- minimal-pair drills ----------

const DRILLS: Record<string, { front: string; back: string }[]> = {
  "w-v": [
    { front: "west", back: "vest" },
    { front: "wine", back: "vine" },
    { front: "wet", back: "vet" },
  ],
  "p-b": [
    { front: "park", back: "bark" },
    { front: "pig", back: "big" },
    { front: "cap", back: "cab" },
  ],
  th: [
    { front: "think", back: "sink" },
    { front: "three", back: "tree" },
    { front: "faith", back: "face" },
  ],
  ng: [
    { front: "sin", back: "sing" },
    { front: "ran", back: "rang" },
    { front: "thin", back: "thing" },
  ],
  "s-sh": [
    { front: "sip", back: "ship" },
    { front: "seat", back: "sheet" },
    { front: "mass", back: "mash" },
  ],
  "vowel:a-e": [
    { front: "bad", back: "bed" },
    { front: "man", back: "men" },
    { front: "bat", back: "bet" },
  ],
  "vowel:i-ee": [
    { front: "ship", back: "sheep" },
    { front: "sit", back: "seat" },
    { front: "live", back: "leave" },
  ],
  "vowel:ee-i": [
    { front: "sheep", back: "ship" },
    { front: "seat", back: "sit" },
    { front: "leave", back: "live" },
  ],
  "vowel:ea-i": [
    { front: "leave", back: "live" },
    { front: "heat", back: "hit" },
  ],
  "vowel:e-ea": [
    { front: "set", back: "seat" },
    { front: "bet", back: "beat" },
  ],
  "vowel:u-oo": [
    { front: "full", back: "fool" },
    { front: "pull", back: "pool" },
  ],
  "vowel:oo-u": [
    { front: "fool", back: "full" },
    { front: "pool", back: "pull" },
  ],
  "vowel:o-u": [
    { front: "not", back: "nut" },
    { front: "cop", back: "cup" },
  ],
  "vowel:u-o": [
    { front: "nut", back: "not" },
    { front: "cup", back: "cop" },
  ],
  "vowel:e-a": [
    { front: "bed", back: "bad" },
    { front: "men", back: "man" },
  ],
  "vowel:i-e": [
    { front: "hit", back: "het" },
    { front: "sit", back: "set" },
  ],
  "vowel:e-i": [
    { front: "set", back: "sit" },
    { front: "met", back: "mit" },
  ],
  clusters: [
    { front: "asked", back: "asked (as-ked)" },
    { front: "texts", back: "texts (tex-ts)" },
    { front: "world", back: "world (wor-ld)" },
  ],
};

const LABELS: Record<string, string> = {
  "w-v": "w vs v - Persian has no /w/",
  "p-b": "p vs b - unaspirated p reads as b",
  th: "th simplifies to t/s/z - no dental fricatives in Persian",
  ng: "final -ng drops to -n",
  "s-sh": "s vs sh",
  "vowel:a-e": "bad vs bed - lax ae vs e",
  "vowel:e-a": "bed vs bad - lax ae vs e",
  "vowel:i-ee": "ship vs sheep - lax vs tense i",
  "vowel:ee-i": "sheep vs ship - tense vs lax i",
  "vowel:ea-i": "leave vs live - tense vs lax i",
  "vowel:e-ea": "set vs seat - e vs tense ea",
  "vowel:i-e": "sit vs set - lax i vs e",
  "vowel:e-i": "set vs sit - e vs lax i",
  "vowel:u-oo": "full vs fool - short vs long u",
  "vowel:oo-u": "fool vs full - long vs short u",
  "vowel:o-u": "not vs nut - o vs u",
  "vowel:u-o": "nut vs not - u vs o",
  clusters: "final consonant clusters reduce - hold every letter",
};

const TIPS: Record<string, string> = {
  "w-v": "Round your lips hard before the sound: W starts like OO, V starts with the top teeth on the lip.",
  "p-b": "Hold a strip of paper in front of your mouth - P must puff it out, B must not.",
  th: "Tongue tip between the teeth and blow. If it whistles like S or pops like T, it is not th.",
  ng: "Press the back of the tongue to the soft palate and keep the air in the nose - no n stop at the end.",
  "s-sh": "Widen the tongue groove for SH; S is a thin whistle with the tongue closer to the teeth.",
  "vowel:a-e": "Open the jaw for BAD (like a doctor's aaah, short) - BED keeps the jaw half shut.",
  "vowel:i-ee": "SHEEP is long with a smile; SHIP is short and relaxed. Overdo the length difference for a week.",
  "vowel:ee-i": "SHEEP is long with a smile; SHIP is short and relaxed.",
  "vowel:ea-i": "LEAVE is long; LIVE is short and relaxed - same smile, half the length.",
  "vowel:e-ea": "SEAT is long and tense; SET is short. Hold the length twice as long as feels natural.",
  "vowel:i-e": "SIT drops the jaw a touch more than SET. Say them in pairs until they feel different.",
  "vowel:e-i": "SET drops the jaw a touch more than SIT. Say them in pairs until they feel different.",
  "vowel:u-oo": "FULL is short with a loose lip; FOOL is long with rounded lips.",
  "vowel:oo-u": "FOOL is long with rounded lips; FULL is short with a loose lip.",
  "vowel:o-u": "NOT is rounded and low; NUT is a lazy central uh. Keep the lips still for NUT.",
  "vowel:u-o": "NUT is a lazy central uh; NOT rounds the lips and drops the jaw.",
  clusters: "Say the cluster slowly, then speed up without dropping letters: as-ked, tex-ts, wor-ld.",
};

// ---------- main ----------

export function diagnoseSounds(target: string, transcript: string): SoundReport {
  const t = words(target);
  const g = words(transcript);
  const { pairs } = alignWords(t, g);

  const byKey = new Map<string, SoundContrast>();
  const other: SoundEvidence[] = [];

  for (const [targetWord, heardWord] of pairs) {
    const key = detectContrast(targetWord, heardWord);
    if (!key) {
      other.push({ target: targetWord, heard: heardWord });
      continue;
    }
    let c = byKey.get(key);
    if (!c) {
      c = {
        key,
        label: LABELS[key] ?? key,
        tip: TIPS[key] ?? "Practice the pair slowly, then fast.",
        evidence: [],
        drill: DRILLS[key] ?? [],
      };
      byKey.set(key, c);
    }
    c.evidence.push({ target: targetWord, heard: heardWord });
  }

  return {
    contrasts: [...byKey.values()],
    other,
    note: HONEST_NOTE,
  };
}
