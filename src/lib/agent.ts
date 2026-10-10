// The Rah agent loop. The coach is no longer a single-shot chatbot: every
// message goes through intent routing, optional skill execution (multi-step
// chains), and a verifier that guarantees clean, English-only output.

import { aiJson, tutorSystem, type ProfileJson } from "@/lib/ai";
import { SKILLS, findSkill, skillCatalog, type SkillPayload, type SkillRun, type Skill } from "@/lib/skills";

export interface Correction {
  wrong: string;
  right: string;
  fa: string;
  trap: string;
}

export interface AgentStep {
  skill: string;
  label: string;
  ms: number;
}

export interface AgentOut {
  reply: string;
  corrections: Correction[];
  steps: AgentStep[];
  payload?: SkillPayload;
  skillsUsed: string[];
}

interface TutorEnvelope {
  reply: string;
  corrections?: { wrong?: string; right?: string; fa?: string; trap?: string }[];
  fa_note?: string; // legacy field from old envelopes; ignored
  praised?: boolean;
}

const FA_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

// The verifier: the reply bubble is English-only, always. If the model leaks
// Persian into the reply (it should not; the prompt forbids it), the runs are
// cut before the learner ever sees them.
function enforceEnglish(text: string): string {
  let out = text.replace(FA_RE, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
  if (out.length < 8) {
    // Too much of the sentence was Persian; fall back to a clean English line.
    out = text.replace(/[^\x00-\x7F]/g, "").replace(/\s{2,}/g, " ").trim();
  }
  return out || "Done. Tell me where to go next.";
}

function envelopeFrom(out: TutorEnvelope, fallbackRaw: string): { reply: string; corrections: Correction[] } {
  const reply = enforceEnglish(String(out.reply ?? fallbackRaw ?? "").trim());
  const corrections: Correction[] = (out.corrections ?? [])
    .filter((c) => c && c.wrong && c.right)
    .slice(0, 3)
    .map((c) => ({
      wrong: String(c.wrong),
      right: String(c.right),
      fa: String(c.fa ?? "").trim(),
      trap: String(c.trap ?? "none"),
    }));
  return { reply, corrections };
}

// ---------- intent routing ----------

interface Route {
  kind: "chat" | "skills" | "unknown-skill";
  list?: { skill: Skill; args: string }[];
  asked?: string;
}

function extractThemeArg(text: string): string {
  const hex = text.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b/);
  if (hex) return hex[0];
  const named = text.match(/midnight|emerald|sunset|violet|ocean|rose|gold/);
  if (named) return named[0];
  return "";
}

const INTENTS: { re: RegExp; skill: string; arg?: (m: string) => string }[] = [
  { re: /\b(gen\w*|creat\w*|mak\w*|buil\w*|giv\w*|tak\w*|start|run|want|need|do|get)\b[\s\S]{0,40}\b(exam|test)\b|\bexam\b[\s\S]{0,20}\b(please|now|about|on)\b/i, skill: "exam.generate", arg: (m) => m },
  { re: /\bquiz\s*me\b/i, skill: "exam.generate", arg: (m) => m },
  { re: /\b(quick|fast|rapid|short)\b[\s\S]{0,20}\b(test|check|quiz)\b/i, skill: "exam.quick", arg: () => "" },
  { re: /\b(deep|thorough|full|real|serious|honest)\b[\s\S]{0,30}\b(analy[sz]e|analysis|assessment)\b|\banaly[sz]e\b[\s\S]{0,20}\blevel\b|\bwhat('s| is) my (true|real|actual|current) level\b/i, skill: "level.deep", arg: () => "" },
  { re: /\bassess\b|\bmy levels\b|\bper.?skill\b|\bwhich level\b|\brate my\b/i, skill: "level.assess", arg: () => "" },
  { re: /\bgrammar\b[\s\S]{0,20}\b(drill|practice|practice|exercise)\b|\bdrill\b[\s\S]{0,20}\bgrammar\b/i, skill: "grammar.drill", arg: () => "" },
  { re: /\bcollocations?\b/i, skill: "collocation.drill", arg: (m) => (m.length < 60 ? m : "") },
  { re: /\bvocab(ulary)?\b[\s\S]{0,20}\b(drill|practice|exercise)\b/i, skill: "vocabulary.drill", arg: () => "" },
  { re: /\bspelling\b|\bspell(ing)? (drill|practice|test)\b/i, skill: "spelling.drill", arg: () => "" },
  { re: /\breading\b[\s\S]{0,20}\b(quiz|test|practice)\b|\bquiz\b[\s\S]{0,20}\breading\b/i, skill: "reading.quiz", arg: (m) => m },
  { re: /\blistening\b[\s\S]{0,20}\b(drill|practice|exercise|quiz)\b|\bdrill\b[\s\S]{0,20}\blistening\b/i, skill: "listening.drill", arg: () => "" },
  { re: /\bspeaking\b[\s\S]{0,20}\b(drill|practice|task|exercise)\b|\bspeak\b[\s\S]{0,20}\bfor (2|two) minutes\b/i, skill: "speaking.drill", arg: () => "" },
  { re: /\bwriting\b[\s\S]{0,20}\b(task|prompt|exercise)\b|\bessay (prompt|task|topic)\b/i, skill: "writing.task", arg: () => "" },
  { re: /\btranslat(e|ion)\b[\s\S]{0,20}\b(drill|practice|exercise)\b/i, skill: "translation.drill", arg: () => "" },
  { re: /\brole-?play\b|\bpretend\b|\bscenario\b|\bact as\b/i, skill: "roleplay", arg: (m) => m },
  { re: /\berror anatomy\b|\bdissect\b|\banatom(y|ies) of/i, skill: "explain.error", arg: (m) => m },
  { re: /\bwhat does\b[\s\S]{0,40}\bmean\b|\bmeaning of\b|\blook(ed)? ?up\b/i, skill: "word.lookup", arg: (m) => m.replace(/.*\bwhat does\b/i, "").replace(/\bmean\b.*/i, "").replace(/.*\bmeaning of\b/i, "").trim() },
  { re: /\bstudy plan\b|\bplan my\b|\bplan for (this|next) week\b|\bweekly plan\b/i, skill: "study.plan", arg: () => "" },
  { re: /\bprogress report\b|\bhow am i doing\b|\bmy stats\b/i, skill: "progress.report", arg: () => "" },
  { re: /\bretention\b|\bnew (cards )?per day\b|\bdaily goal\b/i, skill: "review.tune", arg: (m) => m },
  { re: /\b(theme|recolor|colou?r|colou?rs)\b|\bmake\b[\s\S]{0,24}\b(it|the app|everything|the (ui|gui|interface|background|theme))\b|\b(midnight|emerald|sunset|violet|ocean|rose|gold)\b[\s\S]{0,30}\b(theme|app|colou?r|ui|gui|look|background|interface)\b|\b(theme|app|colou?r|ui|gui|look|background|interface)[\s\S]{0,30}\b(midnight|emerald|sunset|violet|ocean|rose|gold)\b/i, skill: "theme.set", arg: extractThemeArg },
  { re: /\b(aurora|waves|particles)\b|\bwebgl\b|\bbackdrop\b|\bbackground effect/i, skill: "gui.effect", arg: (m) => (m.match(/aurora|waves|particles|none/i)?.[0] ?? "") },
  { re: /\bremember (that|this)\b|\bkeep in mind\b/i, skill: "memory.save", arg: (m) => m.replace(/^.*\bremember (that|this)\b:?/i, "").replace(/^.*\bkeep in mind\b:?/i, "").trim() },
  { re: /\bwhat do you remember\b|\bshow (your )?memory\b/i, skill: "memory.show", arg: () => "" },
];

async function route(message: string): Promise<Route> {
  const trimmed = message.trim();

  // 1. Explicit slash invocation always wins.
  if (trimmed.startsWith("/")) {
    const body = trimmed.replace(/^\/+/, "");
    const m = body.match(/^(?:skill\s+)?([\w.]+)\s*([\s\S]*)$/);
    if (m) {
      const args = (m[2] ?? "").trim();
      let skill = findSkill(m[1]);
      if (!skill) {
        // "/skill generate exam": the verb went into m[1], the target into
        // m[2]. Fuzzy-match over the whole command before giving up.
        skill = findSkill(`${m[1]} ${args}`.trim()) ?? findSkill(body);
      }
      if (skill) return { kind: "skills", list: [{ skill, args }] };
      return { kind: "unknown-skill", asked: body };
    }
    return { kind: "unknown-skill", asked: trimmed };
  }

  // 2. Fast intent table: the common asks never need a planner round-trip.
  for (const intent of INTENTS) {
    if (intent.re.test(trimmed)) {
      const skill = findSkill(intent.skill);
      if (skill) return { kind: "skills", list: [{ skill, args: intent.arg ? intent.arg(trimmed) : "" }] };
    }
  }
  return { kind: "chat" };
}

// ---------- planner (fallback for anything the table missed) ----------

interface PlanRaw {
  action: "chat" | "skill" | "chain";
  skill?: string;
  args?: string;
  skills?: { skill: string; args?: string }[];
}

async function planWithAI(message: string): Promise<Route> {
  const catalog = skillCatalog().map((s) => `${s.id}: ${s.blurb}`).join("\n");
  try {
    const plan = await aiJson<PlanRaw>(
      `You are the planner of Rah, an English-learning app. The learner's message arrives. Decide what the app should DO.

Available skills (id: what it does):
${catalog}

Rules:
- "skill": one skill id plus args (args = the part of the message the skill needs, or "").
- "chain": 2 to 3 skills, in execution order, when the message clearly needs several steps.
- "chat": plain coaching conversation. Choose this when the message is just conversation, a question about English, or a request none of the skills cover.
- Do not invent skill ids. Use exactly the ids from the catalog.
Output ONE JSON object, nothing else: {"action": "chat"} or {"action": "skill", "skill": "", "args": ""} or {"action": "chain", "skills": [{"skill": "", "args": ""}]}`,
      [{ role: "user", content: message.slice(0, 500) }],
    );
    if (plan.action === "skill" && plan.skill) {
      const skill = findSkill(plan.skill);
      if (skill) return { kind: "skills", list: [{ skill, args: String(plan.args ?? "") }] };
    }
    if (plan.action === "chain" && Array.isArray(plan.skills)) {
      const list = plan.skills
        .map((s) => ({ skill: findSkill(s.skill), args: String(s.args ?? "") }))
        .filter((s): s is { skill: Skill; args: string } => Boolean(s.skill))
        .slice(0, 3);
      if (list.length) return { kind: "skills", list };
    }
  } catch {
    // Planner down: plain chat is always the safe floor.
  }
  return { kind: "chat" };
}

// ---------- reply synthesis ----------

const SYNTH_SYSTEM = `You are Rah, the English coach inside the app. The skill system just executed real work for the learner (it generated exams, ran analyses, changed the theme, and so on). You write the final human turn.

Write ONE JSON object and nothing else:
{"reply": "your turn, max 85 words", "corrections": [{"wrong": "", "right": "", "fa": "", "trap": ""}], "praised": false}

Rules:
- The reply is ENGLISH ONLY. Farsi is allowed ONLY inside corrections[].fa.
- Reference the executed work naturally: announce an exam with its exact item count and minutes, or name the headline level from an analysis. Never mention systems, internals, planning, or JSON.
- NEVER claim any work happened that is not in the executed list above. If the list is about an exam, talk about the exam only; do not invent extra exams, analyses, or theme changes.
- End with one concrete next step when it helps (start with question 1, tell me your answers, and so on).
- corrections: only real mistakes in the learner's message, 0 to 3 items; empty list if none.
- Never use the em dash character.`;

// ---------- main entry ----------

export async function runAgent(message: string, profile: ProfileJson): Promise<AgentOut> {
  const steps: AgentStep[] = [];
  const routed = await route(message);

  if (routed.kind === "unknown-skill") {
    const top = SKILLS.slice(0, 8).map((s) => `/${s.id}`).join(", ");
    return {
      reply: `There is no skill called "${routed.asked ?? ""}". Real ones you can invoke right now: ${top}. Full list lives one tap above the input.`,
      corrections: [],
      steps: [{ skill: "router", label: "Checked the skill registry", ms: 1 }],
      skillsUsed: [],
    };
  }

  if (routed.kind === "chat") {
    // The planner only wakes up when the fast table found nothing AND the
    // message smells like a capability request. Plain sentences skip it.
    const smellsLikeSkill = /\b(exam|test|quiz|assess|analy|drill|level|theme|color|effect|roleplay|plan|report|remember)\b/i.test(message);
    if (smellsLikeSkill) {
      const planned = await planWithAI(message);
      if (planned.kind === "skills" && planned.list) {
        return execute(planned.list, message, profile, steps, true);
      }
    }
    return chatOnly(message, profile);
  }

  return execute(routed.list ?? [], message, profile, steps, false);
}

async function execute(
  list: { skill: Skill; args: string }[],
  message: string,
  profile: ProfileJson,
  steps: AgentStep[],
  planned: boolean,
): Promise<AgentOut> {
  const runs: SkillRun[] = [];
  const used: string[] = [];
  let payload: SkillPayload | undefined;
  for (const { skill, args } of list.slice(0, 3)) {
    const t0 = Date.now();
    try {
      const run = await skill.run(args, { profile, args });
      const ms = Date.now() - t0;
      runs.push(run);
      used.push(skill.id);
      steps.push({ skill: skill.id, label: run.label, ms });
      if (run.payload) payload = run.payload;
    } catch (e) {
      steps.push({ skill: skill.id, label: `Failed: ${(e as Error).message.slice(0, 60)}`, ms: Date.now() - t0 });
    }
  }

  if (runs.length === 0) {
    return {
      reply: "That skill hit an error while running. Try it once more; if it fails again, say it differently and I will route it manually.",
      corrections: [],
      steps,
      skillsUsed: [],
    };
  }

  const summaries = runs.map((r, i) => `${i + 1}. ${r.label}: ${r.summary}`).join("\n");
  let out: TutorEnvelope;
  try {
    out = await aiJson<TutorEnvelope>(
      SYNTH_SYSTEM,
      [{ role: "user", content: `Learner message: ${message}\n\nExecuted${planned ? " (planner-routed)" : ""}:\n${summaries}` }],
    );
  } catch {
    out = { reply: runs.map((r) => r.label).join(". ") + ". Say the word and I will walk you through it.", corrections: [] };
  }
  const env = envelopeFrom(out, "");
  return { reply: env.reply, corrections: env.corrections, steps, payload, skillsUsed: used };
}

async function chatOnly(message: string, profile: ProfileJson): Promise<AgentOut> {
  const { db } = await import("@/lib/db");
  const history = await db.chatMsg.findMany({ orderBy: { id: "desc" }, take: 14 });
  const aiHistory = history
    .reverse()
    .map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("assistant" as const),
      content: h.role === "user" ? h.content : h.content.slice(0, 900),
    }));
  let raw = "";
  try {
    const out = await aiJson<TutorEnvelope>(tutorSystem(profile), [...aiHistory, { role: "user", content: message }], (r) => {
      raw = r;
      return { reply: r, corrections: [] };
    });
    const env = envelopeFrom(out, raw);
    return { reply: env.reply, corrections: env.corrections, steps: [], skillsUsed: [] };
  } catch (e) {
    throw new Error(`Coach is unreachable right now: ${(e as Error).message}`);
  }
}
