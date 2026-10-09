// Healing-loop evaluation, end to end over the live app:
// seed a family -> profile steers exams -> weakness-quota items carry the tag
// -> clean exam answers heal the family -> prompts stop steering -> relapse
// reopens it. This is the loop that makes drills stop feeling random.
process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
const BASE = "http://localhost:3000";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { recordMistakes } = await import("@/lib/mistakes");

let failures = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function examViaChat(message: string) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [] }),
  });
  return (await res.json()) as { exam?: { id: string; count: number; spec: { weakTags?: string[] }; items: { id: string; tag?: string }[] } };
}

async function latestExam(id: string) {
  const row = await prisma.exam.findUnique({ where: { id } });
  return { items: JSON.parse(row!.items) as { id: string; a: string; tag?: string }[], spec: JSON.parse(row!.spec) as { weakTags?: string[] } };
}

async function grade(id: string, answers: Record<string, string>) {
  const res = await fetch(`${BASE}/api/exam/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examId: id, answers }),
  });
  return (await res.json()) as { correct: number; total: number };
}

async function profileMistakes() {
  const res = await fetch(`${BASE}/api/state`);
  const j = (await res.json()) as { profile?: { mistakes?: { tag: string; count: number }[]; mistakesHealed?: number } };
  return j.profile ?? { mistakes: [] };
}

// --- Seed: two corrected article mistakes in chat (two calls: one family each hit) ---
await prisma.mistakeFamily.deleteMany({ where: { tag: "articles" } });
await recordMistakes([{ kind: "chat", tag: "articles", wrong: "I saw a elephant", right: "I saw an elephant" }]);
await recordMistakes([{ kind: "chat", tag: "articles", wrong: "She is the teacher", right: "She is a teacher" }]);
await sleep(300);
let fam = await prisma.mistakeFamily.findUnique({ where: { id: "chat:articles" } });
check(fam?.count === 2, "seed: chat:articles family at count 2", String(fam?.count));

// --- Profile steering: the active family reaches prompts and exams ---
let prof = await profileMistakes();
check(prof.mistakes?.some((m) => m.tag === "articles") === true, "profile steers: articles in profile", JSON.stringify(prof.mistakes));

const e1 = await examViaChat("generate a 6 question mixed exam");
check(!!e1.exam, "exam 1 generated", JSON.stringify(e1).slice(0, 120));
const d1 = await latestExam(e1.exam!.id);
check(d1.spec.weakTags?.includes("articles") === true, "exam spec hunts articles", JSON.stringify(d1.spec.weakTags));
const tagged1 = d1.items.filter((i) => i.tag === "articles");
check(tagged1.length >= 1, "weakness quota: at least 1 item tagged articles", `${tagged1.length} of ${d1.items.length}`);

// --- Clean hit #1 ---
const answers1: Record<string, string> = {};
for (const it of d1.items) answers1[it.id] = it.tag === "articles" ? it.a : "";
const r1 = await grade(e1.exam!.id, answers1);
check(r1.total === d1.items.length, "grading returns full count", `${r1.correct}/${r1.total}`);
await sleep(400);
fam = await prisma.mistakeFamily.findUnique({ where: { id: "chat:articles" } });
check((fam?.streakClean ?? 0) >= 1 && !fam?.resolvedAt, "clean hit 1: streak advanced, not resolved", `streak=${fam?.streakClean} resolved=${!!fam?.resolvedAt}`);

// --- Clean hit #2 retires the family ---
const e2 = await examViaChat("generate a 6 question mixed exam");
check(!!e2.exam, "exam 2 generated");
const d2 = await latestExam(e2.exam!.id);
const answers2: Record<string, string> = {};
for (const it of d2.items) answers2[it.id] = it.tag === "articles" ? it.a : "";
await grade(e2.exam!.id, answers2);
await sleep(400);
fam = await prisma.mistakeFamily.findUnique({ where: { id: "chat:articles" } });
check(!!fam?.resolvedAt, "clean hit 2: family RESOLVED (retired)", `resolved=${fam?.resolvedAt}`);

prof = await profileMistakes();
check(prof.mistakes?.some((m) => m.tag === "articles") !== true, "healed family stops steering the profile", JSON.stringify(prof.mistakes));
check((prof.mistakesHealed ?? 0) >= 1, "healed count surfaced", String(prof.mistakesHealed));
const mres = await fetch(`${BASE}/api/mistakes`);
const mdata = (await mres.json()) as { families: { id: string; resolvedAt: string | null }[] };
check(mdata.families.find((f) => f.id === "chat:articles")?.resolvedAt !== null, "/api/mistakes shows the healed family");

// --- Relapse reopens it ---
await recordMistakes([{ kind: "chat", tag: "articles", wrong: "He is a artist", right: "He is an artist" }]);
await sleep(300);
fam = await prisma.mistakeFamily.findUnique({ where: { id: "chat:articles" } });
check(!fam?.resolvedAt && (fam?.count ?? 0) >= 3, "relapse: family reopened with count 3", `count=${fam?.count} resolved=${!!fam?.resolvedAt}`);
prof = await profileMistakes();
check(prof.mistakes?.some((m) => m.tag === "articles") === true, "reopened family steers prompts again");

console.log(failures === 0 ? "\nHEALING LOOP: ALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

export {}
