// One-off cleanup: coach-agent turns saved BEFORE the JSON-repair fix stored
// raw turn objects ({"thought":...,"tool":...}}}) as the reply. Unwrap any
// nested reply; otherwise mark the row as fixed legacy. Idempotent by design.
process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
export {};

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const looksRaw = (s: string) => s.trim().startsWith("{") && /"(thought|tool|final|args)"/.test(s);

const rows = await prisma.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "asc" } });
let fixed = 0;
for (const row of rows) {
  let parsed: any = null;
  try {
    parsed = JSON.parse(row.content);
  } catch {
    continue;
  }
  if (!parsed || parsed.skill !== "agent" || typeof parsed.reply !== "string" || !looksRaw(parsed.reply)) continue;

  const m = parsed.reply.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  let replacement = "(older turn - the raw agent protocol leaked here; it is fixed now)";
  if (m) {
    try {
      const unwrapped = JSON.parse(`"${m[1]}"`) as string;
      if (unwrapped.trim() && !unwrapped.trim().startsWith("{")) replacement = unwrapped;
    } catch {}
  }
  parsed.reply = replacement;
  await prisma.chatMsg.update({ where: { id: row.id }, data: { content: JSON.stringify(parsed) } });
  fixed += 1;
  console.log(`fixed chatMsg #${row.id}`);
}
console.log(`cleanup done: ${fixed} row(s) repaired`);
await prisma.$disconnect();
