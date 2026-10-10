import { builtinTTS } from "@/lib/builtin-ai";
import { createHash } from "crypto";

// Server-side speech synthesis through the built-in engine. Real audio for
// the listening lab, the sound lab and review cards. Small in-memory cache
// so replaying a passage never re-synthesizes it.

const CACHE = new Map<string, Buffer>();
const CACHE_MAX = 80;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const speed = Number(body?.speed ?? 1.0);
  if (!text) return Response.json({ ok: false, error: "no text" }, { status: 400 });
  if (text.length > 1200) return Response.json({ ok: false, error: "text too long for one utterance" }, { status: 413 });

  const key = createHash("sha1").update(`${speed}|${text}`).digest("hex");
  const hit = CACHE.get(key);
  if (hit) {
    return new Response(new Uint8Array(hit), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Cache": "hit" },
    });
  }

  const out = await builtinTTS(text, speed);
  if (!out.ok || !out.audio) {
    return Response.json({ ok: false, error: out.error || "synthesis failed" }, { status: 502 });
  }
  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  CACHE.set(key, out.audio);
  return new Response(new Uint8Array(out.audio), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Cache": "miss" },
  });
}
