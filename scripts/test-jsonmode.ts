import ZAI from "z-ai-web-dev-sdk";
async function main() {
  const zai = await ZAI.create();
  try {
    const c = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: 'Reply with ONE JSON object: {"a": "say \"quoted\" inside"}' },
        { role: "user", content: "go" },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    } as never);
    console.log("JSONMODE OK:", JSON.stringify(c.choices?.[0]?.message?.content ?? "").slice(0, 200));
  } catch (e) {
    console.log("JSONMODE FAIL:", (e as Error).message.slice(0, 200));
  }
}
main();
