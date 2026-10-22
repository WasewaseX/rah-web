// E2E proof of the measured read-aloud chain (Task 64).
// Real audio in (TTS-rendered target sentence), real ASR, real scorer - the
// exact lib path the route runs, minus the HTTP layer.
// Run: bun scripts/test-readaloud-e2e.ts scripts/out/tts-a.wav

import { readFileSync } from "fs";
import { transcribeAudio } from "../src/lib/asr";
import { scorePronunciation } from "../src/lib/pronunciation";

const file = process.argv[2] ?? "scripts/out/tts-a.wav";
const target = "I would like to reserve a table for two people at eight in the evening.";

const b64 = readFileSync(file).toString("base64");
console.log("audio:", file, `(${b64.length} base64 chars)`);

const t0 = Date.now();
const { text, provider } = await transcribeAudio(b64);
console.log(`asr (${provider}, ${Date.now() - t0}ms):`, text);

const report = scorePronunciation(target, text);
console.log("report:", JSON.stringify({ accuracy: report.accuracy, hits: report.hits, near: report.near, misses: report.misses, total: report.total, tier: report.tier }));

if (report.accuracy < 90) {
  console.log("FAIL: measured accuracy of a known-good clip fell below 90");
  process.exit(1);
}
console.log("PASS: measured chain (audio -> ASR -> alignment) scores a known-good clip at", report.accuracy);
