import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, speakSystem } from "@/lib/ai";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";

export const dynamic = "force-dynamic";

interface SpeakResult {
  scores: { fluency: number; range: number; accuracy: number; delivery: number };
  errors: { bad: string; good: string; fa: string; trap: string }[];
  upgrades: { plain: string; better: string; fa: string }[];
  round2: { constraint: string; same_prompt: boolean };
  verdict: string;
  fa_note: string;
}

export const SPEAK_PROMPTS = [
  "Talk for 2 minutes: a habit you changed and what actually happened.",
  "Talk for 2 minutes: convince me your favorite tool is worth the hype.",
  "Talk for 2 minutes: describe a place you keep going back to, and why it works on you.",
  "Talk for 2 minutes: explain something from your field to a smart 12 year old.",
  "Talk for 2 minutes: a time you were completely wrong about someone.",
];

export async function GET() {
  const rows = await db.speakSession.findMany({ orderBy: { id: "desc" }, take: 8 });
  return NextResponse.json({
    prompts: SPEAK_PROMPTS,
    recent: rows.map((r) => ({ id: r.id, prompt: r.prompt, round: r.round, result: safeParse(r.result), at: r.at })),
  });
}

export async function POST(req: Request) {
  const { prompt, transcript, round } = await req.json();
  const t = String(transcript ?? "").trim();
  if (t.length < 30) return NextResponse.json({ error: "The transcript is too short. Speak for at least 30 seconds." }, { status: 400 });

  const profile = await buildProfile();
  let result: SpeakResult;
  try {
    result = await aiJson<SpeakResult>(speakSystem(profile.level), [
      { role: "user", content: `Prompt: ${prompt}\nRound: ${round ?? 1}\nTranscript:\n${t.slice(0, 5000)}` },
    ]);
  } catch (e) {
    return NextResponse.json({ error: `Coach is unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  await db.speakSession.create({ data: { prompt: String(prompt ?? ""), transcript: t.slice(0, 5000), round: Number(round ?? 1), result: JSON.stringify(result) } });
  await bumpDaily("spoken");
  await bumpDaily("xp", 20);
  await touchStreak();
  return NextResponse.json(result);
}

function safeParse(s: string): SpeakResult | null {
  try {
    return JSON.parse(s) as SpeakResult;
  } catch {
    return null;
  }
}
