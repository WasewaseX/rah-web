// Reproduce the import JSON failure and inspect the raw engine output.
import ZAI from "z-ai-web-dev-sdk";

const system = `You turn any English text into study material inside Rah, an English website for Farsi speakers, target level B2.

Extract 6 to 12 of the most valuable items from the text: mid-frequency words, collocations, phrasal verbs, fixed expressions. Skip words a B2 learner certainly knows (common verbs, basic nouns). For each item build one card. Prefer cloze: a sentence (reuse the text's own sentence where possible) with ___ for the target item, answer is the missing string. Use kind ef (English to Farsi) for single concepts, fae (Farsi to English) sparingly.

Gloss every item in natural Farsi (fa). note is one short English line about usage or register. level is the target level.

Output ONE JSON object, nothing else:
{"cards": [{"kind": "cloze", "prompt": "sentence with ___", "answer": "missing", "en": "the full expression", "fa": "farsi gloss", "note": "", "level": "B2 or C1"}], "glossary": [{"w": "", "fa": ""}]}
Never use the em dash character anywhere in your output.`;

const text = `Remote work has quietly rewritten the unwritten contract between employers and staff. At first, managers worried that productivity would plummet without supervision, but the evidence suggests otherwise: most studies report flat or slightly higher output. What did erode was the invisible glue of the office, the hallway conversations and spontaneous brainstorming that spark unexpected ideas. Companies now tiptoe around a dilemma: call people back and risk a revolt, or stay remote and watch mentorship wither. Hybrid schedules are the compromise du jour, yet critics argue they combine the costs of both worlds. The debate is far from settled, and organizations that nail the balance may gain a lasting edge in attracting talent.`;

async function main() {
  const zai = await ZAI.create();
  const c = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: system },
      { role: "user", content: text },
    ],
    thinking: { type: "disabled" },
    temperature: 0.4,
    max_tokens: 2000,
  });
  const t = c.choices?.[0]?.message?.content ?? "";
  console.log("LEN:", t.length);
  console.log("FINISH:", c.choices?.[0]?.finish_reason);
  console.log("HEAD:", JSON.stringify(t.slice(0, 120)));
  console.log("TAIL:", JSON.stringify(t.slice(-160)));
  // emulate extractJson
  const s = t.replace(/\`\`\`json/g, "\`\`\`").replace(/\`\`\`/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  try {
    JSON.parse(s.slice(a, b + 1));
    console.log("PARSE: ok");
  } catch (e) {
    console.log("PARSE FAIL:", (e as Error).message);
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
