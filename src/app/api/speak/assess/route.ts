// Read-aloud pronunciation assessment (Task 64 - audit P1 "genuine acoustic
// pronunciation assessment", Azure decision gate closed).
//
// Flow: learner records a target sentence -> client encodes 16k-mono WAV ->
// this route runs the MEASURED tier:
//   - Azure configured? real phoneme-level assessment (azure-speech.ts).
//   - Azure errors mid-call? fall back to the built-in tier and say so.
//   - Otherwise: built-in SDK ASR -> deterministic word alignment
//     (pronunciation.ts). Zero configuration, real audio, real transcript.
//
// Honesty rules enforced here:
//   - The response ALWAYS carries the tier label that produced the score.
//   - No phoneme-level claims exist in the built-in tier - word misses stay
//     word misses (Sound Lab may infer a contrast, and is labeled as doing so).
//   - The ASR call is rate-limited like every other metered AI service call.
//
// Assessments persist as SpeakSession rows (round 0 = read-aloud assessment,
// distinct from the monologue rounds 1/2) so the analytics ledger sees them.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpDaily, touchStreak } from "@/lib/server";
import { awardXp } from "@/lib/arcade";
import { contentScope } from "@/lib/scope";
import { aiRateLimit } from "@/lib/rate-limit";
import { transcribeAudio, MAX_AUDIO_BASE64_CHARS } from "@/lib/asr";
import { scorePronunciation } from "@/lib/pronunciation";
import { azureSpeechConfigured, azureAssess } from "@/lib/azure-speech";

export const dynamic = "force-dynamic";

// Curated read-aloud targets: each sentence stresses documented Farsi-speaker
// trouble spots (w/v, th, p/b, s/sh, tense/lax vowels, final clusters) so a
// five-second read produces usable contrast evidence.
export const READ_ALOUD_TARGETS = [
  "We went to see a very wide river in the west on a windy Wednesday.",
  "The thirty-three thieves thought that they thrilled the throne throughout Thursday.",
  "I would like to reserve a table for two people at eight in the evening.",
  "Put the park pass in that paper bag beside the pink pig.",
  "She sells fresh fish and chips on ships near the seashore.",
  "The full pool felt cool under the fool's fooling moon.",
  "His best test asked for the texts and the world map.",
  "They bathed in the warm air while their brother gathered the weather data.",
];

export async function GET() {
  return NextResponse.json({ targets: READ_ALOUD_TARGETS, azure: azureSpeechConfigured() });
}

export async function POST(req: Request) {
  // The ASR call is metered exactly like the LLM calls (audit P1-6).
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const body = await req.json().catch(() => null);
  const target = String(body?.target ?? "").trim();
  const audio = String(body?.audio ?? "");

  if (target.length < 3 || target.length > 400) {
    return NextResponse.json({ error: "Pick one of the read-aloud sentences (3-400 characters)." }, { status: 400 });
  }
  if (!audio) {
    return NextResponse.json({ error: "No audio reached the server - hold the record button and read the sentence." }, { status: 400 });
  }
  if (audio.length > MAX_AUDIO_BASE64_CHARS) {
    return NextResponse.json({ error: "Audio clip too large (9MB ceiling) - read one sentence at a time." }, { status: 413 });
  }

  const scope = await contentScope(req);
  let transcript = "";
  let tier = "measured:asr-alignment";
  let report: unknown;
  let degraded: string | null = null;
  let provider = "zai-asr";

  if (azureSpeechConfigured()) {
    try {
      const az = await azureAssess(audio, target);
      transcript = az.transcript;
      tier = az.tier;
      provider = "azure-speech";
      report = {
        accuracy: az.accuracyScore,
        pronunciation: az.pronunciationScore,
        fluency: az.fluencyScore,
        completeness: az.completenessScore,
        words: az.words,
      };
    } catch (e) {
      degraded = `Azure phoneme tier unavailable (${(e as Error).message}) - scored with the built-in word tier.`;
    }
  }

  if (!report) {
    try {
      const tr = await transcribeAudio(audio);
      transcript = tr.text;
      report = scorePronunciation(target, transcript);
      tier = "measured:asr-alignment";
    } catch (e) {
      return NextResponse.json({ error: `Speech service unreachable: ${(e as Error).message}` }, { status: 502 });
    }
  }

  await db.speakSession.create({
    data: {
      prompt: `read-aloud: ${target.slice(0, 120)}`,
      transcript: transcript.slice(0, 5000),
      round: 0,
      result: JSON.stringify({ assessment: report, tier }),
      ...scope,
    },
  });
  await bumpDaily("spoken");
  await awardXp(8, { chainHit: true });
  await touchStreak();

  return NextResponse.json({ target, transcript, tier, provider, degraded, report });
}
