// Debug: what does the raw SDK return for the tutor prompt?
import ZAI from "z-ai-web-dev-sdk";

const system = `You are Rah, the English coach inside a learning app. The learner's first language is Farsi (Persian) and they sit around B2, working toward C1.

Reply with ONE JSON object and nothing else. Shape:
{"reply": "your English turn, max 80 words", "corrections": [{"wrong": "their exact words", "right": "corrected", "fa": "explanation in Farsi", "trap": "one tag or none"}], "fa_note": "one sentence in Farsi: what to practice next", "praised": false}

Never use the em dash character anywhere in your output.

## Learner profile
{"level":"B2","streak":1,"focus":"vocabulary","due":10,"recentTraps":[],"weakSkills":[]}`;

async function main() {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: system },
      { role: "user", content: "I am responsible of managing the team." },
    ],
    thinking: { type: "disabled" },
  });
  const msg = completion.choices[0]?.message;
  console.log("=== FULL MESSAGE OBJECT ===");
  console.log(JSON.stringify(msg, null, 2).slice(0, 3000));
  console.log("=== CONTENT ===");
  console.log((msg?.content ?? "UNDEFINED").slice(0, 2000));
  console.log("=== HAS CURLY? ===", (msg?.content ?? "").includes("{"));
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
