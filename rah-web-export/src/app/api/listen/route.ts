import { NextResponse } from "next/server";
import { aiJson, listenSystem } from "@/lib/ai";
import { buildProfile, bumpDaily } from "@/lib/server";

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
  const { topic } = await req.json();
  const profile = await buildProfile();
  let out: ListenQuiz;
  try {
    out = await aiJson<ListenQuiz>(listenSystem(profile.level), [
      { role: "user", content: `Topic: ${String(topic ?? "a small surprise that changed a plan")}. Write for a ${profile.level} Farsi-speaking listener.` },
    ]);
  } catch (e) {
    return NextResponse.json({ error: `Listening builder is unreachable: ${(e as Error).message}` }, { status: 502 });
  }
  await bumpDaily("listened");
  await bumpDaily("xp", 10);
  return NextResponse.json(out);
}
