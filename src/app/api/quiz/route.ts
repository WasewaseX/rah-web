import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, quizSystem } from "@/lib/ai";
import { buildProfile, bumpDaily } from "@/lib/server";

export const dynamic = "force-dynamic";

interface Quiz {
  title: string;
  items: {
    type: string;
    q: string;
    choices?: string[];
    a: string;
    why: string;
    fa: string;
  }[];
}

export async function POST(req: Request) {
  const { text, source } = await req.json();
  const body = String(text ?? "").trim();
  if (body.length < 40) return NextResponse.json({ error: "Paste or send at least a paragraph." }, { status: 400 });

  const profile = await buildProfile();
  let quiz: Quiz;
  try {
    quiz = await aiJson<Quiz>(quizSystem(profile.level), [{ role: "user", content: body.slice(0, 6000) }]);
  } catch (e) {
    return NextResponse.json({ error: `Quiz builder is unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  await db.quizItem.create({ data: { src: String(source ?? "text"), quiz: JSON.stringify(quiz) } });
  await bumpDaily("xp", 10);
  return NextResponse.json(quiz);
}
