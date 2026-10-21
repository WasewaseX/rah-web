// Degraded-result honesty (audit P1-7, close-out): when the model provider is
// unreachable or unparseable, a route may serve a DETERMINISTIC fallback - but
// the learner must always see that the result was not AI-produced. A fallback
// is never presented as equivalent to a real model answer. These helpers are
// pure and battery-pinned: the honest path is tested, not hoped for.

export interface DegradedBrief {
  priority: string;
  plan: string[];
  pep: string;
  degraded: true;
  degradedNotice: string;
}

const PERSONA_PEP: Record<string, string> = {
  mentor: "The plan is set. Go earn the version of you that speaks C1.",
  drill: "No excuses. Open Review and move.",
  zen: "One card at a time. The streak follows the effort, not the reverse.",
};

// Worded from the ENGINE's plan (nextBestActions) - the AI Director's job was
// only ever to re-voice it, so an offline Director can still hand the learner
// their real moves, clearly labeled as engine-built.
export function fallbackBrief(enginePlan: string[], persona?: string): DegradedBrief {
  const pep = PERSONA_PEP[persona ?? ""] ?? PERSONA_PEP.mentor;
  if (enginePlan.length === 0) {
    return {
      priority: "Clear your due reviews - that always moves your English.",
      plan: [
        "Open Review and work through today's due cards.",
        "Write one short paragraph in Writing to keep production honest.",
        "Speak for two minutes on any Speak prompt.",
      ],
      pep,
      degraded: true,
      degradedNotice: "The AI Director is unreachable right now, so this plan was built by the engine that decides your moves anyway. Tap Re-brief when the AI is back for the voiced version.",
    };
  }
  const moves = enginePlan.slice(0, 3).map((m) => m.replace(/\s*\(.*?\)\s*$/, "").trim());
  while (moves.length < 3) {
    moves.push(["Open Review and clear your due cards.", "Write one paragraph in Writing.", "Speak for two minutes on any prompt."][moves.length]);
  }
  return {
    priority: moves[0],
    plan: moves,
    pep,
    degraded: true,
    degradedNotice: "The AI Director is unreachable right now, so this plan was built by the engine that decides your moves anyway. Tap Re-brief when the AI is back for the voiced version.",
  };
}

// In-scene placeholder for the Talk conversation partner: the line must stay
// speakable and plausible inside almost any scene (connection trouble), while
// the UI banner carries the precise, honest explanation.
export const DEGRADED_CONVERSATION_LINE = "Sorry, could you say that once more? The connection broke for a second.";

export interface DegradedTurn {
  degraded: true;
  degradedNotice: string;
}

export function degradedTurnPayload(): DegradedTurn {
  return {
    degraded: true,
    degradedNotice: "The AI scene partner dropped mid-scene, so this reply is a placeholder. Your progress and corrections for this turn are honest - the partner returns on your next message.",
  };
}
