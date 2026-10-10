// Shared envelope + payload types for the tutor skill system.
// Imported by server engines and client renderer alike.

export interface Correction {
  wrong: string;
  right: string;
  fa: string;
  trap: string;
}

// ---------- drill (instant-feedback practice) ----------
export interface DrillItem {
  type: "mcq" | "cloze" | "transform" | "short";
  q: string;
  choices?: string[];
  answer: string;
  acceptable?: string[];
  why: string;
  fa: string;
}

export interface Drill {
  title: string;
  title_fa: string;
  intro: string;
  items: DrillItem[];
}

export interface DrillItemResult {
  q: string;
  given: string;
  expected: string;
  ok: boolean;
}

export interface DrillOutcome {
  skill: string;
  score: number;
  total: number;
  misses: DrillItemResult[];
}

// ---------- exam (formal, graded at submit) ----------
export interface ExamQuestion {
  id: string;
  type: "mcq" | "cloze" | "transform" | "short" | "write";
  section: string; // Vocabulary | Collocation | Grammar | Reading | Writing
  q: string;
  passage?: string; // shared reading passage (rendered once per section)
  choices?: string[];
  answer: string;
  acceptable?: string[];
  why: string;
  fa: string;
  points: number;
}

export interface Exam {
  id: number; // ExamRun id, set server-side
  title: string;
  title_fa: string;
  level: string;
  spec: string;
  timeLimitMin: number;
  questions: ExamQuestion[];
}

export interface ExamAnswers {
  [qid: string]: string;
}

export interface ExamItemResult {
  qid: string;
  section: string;
  type: ExamQuestion["type"];
  q: string;
  given: string;
  expected: string;
  ok: boolean;
  why: string;
  fa: string;
  /** how it was judged: exact match, spelling slip, accepted variant, near
   *  (left for the examiner), wrong, or blank */
  verdict?: "exact" | "typo" | "accepted" | "near" | "wrong" | "blank";
  /** examiner's human reason (overrides why when present) */
  note?: string;
}

// LLM-written assessment over the mechanical grade.
export interface ExamReport {
  band: string;
  verdict: string;
  strengths: string[];
  weaknesses: string[];
  leaks: { trap: string; note: string; fa: string }[];
  next_action: string;
  write_eval?: { score: number; note: string; fa: string } | null;
  dimensions?: { vocabulary: number; grammar: number; reading: number; writing: number } | null;
}

// ---------- report engine (analysis cards) ----------
export interface SkillBand {
  name: string;
  name_fa: string;
  band: string; // e.g. "B2+", "A2", "n/a"
  score: number; // 0-100 estimate
  note: string;
}

export interface DeepLevelReport {
  overall: string;
  confidence: "low" | "medium" | "high";
  skills: SkillBand[];
  evidence: string[];
  leaks: { trap: string; fa: string }[];
  plan: { step: string; fa: string }[];
  source: "ai" | "mechanical";
}

export interface DiagnosisReport {
  headline: string;
  patterns: { trap: string; title: string; count: number; fa: string; fix: string }[];
  verdict: string;
  source: "ai" | "mechanical";
}

export interface ForecastReport {
  headline: string;
  pace: string;
  eta_weeks: number | null;
  moves: { move: string; effect: string }[];
  source: "ai" | "mechanical";
}

export interface PlanReport {
  headline: string;
  blocks: { icon: string; title: string; why: string; minutes: number }[];
  source: "ai" | "mechanical";
}

// ---------- coach chat envelope (persisted in ChatMsg.content) ----------
export interface CoachEnvelope {
  reply: string;
  kind: "chat" | "exam" | "drill" | "report" | "result";
  corrections: Correction[];
  fa_note: string;
  skill?: { id: string; name_en: string; name_fa: string; icon: string };
  exam?: Exam;
  drill?: Drill;
  report?: DeepLevelReport | DiagnosisReport | ForecastReport | PlanReport;
  result?: {
    title: string;
    score: number;
    total: number;
    percent: number;
    band: string;
    items: ExamItemResult[];
    strengths: string[];
    weaknesses: string[];
    leaks: { trap: string; note: string; fa: string }[];
    next_action: string;
    write_eval?: { score: number; note: string; fa: string } | null;
    dimensions?: { vocabulary: number; grammar: number; reading: number; writing: number } | null;
    runId?: number;
  };
  /** app-control plugin actions the coach executed (theme, backdrop, layout) */
  actions?: import("./plugins").AppAction[];
}
