// Word-level pronunciation-proxy scoring for the Voice Arena. The learner
// repeats a target sentence; the browser ASR transcribes it; this aligns the
// transcript against the target with an LCS and scores how much of the
// target came back intact, penalizing inserted words.

export interface ArenaScore {
  accuracy: number; // 0..100
  matched: number;
  missed: string[]; // target words that never came back
  extra: string[]; // transcript words that were not in the target
  targetWords: number;
  verdict: string;
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()\u060C]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function scoreShadow(target: string, transcript: string): ArenaScore {
  const t = words(target);
  const g = words(transcript);
  const n = t.length;
  const m = g.length;

  // LCS table (small sentences: fine to allocate).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = t[i - 1] === g[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Walk back to collect matched / missed / extra.
  const missed: string[] = [];
  const extra: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (t[i - 1] === g[j - 1]) {
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
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

  const matched = dp[n][m];
  const raw = n === 0 ? 0 : (matched - extra.length * 0.5) / n;
  const accuracy = Math.max(0, Math.min(100, Math.round(raw * 100)));

  let verdict: string;
  if (accuracy >= 92) verdict = "Clean shadow. The vowels and the rhythm both landed.";
  else if (accuracy >= 78) verdict = "Solid take. A couple of words slipped - hit those again.";
  else if (accuracy >= 55) verdict = "The shape is there, the endings are not. Slow it down half a notch.";
  else if (n > 0 && matched > 0) verdict = "Barely recognizable. Listen once more, then repeat line by line.";
  else verdict = "Nothing matched. Make sure the mic hears you, then try again.";

  return { accuracy, matched, missed, extra, targetWords: n, verdict };
}
