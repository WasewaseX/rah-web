// Unit battery for the measured pronunciation scorer (Task 64).
// Deterministic end to end: no AI, no network - same pair in, same report out.
// Run: bun scripts/test-pronunciation.ts

import { scorePronunciation } from "../src/lib/pronunciation";
import { azureSpeechConfigured, azureAssess } from "../src/lib/azure-speech";

let pass = 0;
let fail = 0;
function check(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? " - " + detail : ""}`);
  }
}

const TARGET_A = "I would like to reserve a table for two people at eight in the evening.";

// 1. perfect measured transcript -> 100, all hits
{
  const r = scorePronunciation(TARGET_A, TARGET_A);
  check(r.accuracy === 100, "perfect read scores 100", `got ${r.accuracy}`);
  check(r.hits === r.total && r.misses === 0 && r.near === 0, "perfect read is all hits", JSON.stringify({ h: r.hits, t: r.total }));
  check(r.tier === "measured:asr-alignment", "tier label is measured:asr-alignment", r.tier);
  check(r.words.every((w) => w.status === "hit"), "every word chip is a hit");
}

// 2. ASR-style transcript with punctuation + casing differences -> still 100
{
  const r = scorePronunciation(TARGET_A, "i would like to reserve a table for two people at eight in the evening.");
  check(r.accuracy === 100, "punctuation/case normalization keeps 100", `got ${r.accuracy}`);
}

// 3. one near miss (west -> vest, edit distance 1) -> half credit
{
  const r = scorePronunciation("I went to the west market", "I went to the vest market");
  check(r.total === 6 && r.accuracy === 92, "one near miss of six words scores 92", `got ${r.accuracy} total ${r.total}`);
  check(r.near === 1 && r.hits === 5 && r.misses === 0, "near=1 hits=5", JSON.stringify({ h: r.hits, n: r.near, m: r.misses }));
  const w = r.words.find((x) => x.target === "west");
  check(w?.status === "near" && w.heard === "vest", "west heard as vest is a near", JSON.stringify(w));
}

// 4. one clean miss (word dropped) -> 0 credit for it
{
  const r = scorePronunciation("I went to the west market", "I went to the market");
  check(r.accuracy === 83, "dropped word of six scores 83", `got ${r.accuracy}`);
  check(r.misses === 1 && r.words.find((x) => x.target === "west")?.heard === null, "west is a miss with heard=null");
}

// 5. completely different word -> miss, not near
{
  const r = scorePronunciation("reserve a table", "reserve a chair");
  check(r.words.find((x) => x.target === "table")?.status === "miss", "table->chair is a miss (far edit)");
}

// 6. extra inserted words are listed, not penalized twice
{
  const r = scorePronunciation("good morning teacher", "good very morning teacher");
  check(r.extra.includes("very"), "insertion appears in extra", JSON.stringify(r.extra));
  check(r.accuracy === 100, "insertions do not lower word accuracy", `got ${r.accuracy}`);
}

// 7. determinism: identical calls, deep-equal reports
{
  const a = scorePronunciation("The thirty three thieves thought that", "the thirty tree thieves thought");
  const b = scorePronunciation("The thirty three thieves thought that", "the thirty tree thieves thought");
  check(JSON.stringify(a) === JSON.stringify(b), "same pair twice -> identical report");
  check(a.words.find((x) => x.target === "three")?.status === "near", "three heard as tree is a near", JSON.stringify(a.words));
}

// 8. everything wrong -> 0, never NaN or negative
{
  const r = scorePronunciation("completely different words here", "aa bb cc");
  check(r.accuracy === 0, "garbage read scores 0", `got ${r.accuracy}`);
  check(Number.isFinite(r.accuracy), "accuracy is finite");
}

// 9. honest note travels with the report
{
  const r = scorePronunciation("hello", "hello");
  check(/measured/i.test(r.note) && /phoneme/i.test(r.note), "note labels measured tier and phoneme honesty");
}

// 10. Azure gate: not configured by default (dormant adapter)
{
  check(azureSpeechConfigured() === false, "azure adapter dormant without env keys");
}

// 11. Azure degradation contract (Task 92-bis): WITH keys set but Azure erroring,
// azureAssess must REJECT - that rejection is exactly what the assess route's
// catch branch needs to degrade honestly to the measured word tier. Hermetic:
// fetch is stubbed, no network touched. Restores env + fetch afterwards.
void (async () => {
  const realFetch = globalThis.fetch;
  process.env.AZURE_SPEECH_KEY = "battery-fake-key";
  process.env.AZURE_SPEECH_REGION = "battery-fake-region";
  try {
    check(azureSpeechConfigured() === true, "azure gate flips true with key+region set");
    globalThis.fetch = (async () => {
      throw new Error("battery: azure unreachable");
    }) as typeof fetch;
    let rejected = false;
    let msg = "";
    try {
      await azureAssess("YmF0dGVyeQ==", "hello");
    } catch (e) {
      rejected = true;
      msg = (e as Error).message;
    }
    check(rejected, "azureAssess REJECTS when azure errors (route degrades to word tier)");
    check(/battery: azure unreachable/.test(msg), "rejection carries the underlying error");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.AZURE_SPEECH_KEY;
    delete process.env.AZURE_SPEECH_REGION;
    check(azureSpeechConfigured() === false, "env restored - adapter dormant again");
  }

  console.log(`\npronunciation battery: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
