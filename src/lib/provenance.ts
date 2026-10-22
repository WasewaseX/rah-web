// Task 79 — evidence-backed reference (audit feature #8): provenance of every
// card's example/definition, surfaced where the learner reads it.
//
// The audit's boundary: "cards carry definitions/examples/audio; provenance of
// examples not yet surfaced." This seam makes the origin explicit and honest:
//
//   - "exam:" / "listen:" cards are DERIVED from the learner's own mistake
//     families (the coach mined them from real misses) — the evidence chain
//     is the point, so the label says so.
//   - "mat:" cards are extracted from material the learner added — the exact
//     source sentence ships ON the card (materialToCard maps context -> en).
//   - everything else is the authored course bank (v1) — reviewed content,
//     not generated at read time.
//
// Pure and client-safe: the Review card faces call it directly.

export interface Provenance {
  label: string;
  detail: string;
}

export function provenanceOf(cardId: string): Provenance {
  if (cardId.startsWith("exam:") || cardId.startsWith("listen:")) {
    return {
      label: "from your own misses",
      detail: "coach-mined from your graded mistakes — the evidence quote lives in Mind Reader",
    };
  }
  if (cardId.startsWith("mat:")) {
    return {
      label: "from your material",
      detail: "extracted from text you added — the card's sentence is the exact source line",
    };
  }
  return {
    label: "Rah course bank (v1)",
    detail: "authored course content — reviewed, not generated at read time",
  };
}
