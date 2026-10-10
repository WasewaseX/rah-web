// The built-in Rah engine. Runs entirely server side through the platform
// SDK: no keys, no endpoints, no setup. Every AI feature in Rah routes here
// by default; a BYO provider can take over later, and falls back here if it
// ever fails.
//
// Exposes the same response shape as the BYO chat() in lib/ai.ts so callers
// can swap between engines without branching.

import ZAI from "z-ai-web-dev-sdk";
import type { ChatMsg } from "@/lib/ai";

export const BUILTIN_LABEL = "Rah engine (built-in)";

let client: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null;

function zai() {
  if (!client) client = ZAI.create();
  return client;
}

export interface SimpleResult {
  ok: boolean;
  error: string;
  text: string;
}

export async function builtinChat(
  system: string,
  msgs: ChatMsg[],
  maxOut = 1400,
  jsonMode = false
): Promise<SimpleResult> {
  try {
    const z = await zai();
    // Long envelopes (writing feedback, quizzes) need headroom; the platform
    // model clamps internally when the cap exceeds what it allows.
    const cap = Math.min(Math.max(maxOut, 700), 4000);
    const completion = await z.chat.completions.create({
      messages: [
        { role: "assistant", content: system },
        ...msgs.map((m) => ({ role: m.role, content: m.content })),
      ],
      thinking: { type: "disabled" },
      temperature: 0.4,
      max_tokens: cap,
      // Native JSON mode: the decoder is constrained to valid JSON, which
      // also escapes quotes inside Farsi glosses that break naive parsing.
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    } as never);
    const text = completion.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      return { ok: false, error: "the engine returned an empty response", text: "" };
    }
    return { ok: true, error: "", text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "the built-in engine could not be reached";
    return { ok: false, error: msg, text: "" };
  }
}

// Text to speech. Returns a wav buffer; speed 0.5 to 2.0, 1.0 natural.
export async function builtinTTS(input: string, speed = 1.0): Promise<{ ok: boolean; error: string; audio?: Buffer }> {
  try {
    const z = await zai();
    const response = await z.audio.tts.create({
      input: input.slice(0, 1200),
      voice: "tongtong",
      speed: Math.min(2, Math.max(0.5, speed)),
      response_format: "wav",
      stream: false,
    });
    const buf = Buffer.from(new Uint8Array(await response.arrayBuffer()));
    if (!buf.length) return { ok: false, error: "empty audio payload" };
    return { ok: true, error: "", audio: buf };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "speech synthesis failed";
    return { ok: false, error: msg };
  }
}

// Speech to text. Accepts any base64 audio the platform accepts (wav, mp3,
// webm from MediaRecorder in Chrome). Returns the transcript.
export async function builtinASR(fileBase64: string): Promise<{ ok: boolean; error: string; text: string }> {
  try {
    const z = await zai();
    const response = await z.audio.asr.create({ file_base64: fileBase64 });
    const text = String(response.text ?? "").trim();
    if (!text) return { ok: false, error: "the transcriber heard nothing it could decode", text: "" };
    return { ok: true, error: "", text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "transcription failed";
    return { ok: false, error: msg, text: "" };
  }
}
