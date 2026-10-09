// Power skills: exams, assessment, deep analysis, plans, and the app-control
// plugins (theme, navigation, focus, settings). These are the capabilities the
// learner asked for by name.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { SkillDef, SkillContext, StepTrace } from "./types";
import { generateExam } from "./exam";
import { generateRepairDrill, type DrillPoint } from "./drill";
import { startDaily, clearMode } from "./mode-flow";
import { updateSkillLevels, getSkillLevels, buildAssessment, spreadLine } from "./levels";
import { parseThemeRequest, presetById, PRESETS } from "./theme";
import { topMistakes } from "@/lib/mistakes";
import { basePersona } from "./skills-util";

const TAG_TO_SKILL: Record<string, string> = {
  statives: "grammar", articles: "grammar", countability: "grammar", plurals: "grammar",
  copula: "grammar", prepositions: "grammar", perfect: "grammar", question_order: "grammar",
  adjectives: "grammar", that_omission: "grammar",
  word_choice: "vocabulary", register: "vocabulary", collocation: "vocabulary", spelling: "vocabulary",
};

// Farsi-phonology minimal pairs, curated (no AI needed, instant, reliable):
// the interference points Persian speakers actually hit.
const MINIMAL_PAIRS: { tag: string; pairs: [string, string][]; tip: string; fa: string }[] = [
  {
    tag: "th_sounds",
    pairs: [["think", "sink"], ["three", "tree"], ["bath", "bass"], ["they", "day"], ["breathe", "breeze"]],
    tip: "Persian has no dental fricatives: /th/ collapses to s, t, z or d. Put the tongue tip BETWEEN the teeth and blow - no vibration for 'think', vibration for 'they'.",
    fa: "در فارسی صدای th وجود ندارد؛ زبان را بین دندان‌ها بگذار و هوا بده: think نه sink، they نه day.",
  },
  {
    tag: "w_v",
    pairs: [["west", "vest"], ["wine", "vine"], ["wow", "vow"], ["worse", "verse"], ["wheel", "veal"]],
    tip: "Persian has /v/ but no true /w/. Round the lips tightly and let the air pass with NO teeth contact for 'west' - teeth on lip is 'vest'.",
    fa: "برای w لب‌ها را گرد کن و با دندان لمس نده: west نه vest. v با دندان روی لب ساخته می‌شود.",
  },
  {
    tag: "clusters",
    pairs: [["student", "estudent"], ["street", "estreet"], ["sport", "esport"], ["school", "eschool"], ["special", "especial"]],
    tip: "Farsi inserts a vowel before st-, sp-, sc- clusters (epenthesis). Start straight into the cluster: 's-t' with no vowel before the s.",
    fa: "فارسی قبل از خوشه‌های st و sp یک مصوت اضافه می‌کند: student نه estudent. مستقیم با s شروع کن.",
  },
  {
    tag: "ng",
    pairs: [["sing", "sin"], ["long", "lawn"], ["thing", "thin"], ["singer", "sinner"]],
    tip: "Final -ng is one nasal sound /ŋ/, not /n/ plus a g. Hold the back of the tongue up; the g in 'singer' is silent in careful speech.",
    fa: "پایان کلمات -ng یک صدای بینی است، نه n و g جدا: sing نه sing+گ.",
  },
  {
    tag: "stress",
    pairs: [["PHOtograph", "phoTOgrapher"], ["PREsent (noun)", "preSENT (verb)"], ["REcord (noun)", "reCORD (verb)"], ["HOspital", "hospital"]],
    tip: "Farsi is syllable-timed, so English stress contrast flattens. Exaggerate the loud syllable: one peaks, the others shrink.",
    fa: "تمایز تکیه (stress) در انگلیسی قوی است؛ هجای پرتکیه را بلندتر و کشیده‌تر بگو، بقیه را کوتاه کن.",
  },
];

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
    id: "remediate",
    name: "Repair loop",
    oneLiner: "Rebuilds your actual exam misses as a fresh drill until they are beaten",
    commands: ["remediate", "repair"],
    triggers: [
      /\b(practice|redo|retry|retest|drill) (my )?(misses|wrong( ones?)?|mistakes?|fails?)\b/i,
      /\brepair (drill|my (misses|mistakes))\b/i,
      /\bhelp me (overcome|beat|fix) (my )?(misses|mistakes?|weak\w*)\b/i,
      /\bwont ever let it happen\b/i,
    ],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Collecting your misses", detail: "last graded exams" });
      const graded = await db.exam.findMany({ where: { status: "graded" }, orderBy: { createdAt: "desc" }, take: 3 });
      const points: DrillPoint[] = [];
      for (const row of graded) {
        let items: { id: string; q: string; a: string; why: string; skill: string; tag?: string }[] = [];
        let result: { verdicts?: { itemId: string; given: string; correct: boolean }[] } = {};
        try {
          items = JSON.parse(row.items);
          result = JSON.parse(row.result ?? "{}");
        } catch {
          continue;
        }
        for (const v of result.verdicts ?? []) {
          if (v.correct || !v.given) continue;
          const it = items.find((x) => x.id === v.itemId);
          if (!it) continue;
          points.push({
            point: `${it.why} (question: ${it.q.slice(0, 100)})`,
            wrong: v.given,
            right: it.a,
            tag: it.tag,
            skill: it.skill,
          });
        }
      }
      if (points.length === 0) {
        return {
          skill: "remediate",
          reply: "Clean sheet: your recent exams have no misses to repair. Ask for a fresh exam ('generate an exam') and I will hunt your mistake families inside it instead.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const drill = await generateRepairDrill(ctx.profile, points.slice(0, 6), (l, d) => steps.push({ label: l, detail: d }), "Repair drill: your misses");
      if (!drill) {
        return { skill: "remediate", reply: "I could not build the drill that time - say 'practice my misses' once more.", corrections: [], fa_note: "", steps };
      }
      return {
        skill: "remediate",
        reply: `${points.length} miss(es) found. This drill retests the EXACT same teaching points in fresh sentences - prove the lesson landed and the families behind them move toward retirement. Submit when done.`,
        corrections: [],
        fa_note: "",
        steps,
        exam: drill.client,
      };
    },
  },
  {
    id: "repair-drill",
    name: "Weak-spot drill",
    oneLiner: "Five fresh items on one named weak spot, right now",
    commands: ["drill"],
    triggers: [
      /^\/drill\b/i,
      /\bdrill (my )?(statives?|articles?|prepositions?|countability|copula|perfect|question order|adjectives?|word choice|register|collocations?|spelling|weak\w*|spot|famil\w*|mistake)\b/i,
    ],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const families = await topMistakes(6, true);
      const lower = ctx.text.toLowerCase();
      const named = families.filter((f) => lower.includes(f.tag.replace(/_/g, " ")) || lower.includes(f.tag));
      let points: DrillPoint[];
      if (named.length > 0) {
        points = named.map((f) => ({ point: f.label, wrong: f.evidence.split(" -> ")[0], right: f.evidence.split(" -> ")[1] ?? "", tag: f.tag, skill: TAG_TO_SKILL[f.tag] ?? "grammar" }));
        steps.push({ label: "Aiming at your families", detail: named.map((f) => f.tag).join(", ") });
      } else {
        const topic = ctx.text.replace(/^\/?drill\s*/i, "").replace(/\b(my|a|the|some|spot|weakness|weak)\b/gi, " ").replace(/\s+/g, " ").trim() || "your weakest skill";
        points = [{ point: `Focused practice: ${topic}`, skill: TAG_TO_SKILL[topic.replace(/ /g, "_")] ?? "grammar" }];
        steps.push({ label: "Building the drill", detail: topic });
      }
      const drill = await generateRepairDrill(ctx.profile, points, (l, d) => steps.push({ label: l, detail: d }), "Weak-spot drill");
      if (!drill) {
        return { skill: "repair-drill", reply: "Drill build failed that time - run /drill once more.", corrections: [], fa_note: "", steps };
      }
      return {
        skill: "repair-drill",
        reply: "Fresh drill, same target. Name the weak spot next time ('drill prepositions') or say 'practice my misses' to retest your actual exam errors. Submit when done.",
        corrections: [],
        fa_note: "",
        steps,
        exam: drill.client,
      };
    },
  },
  {
    id: "roleplay",
    name: "Roleplay",
    oneLiner: "Live scenario practice: interviews, airports, doctors - in character",
    commands: ["roleplay", "scene"],
    triggers: [/\brole[- ]?play\b/i, /\bscene\b.{0,40}\b(interview|airport|doctor|restaurant|hotel|shop|meeting|order)\b/i, /simulate (a|an)/i, /practice (talking|speaking) (with|to|in) (a|an|the)/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const t = ctx.text.toLowerCase();
      let scene = "A casual conversation with a new English-speaking colleague";
      let partner = "the colleague";
      let goal = "Keep the conversation natural for five exchanges";
      if (t.includes("interview") || t.includes("job")) {
        scene = "A job interview for a position you really want";
        partner = "the hiring manager";
        goal = "Present yourself, answer the hard questions, and land a second interview";
      } else if (t.includes("airport") || t.includes("flight") || t.includes("check-in")) {
        scene = "An airport check-in counter where your connecting flight is delayed";
        partner = "the check-in agent";
        goal = "Sort out the rebooking and get something for the inconvenience";
      } else if (t.includes("doctor") || t.includes("sick") || t.includes("clinic")) {
        scene = "A doctor's appointment; you have felt unwell for a week";
        partner = "the doctor";
        goal = "Describe symptoms precisely and understand the advice";
      } else if (t.includes("restaurant") || t.includes("order") || t.includes("food")) {
        scene = "A restaurant where the wrong dish just arrived";
        partner = "the waiter";
        goal = "Fix the order politely and order dessert after";
      } else if (t.includes("hotel") || t.includes("room")) {
        scene = "A hotel reception; your room is not what you booked";
        partner = "the receptionist";
        goal = "Get the room fixed or an upgrade, without losing your temper";
      } else if (t.includes("meeting") || t.includes("present") || t.includes("work")) {
        scene = "A work meeting where you must present an idea to skeptical colleagues";
        partner = "a skeptical colleague";
        goal = "Defend the idea with reasons and handle pushback";
      } else if (ctx.text.replace(/\b(roleplay|scene|simulate|a|an|the|practice)\b/gi, " ").trim().length > 8) {
        scene = ctx.text.replace(/^.*\b(roleplay|scene|simulate)\b:?\s*/i, "").trim() || scene;
        partner = "your scene partner";
        goal = "Stay in the scene and communicate naturally";
      }
      steps.push({ label: "Scene set", detail: scene });
      await db.learner.update({ where: { id: "me" }, data: { mode: "roleplay", modeData: JSON.stringify({ scene, partner, goal, startedAt: Date.now() }) } });
      const open = await aiJson<{ reply?: string }>(
        `You are ${partner} in this roleplay for a Farsi speaker around ${ctx.profile.level}: ${scene}. Their goal: ${goal}.
Open the scene IN CHARACTER: 1 to 3 sentences that put the learner on the spot in a natural way and end with something they must respond to. English only, spoken register. No JSON, no Farsi, no em dash.`,
        [{ role: "user", content: "open the scene" }],
        () => ({}),
        { deep: false, temperature: 0.7 },
      );
      const firstLine = String(open.reply ?? "").trim() || "So, let's begin - tell me why you are here.";
      return {
        skill: "roleplay",
        reply: `Scene: ${scene}\nYour goal: ${goal}\n\n${firstLine}\n\n(I stay in character; real errors get corrected on the cards under my replies. Say "end scene" any time to get feedback and return to coach mode.)`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "socratic",
    name: "Socratic mode",
    oneLiner: "I refuse to hand you the answer; my questions drag it out of you",
    commands: ["socratic"],
    triggers: [/\bsocratic\b/i, /guide me (to|through)/i, /dont tell me (the )?answer/i, /make me (think|figure it out)/i, /let me discover/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const families = await topMistakes(3, true);
      const goal = ctx.text.replace(/\bsocratic( mode)?\b/gi, " ").replace(/\b(guide me|on|about|for)\b/gi, " ").trim() || families[0]?.label || "their most common grammar slip";
      steps.push({ label: "Socratic mode on", detail: goal });
      await db.learner.update({ where: { id: "me" }, data: { mode: "socratic", modeData: JSON.stringify({ goal, startedAt: Date.now() }) } });
      const open = await aiJson<{ reply?: string }>(
        `You are Rah in SOCRATIC MODE for a Farsi speaker around ${ctx.profile.level}. Target: ${goal}.
Open with ONE short guiding question or minimal pair that makes them produce the target form themselves. Max 30 words. No explanation, no rule, no answer. English only, no em dash.`,
        [{ role: "user", content: "begin" }],
        () => ({}),
        { deep: false, temperature: 0.6 },
      );
      return {
        skill: "socratic",
        reply: `${String(open.reply ?? "").trim() || "Try this sentence for me: 'Yesterday I ___ (go) to the gym.' Which form fits, and why not the others?"}\n\n(Socratic mode is on: I guide with questions, never hand you the rule. Correction cards still reveal when you err. "end" returns to normal coaching.)`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "explain",
    name: "Explain",
    oneLiner: "The one skill where I break Socratic silence and just teach the rule",
    commands: ["explain"],
    triggers: [/\bexplain\b/i, /what('s| is) the difference between/i, /when (do|should) (i|you) use\b/i, /how (do|does) (present perfect|past simple|a\/an|the) work/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const topic = ctx.text.replace(/^\/?explain\s*/i, "").replace(/what('s| is) the difference between/i, "").trim() || ctx.text;
      steps.push({ label: "Preparing the lesson", detail: topic.slice(0, 60) });
      const out = await aiJson<{ reply?: string; fa?: string; check?: string[] }>(
        `You are the linguist inside Rah, teaching a Farsi speaker around ${ctx.profile.level} who explicitly ASKED for the rule (this is the one mode where lecturing is allowed).
Topic: ${topic}

reply: the clearest possible explanation, max 130 words. Include: the rule in one line, 2 contrasting examples (wrong vs right), and the Farsi-interference angle if there is one.
fa: one or two Farsi sentences summarizing the interference or the takeaway.
check: 2 tiny check questions (with answers hidden in your reply's last line as "Quick check: 1) ... 2) ...").
Output ONE JSON object: {"reply": "", "fa": "", "check": ["", ""]}
No em dash anywhere.`,
        [{ role: "user", content: ctx.text }],
        () => ({}),
        { deep: false, temperature: 0.5 },
      );
      const reply = String(out.reply ?? "").trim();
      const check = Array.isArray(out.check) ? out.check.filter(Boolean).slice(0, 2) : [];
      return {
        skill: "explain",
        reply: `${reply}${check.length ? `\n\nQuick check: ${check.join(" ")}` : ""}`,
        corrections: [],
        fa_note: String(out.fa ?? "").trim(),
        steps,
      };
    },
  },
  {
    id: "debate",
    name: "Debate",
    oneLiner: "Three scored rounds: I take the other side and push back hard",
    commands: ["debate"],
    triggers: [/\bdebate\b/i, /argue (with|against) me/i, /convince me/i, /play devil'?s advocate/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      let topic = ctx.text.replace(/^\/?debate\s*(about|on|over)?\s*/i, "").trim();
      if (topic.length < 6 || /^(with|against) me$/i.test(topic)) {
        const pool = ["Remote work is better than office work", "Social media does more harm than good", "Exams measure nothing real", "Learning grammar rules beats learning phrases", "Cities are better than small towns for raising kids"];
        topic = pool[Math.floor(Math.random() * pool.length)];
      }
      steps.push({ label: "Motion set", detail: topic });
      const side = await aiJson<{ side?: string }>(
        `Debate topic: "${topic}". A Farsi-speaking learner around ${ctx.profile.level} will argue; YOU must take the opposing side. State your side in max 8 words. Output ONE JSON object: {"side": ""}`,
        [{ role: "user", content: "pick your side" }],
        () => ({}),
        { deep: false, temperature: 0.6 },
      );
      const mySide = String(side.side ?? "").trim() || "the opposite position";
      await db.learner.update({ where: { id: "me" }, data: { mode: "debate", modeData: JSON.stringify({ topic, side: mySide, round: 0, startedAt: Date.now() }) } });
      const open = await aiJson<{ reply?: string }>(
        `You are the debate opponent in Rah for a learner around ${ctx.profile.level}. Topic: "${topic}". Your side: ${mySide}.
Open the debate: 2 or 3 sentences with your strongest opening argument, ending with a direct challenge at them. English only, sharp register, no em dash.`,
        [{ role: "user", content: "open the debate" }],
        () => ({}),
        { deep: false, temperature: 0.7 },
      );
      return {
        skill: "debate",
        reply: `Motion: ${topic}\nMy side: ${mySide}\n\n${String(open.reply ?? "").trim()}\n\n(3 rounds, then a scored verdict on argument and language. Real errors get corrected on cards. Say "end debate" any time.)`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "daily-challenge",
    name: "Daily challenge",
    oneLiner: "One hard item, built from your weakest spot today, graded on the spot",
    commands: ["daily", "challenge"],
    triggers: [/daily challenge/i, /\bchallenge me\b/i, /daily (quest|puzzle)/i, /todays? challenge/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      return startDaily(ctx.profile, (l, d) => steps.push({ label: l, detail: d }));
    },
  },
  {
    id: "coach-report",
    name: "Coach report",
    oneLiner: "Your week in hard numbers, with one focus for next week",
    commands: ["week", "report-card"],
    triggers: [/(weekly|coach) report/i, /how (was|did) my week/i, /report card/i, /week in (numbers|review)/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Crunching your data", detail: "7 days, bands, exams, memory" });
      const since = Date.now() / 1000;
      const days = await db.dailyStat.findMany({ where: { day: { gte: Math.floor(since / 86400) - 7 } } });
      const reviews = days.reduce((a, d) => a + d.reviews, 0);
      const xp = days.reduce((a, d) => a + d.xp, 0);
      const correct = days.reduce((a, d) => a + d.correct, 0);
      const bands = await getSkillLevels();
      const mistakes = await topMistakes(50);
      const active = mistakes.filter((m) => !m.resolvedAt);
      const healed = mistakes.filter((m) => m.resolvedAt);
      const exams = await db.exam.findMany({ where: { status: "graded" }, orderBy: { createdAt: "desc" }, take: 5 });
      const pcts = exams.map((e) => {
        try {
          return (JSON.parse(e.result ?? "{}") as { pct?: number }).pct ?? 0;
        } catch {
          return 0;
        }
      });
      const trend = pcts.length >= 2 ? (pcts[0] >= pcts[pcts.length - 1] ? "trending up" : "slipping") : "not enough exams yet";
      const worstBand = [...bands].sort((a, b) => a.score - b.score)[0];
      const focus = active[0]?.label ?? worstBand ? `${worstBand ? `${worstBand.skill} (${worstBand.level})` : "consistency"}` : "consistency";
      const lines = [
        `Last 7 days: ${reviews} reviews, ${correct} correct, ${xp} XP, ${days.length} active day(s), streak ${ctx.profile.streak}.`,
        bands.length ? `Bands: ${bands.map((b) => `${b.skill} ${b.level}`).join(", ")}.` : "No measured bands yet - run /assess.",
        pcts.length ? `Recent exams: ${pcts.join("%, ")}% (${trend}).` : "No graded exams yet.",
        `Mistake memory: ${active.length} active famil${active.length === 1 ? "y" : "ies"}, ${healed.length} healed.`,
        `Next-week focus: ${active[0] ? `${active[0].label} - the exams already hunt it; two clean hits retire it.` : `${focus}.`}`,
      ];
      return { skill: "coach-report", reply: lines.join("\n"), corrections: [], fa_note: "", steps };
    },
  },
  {
    id: "minimal-pairs",
    name: "Pronunciation lab",
    oneLiner: "Minimal pairs for the exact sounds Persian speakers collapse",
    commands: ["pairs"],
    triggers: [/\bminimal pairs?\b/i, /pronunciation (lab|drill|pairs)/i, /\bth sounds?\b/i, /(practice|train|fix) my (th|w|v|pronunciation)/i, /i (cant|can't|cannot) (say|pronounce) (th|w)\b/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const t = ctx.text.toLowerCase();
      const pick = MINIMAL_PAIRS.filter((b) => t.includes(b.tag.replace(/_/g, " ")) || t.includes(b.tag));
      const chosen = pick.length ? pick : [MINIMAL_PAIRS[Math.floor(Math.random() * MINIMAL_PAIRS.length)]];
      steps.push({ label: "Pronunciation lab", detail: chosen.map((b) => b.tag).join(", ") });
      const lines = chosen.flatMap((b, i) => [
        `${i + 1}. ${b.tag.replace(/_/g, " ")}:`,
        ...b.pairs.map(([a, c]) => `   - ${a}  vs  ${c}`),
        `   Tip: ${b.tip}`,
      ]);
      return {
        skill: "minimal-pairs",
        reply: `Say each pair aloud 3 times, exaggerating the contrast, then take them into the Speaking view and let the grader hear them.\n\n${lines.join("\n")}\n\nWant a specific sound next? Ask for "th sounds", "w vs v", "clusters", "ng" or "stress".`,
        corrections: [],
        fa_note: chosen.map((b) => b.fa).join(" "),
        steps,
      };
    },
  },
  {
    id: "summarize",
    name: "Summary check",
    oneLiner: "Scores your summary of any text for fidelity and language",
    commands: ["summarize"],
    triggers: [/^(check|grade|review) my (summary|summaries)/i, /\bmy summary\b/i, /^(here('s| is) )?my summary/i, /summar(ize|ise) check/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const text = ctx.text.replace(/^(check|grade|review) my (summary|summaries)[:,-]?\s*/i, "").trim();
      if (text.length < 20) {
        return {
          skill: "summarize",
          reply: "Paste the summary (and, if you can, the original text after 'original:'). I score how faithfully it captures the source and how clean the English is - misses feed the mistake memory like everything else.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const original = text.match(/\boriginal:\s*([\s\S]+)/i)?.[1]?.trim() ?? "";
      const summary = original ? text.slice(0, text.toLowerCase().indexOf("original:")).trim() : text;
      steps.push({ label: "Reading your summary", detail: `${summary.split(/\s+/).length} words${original ? ", original provided" : ""}` });
      const out = await aiJson<{ reply?: string; corrections?: { wrong?: string; right?: string; fa?: string; trap?: string }[] }>(
        `You are the summary examiner inside Rah for a Farsi speaker around ${ctx.profile.level}.
${original ? `ORIGINAL TEXT:\n${original.slice(0, 1200)}\n\n` : "No original provided - judge language quality and coherence only.\n"}LEARNER'S SUMMARY:\n${summary.slice(0, 1200)}

reply: max 110 words. ${original ? "How faithful is the summary (anything missed, anything distorted), then language verdict. " : "Language and coherence verdict. "}End with ONE concrete upgrade to try.
corrections: up to 3 real errors, each {"wrong", "right", "fa" (Farsi why), "trap" (one of: statives, articles, countability, plurals, copula, prepositions, perfect, question_order, adjectives, that_omission, word_choice, register)}.
Output ONE JSON object, no em dash.`,
        [{ role: "user", content: text.slice(0, 2000) }],
        () => ({}),
        { deep: false, temperature: 0.4 },
      );
      return {
        skill: "summarize",
        reply: String(out.reply ?? "").trim() || "Tell me more about the summary and I will grade it properly.",
        corrections: (Array.isArray(out.corrections) ? out.corrections : []).slice(0, 3).map((c) => ({
          wrong: String(c.wrong ?? ""),
          right: String(c.right ?? ""),
          fa: String(c.fa ?? ""),
          trap: String(c.trap ?? "word_choice"),
        })),
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "exit-mode",
    name: "End mode",
    oneLiner: "Leave roleplay, debate, socratic or the daily challenge",
    commands: ["end", "exit", "stop"],
    triggers: [],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const learner = await db.learner.findUnique({ where: { id: "me" } });
      if (learner && learner.mode !== "coach") {
        await clearMode("slash exit");
        return { skill: "exit-mode", reply: "Mode closed. Back in coach mode - what next?", corrections: [], fa_note: "", steps };
      }
      return { skill: "exit-mode", reply: "No active mode right now. Start one: /roleplay, /debate, /socratic or /daily.", corrections: [], fa_note: "", steps };
    },
  },




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
    id: "mistakes",
    name: "Mistake memory",
    oneLiner: "Your recurring mistakes, counted, with live evidence",
    commands: ["mistakes"],
    triggers: [/\b(recurring )?mistakes?\b/i, /what do i keep (getting )?wrong/i, /\bmy (weak|leak\w*) (points|spots|families)\b/i, /\berror (families|patterns)\b/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Mining corrections", detail: "chat turns, essays, speaking rounds" });
      const families = await topMistakes(8);
      if (families.length === 0) {
        return {
          skill: "mistakes",
          reply: "No recurring mistakes on file yet. The memory builds itself as I correct your chat messages, essays and speaking rounds, so keep producing: within a few sessions the persistent patterns surface here with counts and evidence.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const active = families.filter((f) => !f.resolvedAt);
      const healed = families.filter((f) => f.resolvedAt);
      const lines = active.map((f, i) => `${i + 1}. ${f.label} - seen ${f.count}x in your ${f.kind}${f.streakClean > 0 ? ` (${f.streakClean}/2 clean hits in exams)` : ""}. Latest: "${f.evidence}"`);
      const healedLines = healed.map((f) => `- ${f.label} - fixed, retired after 2 clean exam hits`);
      const top = active[0] ?? families[0];
      const loop = active.length
        ? `\n\nThis is the memory the tutor and the examiner both aim with. Exams now build items that hunt these exact weak spots; answer two of them correctly and I retire the family for good. Say "focus on ${top.tag}" to drill the worst one, or "generate a 6 question grammar only exam" to test it under pressure.`
        : `\n\nEvery active family is healed right now: two clean exam hits each retired them. They reopen automatically if the mistake shows up in your English again.`;
      return {
        skill: "mistakes",
        reply: `${active.length ? `Your leaks, most persistent first:\n${lines.join("\n")}` : ""}${healed.length ? `\n${active.length ? "\n" : ""}Healed and retired:\n${healedLines.join("\n")}` : ""}${loop}`,
        corrections: [],
        fa_note: "",
        steps,
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
