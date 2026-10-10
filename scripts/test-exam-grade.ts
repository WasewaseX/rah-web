// Submit answers to the built exam, including the exact fuzzy cases the
// learner complained about, and print the grading verdicts.
import { readFileSync } from "node:fs";

const raw = readFileSync("/tmp/exam-stream.txt", "utf8");
const lines = raw.split("\n").filter((l) => l.startsWith("data: "));
let exam: { id: string; questions: { id: string; type: string; skill: string; prompt: string; accept: string[] }[] } | null = null;
for (const l of lines) {
  try {
    const ev = JSON.parse(l.slice(6));
    if (ev.type === "final" && ev.envelope?.kind === "exam") exam = ev.envelope.exam;
  } catch {}
}
if (!exam) {
  console.error("no exam in stream");
  process.exit(1);
}
console.log("exam:", exam.id, exam.questions.length, "questions");
exam.questions.forEach((q, i) => console.log(`  ${i + 1}. [${q.type}/${q.skill}] ${q.prompt.slice(0, 70)}  accept=[${q.accept.join("|")}]`));

// Deliberate answers: exact, synonym-variant, article-drop, and wrong.
const answers = {};
for (const q of exam.questions) {
  if (q.type === "mcq") answers[q.id] = q.accept[0]; // answer mcq correctly
  else if (q.accept[0].toLowerCase().includes("make a decision")) answers[q.id] = "make a decision";
  else if (q.accept[0].toLowerCase().includes("interested in")) answers[q.id] = "interested about"; // wrong preposition
  else answers[q.id] = q.accept[0]; // everything else exact
}

const r = await fetch("http://localhost:3000/api/coach/exam", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ exam, answers }),
});
const j = await r.json();
if (!r.ok) {
  console.error("grade failed:", JSON.stringify(j).slice(0, 500));
  process.exit(1);
}
const res = j.result;
console.log(`\nRESULT: ${res.score}/${res.total} (${res.percent}%), close=${res.closeCount}`);
console.log("perSkill:", res.perSkill.map((s) => `${s.skill} ${s.correct}/${s.total}`).join(", "));
console.log("verdict:", res.verdict);
console.log("next:", res.next);
console.log("signal:", res.signal);
for (const q of res.questions) {
  console.log(`  ${q.verdict.toUpperCase().padEnd(8)} given="${(q.given || "").slice(0, 60)}" key="${q.key}"${q.note ? ` :: ${q.note}` : ""}`);
}
