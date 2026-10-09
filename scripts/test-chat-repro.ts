// Replicate the exact route path: live profile + real chat history -> aiJson
import { aiJson, tutorSystem, type ProfileJson } from "../src/lib/ai";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface TutorReply {
  reply: string;
  corrections: { wrong: string; right: string; fa: string; trap: string }[];
  fa_note: string;
  praised: boolean;
}

function plainText(content: string): string {
  try {
    const j = JSON.parse(content) as TutorReply;
    return j.reply ?? content;
  } catch {
    return content;
  }
}

async function main() {
  const rows = await db.chatMsg.findMany({ orderBy: { id: "asc" }, take: 100 });
  console.log(`=== CHAT HISTORY (${rows.length} rows) ===`);
  for (const r of rows) {
    console.log(`[${r.id}] ${r.role}: ${plainText(r.content).slice(0, 120)}`);
  }

  const history = await db.chatMsg.findMany({ orderBy: { id: "desc" }, take: 14 });
  const aiHistory = history
    .reverse()
    .map((h) => ({ role: h.role === "user" ? ("user" as const) : ("assistant" as const), content: h.role === "user" ? h.content : plainText(h.content) }));

  const profile: ProfileJson = {
    level: "B2",
    streak: 1,
    focus: "vocabulary",
    due: 10,
    recentTraps: ["preposition"],
    mistakes: [],
    weakSkills: ["vocabulary"],
  };

  console.log("=== CALLING aiJson WITH HISTORY ===");
  try {
    const out = await aiJson<TutorReply>(
      tutorSystem(profile),
      [...aiHistory, { role: "user", content: "She gave me many advices about my job." }],
    );
    console.log("SUCCESS:", JSON.stringify(out, null, 2).slice(0, 1200));
  } catch (e) {
    console.error("REPRODUCED FAILURE:", (e as Error).message);
  }
  await db.$disconnect();
}

main();
