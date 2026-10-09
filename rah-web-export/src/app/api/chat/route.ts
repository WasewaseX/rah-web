import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, tutorSystem, type ProfileJson } from "@/lib/ai";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";

export const dynamic = "force-dynamic";

interface TutorReply {
  reply: string;
  corrections: { wrong: string; right: string; fa: string; trap: string }[];
  fa_note: string;
  praised: boolean;
}

function cleanEmDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ",");
}

// Last-resort envelope: if every JSON attempt fails, the coach still answers
// with the raw text instead of an error. Never unreachable.
function rawFallback(raw: string): TutorReply {
  return {
    reply: cleanEmDash(raw.trim().slice(0, 600)),
    corrections: [],
    fa_note: "",
    praised: false,
  };
}

export async function GET() {
  const rows = await db.chatMsg.findMany({ orderBy: { id: "asc" }, take: 100 });
  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      at: r.at,
      ...(r.role === "coach" ? { parsed: safeParse(r.content) } : { text: r.content }),
    })),
  });
}

export async function POST(req: Request) {
  const { message } = await req.json();
  const text = String(message ?? "").trim();
  if (!text) return NextResponse.json({ error: "message required" }, { status: 400 });

  const profile: ProfileJson = await buildProfile();
  const history = await db.chatMsg.findMany({ orderBy: { id: "desc" }, take: 14 });
  // Coach turns stay as their stored JSON so the model sees the envelope shape
  // it is contract-bound to produce; plain user turns pass through as-is.
  const aiHistory = history
    .reverse()
    .map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("assistant" as const),
      content: h.role === "user" ? h.content : h.content.slice(0, 900),
    }));

  let out: TutorReply;
  try {
    out = await aiJson<TutorReply>(
      tutorSystem(profile),
      [...aiHistory, { role: "user", content: text }],
      rawFallback,
    );
  } catch (e) {
    return NextResponse.json({ error: `Coach is unreachable right now: ${(e as Error).message}` }, { status: 502 });
  }

  await db.chatMsg.create({ data: { role: "user", content: text } });
  await db.chatMsg.create({ data: { role: "coach", content: JSON.stringify(out) } });
  await bumpDaily("reviews");
  await bumpDaily("xp", 8);
  await touchStreak();

  return NextResponse.json(out);
}

export async function DELETE() {
  await db.chatMsg.deleteMany({});
  return NextResponse.json({ ok: true });
}

function safeParse(s: string): TutorReply | null {
  try {
    return JSON.parse(s) as TutorReply;
  } catch {
    return null;
  }
}
