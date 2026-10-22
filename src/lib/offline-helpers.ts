// Small side effects for the offline outbox (kept out of offline.ts so the
// outbox module stays dependency-free and testable). The optimistic XP hint
// matches what the grade route will pay (10 good/easy, 5 again/hard) - the
// server stays the source of truth; the hint only keeps the offline session
// feeling continuous, and the reconnect flush reconciles the real numbers.

export function awardLocalXpHint(grade: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("rah-offline-xp");
    const cur = raw ? Number(raw) : 0;
    window.localStorage.setItem("rah-offline-xp", String(cur + (grade >= 3 ? 10 : 5)));
  } catch {
    // hint only; never a correctness dependency
  }
}

export function takeLocalXpHint(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = Number(window.localStorage.getItem("rah-offline-xp") ?? "0");
    window.localStorage.removeItem("rah-offline-xp");
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
