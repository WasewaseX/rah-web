// Exam engine v2. Generation bakes answer keys server side; grading is fuzzy
// and generous to meaning. The announced count always equals the graded count:
// the client grades every item in the stored exam, unanswered items count as
// incorrect in the total but never inflate or deflate per-skill numbers.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import { gradeAnswer } from "./fuzzy";
import type { ExamItem, ExamSpec, ExamClient, ExamResult, ExamVerdict, StepTrace } from "./types";
import { EXAM_TRACKS, bandReference, trackTitle, isTrackId, type TrackId } from "./exam-tracks";
import { updateSkillLevels } from "./levels";
import { noteExamAnswer } from "@/lib/mistakes";
import { noteTagOutcome, masteryWeakTags } from "@/lib/mastery";
import { contentUserId } from "@/lib/scope";
import { arbitrateMisses, vetItems } from "./exam-ai";
import { distractorQuality, repairChoices, itemAnswerable, evidenceItem } from "./exam-gate";
import { resolveExamCardTargets, scheduleExamOutcomes } from "@/lib/exam-cards";

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
  const trackBlock = spec.track ? `\n\n${EXAM_TRACKS[spec.track].brief}` : "";
  return `You are the examiner inside Rah, an English app for Farsi speakers. Build ONE exam targeted at ${spec.level} level, focused on: ${spec.targetSkills.join(", ")}.

The learner sits around ${p.level}. Recent weak spots: ${p.weakSkills.join(", ") || "general B2 range"}. Push at the edge of ${spec.level} toward C1: collocations, register, precise verbs, Farsi interference traps (articles, countability, prepositions, present perfect, question order).
${spec.weakTags.length ? `WEAKNESS QUOTA: this learner has these recurring mistake families on file: ${p.mistakes.map((m) => `${m.tag} x${m.count}`).join(", ")}. At least ${quota} items MUST carry a "tag" field naming the family they hunt (one of: ${spec.weakTags.join(", ")}), and the item must genuinely force that exact weakness into play with a FRESH sentence - the ban lists still apply. Never invent a tag outside the list; items not built for a family simply omit the tag field.` : ""}

Exactly ${spec.plannedCount} items.${trackBlock}

Mix, in this rough share: 40% mcq, 30% cloze, 15% short, 15% rewrite.${spec.track ? " (The track block above may override these shares - follow the track when it does.)" : ""} Every item tests ONE teachable point. Wrong choices for mcq must be plausible for a Farsi speaker.

ITEM TYPE CONTRACTS (an answerability gate rejects any item that breaks them; a rejected item is wasted):
- TRIVIA BAN: never ask for terms, definitions, or world knowledge ("what term describes...", "what do you call...", "which document/instrument..."). Every item must test ENGLISH itself: a grammatical form, a collocation, register, a connector, or meaning in context. To teach a word, put it in a sentence blank.
- mcq: exactly ONE choice is defensibly correct. The others must be wrong for a reason you could state (wrong form, wrong meaning, unidiomatic pairing). Never make the key the only positive/hedged/longest option. The key MUST be copied exactly from the choices array.
- cloze: q contains exactly one ___ and the blank is FORCED: grammar or a fixed collocation decides the word, so a competent learner can produce the key (or an accept variant) with confidence. Never an open style/word-choice blank with several equally good answers - if you cannot name why the alternatives fail, the item is unfair.
- short: the answer must be FORCED too: either a blank decided by grammar/collocation, or an explicit form task (comparative, plural, passive form, reported form, negative). Never a "what is X called" question and never an open definition.
- rewrite: q MUST begin with the full instruction, stated in the question text itself: what to do, and to which sentence (quoted). "Rewrite using more formal vocabulary: 'The new law really stops people from polluting rivers.'" is correct. A bare statement with no instruction is a wasted item - the learner cannot know the task.

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
{"title": "short exam title in English", "items": [{"type": "mcq", "skill": "collocation", "q": "sentence with ___ or an instruction plus a quoted sentence", "choices": ["", "", "", ""], "a": "exact correct choice", "accept": [], "why": ""}]}
For cloze: q contains ___ and a is the missing string. For short: a forced form answer. For rewrite: instruction inside q, mustInclude patterns, model a.
Never use the em dash character anywhere.`;
}

export async function generateExam(
  p: ProfileJson,
  targetSkills: string[],
  count: number,
  emit: (l: string, d?: string) => void,
  opts?: { track?: TrackId },
): Promise<{ client: ExamClient; items: ExamItem[]; spec: ExamSpec }> {
  // Weakness quota input: mistake families carry production evidence, but the
  // mastery ledger can prove a weakness the families have not seen yet (three
  // exam misses on a tag with no family, or a slipping tag). Families first,
  // then proven danger/fragile tags - the quota cap stays 3.
  const ledgerTags = await masteryWeakTags();
  const familyTags = p.mistakes.map((m) => m.tag);
  const weakTags = [...new Set([...familyTags, ...ledgerTags])].slice(0, 3);
  const track = opts?.track && isTrackId(opts.track) ? opts.track : undefined;
  const plannedCount = Math.max(4, Math.min(20, count));
  const spec: ExamSpec = {
    level: p.level === "?" ? "B2" : p.level,
    targetSkills: targetSkills.length ? targetSkills : ["collocation", "grammar", "vocabulary"],
    plannedCount,
    minutes: Math.max(5, Math.round(plannedCount * (track ? EXAM_TRACKS[track].minutesPerItem : 1.1))),
    title: "",
    weakTags,
    ...(track ? { track } : {}),
  };

  emit(track ? `Building the ${EXAM_TRACKS[track].label} set` : "Calibrating difficulty", `level ${spec.level}, edge of ${spec.level} toward C1`);
  const fresh = await loadFreshness();
  emit("Rotating topics", fresh.domains.join(", "));
  const genOpts = { deep: true, temperature: 0.9 };
  // Degraded-result honesty (P1-7): every generation round that fell back to
  // the fallback envelope is counted and surfaced. The exam still ships - the
  // count promise and the answerability gate are deterministic and stay
  // enforced - but the spec carries degraded:true so nothing pretends the
  // build was fully AI-quality.
  let degradedRounds = 0;
  const onDegraded = (round: string) => (reason: string) => {
    degradedRounds += 1;
    emit("Degraded round", `${round}: ${reason.slice(0, 90)}`);
  };
  const raw = await aiJson<RawExam>(examSystem(p, spec, fresh), [{ role: "user", content: `Generate the ${spec.plannedCount}-item exam now. Cover: ${spec.targetSkills.join(", ")}. Respect every BAN list and freshness rule.` }], () => ({}), { ...genOpts, degraded: onDegraded("main batch") });
  emit("Validating answer keys", "every item needs a key and a why");

  const seen = new Set<string>();
  const items: ExamItem[] = [];
  const dropped: string[] = [];

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
      // ANSWERABILITY GATE (layer 1, deterministic): bare statements, trivia,
      // cloze without a forced blank, rewrite without an instruction, MCQ keys
      // not among the choices, leaked keys - all dead before the learner sees
      // them. This is the structural fix for the "random statement" bug class.
      const gate = itemAnswerable({ type, q, a, choices: type === "mcq" ? r.choices : undefined });
      if (!gate.ok) {
        dropped.push(`[${gate.reason}] ${q.slice(0, 70)}`);
        continue;
      }
      // DISTRACTOR QUALITY GATE (Task 81, polish #5): duplicates, empties and
      // key-identical choices get one deterministic repair (trim/dedupe), then
      // the quality verdict - still weak means dead, like any gate failure.
      let choicesOut = type === "mcq" ? r.choices!.map(String) : undefined;
      if (type === "mcq" && choicesOut) {
        const repaired = repairChoices(choicesOut);
        if (repaired.length !== choicesOut.length) choicesOut = repaired;
        const dq = distractorQuality(choicesOut, a);
        if (!dq.ok) {
          dropped.push(`[${dq.reason}] ${q.slice(0, 70)}`);
          continue;
        }
      }
      // Weakness tags are validated against the exam's family list so the
      // model can never invent a tag and poison the healing loop.
      const weakTag = spec.weakTags.includes(String(r.tag ?? "").trim().toLowerCase()) ? String(r.tag).trim().toLowerCase() : undefined;
      batchCount += 1;
      items.push({
        id: `i${batchStart + batchCount}`,
        type,
        skill,
        q,
        choices: choicesOut,
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

  // If focus filtering or the gate left the exam short, top up with up to two
  // more generation rounds locked to the requested skills, instead of shipping
  // off-focus or unanswerable items or shrinking the announced count.
  for (let round = 0; round < 2 && items.length < spec.plannedCount; round++) {
    emit("Topping up", "keeping every item inside your requested focus");
    const avoid = [...items.map((i) => i.q.slice(0, 60)), ...fresh.bannedQ.slice(0, 10)];
    const need = spec.plannedCount - items.length;
    const raw2 = await aiJson<RawExam>(
      examSystem(p, spec, fresh),
      [{ role: "user", content: `Generate exactly ${need} more items now. The "skill" field of every item MUST be one of: ${spec.targetSkills.join(", ")}. Do not repeat or paraphrase any of these questions: ${JSON.stringify(avoid)}. Output the same JSON object shape with only the new items.` }],
      () => ({}),
      { ...genOpts, degraded: onDegraded("top-up round 2") },
    );
    harvest(raw2.items, items.length);
  }

  // ANSWERABILITY GATE (layer 2, AI): the arbiter judges what regex cannot -
  // ambiguous keys, unfair MCQs, items whose key does not fit - and audits
  // weakness tags for integrity (a tag on an item that does not force that
  // trap poisons the healing loop, so the tag is stripped, not the item).
  const vetInPlace = (pool: ExamItem[], label: string) =>
    vetItems(pool.map((it) => ({ id: it.id, type: it.type, skill: it.skill, q: it.q, choices: it.choices, a: it.a, accept: it.accept ?? [], tag: it.tag }))).then((vet) => {
      for (const it of [...pool]) {
        const v = vet.get(it.id);
        if (v && !v.ok) {
          dropped.push(`[${label}: ${v.reason}] ${it.q.slice(0, 70)}`);
          items.splice(items.indexOf(it), 1);
        } else if (v && !v.keepTag) {
          it.tag = undefined;
        }
      }
    });

  if (items.length > 0) {
    emit("Answerability gate", "every item must be fairly answerable");
    await vetInPlace(items, "ai");
  }

  // If the gate dropped items, keep topping up (each round gated AND vetted)
  // until the count promise is met or the retry budget is spent. The count
  // the coach announces is the count the learner can actually sit.
  let gateRounds = 0;
  while (items.length < spec.plannedCount && gateRounds < 3) {
    gateRounds++;
    emit("Topping up", `replacing what the gate rejected (round ${gateRounds})`);
    const avoid = [...items.map((i) => i.q.slice(0, 60)), ...fresh.bannedQ.slice(0, 10)];
    const need = spec.plannedCount - items.length;
    const raw3 = await aiJson<RawExam>(
      examSystem(p, spec, fresh),
      [{ role: "user", content: `Generate exactly ${need} more items now. The "skill" field of every item MUST be one of: ${spec.targetSkills.join(", ")}. Do not repeat or paraphrase any of these questions: ${JSON.stringify(avoid)}. Output the same JSON object shape with only the new items.` }],
      () => ({}),
      { ...genOpts, degraded: onDegraded("gate top-up round") },
    );
    const before = items.length;
    harvest(raw3.items, items.length);
    const freshItems = items.slice(before);
    if (freshItems.length > 0) await vetInPlace(freshItems, `ai-r${gateRounds}`);
  }

  // QUOTA ENFORCEMENT (deterministic): the weakness quota is a PROMISE, not a
  // hope. Two failure modes above are invisible to the learner but fatal to
  // the healing loop: the model ignores the quota, or the AI vet strips every
  // tag. Tag honesty is therefore evaluated ONCE at the END - first we force
  // a tag-locked generation round for any hunted tag with zero surviving
  // items, and if the model STILL ships none, we build the hunting item
  // directly from the family's own evidence: the recorded wrong -> right
  // pair IS a forced cloze, and re-serving the exact miss is precisely what
  // the healing loop wants. spec.weakTags keeps the full hunted list until
  // then so harvest's tag validation still accepts quota items.
  const hunted = spec.weakTags.slice();
  const missing = hunted.filter((t) => !items.some((it) => it.tag === t));
  if (missing.length > 0) {
    emit("Forcing the weakness quota", `no surviving item hunts: ${missing.join(", ")}`);
    const avoid2 = [...items.map((i) => i.q.slice(0, 60)), ...fresh.bannedQ.slice(0, 10)];
    const raw4 = await aiJson<RawExam>(
      examSystem(p, spec, fresh),
      [{
        role: "user",
        content: `CRITICAL OVERRIDE: this round has ONE job. Generate ${missing.length * 2} items and EVERY single one MUST have its "tag" field set to exactly one of: ${missing.join(", ")}. An item without a "tag" field from that list is a wasted generation and will be discarded. The item must genuinely force that exact weakness into play with a FRESH sentence. Do not repeat or paraphrase: ${JSON.stringify(avoid2)}. Output the same JSON object shape with only the new items.`,
      }],
      () => ({}),
      { ...genOpts, degraded: onDegraded("weakness-quota round") },
    );
    harvest(raw4.items, items.length);
    const freshItems = items.filter((it) => it.tag && missing.includes(it.tag));
    if (freshItems.length > 0) await vetInPlace(freshItems, "quota");
  }

  // Last-resort enforcement: build evidence items from the families
  // themselves. Deterministic, free, and always honest - the tag is in the
  // item's DNA because the item IS the family's recorded miss.
  const stillMissing = hunted.filter((t) => !items.some((it) => it.tag === t));
  if (stillMissing.length > 0) {
    const u = await contentUserId().catch(() => "me");
    const families = await db.mistakeFamily.findMany({ where: { userId: u, tag: { in: stillMissing }, resolvedAt: null } });
    for (const tag of stillMissing) {
      const fam = families.find((f) => f.tag === tag);
      const item = evidenceItem(tag, fam?.evidence ?? "");
      if (item) {
        items.push(item);
        emit("Evidence item", `built from your own recorded miss on ${tag}`);
      }
    }
  }

  // Tag honesty, evaluated once after enforcement: the exam card announces
  // "hunting: ..." from spec.weakTags. A family whose items all failed the
  // audit (and had no usable evidence) must not be announced.
  spec.weakTags = hunted.filter((t) => items.some((it) => it.tag === t));

  if (dropped.length > 0) {
    emit("Gate report", `${dropped.length} item(s) rejected before delivery`);
  }

  // Guarantee the announced count: top up from the pool by trimming or
  // padding with near-level review items. The count the coach announces IS
  // the count graded, always. Quota items sort first so the slice can never
  // amputate the family hunting it promised.
  const ordered = [...items.filter((it) => it.tag), ...items.filter((it) => !it.tag)];
  const finalItems = ordered.slice(0, spec.plannedCount).map((it, idx) => ({ ...it, id: `i${idx + 1}` }));
  spec.plannedCount = finalItems.length;
  spec.minutes = Math.max(4, Math.round(finalItems.length * 1.1));

  if (degradedRounds > 0) {
    spec.degraded = true;
    emit("Degraded build", `${degradedRounds} generation round(s) fell back - the count and answerability gates still held`);
  }

  const id = newId();
  const title = spec.track ? trackTitle(String(raw.title ?? "").trim().slice(0, 60) || `${spec.level} checkpoint`, spec.track) : String(raw.title ?? "").trim().slice(0, 60) || `${spec.level} checkpoint`;
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

  // Hybrid grading, stage 2: every mechanical miss goes to the AI arbiter,
  // which accepts meaning-equal answers the regex was blind to ("combine" for
  // "blend") and writes a coaching note (rule + Farsi takeaway) for real
  // misses. Then stats are computed from the FINAL verdicts, so the learner
  // is never punished for the regex's blindness.
  const misses = items
    .filter((it) => {
      const v = verdicts.find((x) => x.itemId === it.id);
      return v && !v.correct && v.given.length > 0;
    })
    .map((it) => {
      const v = verdicts.find((x) => x.itemId === it.id)!;
      return { id: it.id, type: it.type, skill: it.skill, q: it.q, a: it.a, given: v.given, why: it.why };
    });
  let degradedReason: string | undefined;
  const arb = await arbitrateMisses(misses, (reason) => {
    degradedReason = reason;
  });
  for (const [id, v] of arb) {
    const verdict = verdicts.find((x) => x.itemId === id);
    if (!verdict) continue;
    if (v.accept) {
      verdict.correct = true;
      verdict.acceptedAI = true;
    } else {
      verdict.coach = { rule: v.rule, fa: v.fa };
    }
  }

  // Healing loop: every weakness-targeted item reports its outcome back to the
  // mistake memory - item tag first, arbiter's trap tag as the fallback so an
  // untagged miss still lands in a family. Correct answers (including
  // arbiter-accepted ones) extend the clean streak toward retirement; misses
  // count as relapse evidence and reopen the family. The same outcome feeds
  // the mastery ledger - BOTH sides of it, so "45% on articles, rising"
  // becomes computable instead of guessed.
  await Promise.allSettled(
    items.map((it) => {
      const v = verdicts.find((x) => x.itemId === it.id)!;
      const tag = it.tag ?? arb.get(it.id)?.tag;
      if (!tag) return Promise.resolve();
      return Promise.all([noteExamAnswer(tag, v.given, it.a, v.correct), noteTagOutcome(tag, v.correct)]);
    }),
  );

  const total = items.length;
  const answered = verdicts.filter((v) => v.given.length > 0).length;
  const correct = verdicts.filter((v) => v.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // P1 exam->FSRS unification: final verdicts land on the FSRS schedule.
  // Deck-matched items reschedule their real card (bomb pulls it due today,
  // pass extends it); tagged items without a deck match land in the
  // exam:<tag> healing namespace and resurface in the review queue as
  // evidence-derived cloze cards. Nothing resolves -> nothing schedules;
  // the learner is never charged an outcome the exam did not actually earn.
  let scheduled: Awaited<ReturnType<typeof scheduleExamOutcomes>> = [];
  try {
    const targets = resolveExamCardTargets(items, verdicts);
    scheduled = await scheduleExamOutcomes(targets);
  } catch {
    // Scheduling must never break grading - the exam result stands on its own.
    scheduled = [];
  }

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

  // Degraded grading honesty (P1-7): if the arbiter was unreachable, the
  // result is regex-only - meaning-equal answers may sit among the misses.
  // That travels with the result so nothing presents it as a full assessment.
  const result: ExamResult = {
    total,
    answered,
    correct,
    pct,
    bySkill,
    verdicts,
    headline,
    scheduled,
    ...(spec.track ? { trackLabel: EXAM_TRACKS[spec.track].label, band: bandReference(pct, spec.track) } : {}),
    ...(degradedReason ? { degraded: true, degradedNotice: `Graded mechanically: the answer arbiter was unreachable (${degradedReason.slice(0, 90)}). Meaning-equal answers may be marked wrong.` } : {}),
  };

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
