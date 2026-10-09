import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, writingSystem } from "@/lib/ai";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";

export const dynamic = "force-dynamic";

interface WritingResult {
  level: string;
  scores: { task: number; organization: number; range: number; accuracy: number };
  verdict: string;
  errors: { bad: string; good: string; fa: string; type: string }[];
  upgrades: { plain: string; c1: string; fa: string }[];
  next_focus: string;
}

export const WRITING_PROMPTS = [
  "Some people think remote work makes teams stronger. Others say it destroys them. What is your position, and what would change your mind?",
  "Describe a decision you made that looked wrong at first but turned out right. What did it teach you?",
  "Your city wants to spend money on either fast internet or public parks. Argue for one, then steelman the other side.",
  "Write a short email to a client explaining a one week delay. Be honest, keep the relationship, offer a fix.",
  "Is it better to master one skill or collect many shallow ones? Take a side and defend it with examples.",
];

export async function GET() {
  const rows = await db.writingSub.findMany({ orderBy: { id: "desc" }, take: 10 });
  return NextResponse.json({
    prompts: WRITING_PROMPTS,
    recent: rows.map((r) => ({ id: r.id, prompt: r.prompt, result: safeParse(r.result), at: r.at })),
  });
}

export async function POST(req: Request) {
  const { prompt, text } = await req.json();
  const body = String(text ?? "").trim();
  if (body.length < 60) return NextResponse.json({ error: "Write at least 60 characters so there is something to grade." }, { status: 400 });

  const profile = await buildProfile();
  let result: WritingResult;
  try {
    result = await aiJson<WritingResult>(writingSystem(profile), [
      { role: "user", content: `Prompt: ${prompt}\n\nEssay:\n${body}` },
    ]);
  } catch (e) {
    return NextResponse.json({ error: `The examiner is unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  await db.writingSub.create({ data: { prompt: String(prompt ?? ""), text: body, result: JSON.stringify(result) } });
  await bumpDaily("written");
  await bumpDaily("xp", 15);
  await touchStreak();
  return NextResponse.json(result);
}

function safeParse(s: string): WritingResult | null {
  try {
    return JSON.parse(s) as WritingResult;
  } catch {
    return null;
  }
}
