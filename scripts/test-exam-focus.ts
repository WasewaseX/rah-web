// Live regression test for the exam focus bug:
// "generate a 12 question vocab only exam" must return vocabulary-only items.
const BASE = "http://localhost:3000";

interface ExamItemClient { id: string; type: string; skill: string; q: string }
interface ChatResp {
  reply?: string;
  steps?: { label: string }[];
  exam?: { count: number; spec: { targetSkills: string[]; minutes: number; plannedCount: number }; items: ExamItemClient[] };
}

async function run(label: string, message: string, expectSkills: string[]) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [] }),
  });
  const data = (await res.json()) as ChatResp;
  if (!res.ok || !data.exam) {
    console.log(`FAIL ${label}: no exam in response (status ${res.status})`);
    return false;
  }
  const ex = data.exam;
  const problems: string[] = [];
  if (ex.count !== ex.items.length) problems.push(`announced ${ex.count} != items ${ex.items.length}`);
  if (ex.spec.plannedCount !== ex.items.length) problems.push(`plannedCount ${ex.spec.plannedCount} != items ${ex.items.length}`);
  const want = expectSkills.join("|").toLowerCase().replace(/vocab\w*/g, "vocabulary");
  const got = ex.spec.targetSkills.join("|").toLowerCase();
  if (got !== want) problems.push(`targetSkills [${got}] != expected [${want}]`);
  const offFocus = ex.items.filter((i) => !ex.spec.targetSkills.includes(i.skill));
  if (offFocus.length) problems.push(`off-focus items: ${offFocus.map((i) => `${i.id}:${i.skill}`).join(", ")}`);
  const ok = problems.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(`  reply: ${data.reply?.slice(0, 110)}`);
  console.log(`  skills: ${ex.spec.targetSkills.join(", ")} | items: ${ex.items.map((i) => i.skill).join(", ")}`);
  if (!ok) for (const p of problems) console.log(`  !! ${p}`);
  return ok;
}

const results = await run("vocab-only 12q (the user's exact request)", "generate a 12 question vocab only exam", ["vocab"]);
await run("grammar-only 6q", "generate a 6 question grammar only exam", ["grammar"]);
console.log(results ? "\nALL EXAM FOCUS TESTS PASS" : "\nSOME TESTS FAILED");
process.exit(results ? 0 : 1);

export {}
