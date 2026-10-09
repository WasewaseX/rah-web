// The agent loop. Route -> skill -> verify. One entry point: runCoach().
// The coach is never unreachable: every failure path still returns an
// envelope, and every envelope the learner sees has passed verification.

import type { CoachEnvelope, SkillContext, StepTrace } from "./types";
import { parseSlash, routeByCommand, routeByTrigger, routeByPlanner } from "./planner";
import { getSkill, REGISTRY } from "./registry";
import { verifyEnvelope } from "./verify";
import { buildProfile } from "@/lib/server";
import { runModeFlow } from "./mode-flow";
import type { ProfileJson } from "@/lib/ai";

export { REGISTRY, getSkill } from "./registry";

function helpEnvelope(): CoachEnvelope {
  const lines = REGISTRY.map((s) => `${s.commands.map((c) => `/${c}`).join(" ")} ${s.name.toLowerCase()}: ${s.oneLiner}`);
  return {
    skill: "chat",
    reply: `Every skill, live right now:\n${lines.join("\n")}\n\nSlash commands route instantly. Plain English works too: I hear what you need and pick.`,
    corrections: [],
    fa_note: "",
    steps: [{ label: "Skills directory", detail: `${REGISTRY.length} skills live` }],
  };
}

function errorEnvelope(msg: string): CoachEnvelope {
  return verifyEnvelope({
    skill: "chat",
    reply: msg,
    corrections: [],
    fa_note: "",
    steps: [{ label: "Recovering", detail: "the turn failed; you still get an answer" }],
  });
}

export async function runCoach(
  text: string,
  history: { role: string; content: string }[],
  profile?: ProfileJson,
): Promise<CoachEnvelope> {
  const p = profile ?? (await buildProfile());
  const steps: StepTrace[] = [];
  const emit = (label: string, detail?: string) => steps.push(detail ? { label, detail } : { label });

  const slash = parseSlash(text);
  if (slash) {
    if (slash.cmd === "skills" || slash.cmd === "help" || slash.cmd === "commands") {
      emit("Skills directory", `${REGISTRY.length} skills live`);
      return { ...helpEnvelope(), steps };
    }
    const routed = routeByCommand(slash.cmd, slash.args);
    if (routed) {
      emit("Slash command", `/${routed.def.commands[0]} -> ${routed.def.name}`);
      const ctx: SkillContext = { text: slash.args || text, args: slash.args, profile: p, history, emit };
      try {
        return verifyEnvelope(await routed.def.run(ctx));
      } catch (e) {
        return errorEnvelope(`That skill hit a snag (${(e as Error).message}). Try once more; the route is already warm.`);
      }
    }
    emit("Unknown command", `/${slash.cmd}`);
    return {
      ...helpEnvelope(),
      reply: `No skill answers to /${slash.cmd}. Here is what does:\n${helpEnvelope().reply}`,
      steps,
    };
  }

  // Deterministic triggers first: zero latency, zero misroutes.
  // But an active conversation mode (roleplay, debate, socratic, daily)
  // IS the turn: it intercepts before skill routing and exits cleanly on
  // "end". Slash commands still win, so /skills works mid-scene.
  const modeTurn = await runModeFlow(text, history, p, emit).catch(() => null);
  if (modeTurn) return verifyEnvelope(modeTurn);

  const triggered = routeByTrigger(text);
  const decision = triggered ?? (await routeByPlanner(text, history));
  if (decision.via === "planner") emit("Planner", `picked ${decision.def.name}`);
  else emit("Routed", decision.def.name);

  const ctx: SkillContext = { text, args: decision.args, profile: p, history, emit };
  try {
    return verifyEnvelope(await decision.def.run(ctx));
  } catch (e) {
    return errorEnvelope(`The ${decision.def.name.toLowerCase()} stalled (${(e as Error).message}). One more try usually lands it.`);
  }
}
