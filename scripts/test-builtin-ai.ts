// Smoke test: built-in chat, TTS and ASR through the platform SDK.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

async function main() {
  const zai = await ZAI.create();

  // 1. chat
  const t0 = Date.now();
  const c = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: "Reply with ONE JSON object only: {\"reply\":\"...\",\"ok\":true}. reply = the word ready." },
      { role: "user", content: "ping" },
    ],
    thinking: { type: "disabled" },
    temperature: 0.4,
    max_tokens: 800,
  });
  console.log("CHAT:", JSON.stringify(c.choices?.[0]?.message?.content ?? "").slice(0, 200), "ms:", Date.now() - t0);

  // 2. tts
  const t1 = Date.now();
  const tts = await zai.audio.tts.create({
    input: "The committee has decided to postpone the referendum.",
    voice: "tongtong",
    speed: 1.0,
    response_format: "wav",
    stream: false,
  });
  const buf = Buffer.from(new Uint8Array(await tts.arrayBuffer()));
  fs.writeFileSync("/tmp/tts-test.wav", buf);
  console.log("TTS:", buf.length, "bytes, ms:", Date.now() - t1, "header:", buf.subarray(0, 4).toString("ascii"));

  // 3. asr (round trip on our own wav)
  const t2 = Date.now();
  const b64 = fs.readFileSync("/tmp/tts-test.wav").toString("base64");
  const asr = await zai.audio.asr.create({ file_base64: b64 });
  console.log("ASR:", JSON.stringify(asr.text ?? ""), "ms:", Date.now() - t2);
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
