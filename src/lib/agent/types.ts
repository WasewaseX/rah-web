// Agent core types. The coach is a loop: route -> skill -> verify.
// Skills are the unit of capability; the envelope is the unit of trust.

import type { ProfileJson } from "@/lib/ai";

export type SkillId =
  | "chat"
  | "correct"
  | "translate"
  | "collocation-drill"
  | "vocab-drill"
  | "phrasal-verbs"
  | "idioms"
  | "grammar-drill"
  | "pronunciation"
  | "word-of-the-day"
  | "paraphrase"
  | "writing-prompt"
  | "generate-exam"
  | "exam-track"
  | "grade-exam"
  | "assess-level"
  | "mistakes"
  | "deep-analysis"
  | "skill-report"
  | "study-plan"
  | "exam-history"
  | "theme-control"
  | "remediate"
  | "repair-drill"
  | "roleplay"
  | "socratic"
  | "explain"
  | "debate"
  | "daily-challenge"
  | "coach-report"
  | "minimal-pairs"
  | "summarize"
  | "exit-mode"
  | "navigate"
  | "focus-skill"
  | "settings";

export interface StepTrace {
  label: string;
  detail?: string;
}

// One graded exam item. `a` is the primary key; `accept` lists equivalent
// answers (synonyms, inflections); rewrite items carry `mustInclude` patterns
// that all have to appear, and optionally `mustNotInclude`.
export interface ExamItem {
  id: string;
  type: "mcq" | "cloze" | "short" | "rewrite";
  skill: string; // grammar | vocabulary | collocation | writing | reading | listening
  q: string;
  choices?: string[];
  a: string;
  accept?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  why: string;
  tag?: string; // mistake-family tag when the item deliberately hunts a weak spot
}

export interface ExamSpec {
  level: string;
  targetSkills: string[];
  plannedCount: number;
  minutes: number;
  title: string;
  weakTags: string[]; // active mistake families this exam was built to hunt
  // Authentic exam-format track (audit P1 curriculum, Task 66). Present when
  // the learner asked for IELTS/TOEFL/C1A-style practice; grading attaches the
  // deterministic band reference when set. See lib/agent/exam-tracks.ts.
  track?: "ielts" | "toefl" | "c1a";
  degraded?: boolean; // true = some generation rounds fell back; count/answerability gates still enforced (audit P1-7)
}

// Client-facing exam: items WITHOUT answer keys.
export interface ExamClient {
  id: string;
  title: string;
  spec: ExamSpec;
  count: number;
  items: { id: string; type: string; skill: string; q: string; choices?: string[]; tag?: string }[];
}

export interface ExamVerdict {
  itemId: string;
  given: string;
  correct: boolean;
  key: string;
  why: string;
  skill: string;
  acceptedAI?: boolean; // mechanical grader said no, the arbiter said yes
  coach?: { rule: string; fa: string }; // teaching note attached to a real miss
}

export interface ExamResult {
  total: number;
  answered: number;
  correct: number;
  pct: number;
  bySkill: { skill: string; correct: number; total: number }[];
  verdicts: ExamVerdict[];
  headline: string;
  // P1 exam->FSRS unification: the cards this exam's outcomes landed on.
  // Empty when nothing resolved (no deck match, no tag) - never invented.
  scheduled?: { cardId: string; due: number; grade: number; via: "deck" | "family" }[];
  // Degraded-grading honesty (P1-7): true when the AI answer arbiter was
  // unreachable and the result is regex-only. Never silently equivalent.
  degraded?: boolean;
  degradedNotice?: string;
  // Track flavor (Task 66): present only when the exam was generated on an
  // authentic-format track; the band is a deterministic rough reference, the
  // note carries the not-an-official-score disclaimer.
  trackLabel?: string;
  band?: { band: string; note: string };
}

export interface SkillLevelRow {
  skill: string;
  level: string;
  score: number; // 0..1
  samples: number;
}

export interface AssessmentPayload {
  overall: string;
  skills: SkillLevelRow[];
  note: string;
}

export interface ThemeTokens {
  primary?: string;
  primaryDeep?: string;
  bg?: string;
  surface?: string;
  accent?: string;
}

export interface AgentAction {
  type: "theme" | "navigate" | "focus";
  tokens?: ThemeTokens;
  preset?: string;
  view?: string;
  skill?: string;
}

export interface Correction {
  wrong: string;
  right: string;
  fa: string;
  trap: string;
}

// The full coach envelope, version 2. Everything optional except reply.
export interface CoachEnvelope {
  skill: SkillId;
  reply: string;
  corrections?: Correction[];
  fa_note?: string;
  steps?: StepTrace[];
  exam?: ExamClient;
  result?: ExamResult;
  assessment?: AssessmentPayload;
  actions?: AgentAction[];
  praised?: boolean;
}

// What a skill receives. Skills read state through ctx, never through fetches.
export interface SkillContext {
  text: string;
  args: string;
  profile: ProfileJson;
  history: { role: string; content: string }[];
  emit: (label: string, detail?: string) => void;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  oneLiner: string;
  commands: string[]; // slash aliases: "/exam", "/assess" ...
  triggers: RegExp[]; // deterministic router
  run: (ctx: SkillContext) => Promise<CoachEnvelope>;
}
