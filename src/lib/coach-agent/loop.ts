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
import { TOOLS, toolByName, ensureWorkspace, type ToolResult } from "./tools";
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
2. If a tool fails, fix the inputs and retry (different args, different approach). Do not give up after one failure.
3. Workspace file paths are RELATIVE (e.g. "plan.md", "drills/week1.csv"). The sandbox rejects anything outside it.
4. commands (client actions) you may include in the final object:
   {"type":"navigate","view":"home|review|write|speak|listen|read|placement|arcade|progress"}
   {"type":"refresh"}  {"type":"start_review"}  {"type":"open_placement"}
   {"type":"toast","title":"...","desc":"..."}
   Use them when the answer is an ACTION the learner should take (e.g. navigate to review when reviews are due).
5. reply is spoken to the learner: warm, direct, no meta-talk about tools or JSON. Mention artifacts you created by name ("I wrote week-1-plan.md").
6. The learner's app language is English; they are learning English at ${"their"} measured level. Stay on mission: measurable progress to C1.
7. Never invent tool results. Never fake file contents. If you did not run it, you do not know it.`;
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

function extractTurn(raw: string): TurnDecision {
  const cleaned = raw.trim().replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const body = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(body) as TurnDecision;
  } catch {
    // Non-JSON reply: treat the whole text as a final answer rather than failing the turn.
    return { final: true, reply: cleaned.slice(0, 2000), corrections: [], commands: [] };
  }
}

export async function runAgent(
  message: string,
  history: { role: string; content: string }[],
  profile?: ProfileJson,
  emit?: (e: AgentEvent) => void,
): Promise<AgentTurn> {
  const p = profile ?? (await (await import("@/lib/server")).buildProfile());
  const steps: { label: string; detail?: string; ok?: boolean }[] = [];
  const toolsUsed: string[] = [];
  const push = (e: AgentEvent) => emit?.(e);

  await ensureWorkspace();

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt() },
    ...history.slice(-8),
    {
      role: "user",
      content: `${message}\n\n[live context] level=${p.level} streak=${p.streak} due=${p.due} focus=${p.focus} traps=${p.recentTraps.join(",") || "none"}`,
    },
  ];

  const zai = await ZAI.create();

  for (let step = 0; step < MAX_STEPS; step++) {
    let raw: string;
    try {
      const res = await zai.chat.completions.create({ messages } as never);
      raw = String(res?.choices?.[0]?.message?.content ?? "");
    } catch (e) {
      push({ type: "error", label: "Model unreachable", detail: (e as Error).message });
      return {
        reply: "The model is unreachable right now (quota or network). Your message stands; try again in a moment.",
        corrections: [],
        commands: [],
        steps,
        toolsUsed,
      };
    }

    const turn = extractTurn(raw);
    const thought = turn.thought ?? "";

    if (turn.final || !turn.tool) {
      const reply = String(turn.reply ?? "").trim() || "I ran out of useful moves; rephrase and I will take another run at it.";
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

    toolsUsed.push(def.name);
    push({ type: "tool", label: def.name, detail: thought || def.desc.slice(0, 80) });
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
      content: `[tool result] ${def.name}\nok=${result.ok}\n${result.detail ?? result.summary}\n\nContinue with the protocol: another tool call, or the final object.`,
    });
  }

  // Step budget exhausted: force the close.
  push({ type: "error", label: "Step budget spent" });
  messages.push({
    role: "user",
    content: 'Step budget exhausted. Emit the final object NOW: {"thought":"...","final":true,"reply":"...","corrections":[],"commands":[]}',
  });
  try {
    const res = await zai.chat.completions.create({ messages } as never);
    const turn = extractTurn(String(res?.choices?.[0]?.message?.content ?? ""));
    const reply = String(turn.reply ?? "").trim() || "I ran my step budget before finishing; ask me to continue and I will pick up where I left off.";
    push({ type: "final", reply, commands: turn.commands ?? [] });
    return { reply, corrections: Array.isArray(turn.corrections) ? turn.corrections : [], commands: Array.isArray(turn.commands) ? turn.commands : [], steps, toolsUsed };
  } catch {
    return {
      reply: "I hit the step budget and the model went quiet. The work so far is in my step trace; ask again and I will resume.",
      corrections: [],
      commands: [],
      steps,
      toolsUsed,
    };
  }
}
