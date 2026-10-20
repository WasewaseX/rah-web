// The agent loop. This is NOT a chat interface: it is a multi-step executor.
// Turn protocol (JSON, same contract pattern as every other AI surface in Rah):
//   { "thought": "...", "tool": "<name>", "args": {...} }   -> one tool call, then observe
//   { "thought": "...", "final": true, "reply": "...",      -> done; reply + client commands
//     "corrections": [...], "commands": [...] }
// Commands are what make the sidebar able to "access anything, show anything":
// the client executes them on every tab - navigate, refresh state, open views, toast.
// Hard cap MAX_STEPS keeps a runaway model from burning the quota; every event
// streams to the sidebar as it happens.

import ZAI from "z-ai-web-dev-sdk";
import { TOOLS, toolByName, ensureWorkspace, toolTier, TIER_BUDGETS, type ToolResult } from "./tools";
import type { ProfileJson } from "@/lib/ai";

export const MAX_STEPS = 6;

export interface AgentCommand {
  type: "navigate" | "refresh" | "toast" | "open_placement" | "start_review";
  view?: string;
  title?: string;
  desc?: string;
}

export interface AgentEvent {
  type: "thought" | "tool" | "observe" | "final" | "error" | "done";
  label?: string;
  detail?: string;
  ok?: boolean;
  reply?: string;
  corrections?: { wrong: string; right: string; trap?: string }[];
  commands?: AgentCommand[];
  stepsUsed?: number;
}

export interface AgentTurn {
  reply: string;
  corrections: { wrong: string; right: string; trap?: string }[];
  commands: AgentCommand[];
  steps: { label: string; detail?: string; ok?: boolean }[];
  toolsUsed: string[];
  stopped?: boolean;
}

// Review feature #15: the graceful close when the learner stops a run. Pure
// (exported for the battery): the reply always names what WAS done and never
// pretends the task completed.
export function stoppedReply(steps: { label: string; ok?: boolean }[]): string {
  const done = steps.map((s) => s.label).filter((l) => l && !l.startsWith("Mode:") && !l.startsWith("Unknown"));
  if (done.length === 0) {
    return "Stopped before I got going - nothing was done yet. Send another message whenever you want me back on it.";
  }
  return `Stopped, as you asked. Completed before the stop: ${done.join(", ")}. Nothing beyond that ran; your message stands whenever you want the rest done.`;
}

function systemPrompt(): string {
  const toolLines = TOOLS.map((t) => `- ${t.name}: ${t.desc}\n  args example: ${t.args}`).join("\n");
  return `You are Rah's coach: an agent embedded in a language-learning app, running inside a sidebar visible on every tab. You are NOT a plain chatbot - you ACT: you call tools, chain multiple steps, and only then answer.

TOOLS (call them by emitting the JSON turn object):
${toolLines}

TURN PROTOCOL - every reply you produce must be EXACTLY one JSON object, no prose around it:
{"thought": "why", "tool": "<tool_name>", "args": {...}}
or, when you have everything you need:
{"thought": "why", "final": true, "reply": "the answer to the learner", "corrections": [], "commands": []}

RULES:
1. Multi-step is expected: read_state before data-dependent advice; write_file + run_js for anything computational; web_search/page_reader for current facts. Chain tools across steps; one tool per turn.
   MANDATORY: any question about the learner's level, streak, XP, gems, reviews, mistakes, progress, or "what should I do" REQUIRES read_state (and, when acting on it, a follow-up tool) BEFORE your final answer. Answering such questions without a tool call is a protocol violation - the [live context] hint is NOT enough.
   EXCEPT "which tab am I / where am I": the [live context] line carries current_view - the tab the learner is on RIGHT NOW. Answer that from current_view directly (final, no tools). NEVER call page_reader or web_search for anything about the app itself - they are for the outside web only.
   [current screen]: when the [live context] carries a current_screen JSON block, it is the EXACT exercise the learner is looking at (prompt, correct answer, what they typed). Questions like "what is the answer", "why can't I answer", "explain this one" are answered from that block - NEVER ask the learner to paste the question. If they have not answered yet (revealed=false), first push retrieval with one hint or a guiding question, then give the answer and the why; if it is already revealed, explain the why directly.
2. If a tool fails, fix the inputs and retry (different args, different approach). Do not give up after one failure.
3. Workspace file paths are RELATIVE (e.g. "plan.md", "drills/week1.csv"). The sandbox rejects anything outside it.
4. commands (client actions) you may include in the final object:
   {"type":"navigate","view":"home|review|write|speak|listen|read|placement|arcade|progress"}
   {"type":"refresh"}  {"type":"start_review"}  {"type":"open_placement"}
   {"type":"toast","title":"...","desc":"..."}
   Use them when the answer is an ACTION the learner should take (e.g. navigate to review when reviews are due).
5. Deliverables: anything you write with write_file or make_pdf instantly appears in the learner's Workspace panel in this sidebar - name the file in your final reply so they know it is there. Requests for a PDF use make_pdf (a real renderer); NEVER say you cannot produce PDFs.
6. reply is spoken to the learner: warm, direct, no meta-talk about tools or JSON. Mention artifacts you created by name ("I wrote week-1-plan.md").
7. The learner's app language is English; they are learning English at their measured level. Stay on mission: measurable progress to C1.
8. Never invent tool results. Never fake file contents. If you did not run it, you do not know it.
9. STUDY MODE - how you teach, every explanation (screen-related or not):
   (1) DIAGNOSE first: quote what the learner typed/picked (current_screen, or their own words) and name the misunderstanding behind it ("You picked X - you are treating the team as many individuals").
   (2) STEPWISE: 2-4 short numbered steps, one idea each, no walls of text.
   (3) CHECK: end with ONE question that PROVES understanding (never "does that make sense?" - e.g. "So which verb: 'The committee ___ meet on Fridays'?").
   Guide toward understanding instead of merely producing an answer. This never waives rule 1: state questions still require read_state FIRST, even if history already holds a similar answer - state changes between asks.`;
}

interface TurnDecision {
  thought?: string;
  tool?: string;
  args?: Record<string, unknown>;
  final?: boolean;
  reply?: string;
  corrections?: { wrong: string; right: string; trap?: string }[];
  commands?: AgentCommand[];
}

// ---------- JSON repair: the model's #1 failure mode is a broken turn object ----------

function tryParse(s: string): TurnDecision | null {
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as TurnDecision) : null;
  } catch {
    return null;
  }
}

// String-aware scanner: finds the first COMPLETE top-level object, or repairs
// trailing-unbalanced braces by closing the open stack. Handles quotes/escapes.
function salvageObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      const open = stack.pop();
      if (!open || (open === "{" && c !== "}") || (open === "[" && c !== "]")) return null; // mismatched: unrepairable
      if (stack.length === 0) return s.slice(start, i + 1); // first complete object
    }
  }
  if (inStr) return null; // dangling string: unrepairable
  if (stack.length && stack[0] !== "{") return null;
  let out = s.slice(start);
  while (stack.length) out += stack.pop() === "{" ? "}" : "]"; // close what the model left open
  return out;
}

// Balanced-scan salvage for "args": { ... } even when the envelope is mangled.
function salvageArgs(s: string): Record<string, unknown> | null {
  const m = s.match(/"args"\s*:\s*/);
  if (!m || m.index === undefined) return null;
  const obj = salvageObject(s.slice(m.index + m[0].length));
  if (!obj) return null;
  const parsed = tryParse(obj);
  return (parsed?.args as Record<string, unknown>) ?? null;
}

function salvageString(s: string, key: string): string | null {
  const m = s.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"));
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
}

const looksLikeJson = (s: string) => /^\s*\{[\s\S]*"(thought|tool|final|reply|args)"[\s\S]*\}?\s*$/.test(s);

// Exported for the drive battery: the repair logic is exactly what used to
// leak raw JSON into the learner's chat, so the battery pins it.
export function extractTurn(raw: string): { turn: TurnDecision; kind: "json" | "prose" | "junk" } {
  const cleaned = raw.trim().replace(/```(?:json)?/g, "").trim();
  if (!cleaned) return { turn: {}, kind: "junk" };

  const start = cleaned.indexOf("{");
  if (start === -1) {
    // Prose without any braces: an acceptable final answer.
    return { turn: { final: true, reply: cleaned.slice(0, 2000), corrections: [], commands: [] }, kind: "prose" };
  }

  const body = cleaned.slice(start);
  let turn = tryParse(body) ?? tryParse(salvageObject(body) ?? "");
  if (turn) return { turn, kind: "json" };

  // Mangled JSON: salvage the pieces. A tool call must NEVER leak to the learner.
  const toolM = body.match(/"tool"\s*:\s*"([a-zA-Z_]+)"/);
  if (toolM) {
    const args = salvageArgs(body) ?? {};
    return { turn: { thought: salvageString(body, "thought") ?? "", tool: toolM[1], args }, kind: "json" };
  }
  const reply = salvageString(body, "reply");
  if (reply) {
    return { turn: { final: true, reply, corrections: [], commands: [] }, kind: "json" };
  }
  // JSON-shaped garbage (e.g. just a thought): junk - the loop nudges the model
  // instead of showing the learner a wall of braces.
  return { turn: {}, kind: looksLikeJson(body) ? "junk" : "prose" };
}

// The [live context] line appended to every learner message. Pure so the
// battery can pin it: the coach must NEVER have to ask the learner what is
// already on their screen.
export function buildLiveContext(
  p: { level: unknown; streak: unknown; due: unknown; focus: unknown; recentTraps: string[] },
  currentView?: string,
  activity?: Record<string, unknown> | null,
): string {
  let line = `[live context] level=${p.level} streak=${p.streak} due=${p.due} focus=${p.focus} traps=${p.recentTraps.join(",") || "none"}`;
  if (currentView) line += ` current_view=${currentView}`;
  if (activity && typeof activity === "object") {
    const slim: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(activity)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) slim[k] = v.slice(0, 8);
      else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") slim[k] = typeof v === "string" ? v.slice(0, 300) : v;
    }
    if (Object.keys(slim).length > 0) line += `\n[current screen] ${JSON.stringify(slim)}`;
  }
  return line;
}

// Last line of defense: a final reply must never BE a turn object.
export function sanitizeReply(reply: string, fallback: string): string {
  const r = reply.trim();
  if (!r) return fallback;
  if (r.startsWith("{") && /"(thought|tool|final|args|reply)"/.test(r)) {
    const inner = extractTurn(r);
    const unwrapped = inner.turn.reply?.trim();
    return unwrapped && !unwrapped.startsWith("{") ? unwrapped : fallback;
  }
  return r.slice(0, 4000);
}

// Model call with 429/quota-aware retries: one hiccup should not kill the turn.
const MODEL_RETRY_DELAYS = [1500, 4000];
async function callModel(
  zai: { chat: { completions: { create: (args: unknown) => Promise<{ choices?: { message?: { content?: string } }[] }> } } },
  messages: { role: string; content: string }[],
  emit?: (e: AgentEvent) => void,
): Promise<string | null> {
  for (let attempt = 0; attempt <= MODEL_RETRY_DELAYS.length; attempt++) {
    try {
      const res = await zai.chat.completions.create({ messages } as never);
      return String(res?.choices?.[0]?.message?.content ?? "");
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      const retriable = /429|rate|quota|temporar|timeout|timed out|502|503|504|529|network|econn|fetch failed|socket/i.test(msg);
      if (attempt < MODEL_RETRY_DELAYS.length && retriable) {
        emit?.({ type: "error", label: `Model hiccup (${attempt + 1}) - retrying`, detail: msg.slice(0, 140) });
        await new Promise((r) => setTimeout(r, MODEL_RETRY_DELAYS[attempt]));
        continue;
      }
      emit?.({ type: "error", label: "Model unreachable", detail: msg.slice(0, 200) });
      return null;
    }
  }
  return null;
}

// Review feature C (the 7.4/10 wave, agent dependability): prompt rules
// alone could not stop the model from answering state questions straight
// from [live context]. The LOOP now enforces the rule deterministically: a
// final answer with zero tool calls on a state-shaped question gets ONE
// server-side nudge that demands read_state, then the run continues. Pure
// and exported for the battery.
export function isStateQuestion(message: string): boolean {
  return /\b(streak|due\b|due count|my level|my xp|gems?\b|review\b.*due|my mistakes|my progress|what should i (do|practice)|how am i doing|read_state)\b/i.test(message);
}

export async function runAgent(
  message: string,
  history: { role: string; content: string }[],
  profile?: ProfileJson,
  emit?: (e: AgentEvent) => void,
  currentView?: string,
  activity?: Record<string, unknown> | null,
  signal?: AbortSignal,
): Promise<AgentTurn> {
  const p = profile ?? (await (await import("@/lib/server")).buildProfile());
  const steps: { label: string; detail?: string; ok?: boolean }[] = [];
  const toolsUsed: string[] = [];
  const tierBudgetUse: Partial<Record<string, number>> = {};
  const push = (e: AgentEvent) => emit?.(e);

  await ensureWorkspace();

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt() },
    ...history.slice(-8),
    {
      role: "user",
      content: `${message}\n\n${buildLiveContext(p, currentView, activity)}`,
    },
  ];

  const zai = (await ZAI.create()) as unknown as Parameters<typeof callModel>[0];

  const UNREACHABLE = "The model is unreachable right now (quota or network). Your message stands; try again in a moment.";
  let nudges = 0; // thought-only / junk turns: feed the model back on track instead of dead-ending
  let stateEnforced = 0; // read_state enforcement: one deterministic retry per run

  for (let step = 0; step < MAX_STEPS; step++) {
    // Review feature #15 (the 7.4/10 wave): the learner can STOP a long run.
    // The check sits between steps - the current model call finishes (it is
    // already in flight), then the loop exits and closes gracefully from
    // whatever work was actually done. The turn still persists.
    if (signal?.aborted) {
      push({ type: "error", label: "Stopped by learner" });
      return { reply: stoppedReply(steps), corrections: [], commands: [], steps, toolsUsed, stopped: true };
    }
    const raw = await callModel(zai, messages, push);
    if (raw === null) {
      return { reply: UNREACHABLE, corrections: [], commands: [], steps, toolsUsed };
    }

    const { turn, kind } = extractTurn(raw);
    const thought = turn.thought ?? "";

    // Thought-only / JSON junk: NOT a final answer. Nudge the model back on
    // protocol (max twice) instead of showing the learner "no output".
    if (!turn.final && !turn.tool && kind !== "prose") {
      if (nudges < 2 && step < MAX_STEPS - 1) {
        nudges += 1;
        push({ type: "error", label: "Unclear step - re-running", ok: false });
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: 'That was not a valid turn (a thought without a tool call and without final:true). Answer with EXACTLY one JSON object: {"thought":"...","tool":"<tool>","args":{...}} to act, or {"thought":"...","final":true,"reply":"...","corrections":[],"commands":[]} to answer the learner directly.',
        });
        continue;
      }
      // Nudge budget spent: close from whatever the model DID say.
      const reply = sanitizeReply(thought || raw, "I could not form a clean answer that time. Send it again and I will take another run.");
      push({ type: "final", reply, commands: [] });
      return { reply, corrections: [], commands: [], steps, toolsUsed };
    }

    if (turn.final || !turn.tool) {
      // The MANDATORY read_state rule, enforced in code: a state-shaped
      // question answered with zero tool calls gets one nudge, then the run
      // continues and the model re-answers from real data.
      if (turn.final && toolsUsed.length === 0 && stateEnforced < 1 && step < MAX_STEPS - 2 && isStateQuestion(message)) {
        stateEnforced = 1;
        push({ type: "error", label: "State question needs read_state - enforcing", ok: false });
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content:
            'That was a state question and you answered it WITHOUT calling read_state - a protocol violation. First call read_state now: {"thought":"...","tool":"read_state","args":{}}. Then, with its result, emit your final object.',
        });
        continue;
      }
      const reply = sanitizeReply(String(turn.reply ?? ""), "I ran out of useful moves; rephrase and I will take another run at it.");
      push({ type: "final", reply, commands: turn.commands ?? [] });
      return {
        reply,
        corrections: Array.isArray(turn.corrections) ? turn.corrections : [],
        commands: Array.isArray(turn.commands) ? turn.commands : [],
        steps,
        toolsUsed,
      };
    }

    const def = toolByName(String(turn.tool));
    if (!def) {
      steps.push({ label: `Unknown tool: ${turn.tool}`, ok: false });
      push({ type: "observe", label: `Unknown tool: ${turn.tool}`, ok: false });
      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: `Tool "${turn.tool}" does not exist. Valid tools: ${TOOLS.map((t) => t.name).join(", ")}. Continue.` });
      continue;
    }

    // Permission matrix (P1-8): tier-tag the trace and enforce per-run budgets
    // on the dangerous tiers. A refused call never executes.
    const tier = toolTier(def.name);
    const budget = TIER_BUDGETS[tier];
    const used = tierBudgetUse[tier] ?? 0;
    if (budget !== undefined && used >= budget) {
      steps.push({ label: `${def.name} - tier budget spent`, detail: `${tier} tier already used ${used}/${budget} this run`, ok: false });
      push({ type: "observe", label: `${def.name} refused: ${tier}-tier budget spent (${used}/${budget} this run)`, ok: false });
      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: `Tool "${def.name}" (${tier} tier) is refused: the per-run budget of ${budget} ${tier} calls is spent. Emit the final object now.` });
      continue;
    }
    if (budget !== undefined) tierBudgetUse[tier] = used + 1;

    toolsUsed.push(def.name);
    push({ type: "tool", label: def.name, detail: `${thought || def.desc.slice(0, 80)}` });
    steps.push({ label: def.name, detail: thought });

    let result: ToolResult;
    try {
      result = await def.run(turn.args ?? {});
    } catch (e) {
      result = { ok: false, summary: `Tool threw: ${(e as Error).message}` };
    }
    steps[steps.length - 1] = { label: def.name, detail: result.summary, ok: result.ok };
    push({ type: "observe", label: result.summary, detail: result.detail?.slice(0, 300), ok: result.ok });

    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `[tool result] ${def.name} [tier: ${tier}]\nok=${result.ok}\n${result.detail ?? result.summary}\n\nContinue with the protocol: another tool call, or the final object.`,
    });
  }

  // Step budget exhausted: force the close.
  push({ type: "error", label: "Step budget spent" });
  messages.push({
    role: "user",
    content: 'Step budget exhausted. Emit the final object NOW: {"thought":"...","final":true,"reply":"...","corrections":[],"commands":[]}',
  });
  const raw = await callModel(zai, messages, push);
  if (raw === null) {
    return {
      reply: "I hit the step budget and the model went quiet. The work so far is in my step trace; ask again and I will resume.",
      corrections: [],
      commands: [],
      steps,
      toolsUsed,
    };
  }
  const { turn } = extractTurn(raw);
  const reply = sanitizeReply(
    String(turn.reply ?? "") || (turn.thought ?? ""),
    "I ran my step budget before finishing; ask me to continue and I will pick up where I left off.",
  );
  push({ type: "final", reply, commands: turn.commands ?? [] });
  return { reply, corrections: Array.isArray(turn.corrections) ? turn.corrections : [], commands: Array.isArray(turn.commands) ? turn.commands : [], steps, toolsUsed };
}
