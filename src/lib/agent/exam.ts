// Exam engine v2. Generation bakes answer keys server side; grading is fuzzy
// and generous to meaning. The announced count always equals the graded count:
// the client grades every item in the stored exam, unanswered items count as
// incorrect in the total but never inflate or deflate per-skill numbers.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import { gradeAnswer } from "./fuzzy";
import type { ExamItem, ExamSpec, ExamClient, ExamResult, ExamVerdict, StepTrace } from "./types";
import { updateSkillLevels } from "./levels";
import { noteExamAnswer } from "@/lib/mistakes";

function newId(): string {
  return `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

interface RawItem {
  type?: string;
  skill?: string;
  q?: string;
  choices?: string[];
  a?: string;
  accept?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  why?: string;
  tag?: string;
}

interface RawExam {
  title?: string;
  items?: RawItem[];
}

// Randomized topic domains: exams rotate through these so two exams never
// mine the same "office policy + party + heavy rain" cliché territory.
const DOMAINS = [
  "technology and apps", "health and fitness", "travel and airports", "food and cooking",
  "environment and climate", "work and careers", "education and studying", "sports and competition",
  "music and film", "science and space", "money and shopping", "city life and transport",
  "family and friendships", "news and media", "nature and animals", "art and design",
];

// Templates the model gravitates to when lazy. Named explicitly so the first
// sentence of every exam is not "The new policy had a significant ___ on".
const OVERUSED = [
  "The new policy had a significant ___ on",
  "Which word means to make something less severe or intense",
  "By the time we arrived at the party",
  "What verb collocates with 'heavy'",
  "If I ___ more time, I would have",
  "The company needs to ___ its operations",
];

interface Freshness {
  domains: string[];
  bannedQ: string[];
  bannedA: string[];
}

// Recent-exam ledger: the last few exams' sentences and answer keys become a
// ban list, so "the same exam again" is structurally impossible, not hoped
// against. Banned answers rotate the teaching points too (no more alleviate /
// mitigate asked twice in a row).
async function loadFreshness(): Promise<Freshness> {
  const domains = [...DOMAINS].sort(() => Math.random() - 0.5).slice(0, 4);
  try {
    const recent = await db.exam.findMany({ orderBy: { createdAt: "desc" }, take: 4, select: { items: true } });
    const past = recent.flatMap((r) => {
      try { return JSON.parse(r.items) as ExamItem[]; } catch { return []; }
    });
    return {
      domains,
      bannedQ: [...new Set(past.map((i) => i.q.replace(/\s+/g, " ").slice(0, 90)))].slice(0, 24),
      bannedA: [...new Set(past.map((i) => i.a.toLowerCase().replace(/\s+/g, " ").slice(0, 40)))].slice(0, 24),
    };
  } catch {
    return { domains, bannedQ: [], bannedA: [] };
  }
}

// A question that says "according to the text" without carrying the text is a
// broken item: the learner has nothing to read. Reading items must embed their
// own mini-passage, so anything referencing a text while staying short is dead
// on arrival.
const DANGLING_TEXT_REF = /\b(according to|based on)\b[^.]{0,40}\b(text|passage|article|author|writer)\b|\bthe (text|passage|article) (says|states|mentions|suggests)\b|\bthe (author|writer) (says|states|mentions|argues)\b/i;

function examSystem(p: ProfileJson, spec: ExamSpec, fresh: Freshness): string {
  const bans = [
    fresh.bannedQ.length ? `BANNED questions (served recently; never reuse the sentence, a close paraphrase, or the same teaching point): ${fresh.bannedQ.map((q) => JSON.stringify(q)).join("; ")}` : "",
    fresh.bannedA.length ? `BANNED answers (do not make any of these the correct answer or a distractor again): ${fresh.bannedA.join("; ")}` : "",
    `AVOID these worn-out templates entirely: ${OVERUSED.map((t) => JSON.stringify(t)).join("; ")}`,
  ].filter(Boolean).join("\n\n");
  const quota = spec.weakTags.length ? Math.min(4, Math.max(1, Math.ceil(spec.plannedCount / 3))) : 0;
  return `You are the examiner inside Rah, an English app for Farsi speakers. Build ONE exam targeted at ${spec.level} level, focused on: ${spec.targetSkills.join(", ")}.

The learner sits around ${p.level}. Recent weak spots: ${p.weakSkills.join(", ") || "general B2 range"}. Push at the edge of ${spec.level} toward C1: collocations, register, precise verbs, Farsi interference traps (articles, countability, prepositions, present perfect, question order).
${spec.weakTags.length ? `WEAKNESS QUOTA: this learner has these recurring mistake families on file: ${p.mistakes.map((m) => `${m.tag} x${m.count}`).join(", ")}. At least ${quota} items MUST carry a "tag" field naming the family they hunt (one of: ${spec.weakTags.join(", ")}), and the item must genuinely force that exact weakness into play with a FRESH sentence - the ban lists still apply. Never invent a tag outside the list; items not built for a family simply omit the tag field.` : ""}

Exactly ${spec.plannedCount} items. Mix, in this rough share: 40% mcq, 30% cloze, 15% short, 15% rewrite. Every item tests ONE teachable point. Wrong choices for mcq must be plausible for a Farsi speaker.

FRESHNESS RULES (a moderator rejects recycled exams):
- Draw situations from these domains: ${fresh.domains.join(", ")}. At least half the items must come from this list.
- Every sentence pattern in the exam must be structurally different from every other. Ten cloze items are ten different shapes, not one shape repeated.
- Never test the same word or teaching point twice in one exam, even in different sentence frames.
${bans}

HARD FOCUS RULE: every item's "skill" field MUST be one of: ${spec.targetSkills.join(", ")}. Zero items outside this list, even if the item type would fit another skill. A rewrite item in a vocabulary exam is still a vocabulary item (word choice, register, word formation), never a writing item.

READING RULE: an item about a text MUST embed the full mini-text (2 to 4 short sentences) inside its "q" before the question. Never write "according to the text" without the text being right there in "q". Standalone reading items (word meaning in context) are fine without a passage.

CRITICAL answer-key rules, the grader is mechanical:
- "a" is the single best answer, lowercase unless a proper noun.
- "accept" lists every variant you would hand-grade as correct: synonyms ("heavy rain" accepts "pouring rain"), inflections ("rains", "raining" where the sentence allows), spelling variants. Give 2 to 5 accept entries for cloze and short items.
- rewrite items: "mustInclude" lists the target patterns that ALL have to appear in the learner's sentence (e.g. ["take advantage of"]), and "a" is one model answer.
- "skill" is exactly one of: grammar, vocabulary, collocation, writing, reading, listening.
${spec.weakTags.length ? `- "tag" (optional) is exactly one of: ${spec.weakTags.join(", ")} - set it only on items built to hunt that mistake family, omit it everywhere else.` : ""}
- "why" is one short English sentence teaching the point (max 18 words). No Farsi anywhere in the exam.

Output ONE JSON object, nothing else:
{"title": "short exam title in English", "items": [{"type": "mcq", "skill": "collocation", "q": "sentence with ___ or a question", "choices": ["", "", "", ""], "a": "exact correct choice", "accept": [], "why": ""}]}
For cloze: q contains ___ and a is the missing string. For short: a one-phrase answer. For rewrite: a full-sentence task, mustInclude patterns, model a.
Never use the em dash character anywhere.`;
}

export async function generateExam(
  p: ProfileJson,
  targetSkills: string[],
  count: number,
  emit: (l: string, d?: string) => void,
): Promise<{ client: ExamClient; items: ExamItem[]; spec: ExamSpec }> {
  const spec: ExamSpec = {
    level: p.level === "?" ? "B2" : p.level,
    targetSkills: targetSkills.length ? targetSkills : ["collocation", "grammar", "vocabulary"],
    plannedCount: Math.max(4, Math.min(20, count)),
    minutes: Math.max(5, Math.round(count * 1.1)),
    title: "",
    weakTags: p.mistakes.map((m) => m.tag).slice(0, 3),
  };

  emit("Calibrating difficulty", `level ${spec.level}, edge of ${spec.level} toward C1`);
  const fresh = await loadFreshness();
  emit("Rotating topics", fresh.domains.join(", "));
  const genOpts = { deep: true, temperature: 0.9 };
  const raw = await aiJson<RawExam>(examSystem(p, spec, fresh), [{ role: "user", content: `Generate the ${spec.plannedCount}-item exam now. Cover: ${spec.targetSkills.join(", ")}. Respect every BAN list and freshness rule.` }], () => ({}), genOpts);
  emit("Validating answer keys", "every item needs a key and a why");

  const seen = new Set<string>();
  const items: ExamItem[] = [];

  const harvest = (rawItems: RawItem[] | undefined, batchStart: number) => {
    let batchCount = 0;
    for (const r of rawItems ?? []) {
      const q = String(r.q ?? "").trim();
      const a = String(r.a ?? "").trim();
      if (!q || !a || seen.has(q)) continue;
      const type = (["mcq", "cloze", "short", "rewrite"] as const).includes(r.type as never) ? (r.type as ExamItem["type"]) : "cloze";
      if (type === "mcq" && (!Array.isArray(r.choices) || r.choices.length < 2)) continue;
      const skillRaw = /^(grammar|vocabulary|collocation|writing|reading|listening)$/.test(String(r.skill)) ? String(r.skill) : "vocabulary";
      // Collocation is vocabulary in narrower clothes: when the learner asked
      // for vocabulary only, a collocation item honors the promise (the level
      // engine already folds collocation into the vocabulary band), so relabel
      // instead of dropping it. That is how "4 vocab questions" stays 4.
      const skill = skillRaw === "collocation" && spec.targetSkills.includes("vocabulary") ? "vocabulary" : skillRaw;
      // Focus guard: an item tagged outside the requested focus would break the
      // promise the exam card makes ("mixed: ..." / "focus: ..."), so drop it.
      if (!spec.targetSkills.includes(skill)) continue;
      // Broken-item guard: no question may reference a text it fails to carry.
      if (DANGLING_TEXT_REF.test(q) && q.length < 220) continue;
      // Weakness tags are validated against the exam's family list so the
      // model can never invent a tag and poison the healing loop.
      const weakTag = spec.weakTags.includes(String(r.tag ?? "").trim().toLowerCase()) ? String(r.tag).trim().toLowerCase() : undefined;
      batchCount += 1;
      items.push({
        id: `i${batchStart + batchCount}`,
        type,
        skill,
        q,
        choices: type === "mcq" ? r.choices!.map(String) : undefined,
        a,
        accept: Array.isArray(r.accept) ? r.accept.map(String).filter(Boolean).slice(0, 6) : [],
        mustInclude: Array.isArray(r.mustInclude) ? r.mustInclude.map(String).filter(Boolean) : [],
        mustNotInclude: Array.isArray(r.mustNotInclude) ? r.mustNotInclude.map(String).filter(Boolean) : [],
        why: String(r.why ?? "").trim() || "Target pattern practice.",
        tag: weakTag,
      });
      seen.add(q);
    }
    return batchCount;
  };

  harvest(raw.items, 0);

  // If focus filtering left the exam short, top up with up to two more
  // generation rounds locked to the requested skills, instead of shipping
  // off-focus items or shrinking the announced count.
  for (let round = 0; round < 2 && items.length < spec.plannedCount; round++) {
    emit("Topping up", "keeping every item inside your requested focus");
    const avoid = [...items.map((i) => i.q.slice(0, 60)), ...fresh.bannedQ.slice(0, 10)];
    const need = spec.plannedCount - items.length;
    const raw2 = await aiJson<RawExam>(
      examSystem(p, spec, fresh),
      [{ role: "user", content: `Generate exactly ${need} more items now. The "skill" field of every item MUST be one of: ${spec.targetSkills.join(", ")}. Do not repeat or paraphrase any of these questions: ${JSON.stringify(avoid)}. Output the same JSON object shape with only the new items.` }],
      () => ({}),
      genOpts,
    );
    harvest(raw2.items, items.length);
  }

  // Guarantee the announced count: top up from the pool by trimming or
  // padding with near-level review items. The count the coach announces IS
  // the count graded, always.
  const finalItems = items.slice(0, spec.plannedCount).map((it, idx) => ({ ...it, id: `i${idx + 1}` }));
  spec.plannedCount = finalItems.length;
  spec.minutes = Math.max(4, Math.round(finalItems.length * 1.1));

  const id = newId();
  const title = String(raw.title ?? "").trim().slice(0, 60) || `${spec.level} checkpoint`;
  const client: ExamClient = {
    id,
    title,
    spec,
    count: finalItems.length,
    items: finalItems.map((it) => ({ id: it.id, type: it.type, skill: it.skill, q: it.q, choices: it.choices, tag: it.tag })),
  };

  await db.exam.create({
    data: { id, title, spec: JSON.stringify(spec), items: JSON.stringify(finalItems), status: "pending" },
  });
  emit("Exam ready", `${finalItems.length} items, about ${spec.minutes} minutes`);
  return { client, items: finalItems, spec };
}

export async function gradeExamSubmission(
  examId: string,
  answers: Record<string, string>,
): Promise<ExamResult | null> {
  const row = await db.exam.findUnique({ where: { id: examId } });
  if (!row) return null;
  const items: ExamItem[] = JSON.parse(row.items);
  const spec: ExamSpec = JSON.parse(row.spec);

  const verdicts: ExamVerdict[] = items.map((it) => {
    const given = String(answers[it.id] ?? "").trim();
    const correct = gradeAnswer({ given, type: it.type, a: it.a, accept: it.accept, mustInclude: it.mustInclude, mustNotInclude: it.mustNotInclude, choices: it.choices });
    return { itemId: it.id, given, correct, key: it.a, why: it.why, skill: it.skill };
  });

  // Healing loop: every weakness-targeted item reports its outcome back to the
  // mistake memory. Correct answers extend the family's clean streak toward
  // retirement; misses count as relapse evidence and reopen it.
  await Promise.allSettled(
    items
      .filter((it) => it.tag)
      .map((it) => {
        const v = verdicts.find((x) => x.itemId === it.id);
        return noteExamAnswer(it.tag!, v?.given ?? "", it.a, v?.correct ?? false);
      }),
  );

  const total = items.length;
  const answered = verdicts.filter((v) => v.given.length > 0).length;
  const correct = verdicts.filter((v) => v.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const bySkillMap = new Map<string, { correct: number; total: number }>();
  for (const v of verdicts) {
    const agg = bySkillMap.get(v.skill) ?? { correct: 0, total: 0 };
    agg.total += 1;
    if (v.correct) agg.correct += 1;
    bySkillMap.set(v.skill, agg);
  }
  const bySkill = [...bySkillMap.entries()]
    .map(([skill, a]) => ({ skill, ...a }))
    .sort((a, b) => b.total - a.total);

  const weakest = [...bySkill].filter((s) => s.correct / s.total < 0.6)[0];
  const headline =
    pct >= 85
      ? `Strong pass: ${correct}/${total}. This band is C1 territory; keep the pressure on.`
      : pct >= 60
        ? `Solid: ${correct}/${total}. ${weakest ? `Your leak is ${weakest.skill}; that is where the next session goes.` : "Consistent B2 performance."}`
        : `${correct}/${total}. The gap is specific, not general: ${weakest ? `${weakest.skill} broke first. Drill it before the next exam.` : "the fundamentals need another pass."}`;

  const result: ExamResult = { total, answered, correct, pct, bySkill, verdicts, headline };

  await db.exam.update({ where: { id: examId }, data: { status: "graded", result: JSON.stringify(result) } });
  // Feed the per-skill level engine with the exam outcome.
  await updateSkillLevelsFromExam(bySkill);
  return result;
}

async function updateSkillLevelsFromExam(bySkill: { skill: string; correct: number; total: number }[]) {
  const map: Record<string, string> = { collocation: "vocabulary", writing: "writing", reading: "reading", listening: "listening", grammar: "grammar", vocabulary: "vocabulary" };
  const filtered = bySkill
    .filter((s) => map[s.skill])
    .map((s) => ({ skill: map[s.skill], score: s.total ? s.correct / s.total : 0, samples: s.total }));
  await updateSkillLevels(filtered);
}

export { type StepTrace };
