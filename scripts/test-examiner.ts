// Examiner test: generate a collocation exam, answer with legitimate
// synonyms, a spelling slip, and one wrong answer, then inspect the verdicts.
const EXAM_BASE = "http://localhost:3000";

async function runExam() {
  // 1. generate exam
  const gen = await fetch(`${EXAM_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skill: "exam_collocation" }),
  }).then((r) => r.json());
  if (!gen.exam) {
    console.log("NO EXAM:", JSON.stringify(gen).slice(0, 400));
    return;
  }
  const exam = gen.exam;
  console.log(`exam: ${exam.title} | ${exam.questions.length} questions | id ${exam.id}`);

  // 2. build answers: strategy per question type
  const answers: Record<string, string> = {};
  const log: string[] = [];
  for (const q of exam.questions) {
    if (q.type === "mcq") {
      // answer wrong on purpose for q1 mcq: pick a choice that is NOT the answer
      const wrong = q.choices?.find((c) => c.toLowerCase() !== q.answer.toLowerCase());
      answers[q.id] = q.id === "q1" ? (wrong ?? "") : q.answer;
      log.push(`${q.id} [mcq] key=${q.answer} -> given=${answers[q.id]} (intended: ${q.id === "q1" ? "WRONG" : "right"})`);
    } else if (q.type === "write") {
      answers[q.id] = "I took advantage of the good weather and went for a long walk in park, which made me feel relaxed and happy about my decision."; // ~25 words shortish
      log.push(`${q.id} [write] given short essay`);
    } else {
      // typed items: synonym/typo/blank/wrong rotation
      const key = q.answer;
      const synonyms = q.acceptable ?? [];
      // q-typed rotation index
      const n = Number(q.id.replace("q", ""));
      if (n % 4 === 1 && synonyms.length) {
        answers[q.id] = synonyms[0];
        log.push(`${q.id} [${q.type}] key=${key} -> SYNONYM=${synonyms[0]} (from acceptable)`);
      } else if (n % 4 === 2) {
        const typo = key.length > 3 ? key.slice(0, -1) + (key.endsWith("e") ? "" : "e") : key + "x";
        answers[q.id] = typo;
        log.push(`${q.id} [${q.type}] key=${key} -> TYPO=${typo}`);
      } else if (n % 4 === 3) {
        answers[q.id] = "completely wrong word";
        log.push(`${q.id} [${q.type}] key=${key} -> WRONG on purpose`);
      } else {
        answers[q.id] = key;
        log.push(`${q.id} [${q.type}] key=${key} -> EXACT`);
      }
    }
  }
  console.log(log.join("\n"));

  // 3. submit
  const t0 = Date.now();
  const res = await fetch(`${EXAM_BASE}/api/exam/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId: exam.id, answers }),
  }).then((r) => r.json());
  console.log(`\ngrader took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (!res.result) {
    console.log("NO RESULT:", JSON.stringify(res).slice(0, 400));
    return;
  }
  const r = res.result;
  console.log(`\nSCORE ${r.score}/${r.total} (${r.percent}%) band=${r.band}`);
  console.log(`verdict: ${r.strengths?.join(" | ")} ... weak: ${r.weaknesses?.join(" | ")}`);
  console.log(`dimensions: ${JSON.stringify(r.dimensions)}`);
  console.log("\nper-item:");
  for (const it of r.items) {
    console.log(`  ${it.qid} ok=${it.ok ? 1 : 0} verdict=${it.verdict} given="${(it.given || "").slice(0, 30)}" key="${(it.expected || "").slice(0, 30)}"`);
    if (it.note) console.log(`      note: ${it.note.slice(0, 140)}`);
  }
}

runExam();
