import { builtinASR } from "@/lib/builtin-ai";

// Server-side speech recognition through the built-in engine. The speaking
// studio records in the browser, posts base64 audio here, and gets a
// transcript that the speaking coach evaluates.

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const audio = String(body?.audio ?? "");
  if (!audio) return Response.json({ ok: false, error: "no audio" }, { status: 400 });
  const stripped = audio.replace(/^data:[^;]+;base64,/, "");
  if (stripped.length > 14_000_000) {
    return Response.json({ ok: false, error: "recording too large" }, { status: 413 });
  }
  const out = await builtinASR(stripped);
  if (!out.ok) return Response.json({ ok: false, error: out.error }, { status: 502 });
  return Response.json({ ok: true, text: out.text });
}
