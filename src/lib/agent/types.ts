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
  | "grade-exam"
  | "assess-level"
  | "deep-analysis"
  | "skill-report"
  | "study-plan"
  | "exam-history"
  | "theme-control"
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
}

export interface ExamSpec {
  level: string;
  targetSkills: string[];
  plannedCount: number;
  minutes: number;
  title: string;
}

// Client-facing exam: items WITHOUT answer keys.
export interface ExamClient {
  id: string;
  title: string;
  spec: ExamSpec;
  count: number;
  items: { id: string; type: string; skill: string; q: string; choices?: string[] }[];
}

export interface ExamVerdict {
  itemId: string;
  given: string;
  correct: boolean;
  key: string;
  why: string;
  skill: string;
}

export interface ExamResult {
  total: number;
  answered: number;
  correct: number;
  pct: number;
  bySkill: { skill: string; correct: number; total: number }[];
  verdicts: ExamVerdict[];
  headline: string;
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
