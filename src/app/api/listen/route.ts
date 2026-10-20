import { NextResponse } from "next/server";
import { aiJson, listenSystem } from "@/lib/ai";
import { buildProfile, bumpDaily } from "@/lib/server";
import { awardXp } from "@/lib/arcade";
import { ladderFor, ladderBrief } from "@/lib/ladder";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ListenQuiz {
  title: string;
  text: string;
  questions: { q: string; choices: string[]; a: string; why: string }[];
}

export const LISTEN_TOPICS = [
  "why most productivity hacks fail",
  "a story about missing a flight and what followed",
  "how noise shapes what we remember",
  "the strange economics of coffee",
  "what runners know about pacing",
];

export async function GET() {
  return NextResponse.json({ topics: LISTEN_TOPICS });
}

export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const { topic } = await req.json();
  const profile = await buildProfile();
  // P3: the ladder envelope decides the material's difficulty BEFORE the AI
  // gets any say; the payload carries it back so the client paces the TTS.
  const lad = ladderFor(profile.level);
  let out: ListenQuiz;
  try {
    out = await aiJson<ListenQuiz>(listenSystem(profile.level), [
      { role: "user", content: `Topic: ${String(topic ?? "a small surprise that changed a plan")}. Write for a ${profile.level} Farsi-speaking listener.\n${ladderBrief(lad, "listen")}` },
    ]);
  } catch (e) {
    return NextResponse.json({ error: `Listening builder is unreachable: ${(e as Error).message}` }, { status: 502 });
  }
  await bumpDaily("listened");
  await awardXp(10, { chainHit: true });
  return NextResponse.json({ ...out, ladder: { band: lad.band, ttsRate: lad.ttsRate } });
}
