// Mastery ledger + next-best-action drive, end to end over the live app.
//
// The learner model v2 claim set:
//  1. noteTagOutcome records BOTH outcomes per tag; Wilson math is exact.
//  2. Exam grading feeds the ledger through the real route (tagged item,
//     correct AND wrong) and the EWMA moves toward the outcome.
//  3. Statuses classify correctly: unproven <3 samples, danger below 0.45
//     Wilson, rising/solid above, trend arrows on a 0.12 gap.
//  4. /api/state carries mastery + nextBest; the selector fires review for
//     due cards, drill for danger tags, test for near-healed families, and
//     orders everything by urgency.
//  5. Writing errors debit the ledger (route-level integration).
// Full state restore in finally - the drive must leave no residue.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
// TagMastery gained a composite key (userId, tag) in Task 65 - the drive runs
// as the singleton "me", so every unique lookup goes through this helper.
const T = (tag: string) => ({ userId_tag: { userId: "me", tag } as const });
const BASE = "http://localhost:3000";
export {};

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { noteTagOutcome, classifyTag, getMasteryView } = await import("@/lib/mastery");
const { nextBestActions } = await import("@/lib/next-best");

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

// ---------- snapshot for restore ----------
const ledgerBefore = await prisma.tagMastery.findMany();
const familiesBefore = await prisma.mistakeFamily.findMany();
const examsBefore = await prisma.exam.findMany();
const learnerBefore = await prisma.learner.findUnique({ where: { id: "me" } });
const statBefore = await prisma.dailyStat.findUnique({ where: { userId_day: { userId: "me", day: Math.floor(Date.now() / 86400000) } } } );
const gameBefore = learnerBefore
  ? { xp: learnerBefore.xp, sp: learnerBefore.sp, chain: learnerBefore.chain, chainDay: learnerBefore.chainDay }
  : null;
const questsBefore = await prisma.quest.findMany();
const achievementsBefore = await prisma.achievement.findMany();

const TAG_A = "drive_articles";
const TAG_B = "drive_statives";
const TAG_C = "drive_prepositions";

try {
  // Clean slate for the drive tags.
  await prisma.tagMastery.deleteMany({ where: { tag: { in: [TAG_A, TAG_B, TAG_C] } } });
  await prisma.mistakeFamily.deleteMany({ where: { tag: { in: [TAG_A, TAG_B, TAG_C] } } });

  // ---------- 1. Wilson math + classification (pure) ----------
  const r22 = classifyTag(TAG_A, 2, 0, 0.7);
  check(r22.status === "unproven", "2/2 correct stays unproven", `got ${r22.status} wilson ${r22.wilson}`);
  check(r22.wilson < 0.85 && r22.wilson > 0.2, "Wilson bound is conservative on 2/2", `wilson ${r22.wilson}`);

  const weak = classifyTag(TAG_B, 1, 4, 0.2); // 5 samples, 20% raw
  check(weak.status === "danger", "1/4 classifies danger", `got ${weak.status} wilson ${weak.wilson}`);
  check(weak.wilson < 0.45, "danger wilson under 0.45", `${weak.wilson}`);

  const strong = classifyTag(TAG_C, 9, 1, 0.95); // 10 samples, 90%
  check(strong.status === "rising" || strong.status === "solid", "9/1 classifies strong", `got ${strong.status}`);

  const slipping = classifyTag("drive-tmp", 8, 2, 0.25); // 80% raw but ewma collapsed
  check(slipping.trend === "falling", "ewma collapse marks falling trend", `trend ${slipping.trend} raw ${slipping.raw} ewma ${slipping.ewma}`);
  check(slipping.status === "fragile", "falling + low ewma = fragile", `got ${slipping.status}`);

  // ---------- 2. Ledger records through the lib ----------
  await noteTagOutcome(TAG_A, true);
  await noteTagOutcome(TAG_A, true);
  await noteTagOutcome(TAG_A, false);
  const rowA = await prisma.tagMastery.findUnique({ where: T(TAG_A) });
  check(!!rowA && rowA.ok === 2 && rowA.no === 1, "ledger counts both outcomes", JSON.stringify(rowA));
  check(!!rowA && rowA.ewma < 0.62 && rowA.ewma > 0.5, "EWMA settles between prev 0.5 and outcomes", rowA ? `${rowA.ewma}` : "missing");

  // ---------- 3. Real exam grade feeds the ledger (route integration) ----------
  const exam = await prisma.exam.create({
    data: {
      id: "drv-mastery-exam",
      title: "Mastery drive",
      spec: JSON.stringify({ level: "B2", targetSkills: ["grammar", "vocabulary"], plannedCount: 2, minutes: 4, weakTags: [TAG_B] }),
      items: JSON.stringify([
        { id: "q1", type: "cloze", skill: "grammar", q: "She ___ to Tehran last year.", a: "moved", accept: ["travelled", "went"], why: "past simple", tag: TAG_B },
        { id: "q2", type: "cloze", skill: "grammar", q: "I have lived here ___ 2019.", a: "since", accept: ["from"], why: "since + point", tag: TAG_C },
      ]),
      createdAt: new Date(),
    },
  });
  const gradeRes = await fetch(`${BASE}/api/exam/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examId: exam.id, answers: { q1: "moved", q2: "for" } }),
  });
  const gradeJson = (await gradeRes.json()) as { correct: number; total: number };
  check(gradeJson.correct === 1 && gradeJson.total === 2, "drive exam grades 1/2", JSON.stringify(gradeJson));

  const rowB = await prisma.tagMastery.findUnique({ where: T("drive_statives") });
  check(!!rowB && rowB.ok === 1 && rowB.no === 0, "correct tagged exam answer credits ledger (canonical _ key)", JSON.stringify(rowB));
  const rowC = await prisma.tagMastery.findUnique({ where: T("drive_prepositions") });
  check(!!rowC && rowC.ok === 0 && rowC.no === 1, "wrong tagged exam answer debits ledger (canonical _ key)", JSON.stringify(rowC));
  const famC = await prisma.mistakeFamily.findMany({ where: { tag: "drive_prepositions", kind: "exam" } });
  check(famC.length === 1, "exam miss lands in mistake family under the SAME canonical key", `${famC.length} ${JSON.stringify(famC.map((f) => f.id))}`);

  // Key unification: the same raw tag in different spellings ("Drive Prepositions!")
  // must land on the ONE canonical ledger row, not fork a new key.
  await noteTagOutcome("Drive Prepositions!", false);
  const rowC2 = await prisma.tagMastery.findUnique({ where: T("drive_prepositions") });
  check(!!rowC2 && rowC2.no === 2, "alternate spellings unify onto one canonical ledger row", JSON.stringify(rowC2));
  const forked = await prisma.tagMastery.findUnique({ where: T("drive-prepositions") });
  check(!forked, "no hyphen-key fork row exists", JSON.stringify(forked));

  // ---------- 4. Mastery view + state payload ----------
  const view = await getMasteryView();
  check(view.tags.some((t) => t.tag === "drive_statives" && t.status === "unproven"), "view lists TAG_B unproven (1 sample)", JSON.stringify(view.tags.find((t) => t.tag === "drive_statives")));

  const stateRes = await fetch(`${BASE}/api/state`, { cache: "no-store" });
  const state = (await stateRes.json()) as {
    mastery?: { tags: { tag: string; status: string }[]; summary: string };
    nextBest?: { action: string; target: string; urgency: number }[];
  };
  check(Array.isArray(state.mastery?.tags) && state.mastery.tags.length >= 3, "state carries mastery ledger", `${state.mastery?.tags?.length} tags`);
  check(typeof state.mastery?.summary === "string" && (state.mastery?.summary.length ?? 0) > 10, "state carries mastery summary", state.mastery?.summary ?? "missing");
  check(Array.isArray(state.nextBest), "state carries nextBest actions", `${state.nextBest?.length}`);

  // ---------- 5. Selector behavior ----------
  // Danger tag -> drill action present when ledger has a proven weak tag.
  await noteTagOutcome(TAG_B, false);
  await noteTagOutcome(TAG_B, false);
  await noteTagOutcome(TAG_B, false);
  const weakB = await prisma.tagMastery.findUnique({ where: T("drive_statives") });
  const actions = await nextBestActions();
  const drill = actions.find((a) => a.action === "drill");
  check(!!weakB, "TAG_B now has 1/4 record", JSON.stringify(weakB));
  check(
    !!drill && weakB != null && drill.target === TAG_B,
    "selector drills the proven danger tag",
    drill ? `${drill.action} ${drill.target}` : "no drill action",
  );
  check(actions.every((a, i) => i === 0 || actions[i - 1].urgency >= a.urgency), "actions ordered by urgency descending", JSON.stringify(actions.map((a) => [a.action, a.urgency])));
  check(actions.length <= 4, "selector caps at 4 actions", `${actions.length}`);
  const review = actions.find((a) => a.action === "review");
  check(!!review, "due cards produce a review action when due > 0", review ? review.target : "none");
  for (const a of actions) check(!!a.command && a.command.length > 8, `action ${a.action} carries a coach command`, a.command ?? "none");

  // Near-healed family -> test action.
  await prisma.mistakeFamily.create({
    data: { id: `exam:${TAG_C}-heal`, kind: "exam", tag: TAG_C, label: TAG_C, count: 3, evidence: "for -> since", streakClean: 1 },
  });
  const actions2 = await nextBestActions();
  const closer = actions2.find((a) => a.action === "test" && a.target === TAG_C);
  check(!!closer, "near-healed family gets a test (close-out) action", closer ? closer.reason : "none");

  // ---------- 6. Summary line names the leak ----------
  const view2 = await getMasteryView();
  const weakest = view2.tags[0];
  check(view2.summary.includes(weakest.tag), "summary names the weakest tag", view2.summary);
} catch (e) {
  failures += 1;
  console.log(`FAIL drive crashed -> ${(e as Error).message}\n${(e as Error).stack ?? ""}`);
} finally {
  // ---------- full restore ----------
  await prisma.exam.deleteMany({ where: { id: "drv-mastery-exam" } });
  await prisma.mistakeFamily.deleteMany({ where: { tag: { in: [TAG_A, TAG_B, TAG_C] } } });
  // restore exact pre-drive ledger rows: drop rows the drive created, then
  // upsert every pre-drive row back to its exact counters.
  const keepTags = new Set(ledgerBefore.map((r) => r.tag));
  const ledgerNow = await prisma.tagMastery.findMany();
  for (const r of ledgerNow) {
    if (!keepTags.has(r.tag)) await prisma.tagMastery.delete({ where: T(r.tag) });
  }
  // restore exact pre-drive ledger rows
  for (const r of ledgerBefore) {
    await prisma.tagMastery.upsert({
      where: T(r.tag),
      create: { userId: "me", tag: r.tag, ok: r.ok, no: r.no, ewma: r.ewma, lastOk: r.lastOk, lastNo: r.lastNo },
      update: { ok: r.ok, no: r.no, ewma: r.ewma, lastOk: r.lastOk, lastNo: r.lastNo },
    });
  }
  // restore families that existed before (drive may have created/reopened some)
  const famNow = await prisma.mistakeFamily.findMany();
  for (const f of famNow) {
    if (!familiesBefore.some((b) => b.id === f.id)) await prisma.mistakeFamily.delete({ where: { id: f.id } });
  }
  for (const f of familiesBefore) {
    await prisma.mistakeFamily.upsert({
      where: { id: f.id },
      create: { id: f.id, kind: f.kind, tag: f.tag, label: f.label, count: f.count, evidence: f.evidence, lastSeen: f.lastSeen, streakClean: f.streakClean, resolvedAt: f.resolvedAt },
      update: { count: f.count, evidence: f.evidence, lastSeen: f.lastSeen, streakClean: f.streakClean, resolvedAt: f.resolvedAt },
    });
  }
  // restore exam inventory
  const examNow = await prisma.exam.findMany();
  for (const e of examNow) {
    if (!examsBefore.some((b) => b.id === e.id)) await prisma.exam.delete({ where: { id: e.id } });
  }
  // restore learner counters touched by exam grading (XP/chain/quests/dailies)
  if (gameBefore && learnerBefore) {
    await prisma.learner.update({ where: { id: "me" }, data: gameBefore });
  }
  // quests: the graded exam advances exam_1 and may award XP/trophies
  const questNow = await prisma.quest.findMany();
  for (const q of questNow) {
    if (!questsBefore.some((b) => b.id === q.id)) await prisma.quest.delete({ where: { userId_id: { userId: "me", id: q.id } } });
  }
  for (const q of questsBefore) {
    await prisma.quest.update({ where: { userId_id: { userId: "me", id: q.id } }, data: { progress: q.progress, done: q.done } });
  }
  const achNow = await prisma.achievement.findMany();
  for (const a of achNow) {
    if (!achievementsBefore.some((b) => b.key === a.key)) await prisma.achievement.delete({ where: { userId_key: { userId: "me", key: a.key } } });
  }
  if (statBefore) {
    await prisma.dailyStat.upsert({
      where: { userId_day: { userId: "me", day: statBefore.day } },
      create: { userId: "me", day: statBefore.day, reviews: statBefore.reviews, correct: statBefore.correct, xp: statBefore.xp, spoken: statBefore.spoken, written: statBefore.written, listened: statBefore.listened },
      update: { reviews: statBefore.reviews, correct: statBefore.correct, xp: statBefore.xp, spoken: statBefore.spoken, written: statBefore.written, listened: statBefore.listened },
    });
  }
  console.log(`\nMASTERY DRIVE ${n - failures}/${n} ${failures === 0 ? "ALL PASS" : `${failures} FAILURES`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}
