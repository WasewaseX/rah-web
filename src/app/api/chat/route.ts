import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";
import { awardXp, progressQuest } from "@/lib/arcade";
import { runCoach } from "@/lib/agent/run";
import { recordMistakes } from "@/lib/mistakes";
import { contentScope } from "@/lib/scope";
import type { ProfileJson } from "@/lib/ai";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const rows = await db.chatMsg.findMany({ where: await contentScope(), orderBy: { id: "asc" }, take: 200 });
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
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const { message } = await req.json();
  const text = String(message ?? "").trim();
  if (!text) return NextResponse.json({ error: "message required" }, { status: 400 });

  const profile: ProfileJson = await buildProfile();
  const history = await db.chatMsg.findMany({ where: await contentScope(req), orderBy: { id: "desc" }, take: 14 });
  const flat = history
    .reverse()
    .map((h) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.role === "user" ? h.content : flattenCoach(h.content),
    }));

  let out;
  try {
    out = await runCoach(text, flat, profile);
  } catch (e) {
    return NextResponse.json({ error: `Coach is unreachable right now: ${(e as Error).message}` }, { status: 502 });
  }

  const uid = await contentScope(req);
  await db.chatMsg.create({ data: { role: "user", content: text, ...uid } });
  await db.chatMsg.create({ data: { role: "coach", content: JSON.stringify(out), ...uid } });

  // One memory hook at the agent boundary: ANY skill that returns tagged
  // corrections (chat, correct, roleplay, debate, socratic, summarize, ...)
  // feeds the persistent mistake families here. Fire and forget: memory must
  // never delay or break the turn that produced the mistakes.
  if (out.corrections && out.corrections.length > 0) {
    void recordMistakes(
      out.corrections.map((c) => ({
        kind: "chat" as const,
        tag: String((c as { trap?: string }).trap ?? "none"),
        wrong: String(c.wrong ?? ""),
        right: String(c.right ?? ""),
      })),
    ).catch(() => undefined);
  }

  await bumpDaily("reviews");
  await awardXp(8, { chainHit: true });
  await progressQuest("chat_10", 1);
  await touchStreak();

  return NextResponse.json(out);
}

export async function DELETE() {
  await db.chatMsg.deleteMany({ where: await contentScope() });
  return NextResponse.json({ ok: true });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Stored coach envelopes are flattened for the model's history: only the
// spoken English turn matters, not the machinery.
function flattenCoach(content: string): string {
  try {
    const p = JSON.parse(content) as { reply?: string };
    return p.reply ?? content.slice(0, 900);
  } catch {
    return content.slice(0, 900);
  }
}
