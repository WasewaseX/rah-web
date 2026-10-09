// Test: does the SDK support (a) response_format json_object, (b) assistant prefill?
import ZAI from "z-ai-web-dev-sdk";

const system = `You are Rah, an English coach. Reply with ONE JSON object and nothing else. Shape:
{"reply": "...", "corrections": [], "fa_note": "...", "praised": false}`;

const history = [
  { role: "user" as const, content: "I have went to Tehran yesterday." },
  { role: "assistant" as const, content: "Can you try that sentence again? Think about the verb tense." },
  { role: "user" as const, content: "She gave me many advices." },
];

async function main() {
  const zai = await ZAI.create();

  // Test A: trailing assistant message as prefill (force JSON open)
  console.log("=== TEST A: assistant prefill ===");
  try {
    const c = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: system },
        ...history,
        { role: "assistant", content: "{" },
      ],
      thinking: { type: "disabled" },
    });
    const out = c.choices[0]?.message?.content ?? "";
    console.log("A RESULT:", out.slice(0, 300));
    console.log("A starts with JSON-ish:", /^\s*\{/.test(out) || out.trim().startsWith('"'));
  } catch (e) {
    console.log("A FAILED:", (e as Error).message);
  }

  // Test B: nudge message at end (assistant instruction)
  console.log("=== TEST B: contract nudge at end ===");
  try {
    const c = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: system },
        ...history,
        {
          role: "assistant",
          content:
            'Remember: your next message must be ONLY the JSON object {"reply":..., "corrections":[...], "fa_note":"...", "praised":false} with no other text before or after. Correct the learner\'s latest sentence.',
        },
        { role: "user", content: "She gave me many advices." },
      ],
      thinking: { type: "disabled" },
    });
    const out = c.choices[0]?.message?.content ?? "";
    console.log("B RESULT:", out.slice(0, 300));
    console.log("B has curly:", out.includes("{"));
  } catch (e) {
    console.log("B FAILED:", (e as Error).message);
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
