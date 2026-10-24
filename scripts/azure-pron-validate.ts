/**
 * Task 95 (review P1 #7): the Azure pronunciation-tier validation harness.
 * Protocol + acceptance criteria: PRONUNCIATION-VALIDATION.md.
 *
 * Two modes:
 *  - No AZURE_SPEECH_KEY/AZURE_SPEECH_REGION: honest SKIP for every check
 *    (exit 0) - a validation that cannot run must say so, never fake-pass.
 *  - With key: runs the automatable criteria (1,2,3,4,5,7) against the clips
 *    in scripts/pron-validation-clips/ (gitignored - voice is biometric data),
 *    printing a PASS/FAIL table. Criterion 6 (degradation) is asserted by the
 *    pinned battery (the route's fallback contract), not here.
 *
 * Usage:
 *   bunx tsx scripts/azure-pron-validate.ts
 *   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=... bunx tsx scripts/azure-pron-validate.ts
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const CLIP_DIR = join(process.cwd(), "scripts", "pron-validation-clips");
const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;

interface CheckResult { criterion: string; pass: boolean | null; detail: string; }
const results: CheckResult[] = [];

function record(criterion: string, pass: boolean | null, detail: string) {
  results.push({ criterion, pass, detail });
  const mark = pass === null ? "SKIP" : pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${criterion} - ${detail}`);
}

/** Mirror of src/lib/azure-speech.ts azureAssess() - same REST contract, raw form. */
async function azureAssessRaw(wav: Buffer, referenceText: string) {
  const pronParams = Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    }),
  ).toString("base64");
  const url = `https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY!,
      "Content-Type": 'audio/wav; codecs="audio/pcm"; samplerate=16000',
      Accept: "application/json",
      "Pronunciation-Assessment": pronParams,
    },
    body: new Uint8Array(wav),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`azure: HTTP ${res.status}`);
  return res.json() as Promise<{
    DisplayText?: string;
    NBest?: {
      Display?: string;
      PronunciationAssessment?: { PronScore?: number; AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number };
      Words?: { Word: string; PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string }; Phonemes?: { Phoneme: string; PronunciationAssessment?: { AccuracyScore?: number } }[] }[];
    }[];
  }>;
}

/** Reference sentences per clip group - keep in sync with PRONUNCIATION-VALIDATION.md. */
const REFERENCES: Record<string, string> = {
  "clean-": "The committee will reconsider the proposal after the quarterly review.",
  "mispron-": "I wore a comfortable sweater on the long train journey.",
  "omission-": "The committee will reconsider the proposal after the quarterly review.",
  "insertion-": "The committee will reconsider the proposal after the quarterly review.",
  "noisy-": "Seven silver salmon swam silently upstream at sunrise.",
  "fast-": "Engineers frequently measure throughput before deploying changes.",
};

function groupOf(name: string): string {
  const m = name.match(/^([a-z]+)-\d+/);
  return m ? m[1] : "";
}

async function main() {
  if (!KEY || !REGION) {
    record("1 transport", null, "no AZURE_SPEECH_KEY/AZURE_SPEECH_REGION - honest skip; the built-in measured:asr-alignment tier remains the only scored path");
    record("2 phoneme presence", null, "needs a real key");
    record("3 known-error detection", null, "needs mispron-* clips + a real key");
    record("4 omission/insertion", null, "needs omission-*/insertion-* clips + a real key");
    record("5 stability", null, "needs a real key");
    record("7 latency budget", null, "needs a real key");
    console.log("\nRESULT: SKIPPED (not run). Configure the key and re-run; until then no phoneme claims are made anywhere in the UI.");
    return;
  }

  let clips: string[] = [];
  try {
    clips = readdirSync(CLIP_DIR).filter((f) => f.endsWith(".wav")).sort();
  } catch {
    record("1 transport", false, `clip directory ${CLIP_DIR} not found - record the clip set per PRONUNCIATION-VALIDATION.md first`);
    printSummary();
    return;
  }
  if (clips.length === 0) {
    record("1 transport", false, `no .wav clips in ${CLIP_DIR} - record the clip set per PRONUNCIATION-VALIDATION.md first`);
    printSummary();
    return;
  }

  const latencies: number[] = [];
  const byGroup = new Map<string, { file: string; json: Awaited<ReturnType<typeof azureAssessRaw>>; ms: number }[]>();
  let transportFailures = 0;

  for (const file of clips) {
    const group = groupOf(file);
    if (!REFERENCES[group]) continue;
    try {
      const t0 = Date.now();
      const json = await azureAssessRaw(readFileSync(join(CLIP_DIR, file)), REFERENCES[group]);
      const ms = Date.now() - t0;
      latencies.push(ms);
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push({ file, json, ms });
    } catch (e) {
      transportFailures++;
      record(`1 transport (${file})`, false, String(e instanceof Error ? e.message : e));
    }
  }

  const groups = [...byGroup.keys()];
  record("1 transport", transportFailures === 0 && groups.length >= 3, transportFailures === 0 ? `${clips.length} clips assessed across groups: ${groups.join(", ")}` : `${transportFailures} transport failures`);

  // criterion 2: every scored word carries a phoneme array with 0..100 scores
  let phonemeGaps = 0, wordsScored = 0;
  for (const items of byGroup.values()) {
    for (const { json } of items) {
      for (const w of json.NBest?.[0]?.Words ?? []) {
        wordsScored++;
        const ph = w.Phonemes ?? [];
        if (ph.length === 0 || ph.some((p) => p.PronunciationAssessment?.AccuracyScore == null || p.PronunciationAssessment.AccuracyScore < 0 || p.PronunciationAssessment.AccuracyScore > 100)) phonemeGaps++;
      }
    }
  }
  record("2 phoneme presence", wordsScored > 0 && phonemeGaps === 0, `${wordsScored} words scored, ${phonemeGaps} phoneme gaps`);

  // criterion 3: mispron-* clips flag the target word as Mispronunciation in >=4/5 takes
  const mis = byGroup.get("mispron") ?? [];
  if (mis.length >= 3) {
    const flagged = mis.filter(({ json }) =>
      (json.NBest?.[0]?.Words ?? []).some((w) => /comfort/i.test(w.Word) && (w.PronunciationAssessment?.ErrorType ?? "None") === "Mispronunciation"),
    ).length;
    record("3 known-error detection", flagged >= Math.ceil(mis.length * 0.8), `${flagged}/${mis.length} takes flagged the distorted target as Mispronunciation (need >=80%)`);
  } else {
    record("3 known-error detection", null, `needs >=3 mispron-* clips (found ${mis.length})`);
  }

  // criterion 4: omission flagged; insertion behavior recorded (consistency, not a fixed shape)
  const om = byGroup.get("omission") ?? [];
  if (om.length >= 2) {
    const flagged = om.filter(({ json }) =>
      (json.NBest?.[0]?.Words ?? []).some((w) => (w.PronunciationAssessment?.ErrorType ?? "") === "Omission"),
    ).length;
    record("4 omission detection", flagged === om.length, `${flagged}/${om.length} takes flagged an Omission`);
  } else {
    record("4 omission detection", null, `needs >=2 omission-* clips (found ${om.length})`);
  }
  const ins = byGroup.get("insertion") ?? [];
  if (ins.length >= 2) {
    const shapes = new Set(ins.map(({ json }) => {
      const words = json.NBest?.[0]?.Words ?? [];
      const hasIns = words.some((w) => (w.PronunciationAssessment?.ErrorType ?? "") === "Insertion");
      const display = String(json.NBest?.[0]?.Display ?? json.DisplayText ?? "");
      return `${hasIns ? "ins-word" : "display-only"}:${display.toLowerCase().split(/\s+/).length}`;
    }));
    record("4 insertion consistency", shapes.size === 1, shapes.size === 1 ? `consistent shape across ${ins.length} takes` : `inconsistent shapes: ${[...shapes].join(" | ")}`);
  } else {
    record("4 insertion consistency", null, `needs >=2 insertion-* clips (found ${ins.length})`);
  }

  // criterion 5: same clip twice -> identical scores
  const probe = byGroup.get("clean")?.[0];
  if (probe) {
    try {
      const again = await azureAssessRaw(readFileSync(join(CLIP_DIR, probe.file)), REFERENCES["clean-"]);
      const a = JSON.stringify((probe.json.NBest?.[0]?.Words ?? []).map((w) => w.PronunciationAssessment?.AccuracyScore));
      const b = JSON.stringify((again.NBest?.[0]?.Words ?? []).map((w) => w.PronunciationAssessment?.AccuracyScore));
      record("5 stability", a === b, a === b ? "identical word scores on resubmit" : "scores jittered between identical submissions - pin adapter settings or document the delta");
    } catch (e) {
      record("5 stability", false, `resubmit failed: ${String(e instanceof Error ? e.message : e)}`);
    }
  } else {
    record("5 stability", null, "needs >=1 clean-* clip");
  }

  // criterion 7: latency budget p50<2.5s p95<5s (20-clip class; gates on what was sent)
  if (latencies.length >= 5) {
    const sorted = [...latencies].sort((x, y) => x - y);
    const p50 = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    record("7 latency budget", p50 < 2500 && p95 < 5000, `p50=${p50}ms p95=${p95}ms over ${latencies.length} clips`);
  } else {
    record("7 latency budget", null, `needs >=5 timed clips (found ${latencies.length})`);
  }

  printSummary();
}

function printSummary() {
  const run = results.filter((r) => r.pass !== null);
  const failed = run.filter((r) => r.pass === false);
  console.log(`\nRESULT: ${failed.length === 0 && run.length > 0 ? "ALL CHECKS PASS" : failed.length > 0 ? `${failed.length} CHECK(S) FAILED` : "SKIPPED"}`);
  if (failed.length > 0) process.exit(1);
}

main();
