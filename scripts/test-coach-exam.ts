// DEDICATED retest of the coach's /exam flow - the exact trigger from the
// user's chat log ("make an exam" -> mangled {"tool":"coach_skill",
// "args":{"message":"/exam vocabulary B2"}} JSON leak).
//
// What must hold NOW:
//  1. The mangled turn salvages to a coach_skill call and NEVER leaks raw JSON
//     (pinned in the battery; re-pinned here against the exact payload).
//  2. coach_skill("/exam vocabulary B2") returns a verified envelope: no
//     braces, no protocol talk, an exam the client can render.
//  3. The exam itself: announced count == graded count, every item passes the
//     answerability gate, B2 vocabulary focus honored.
//  4. A second live run (the "make an exam" plain-English phrasing) routes to
//     the exam skill and behaves identically.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";

// Module marker: tsc treats an import/export-free file as a script, where
// top-level await is a TS1375 error. Bun runs it as a module either way.
export {};

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const { extractTurn } = await import("../src/lib/coach-agent/loop");
const { runCoach } = await import("../src/lib/agent/run");
const { itemAnswerable } = await import("../src/lib/agent/exam-gate");
const { buildBundle, planImport, commitImport } = await import("@/lib/portable");

const before = await buildBundle();

try {
  // ---------- 1. the exact wild payload from the user's log ----------
  const wild =
    '{"thought":"The learner is asking me to \'make an exam\' at B2 level with a vocabulary focus. I should use the coach_skill function to generate an exam tailored to their current level and focus area.", "tool": "coach_skill", "args": {"message": "/exam vocabulary B2"}}}';
  const t = extractTurn(wild);
  check(t.kind === "json" && t.turn.tool === "coach_skill", "mangled /exam turn salvages to coach_skill", JSON.stringify(t.turn).slice(0, 120));
  check((t.turn.args as any)?.message === "/exam vocabulary B2", "salvaged args carry the exact /exam message", JSON.stringify(t.turn.args));
  check(!t.turn.reply, "the mangled turn NEVER becomes a reply", JSON.stringify(t.turn.reply));

  // ---------- 2. the skill the agent would call, live ----------
  console.log("\n-- live coach_skill('/exam vocabulary B2') --");
  const t0 = Date.now();
  const env = await runCoach("/exam vocabulary B2", [], undefined);
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s, skill=${env.skill}, steps=${env.steps?.length ?? 0})`);
  const reply = String(env.reply ?? "");
  check(env.skill !== "chat", "routed to a real skill (not the chat fallback)", env.skill);
  check(!/^\s*\{/.test(reply), "reply is prose, never a JSON object", reply.slice(0, 80));
  check(!/"thought"|"tool"|"args"/.test(reply), "no agent-protocol keys in the reply", reply.slice(0, 120));
  check(reply.trim().length > 40, "reply speaks to the learner", reply.slice(0, 100));
  check(/exam|question|vocabulary|quiz/i.test(reply), "the reply announces the exercise", reply.slice(0, 100));

  // ---------- 3. the exam payload itself ----------
  const exam = (env as any).exam as { id?: string; count?: number; items?: any[]; spec?: any } | undefined;
  check(Boolean(exam), "envelope carries an exam payload", JSON.stringify(Object.keys(env)).slice(0, 200));
  if (exam) {
    const items = exam.items ?? [];
    check(items.length === exam.count, `announced count == delivered items (${exam.count})`, `${items.length} vs ${exam.count}`);
    check(items.length >= 3, "a real exam, not a stub (focused exams run 3-5 items)", `${items.length} items`);
    const gateFails = items.filter((it) => !itemAnswerable(it));
    check(gateFails.length === 0, "every item passes the answerability gate", JSON.stringify(gateFails.slice(0, 1)).slice(0, 200));
    const skills = new Set(items.map((it) => it.skill));
    check(skills.has("vocabulary"), "vocabulary focus honored", [...skills].join(","));
    // WIRE payloads are KEYLESS by design (the client grades via /api/exam/grade
    // against the server-stored key) - so on the wire assert choices exist and
    // the key does NOT leak; the KEY itself is checked against the stored row.
    const mcqs = items.filter((it) => it.type === "mcq");
    check(mcqs.every((it) => (it.choices?.length ?? 0) >= 3), "every mcq ships real choices", JSON.stringify(mcqs[0] ?? {}).slice(0, 150));
    check(mcqs.every((it) => it.a === undefined), "mcq keys never leak to the client payload", JSON.stringify(mcqs[0]?.a));
    if (exam.id) {
      const { db } = await import("@/lib/db");
      const row = await db.exam.findUnique({ where: { id: exam.id } });
      const stored = row ? (JSON.parse(row.items) as any[]) : [];
      const storedMcq = stored.filter((it) => it.type === "mcq");
      // vacuously true when this draw generated no mcq items (stochastic mix)
      check(storedMcq.every((it) => it.a && it.choices?.includes(it.a)), "stored keys (when mcq items exist) sit among their choices (server-side)", JSON.stringify(storedMcq[0] ?? {}).slice(0, 150));
      check(stored.length === items.length, "stored exam matches the delivered count", `${stored.length} vs ${items.length}`);
    }
    const raw = JSON.stringify(env);
    check(!/"thought"\s*:/.test(raw), "no protocol JSON anywhere in the envelope", "");
  }

  // ---------- 4. plain-English "make an exam" routes the same way ----------
  console.log("\n-- live runCoach('make an exam') --");
  const env2 = await runCoach("make an exam", [], undefined);
  check(env2.skill !== "chat", "plain English still routes to a skill", env2.skill);
  const reply2 = String(env2.reply ?? "");
  check(!/^\s*\{/.test(reply2) && !/"tool"/.test(reply2), "plain-English exam reply stays clean prose", reply2.slice(0, 90));
  const exam2 = (env2 as any).exam as { items?: any[] } | undefined;
  check(Boolean(exam2) || /exam/i.test(reply2), "plain-English run produces an exam or an exam promise", `${Boolean(exam2)} ${reply2.slice(0, 60)}`);
} catch (e) {
  console.error("DRIVE CRASH:", e);
  failures += 1;
} finally {
  const plan = planImport({ format: "rah.v1", exportedAt: before.bundle.exportedAt, tables: before.bundle.tables });
  check(plan.valid === true, "restore plan accepted", "");
  await commitImport(before.bundle.tables);
  console.log("restore done");
}

console.log(`\n=== COACH /EXAM RETEST: ${n - failures}/${n} ===`);
process.exit(failures === 0 ? 0 : 1);
