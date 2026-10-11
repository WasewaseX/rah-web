// Orchestration bus: lets any surface hand the coach its next move.
// Placement results, exam cards, progress cards - all can queue a command;
// the chat view consumes it (on mount and on the rah:pendingCommand event)
// and runs it as a normal user turn. Exactly-once consumption is guaranteed
// by takeCoachCommand removing the item before anything else happens.

const KEY = "rah.pendingCommand";
export const BUS_EVENT = "rah:pendingCommand";

export function handCoach(command: string): void {
  if (!command.trim()) return;
  sessionStorage.setItem(KEY, command.trim());
  window.dispatchEvent(new Event(BUS_EVENT));
}

export function takeCoachCommand(): string | null {
  const cmd = sessionStorage.getItem(KEY);
  if (cmd) sessionStorage.removeItem(KEY);
  return cmd;
}
