// The learner's CURRENT screen activity, as a tiny module-level store.
// Why not props: Review.tsx owns its question state deep in the tree; the
// coach sidebar sits beside every view. Threading one more prop through App
// for every future surface is churn - a store keeps both sides dumb.
// Review (and any future surface) writes on every state change and clears on
// unmount; the sidebar reads ONCE at send time and view-gates it, so a stale
// activity can never ride along after the learner switches tabs.

export interface CoachActivity {
  surface: string; // "review" | future surfaces
  dir?: string; // review direction (cloze/bank/mcq_fa/...)
  prompt?: string; // the exact question text the learner is looking at
  answer?: string; // the correct answer for THIS direction
  en?: string; // English phrase of the card
  fa?: string; // Farsi phrase of the card
  note?: string; // the card's teaching note
  choices?: string[]; // mcq options when present
  tiles?: string[]; // word-bank tray when present
  typed?: string; // what the learner has typed / picked / built so far
  revealed?: boolean; // whether the answer is already on screen
}

let current: CoachActivity | null = null;

export function setCoachActivity(a: CoachActivity | null): void {
  current = a;
}

export function getCoachActivity(): CoachActivity | null {
  return current;
}
