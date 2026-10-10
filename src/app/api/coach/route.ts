import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAgent } from "@/lib/skills/agent";
import { isLegacyChat, type Envelope } from "@/lib/skills/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// History: every row normalized to a Envelope so the UI renders one shape.
export async function GET() {
  const rows = await db.chatMsg.findMany({ orderBy: { id: "asc" }, take: 200 });
  const messages = rows.map((r) => {
    if (r.role === "user") return { id: r.id, role: "user", at: r.at, text: r.content };
    let env: Envelope | null = null;
    try {
      const j = JSON.parse(r.content) as unknown;
      env = isLegacyChat(j)
        ? { kind: "chat", reply: j.reply, corrections: j.corrections ?? [], fa_note: j.fa_note ?? "", praised: false }
        : (j as Envelope);
    } catch {
      env = { kind: "chat", reply: r.content.slice(0, 600), corrections: [], fa_note: "", praised: false };
    }
    return { id: r.id, role: "coach", at: r.at, envelope: env };
  });
  return NextResponse.json({ messages });
}

// The agent endpoint. Server-sent events stream every step as it happens:
// the UI shows the work, not a spinner with a secret inside.
export async function POST(req: Request) {
  const { message } = await req.json().catch(() => ({ message: "" }));
  const text = String(message ?? "").trim();
  if (!text) return NextResponse.json({ error: "message required" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // client vanished mid-run; the agent keeps its own persistence
        }
      };
      try {
        await runAgent(text, emit as never);
      } catch (e) {
        emit({ type: "error", message: `The coach hit a snag: ${(e as Error).message}` });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function DELETE() {
  await db.chatMsg.deleteMany({});
  return NextResponse.json({ ok: true });
}
