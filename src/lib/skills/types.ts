// Shared contracts for the Rah coach agent: skill registry entries, streamed
// agent steps, and the message envelopes persisted into the chat history.

export interface Correction {
  wrong: string;
  right: string;
  fa: string;
  trap: string;
}

// ---------- exam ----------

export type ExamSkill =
  | "grammar"
  | "vocabulary"
  | "collocation"
  | "prepositions"
  | "tenses"
  | "articles"
  | "countability"
  | "phrasal"
  | "register"
  | "reading"
  | "writing"
  | "wordform";

export interface ExamQuestion {
  id: string;
  type: "mcq" | "cloze" | "rewrite" | "translate";
  skill: ExamSkill;
  prompt: string; // may contain ___ for cloze
  choices?: string[]; // mcq only
  accept: string[]; // every valid answer (first one is the canonical key)
  point: string; // what this item tests, in plain words
  fa: string; // Farsi nudge shown with the question
  why: string; // teaching line shown after grading
}

export interface Exam {
  id: string;
  title: string;
  targetLevel: string;
  questions: ExamQuestion[];
  builtAt: number;
}

export interface GradedQuestion {
  id: string;
  verdict: "correct" | "close" | "wrong" | "skipped";
  given: string;
  key: string; // canonical answer
  alsoAccepted?: string[]; // other valid forms the grader recognized
  note: string; // precise feedback about the actual answer
  fa: string;
}

export interface ExamResult {
  examId: string;
  title: string;
  score: number;
  total: number;
  percent: number;
  closeCount: number;
  perSkill: { skill: string; correct: number; total: number }[];
  signal: string; // what this result says about the level, in one line
  verdict: string; // grounded summary of what actually happened
  next: string; // grounded next move
  questions: GradedQuestion[];
}

// ---------- deep assessment ----------

export interface SkillLevel {
  skill: string;
  level: string; // CEFR or "?" when not measurable
  score10: number; // 1..10 confidence in that band
  note: string; // evidence-based one-liner
}

export interface Assessment {
  overall: string;
  previous: string;
  confidence: number;
  skills: SkillLevel[];
  evidence: string[];
  plan: string[];
  fa_note: string;
}

// ---------- theme plugin ----------

export interface ThemeSpec {
  name: string; // human name, e.g. "Emerald Deep"
  preset?: string; // preset id when known
  vars: Record<string, string>; // CSS custom properties to set on :root
}

// ---------- envelopes (persisted as ChatMsg content) ----------

export type AgentStepState = "run" | "done";

export interface AgentStep {
  label: string;
  state: AgentStepState;
}

export type Envelope =
  | { kind: "chat"; reply: string; corrections: Correction[]; fa_note: string; praised: boolean }
  | { kind: "steps"; reply: string; steps: AgentStep[]; fa_note?: string; data?: unknown; dataType?: string }
  | { kind: "exam"; exam: Exam; intro: string; fa_note: string }
  | { kind: "examResult"; result: ExamResult }
  | { kind: "assessment"; assessment: Assessment }
  | { kind: "theme"; theme: ThemeSpec; note: string; fa: string };

// SSE wire events from /api/coach
export type AgentEvent =
  | { type: "start"; skill: string; title: string }
  | { type: "step"; label: string; state: AgentStepState; detail?: string }
  | { type: "final"; envelope: Envelope }
  | { type: "error"; message: string };

// Legacy shape (messages saved before the agent existed) renders as chat.
export function isLegacyChat(e: unknown): e is { reply: string; corrections: Correction[]; fa_note: string } {
  return typeof e === "object" && e !== null && "reply" in e && !("kind" in e);
}
