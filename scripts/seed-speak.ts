process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
export {};
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
await p.speakSession.createMany({ data: [
  { prompt: "Talk for 2 minutes: a habit you changed and what actually happened.", transcript: "I used to drink much coffee every day but I changed this habit last year when doctor said...", round: 1, result: JSON.stringify({ scores: { fluency: 6, range: 5, accuracy: 5, delivery: 6 }, errors: [{ trap: "articles", bad: "doctor said", good: "the doctor said" }], upgrades: [], round2: { constraint: "add one number", same_prompt: true }, verdict: "ok", fa_note: "" }) },
  { prompt: "Talk for 2 minutes: a habit you changed and what actually happened.", transcript: "I used to drink too much coffee every day, but I changed this habit last year when the doctor said...", round: 2, result: JSON.stringify({ scores: { fluency: 7, range: 6, accuracy: 7, delivery: 7 }, errors: [], upgrades: [], round2: { constraint: "", same_prompt: true }, verdict: "better", fa_note: "" }) },
]});
await p.$disconnect();
console.log("seeded");
