// Shared machinery for conversational skills. Every teaching skill composes a
// focus brief on top of the Socratic base prompt and parses the same envelope.

import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import type { CoachEnvelope, SkillContext, StepTrace, Correction } from "./types";

export interface TurnResult {
  reply: string;
  corrections: Correction[];
  fa_note: string;
  praised: boolean;
}

function cleanEmDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ",");
}

function repairJson(body: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of body) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = body;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "").replace(/:\s*$/, ': ""').replace(/,\s*(?=[}\]])/g, "");
  while (stack.length) {
    const open = stack.pop();
    out += open === "{" ? "}" : "]";
  }
  return out;
}

function extractTurn(raw: string): TurnResult {
  const cleaned = cleanEmDash(raw.trim());
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : cleaned;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1) throw new Error("no json");
  const candidate = end > start ? body.slice(start, end + 1) : body.slice(start);
  try {
    return JSON.parse(candidate) as TurnResult;
  } catch {
    return JSON.parse(repairJson(candidate)) as TurnResult;
  }
}

function rawFallback(raw: string): TurnResult {
  return { reply: cleanEmDash(raw.trim().slice(0, 600)), corrections: [], fa_note: "", praised: false };
}

// The Socratic base. Shared by every conversational skill so the teaching
// personality never drifts between views.
export function basePersona(p: ProfileJson): string {
  return `You are Rah, the English coach inside a learning app. The learner's first language is Farsi (Persian) and they sit around ${p.level === "?" ? "B2" : p.level}, working toward C1.

## How you teach
1. Socratic drill. Make the learner produce language before you reveal anything. Answer questions with a question that makes them try first, then confirm.
2. Short turns. reply is at most 80 words and usually ends with a question or a task.
3. Retrieval beats re-reading. Push recall and production: rewrite a sentence, finish a thought, choose between two forms, use a target word. Never accept "I understand" as evidence.
4. Elaborated feedback. Every correction carries a Farsi explanation of WHY the wrong form happens for a Farsi speaker.
5. Push toward C1 markers: collocations over loose pairs, register awareness, hedging and discourse markers, precise verbs, idiomatic but natural phrasing.
6. One focus per turn. Pick the highest value mistake and drill it.

## Farsi interference traps (tag with one when it applies)
articles, countability, plurals, copula, prepositions (dar covers in/at/on), statives, perfect, question_order, adjectives, that_omission, th_sounds, w_v, clusters, ng, stress.

## Output contract
ONE JSON object, nothing else:
{"reply": "English turn, max 80 words", "corrections": [{"wrong": "their exact words", "right": "corrected", "fa": "explanation in Farsi", "trap": "one tag or none"}], "fa_note": "one short Farsi sentence about the correction, empty string if there were no corrections", "praised": false}
corrections: 0 to 3, most important first. fa_note MUST be an empty string when corrections is empty. Never use the em dash character. Never write Farsi inside the reply field, only inside fa and fa_note.`;
}

export function profileBlock(p: ProfileJson): string {
  return JSON.stringify(p);
}

// Run one coach turn for a skill: compose system, call the model, wrap steps.
export async function coachTurn(
  system: string,
  ctx: SkillContext,
  steps: StepTrace[],
  opts?: { thinkingGate?: (p: ProfileJson) => boolean },
): Promise<TurnResult> {
  const history = ctx.history
    .slice(-6)
    .map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("assistant" as const),
      content: h.role === "user" ? h.content : h.content.slice(0, 900),
    }));
  const deep = opts?.thinkingGate ? opts.thinkingGate(ctx.profile) : false;
  const out = await aiJson<TurnResult>(
    `${system}\n\n## Learner profile (live)\n${profileBlock(ctx.profile)}`,
    [...history, { role: "user", content: ctx.text }],
    rawFallback,
    deep,
  );
  return {
    reply: cleanEmDash(String(out.reply ?? "")).trim(),
    corrections: Array.isArray(out.corrections) ? out.corrections.slice(0, 3) : [],
    fa_note: String(out.fa_note ?? "").trim(),
    praised: Boolean(out.praised),
  };
}

export function envelope(
  skill: CoachEnvelope["skill"],
  turn: TurnResult,
  steps: StepTrace[],
  extra?: Partial<CoachEnvelope>,
): CoachEnvelope {
  return {
    skill,
    reply: turn.reply,
    corrections: turn.corrections,
    // No corrections means no Farsi tail: the learner complained about
    // Persian plan lines stapled onto every message. Farsi appears only
    // when there is something to explain.
    fa_note: turn.corrections.length > 0 ? turn.fa_note : "",
    steps,
    praised: turn.praised,
    ...extra,
  };
}
