// Exam quality evaluation: replays the user's real failures as assertions.
// Covers: exact count honored, skill focus respected, no dangling text
// references, no recycled questions across consecutive exams.
const BASE = "http://localhost:3000";

interface ExamItemClient { id: string; type: string; skill: string; q: string }
interface ChatResp {
  reply?: string;
  exam?: { count: number; spec: { targetSkills: string[] }; items: ExamItemClient[] };
}

// Mirrors the engine's broken-item guard: a question that references a text
// while being too short to actually contain one is dead on arrival.
const DANGLING_TEXT_REF = /\b(according to|based on)\b[^.]{0,40}\b(text|passage|article|author|writer)\b|\bthe (text|passage|article) (says|states|mentions|suggests)\b|\bthe (author|writer) (says|states|mentions|argues)\b/i;

async function exam(label: string, message: string): Promise<NonNullable<ChatResp["exam"]>> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [] }),
  });
  const data = (await res.json()) as ChatResp;
  if (!res.ok || !data.exam) throw new Error(`${label}: no exam returned (status ${res.status})`);
  console.log(`\n== ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s) -> ${data.exam.count} items, focus [${data.exam.spec.targetSkills.join(", ")}]`);
  return data.exam;
}

let failures = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

// 1. The user's exact failed request: 4 questions, vocab only, no grammar.
const e1 = await exam("exact user request: 4 questions vocab only", "make an exam with only 4 questions and only vocab no grammar");
check(e1.count === 4, "exactly 4 questions", `got ${e1.count}`);
check(e1.items.every((i) => i.skill === "vocabulary"), "every item is vocabulary", e1.items.map((i) => i.skill).join(","));

// 2. 12-question vocab exam: count + focus at scale.
const e2 = await exam("12-question vocab only", "generate a 12 question vocab only exam");
check(e2.count === 12, "exactly 12 questions", `got ${e2.count}`);
check(e2.items.every((i) => i.skill === "vocabulary"), "every item is vocabulary", e2.items.map((i) => i.skill).join(","));

// 3. Freshness: two mixed exams in a row share zero questions.
const e3 = await exam("mixed exam A (freshness run 1)", "make an exam");
const e4 = await exam("mixed exam B (freshness run 2)", "generate an exam");
const qsA = new Set(e3.items.map((i) => i.q.toLowerCase().replace(/\s+/g, " ").trim()));
const overlap = e4.items.filter((i) => qsA.has(i.q.toLowerCase().replace(/\s+/g, " ").trim()));
check(overlap.length === 0, "no recycled questions between consecutive exams", overlap.map((i) => i.q.slice(0, 60)).join(" | "));

// 4. The broken probe case: assess-level reading question with no text.
const e5 = await exam("assess my level probe", "Assess my level");
check(e5.count === e5.items.length, "probe count consistent", `${e5.count} vs ${e5.items.length}`);
const dangling = e5.items.filter((i) => DANGLING_TEXT_REF.test(i.q) && i.q.length < 220);
check(dangling.length === 0, "no question references a text it does not carry", dangling.map((i) => i.q.slice(0, 80)).join(" | "));

// 5. Reading items, when present anywhere today, must carry passages.
const allItems = [...e3.items, ...e4.items, ...e5.items];
const danglingAll = allItems.filter((i) => DANGLING_TEXT_REF.test(i.q) && i.q.length < 220);
check(danglingAll.length === 0, "all exams: no dangling text references", danglingAll.map((i) => i.q.slice(0, 80)).join(" | "));

// 6. Banned-template spot check: the exact clichés the user saw twice.
const banned = ["new policy has had a significant", "make something less severe", "by the time we arrived at the party"];
const recycled = allItems.filter((i) => banned.some((b) => i.q.toLowerCase().includes(b)));
check(recycled.length === 0, "no overused templates in today's exams", recycled.map((i) => i.q.slice(0, 60)).join(" | "));

console.log(failures === 0 ? "\nALL EXAM QUALITY CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

export {}
