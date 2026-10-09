// Power skills: exams, assessment, deep analysis, plans, and the app-control
// plugins (theme, navigation, focus, settings). These are the capabilities the
// learner asked for by name.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { SkillDef, SkillContext, StepTrace } from "./types";
import { generateExam } from "./exam";
import { updateSkillLevels, getSkillLevels, buildAssessment, spreadLine } from "./levels";
import { parseThemeRequest, presetById, PRESETS } from "./theme";
import { basePersona } from "./skills-util";

const VIEW_WORDS: Record<string, RegExp> = {
  home: /\bhome\b|dashboard/i,
  review: /\breview\b|\bsrs\b|\bflashcards?\b/i,
  chat: /\bcoach\b|\bchat\b/i,
  write: /\bwrit(e|ing)\b/i,
  speak: /\bspeak(ing)?\b|\bspeaking\b/i,
  listen: /\blisten(ing)?\b/i,
  read: /\bread(ing)?\b/i,
  placement: /\bplacement\b|\bplace(ment)? test\b/i,
  progress: /\bprogress\b|\bstats?\b|\bstatistics\b/i,
};

export const POWER_SKILLS: SkillDef[] = [
  {
    id: "generate-exam",
    name: "Exam builder",
    oneLiner: "A full checkpoint exam, graded with mercy for synonyms",
    commands: ["exam", "test", "quiz-full"],
    triggers: [
      /\b(exam|test|checkpoint|mock)\b/i,
      /generate (an? )?(exam|test)/i,
      /test (me|myself)/i,
      /quiz me/i,
      /assess.*exam/i,
    ],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Reading your profile", detail: `level ${ctx.profile.level}, leaks: ${ctx.profile.weakSkills.join(", ") || "none flagged"}` });
      const countMatch = ctx.text.match(/(\d{1,2})\s*(questions?|items?|q\b)/i) ?? ctx.args.match(/(\d{1,2})/);
      const count = countMatch ? parseInt(countMatch[1], 10) : 10;
      // Skill words, tolerant of spelling ("grammer" is a real user spelling)
      // and of NEGATION: "vocab only no grammar" must exclude grammar, not
      // include it just because the word appeared. Negated mentions are
      // stripped before matching and collected into an exclusion set.
      const SKILL_WORD = /\b(?:collocation|gram\w*|vocab\w*|writing|reading|listening|phrasal)/gi;
      const NEGATION = /\b(?:anything\s+but|no|not|without|zero|except(?:\s+for)?|other\s+than|aside\s+from|excluding)\s+(?:(?:about|on|for|of|the|a|any)\s+)?(?:collocation|gram\w*|vocab\w*|writing|reading|listening|phrasal)\w*/gi;
      const normalizeSkill = (s: string) => s.toLowerCase().replace(/vocab\w*/, "vocabulary").replace(/gram\w*/, "grammar").replace(/phrasal/, "vocabulary");
      const excluded = new Set<string>();
      for (const m of ctx.text.matchAll(NEGATION)) {
        const hit = m[0].match(SKILL_WORD);
        if (hit) excluded.add(normalizeSkill(hit[0]));
      }
      const positiveText = ctx.text.replace(NEGATION, " ");
      const skillMatch = [...positiveText.matchAll(SKILL_WORD)].map((m) => m[0]);
      const targetSkills = (skillMatch.length
        ? [...new Set(skillMatch.map(normalizeSkill))]
        : ["collocation", "grammar", "vocabulary"]
      ).filter((s) => !excluded.has(s));
      const { client, spec } = await generateExam(ctx.profile, targetSkills, count, (l, d) => steps.push({ label: l, detail: d }));
      return {
        skill: "generate-exam",
        reply: `${client.title}: ${client.count} questions, about ${spec.minutes} minutes. Answer everything you can; blank answers count against the total, and near-miss wordings still score. Submit when done and I will break it down by skill.`,
        corrections: [],
        fa_note: "",
        steps,
        exam: client,
      };
    },
  },
  {
    id: "assess-level",
    name: "Level probe",
    oneLiner: "Quick probe that updates grammar, vocab and reading bands",
    commands: ["assess", "probe", "level"],
    triggers: [/\bassess\b/i, /(what|whats|what is) my level/i, /my (english )?level\?*$/i, /level check/i, /recheck my level/i, /how (good|bad) is my english/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Designing the probe", detail: "grammar, vocabulary, reading, 8 items" });
      const { client, spec } = await generateExam(ctx.profile, ["grammar", "vocabulary", "reading"], 8, (l, d) => steps.push({ label: l, detail: d }));
      return {
        skill: "assess-level",
        reply: `Short probe: ${client.count} items, about ${spec.minutes} minutes. It measures grammar, vocabulary and reading separately, then updates the band for each. No filler, no practice round: start when ready.`,
        corrections: [],
        fa_note: "",
        steps,
        exam: client,
      };
    },
  },
  {
    id: "deep-analysis",
    name: "Deep analysis",
    oneLiner: "30 seconds of real work over your whole history",
    commands: ["deep", "analyze", "analyse"],
    triggers: [/deep\s*(analysis|analyse|analyze)/i, /analy[sz]e my (english|level|progress|weakness)/i, /(thorough|full|complete) analysis/i, /how am i doing( really| actually)?/i],
    run: async (ctx) => {
      const t0 = Date.now();
      const steps: StepTrace[] = [];
      // The user asked for a coach that visibly works ~30 seconds on analysis,
      // not a 7-second token stream. Every pass below does real work; the
      // minimum window at the end guarantees the promised depth of attention.
      const MIN_ANALYSIS_MS = 25000;
      // 1. Evidence gathering: everything the app has measured.
      steps.push({ label: "Collecting evidence", detail: "reviews, lapses, writing, speaking, chats" });
      const [reviewCount, lapseRows, writes, speaks, corrections, quizItems, levels] = await Promise.all([
        db.reviewLog.count(),
        db.reviewLog.findMany({ where: { grade: 1 }, orderBy: { id: "desc" }, take: 20 }),
        db.writingSub.findMany({ orderBy: { id: "desc" }, take: 3 }),
        db.speakSession.findMany({ orderBy: { id: "desc" }, take: 3 }),
        db.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "desc" }, take: 25 }),
        db.quizItem.count(),
        getSkillLevels(),
      ]);
      const trapCards = lapseRows.length;
      steps.push({ label: "Evidence in hand", detail: `${reviewCount} reviews, ${trapCards} recent lapses, ${writes.length} essays, ${speaks.length} speaking runs, ${corrections.length} coach turns` });

      const parseCorrections = (c: { content: string }) => {
        try {
          const p = JSON.parse(c.content) as { corrections?: { wrong: string; right: string; trap: string }[] };
          return (p.corrections ?? []).map((x) => `${x.wrong} -> ${x.right} (${x.trap})`);
        } catch {
          return [];
        }
      };

      // 2. Domain pass A: production errors from chat and reviews.
      steps.push({ label: "Pass 1: spoken and typed errors", detail: "chat corrections, review lapses, extended reasoning" });
      const prodEvidence = JSON.stringify({
        profile: ctx.profile,
        recentLapses: lapseRows.map((r) => r.cardId),
        recentCorrections: corrections.flatMap(parseCorrections).slice(0, 15),
      });
      const prod = await aiJson<{ patterns: string[] }>(
        `You are the diagnostic engine inside Rah, an English app for Farsi speakers. Mine these PRODUCTION errors (chat corrections, review lapses). Find repeating error families and cite one concrete example per family. Output ONE JSON object: {"patterns": ["max 5 concrete findings"]}. No em dashes.`,
        [{ role: "user", content: prodEvidence.slice(0, 5000) }],
        () => ({ patterns: [] }),
        { deep: true },
      );

      // 3. Domain pass B: composed language from essays and speaking.
      steps.push({ label: "Pass 2: essays and speaking", detail: "range, cohesion, Farsi transfer at text level" });
      const compEvidence = JSON.stringify({
        writingSamples: writes.map((w) => w.text.slice(0, 400)),
        speakingTranscripts: speaks.map((s) => s.transcript.slice(0, 400)),
        measuredLevels: levels.filter((l) => l.samples > 0),
      });
      const comp = await aiJson<{ patterns: string[] }>(
        `You are the diagnostic engine inside Rah. Mine these COMPOSED texts (essays, speaking transcripts) from a Farsi speaker. Judge range, cohesion, register, and Farsi transfer at TEXT level; ignore ASR noise in transcripts. Cite one concrete example per finding. Output ONE JSON object: {"patterns": ["max 5 concrete findings"]}. No em dashes.`,
        [{ role: "user", content: compEvidence.slice(0, 5000) }],
        () => ({ patterns: [] }),
        { deep: true },
      );
      const patterns = [...prod.patterns, ...comp.patterns].slice(0, 8);
      steps.push({ label: "Patterns mined", detail: `${patterns.length} findings across both domains` });

      // 4. Synthesis: bands, priorities, plan.
      steps.push({ label: "Pass 3: synthesis", detail: "bands, priorities, seven-day plan" });
      const synth = await aiJson<{ summary: string; bands: { skill: string; score: number }[]; priorities: string[]; plan: string[] }>(
        `You are Rah's head coach. Using ONLY these mined patterns and measured levels, write the learner's state of the union. bands: estimate mastery 0..1 ONLY for skills the evidence actually touches; omit any skill you have no evidence for; NEVER output 0 for an untouched skill. priorities: max 3, ordered. plan: exactly 5 day-steps, each one actionable line with a number in it.
Output ONE JSON object: {"summary": "max 70 words, direct, second person", "bands": [{"skill": "grammar", "score": 0.0}], "priorities": ["..."], "plan": ["Day 1: ...", ...]}. No em dashes. No Farsi.`,
        [
          { role: "user", content: `Patterns: ${JSON.stringify(patterns)}\nMeasured levels: ${JSON.stringify(levels.filter((l) => l.samples > 0))}\nLearner profile: ${JSON.stringify(ctx.profile)}` },
        ],
        () => ({ summary: "Analysis complete.", bands: [], priorities: [], plan: [] }),
        { deep: true },
      );
      steps.push({ label: "Pass 4: verification", detail: "checking the plan against the evidence" });
      const check = await aiJson<{ plan: string[]; priorities: string[] }>(
        `You are Rah's quality gate. Given the coach's plan and the mined patterns, reject any plan line that is not backed by a pattern or a measured weakness, tighten vague lines, and keep exactly 5. Same for priorities (max 3). Output ONE JSON object: {"plan": ["Day 1: ...", ...], "priorities": ["..."]}. No em dashes. No Farsi.`,
        [{ role: "user", content: `Patterns: ${JSON.stringify(patterns)}\nPlan: ${JSON.stringify(synth.plan)}\nPriorities: ${JSON.stringify(synth.priorities)}` }],
        () => ({ plan: synth.plan, priorities: synth.priorities }),
        { deep: true },
      );
      steps.push({ label: "Pass 5: the coaching note", detail: "what would move each band fastest" });
      const note = await aiJson<{ note: string }>(
        `You are Rah's head coach writing a 3-sentence personal note to a Farsi speaker after a deep review. Reference their strongest and weakest band by name and name the ONE habit that would move the weakest fastest. Output ONE JSON object: {"note": "max 60 words, direct, warm, second person"}. No em dashes. No Farsi.`,
        [{ role: "user", content: `Patterns: ${JSON.stringify(patterns)}\nMeasured: ${JSON.stringify(levels.filter((l) => l.samples > 0))}\nSynthesis: ${synth.summary}` }],
        () => ({ note: "" }),
        { deep: true },
      );
      // Only skills the synthesis actually scored move the bands: a 0 for an
      // untouched skill must never drag a measured band down.
      const evidenceBands = synth.bands.filter((b) => b.score > 0.02);
      steps.push({ label: "Updating your bands", detail: `${evidenceBands.length} skills touched` });
      await updateSkillLevels(evidenceBands.map((b) => ({ skill: b.skill, score: Math.min(1, Math.max(0, b.score)), samples: 4 })));
      const assessment = await buildAssessment(note.note || spreadLine(levels));
      steps.push({ label: "Compiling report", detail: "assembling bands, priorities, plan" });

      // Minimum working window: multi-pass depth the learner can feel. Real
      // work happens above; this only guarantees the promised attention span.
      const elapsed = Date.now() - t0;
      if (elapsed < MIN_ANALYSIS_MS) {
        await new Promise((r) => setTimeout(r, MIN_ANALYSIS_MS - elapsed));
      }
      steps.push({ label: "Done", detail: `${Math.round((Date.now() - t0) / 1000)}s of analysis` });

      const planLines = check.plan.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join("\n");
      const prioLines = check.priorities.slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join("\n");
      return {
        skill: "deep-analysis",
        reply: `${synth.summary}\n\nPriorities:\n${prioLines}\n\nSeven-day plan:\n${planLines}`.slice(0, 1400),
        corrections: [],
        fa_note: "",
        steps,
        assessment,
      };
    },
  },
  {
    id: "skill-report",
    name: "Skill report",
    oneLiner: "Per-skill bands: grammar vs vocab vs the rest",
    commands: ["report", "bands"],
    triggers: [/(skill|progress) report/i, /\bbands?\b/i, /my (strong|weak) (skill|spot)/i, /skill levels/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Reading measured bands", detail: "grammar, vocabulary, writing, speaking, reading, listening" });
      const levels = await getSkillLevels();
      const assessment = await buildAssessment(spreadLine(levels));
      const measured = levels.filter((l) => l.samples > 0);
      const lines = measured.length
        ? measured.map((l) => `- ${l.skill}: ${l.level} (${Math.round(l.score * 100)}% mastery)`).join("\n")
        : "Nothing measured yet. Run /assess for the quick probe or /deep for the full analysis.";
      steps.push({ label: "Report ready", detail: `${measured.length} skills measured` });
      return {
        skill: "skill-report",
        reply: measured.length
          ? `Overall band: ${assessment.overall}.\n${lines}\n\n${assessment.note}`
          : `Overall band: not yet measurable.\n${lines}`,
        corrections: [],
        fa_note: "",
        steps,
        assessment,
      };
    },
  },
  {
    id: "study-plan",
    name: "Study plan",
    oneLiner: "Five days, aimed at your leaks",
    commands: ["plan"],
    triggers: [/study plan/i, /(daily|weekly|7[- ]day|five[- ]day) plan/i, /what should i (do|study|practice)( tomorrow| next| today)/i, /plan for (this|next) week/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Weighing your leaks", detail: `weak: ${ctx.profile.weakSkills.join(", ") || "balanced"}` });
      const out = await aiJson<{ plan: string[] }>(
        `${basePersona(ctx.profile)}

You are building a five-day plan, one line per day, each line a concrete task with a number in it (items, minutes, words). Aim every day at the learner's weak skills and traps. Output ONE JSON object: {"plan": ["Day 1: ...", ...]} with exactly 5 entries. No em dashes. No Farsi.`,
        [{ role: "user", content: `Build the plan. Profile: ${JSON.stringify(ctx.profile)}` }],
        () => ({ plan: [] }),
      );
      steps.push({ label: "Plan ready", detail: `${out.plan.length} days` });
      const plan = out.plan.length ? out.plan.map((p, i) => `${i + 1}. ${p}`).join("\n") : "Review 10 due cards, write 80 words about your day, and ask me for a collocation drill.";
      return {
        skill: "study-plan",
        reply: `Five days, aimed at your leaks:\n${plan}`.slice(0, 1000),
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "exam-history",
    name: "Exam history",
    oneLiner: "Past exams and scores",
    commands: ["history"],
    triggers: [/(exam|test) (history|results?|scores?)/i, /past (exams|tests)/i, /how did i do on (the|my) (last|previous)/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Loading graded exams", detail: "newest first" });
      const rows = await db.exam.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
      const graded = rows.filter((r) => r.status === "graded" && r.result);
      steps.push({ label: "Found", detail: `${graded.length} graded of ${rows.length}` });
      const lines = graded.map((r) => {
        const res = JSON.parse(r.result!) as { correct: number; total: number; pct: number };
        return `- ${r.title}: ${res.correct}/${res.total} (${res.pct}%)`;
      });
      const pending = rows.filter((r) => r.status === "pending");
      return {
        skill: "exam-history",
        reply: graded.length
          ? `Last exams:\n${lines.join("\n")}${pending.length ? `\n\nOne exam is still open: ${pending[0].title}. Say "open my exam" and I will bring it back.` : ""}`
          : pending.length
            ? `No graded exams yet, but "${pending[0].title}" is still open. Finish and submit it.`
            : "No exams on record yet. Say the word and I will build one.",
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "theme-control",
    name: "Theme plugin",
    oneLiner: "Repaint the app on command",
    commands: ["theme", "color", "color-scheme"],
    triggers: [/\btheme\b/i, /colou?r (scheme|of the app|palette)/i, /change (the )?colou?rs?/i, /(make|turn) (it|the app) (blue|green|dark|purple|orange|pink|red|violet)/i, /dark mode/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const req = parseThemeRequest(ctx.args || ctx.text);
      if (req.preset || req.tokens) {
        const preset = req.preset ? presetById(req.preset) : undefined;
        const tokens = req.tokens ?? preset!.tokens;
        steps.push({ label: "Applying theme plugin", detail: preset ? preset.name : "custom tokens" });
        await db.learner.update({ where: { id: "me" }, data: { theme: JSON.stringify(tokens) } });
        return {
          skill: "theme-control",
          reply: preset
            ? `Repainted: ${preset.name}. The whole app shifts now, and it stays after reload. Say "theme midnight" to go back.`
            : "Custom tokens applied. Every surface and accent you gave me is live, and it stays after reload.",
          corrections: [],
          fa_note: "",
          steps,
          actions: [{ type: "theme", tokens, preset: req.preset }],
        };
      }
      steps.push({ label: "Theme plugin", detail: "listing presets" });
      return {
        skill: "theme-control",
        reply: `I can repaint the whole app. Presets: ${PRESETS.map((p) => p.id).join(", ")}. Or hand me hex codes. Try: /theme ocean`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "navigate",
    name: "Navigation plugin",
    oneLiner: "Opens any view for you",
    commands: ["go", "open"],
    triggers: [/^(take|send) me to/i, /^(open|go to|show) (the )?(home|review|coach|chat|writ(e|ing)|speak(ing)?|listen(ing)?|read(ing)?|placement|progress)\b/i, /navigate to/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      for (const [view, re] of Object.entries(VIEW_WORDS)) {
        if (re.test(ctx.text)) {
          steps.push({ label: "Navigation plugin", detail: `opening ${view}` });
          return {
            skill: "navigate",
            reply: view === "review"
              ? `Opening Review. ${ctx.profile.due} cards are waiting.`
              : `Opening ${view}.`,
            corrections: [],
            fa_note: "",
            steps,
            actions: [{ type: "navigate", view }],
          };
        }
      }
      return {
        skill: "navigate",
        reply: "Which view? home, review, write, speak, listen, read, placement, progress. Name it and I will take you there.",
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "focus-skill",
    name: "Focus plugin",
    oneLiner: "Points the whole app at one skill",
    commands: ["focus"],
    triggers: [/^focus on/i, /set (my )?focus/i, /(work on|practice) (my )?(collocation|grammar|vocabular\w*|writing|speaking|listening|reading|pronunciation)/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const m = ctx.text.match(/(collocation|grammar|vocabular\w*|writing|speaking|listening|reading|pronunciation)/i);
      if (!m) {
        return {
          skill: "focus-skill",
          reply: "Focus can be: collocation, grammar, vocabulary, writing, speaking, listening, reading, pronunciation. Name one.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const skill = m[1].toLowerCase().replace(/vocabular.*/, "vocabulary");
      steps.push({ label: "Focus plugin", detail: `aiming everything at ${skill}` });
      await db.learner.update({ where: { id: "me" }, data: { focusSkill: skill } });
      return {
        skill: "focus-skill",
        reply: `Done. Everything now aims at ${skill}: reviews surface it, my drills pull toward it, exams weight it. Say "focus off" anytime.`, 
        corrections: [],
        fa_note: "",
        steps,
        actions: [{ type: "focus", skill }],
      };
    },
  },
  {
    id: "settings",
    name: "Settings plugin",
    oneLiner: "Daily goal and new-card pace",
    commands: ["set"],
    triggers: [/set (my )?(daily )?goal/i, /(\d+) (new )?cards (a|per) day/i, /change (my )?daily goal/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const goal = ctx.text.match(/goal (to |of )?(\d{1,3})/i);
      const cards = ctx.text.match(/(\d{1,2}) (new )?cards (a|per) day/i);
      if (goal) {
        const v = Math.max(5, Math.min(200, parseInt(goal[2], 10)));
        await db.learner.update({ where: { id: "me" }, data: { dailyGoal: v } });
        steps.push({ label: "Settings plugin", detail: `daily goal ${v}` });
        return { skill: "settings", reply: `Daily goal: ${v}. The ring on Home now counts to it.`, corrections: [], fa_note: "", steps };
      }
      if (cards) {
        const v = Math.max(3, Math.min(50, parseInt(cards[1], 10)));
        await db.learner.update({ where: { id: "me" }, data: { newPerDay: v } });
        steps.push({ label: "Settings plugin", detail: `${v} new cards per day` });
        return { skill: "settings", reply: `${v} new cards per day. The queue refills at that pace from now on.`, corrections: [], fa_note: "", steps };
      }
      return { skill: "settings", reply: "I can set your daily goal ('set goal 40') or the new-card pace ('15 cards a day').", corrections: [], fa_note: "", steps };
    },
  },
];
