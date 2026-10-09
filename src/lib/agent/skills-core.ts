// Conversational teaching skills. Each is the Socratic coach with one
// obsession. Data-driven: the run() body is shared, the focus differs.

import type { SkillDef, SkillContext, StepTrace } from "./types";
import { basePersona, coachTurn, envelope } from "./skills-util";

interface DrillSpec {
  id: SkillDef["id"];
  name: string;
  oneLiner: string;
  commands: string[];
  triggers: RegExp[];
  focus: string;
}

function makeDrill(spec: DrillSpec): SkillDef {
  return {
    id: spec.id,
    name: spec.name,
    oneLiner: spec.oneLiner,
    commands: spec.commands,
    triggers: spec.triggers,
    run: async (ctx: SkillContext) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Loaded your profile", detail: `level ${ctx.profile.level}, weak: ${ctx.profile.weakSkills.join(", ") || "balanced"}` });
      steps.push({ label: spec.name, detail: "one focus this turn" });
      const system = `${basePersona(ctx.profile)}

## This turn's obsession: ${spec.name}

${spec.focus}

Steer every turn back to this obsession without announcing it. If the learner drifts, answer once, then pull the thread back with a task.`;
      const turn = await coachTurn(system, ctx, steps);
      return envelope(spec.id, turn, steps);
    },
  };
}

export const CORE_SKILLS: SkillDef[] = [
  {
    id: "chat",
    name: "Free conversation",
    oneLiner: "Socratic chat that corrects as you go",
    commands: ["chat", "talk"],
    triggers: [],
    run: async (ctx: SkillContext) => {
      const steps: StepTrace[] = [{ label: "Coach turn", detail: "reading your last lines for the highest-value fix" }];
      const turn = await coachTurn(basePersona(ctx.profile), ctx, steps, {
        thinkingGate: (p) => p.level === "C1",
      });
      return envelope("chat", turn, steps);
    },
  },
  makeDrill({
    id: "correct",
    name: "Deep correction",
    oneLiner: "Paste anything, get it fixed with the why",
    commands: ["correct", "fix"],
    triggers: [/^(correct|fix|check)\b.*:/i, /^(correct|fix|check) this/i, /correct this sentence/i, /is this (correct|right|grammatical)/i],
    focus: "The learner handed you text to fix. Correct up to 3 issues, ranked by value. For each, make them attempt the fix in their next message before confirming, unless they already attempted it.",
  }),
  makeDrill({
    id: "translate",
    name: "Translation drill",
    oneLiner: "Say it in English, Farsi source welcome",
    commands: ["translate", "tr"],
    triggers: [/how (do|would) (i|you) say/i, /translate/i, /what is .* in english/i, /in english\?*$/i],
    focus: "The learner wants a Farsi thought in English. First make THEM attempt a version. Grade their attempt, then give the natural version plus one register note.",
  }),
  makeDrill({
    id: "collocation-drill",
    name: "Collocation drill",
    oneLiner: "Verb-noun pairs that never translate",
    commands: ["collocation", "collocations"],
    triggers: [/collocation/i, /word (pairs?|combinations?)/i, /make or do/i, /do or make/i],
    focus: "Drill collocations that break under Farsi-to-English transfer: make/do, take/get, heavy/strong, raise/issue. Make them choose, produce, and correct. One pair family per turn.",
  }),
  makeDrill({
    id: "vocab-drill",
    name: "Vocabulary workout",
    oneLiner: "Word families, register, precision",
    commands: ["vocab", "vocabulary"],
    triggers: [/vocabular/i, /\bvocab\b/i, /(new|more) words/i, /word of the day/i, /teach me (a |an )?word/i],
    focus: "Work mid-frequency and C1 vocabulary: word families, register (formal vs casual), precise verbs over generic ones (go up -> surge, climb, spike). Make them use each word in their own sentence.",
  }),
  makeDrill({
    id: "phrasal-verbs",
    name: "Phrasal verbs",
    oneLiner: "put up with, run out of, cut down on",
    commands: ["phrasal"],
    triggers: [/phrasal/i, /two[- ]word verbs?/i],
    focus: "Drill phrasal verbs by register and particle logic. Make them produce sentences, not definitions. Show the formal one-word twin (put up with = tolerate) for C1 range.",
  }),
  makeDrill({
    id: "idioms",
    name: "Idioms",
    oneLiner: "Sound like a person, not a textbook",
    commands: ["idiom", "idioms"],
    triggers: [/idiom/i, /expressions?/i, /sound natural/i, /native speakers? say/i],
    focus: "Teach idioms with register warnings (workplace-safe vs casual only). Make them use one in a sentence about their own life.",
  }),
  makeDrill({
    id: "grammar-drill",
    name: "Grammar drill",
    oneLiner: "Tenses, articles, prepositions, on demand",
    commands: ["grammar"],
    triggers: [/grammar/i, /(present|past) (perfect|simple|continuous)/i, /tense/i, /article (a|an|the)/i, /preposition/i],
    focus: "Pick the grammar point the learner named (or the one visible in their message). Run a 3-beat cycle: concept question, production task, correction with the Farsi why.",
  }),
  makeDrill({
    id: "pronunciation",
    name: "Pronunciation",
    oneLiner: "th, v/w, clusters: the Farsi six",
    commands: ["pronunciation", "pronounce"],
    triggers: [/pronunciat/i, /\bth\b sounds?/i, /\bv\b.*\bw\b|\bw\b.*\bv\b/i, /accent/i, /how do you say .* out loud/i],
    focus: "Drill the Farsi-speaker problem set: th (theta/eth), v/w merger, consonant clusters (epenthetic vowels: estudent), final ng+g, flat stress. Give minimal pairs and make them type and read aloud.",
  }),
  makeDrill({
    id: "paraphrase",
    name: "Paraphrase in three registers",
    oneLiner: "One idea, casual, neutral, formal",
    commands: ["register", "paraphrase"],
    triggers: [/paraphrase/i, /(formal|casual|informal) (way|version)/i, /three ways to say/i, /register/i],
    focus: "Take their sentence and make them re-render it in casual, neutral, and formal registers. Grade each attempt, then show the model set.",
  }),
  makeDrill({
    id: "writing-prompt",
    name: "Writing prompt",
    oneLiner: "A task matched to your band",
    commands: ["writing-prompt", "prompt me"],
    triggers: [/(give|give me|need) .*writing (prompt|task|topic)/i, /what should i write about/i, /essay (topic|prompt)/i, /writing practice/i],
    focus: "Give ONE writing task sized for their band (80 words at B2, 120 at C1) with a constraint that forces the weak spot into play. When they submit, grade like the writing examiner: task, organization, range, accuracy.",
  }),
  {
    id: "word-of-the-day",
    name: "Word of the day",
    oneLiner: "One C1 word, used immediately",
    commands: ["wotd", "word"],
    triggers: [/word of (the|today)/i, /\bwotd\b/i, /daily word/i],
    run: async (ctx: SkillContext) => {
      const steps: StepTrace[] = [{ label: "Picking from the C1 band", detail: "mid-frequency, immediately usable" }];
      const system = `${basePersona(ctx.profile)}

## This turn's obsession: Word of the day

Give ONE C1-band word that is useful in work and news contexts. Format inside reply, compact:
**word** /pronunciation/ register note. One-line meaning. Two natural collocations. One Farsi-speaker trap. End by demanding a sentence from the learner using the word.
corrections stays empty this turn; fa_note empty.`;
      const turn = await coachTurn(system, ctx, steps);
      return envelope("word-of-the-day", turn, steps);
    },
  },
];
