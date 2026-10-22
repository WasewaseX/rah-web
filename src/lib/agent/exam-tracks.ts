// Authentic exam-format tracks (audit P1 curriculum, Task 66).
//
// The learner asked for IELTS/TOEFL/Cambridge practice, not another generic
// quiz. These tracks shape the EXISTING exam engine: task-type mix, rubric
// emphasis, timing and a band reference from the graded percentage.
//
// Honesty rules, same as everywhere in Rah:
//   - These are FORMAT PRACTICE tracks inspired by the publicly documented
//     task types - Rah is not affiliated with IELTS, TOEFL or Cambridge, and
//     every surface that shows a band also says so.
//   - The band is a ROUGH REFERENCE computed from one short practice set
//     (deterministic map from the accuracy percentage), never presented as an
//     official score or a prediction.
//   - No new AI behavior: the same generation pipeline, answerability gate
//     and arbiter run; the track only re-weights what gets asked.

export type TrackId = "ielts" | "toefl" | "c1a";

export interface ExamTrack {
  id: TrackId;
  label: string; // displayed exam flavor
  titlePrefix: string;
  disclaimer: string;
  // Prompt block: task-type mix + rubric emphasis for this format.
  brief: string;
  minutesPerItem: number;
  defaultCount: number;
}

export const EXAM_TRACKS: Record<TrackId, ExamTrack> = {
  ielts: {
    id: "ielts",
    label: "IELTS-style practice",
    titlePrefix: "IELTS-style practice",
    disclaimer: "Format practice inspired by IELTS task types - not affiliated with IELTS, and the band is a rough reference from one short set, never an official score.",
    brief: `EXAM FORMAT - IELTS-style practice:
- Aim the language at IELTS task types: opinion/argument framing (agree-disagree, discuss both views), describing trends and processes, and paraphrase control.
- Rough share: 40% mcq (meaning-in-context and paraphrase recognition), 25% cloze (cohesive devices, collocations, articles), 15% short (forced form: comparative, passive, reported), 20% rewrite (formal register upgrades and sentence transformation, IELTS-writing flavored).
- Vocabulary register: academic-leaning but natural; avoid trivia, avoid idioms whose only content is culture-specific.`,
    minutesPerItem: 1.2,
    defaultCount: 8,
  },
  toefl: {
    id: "toefl",
    label: "TOEFL-style practice",
    titlePrefix: "TOEFL-style practice",
    disclaimer: "Format practice inspired by TOEFL task types - not affiliated with TOEFL/ETS, and the score range is a rough reference from one short set, never an official score.",
    brief: `EXAM FORMAT - TOEFL-style practice:
- Aim the language at TOEFL task types: campus and academic situations, mini-lecture comprehension (always embed the 2-4 sentence mini-text in the item), paraphrasing academic sentences, and precise verb/noun choice.
- Rough share: 40% mcq (academic meaning-in-context, paraphrase), 25% cloze (academic collocations, connectors), 20% short (forced form), 15% rewrite (concise academic rephrasing - same meaning, fewer words).
- Register: neutral-to-formal academic American English is fine, but no US-culture trivia.`,
    minutesPerItem: 1.2,
    defaultCount: 8,
  },
  c1a: {
    id: "c1a",
    label: "Cambridge C1 Advanced-style practice",
    titlePrefix: "C1 Advanced-style practice",
    disclaimer: "Format practice inspired by Cambridge C1 Advanced task types - not affiliated with Cambridge Assessment English, and the grade reference is a rough reference from one short set, never an official result.",
    brief: `EXAM FORMAT - Cambridge C1 Advanced-style practice:
- Aim the language at C1 Advanced task types: key word transformations (rewrite items MUST be key-word transformations: give the exact stem, the prompt word in caps inside the instruction, and require that word in the answer), lexical precision (fixed phrases, dependent prepositions, idiomatic range), and register control.
- Rough share: 30% mcq (lexical precision), 30% cloze (fixed phrases, prepositions, articles), 15% short (word formation - the answer must be a built form like "impressive", "unaware"), 25% rewrite (key word transformations).
- Difficulty rule: distractors and wrong options must be B2-plausible, correct keys C1-precise - the exam should separate strong B2 from real C1.`,
    minutesPerItem: 1.4,
    defaultCount: 6,
  },
};

export function isTrackId(v: unknown): v is TrackId {
  return v === "ielts" || v === "toefl" || v === "c1a";
}

// Deterministic, monotone band reference from the accuracy percentage. Every
// value is a RANGE on purpose: one short practice set cannot honestly pin a
// finer number, and the label next to it says so.
export function bandReference(pct: number, track: TrackId): { band: string; note: string } {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const genericNote = `Rough reference from this ${EXAM_TRACKS[track].label} set (${p}% correct) - not an official score.`;
  if (track === "ielts") {
    const band = p >= 95 ? "8.5-9.0" : p >= 85 ? "8.0" : p >= 75 ? "7.0-7.5" : p >= 65 ? "6.5" : p >= 55 ? "6.0" : p >= 45 ? "5.5" : p >= 35 ? "5.0" : "below 5.0";
    return { band, note: genericNote };
  }
  if (track === "toefl") {
    const band = p >= 95 ? "110-120" : p >= 85 ? "100-109" : p >= 75 ? "90-99" : p >= 65 ? "80-89" : p >= 55 ? "70-79" : p >= 45 ? "60-69" : "below 60";
    return { band, note: genericNote };
  }
  const band = p >= 90 ? "Grade A pressure (200+)" : p >= 80 ? "Grade B range (193-199)" : p >= 70 ? "Grade C range (180-192)" : p >= 60 ? "narrow miss - strong B2" : "below the passing band";
  return { band, note: genericNote };
}

// Prefix the generated title so the flavor is visible everywhere the title
// travels (exam card, replay, chat reply) without trusting the model to name it.
export function trackTitle(rawTitle: string, track: TrackId): string {
  const t = String(rawTitle ?? "").trim() || "Practice set";
  const prefix = EXAM_TRACKS[track].titlePrefix;
  return t.toLowerCase().startsWith(prefix.toLowerCase()) ? t : `${prefix}: ${t}`;
}
