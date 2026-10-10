# Rah v2.0.0 — The Agent Release

## Coach is now an agent

The coach is no longer a single-shot chatbot. Every message becomes a run:

1. **Plan** — a planner reads the request and the skill catalog and builds 1–3 ordered steps. Typos and slash commands carry intent: "genrate an exam" is understood as an exam request, never corrected as English.
2. **Execute** — skills run in order, streaming live progress into the chat as a timeline you can watch.
3. **Compose** — the coach writes its turn over the real tool output, and structured artifacts (exam cards, assessment panels, drills, themes) attach to the reply.

## 23 executable skills

| Area | Skills |
|------|--------|
| Assessment | `analyze_level` (6 deep probes + overall merge), `read_profile`, `progress_report` |
| Exams | `generate_exam` (with grading contract), `exam_history` |
| Practice | `make_drill`, `make_reading`, `make_listening`, `make_writing_prompt`, `make_speaking_prompt`, `grade_writing_inline` |
| Language | `explain_rule`, `compare_forms`, `lookup_word`, `add_vocab_cards` |
| Planning | `review_plan`, `coach_plan`, `set_goal`, `get_goal`, `suggest_next`, `streak_status`, `motivate` |
| App control | `set_theme` (7 presets + custom hex, applied live) |

## Exams that grade like a human

- **Accepted alternatives are part of the exam contract.** The generator must list real synonyms ("expand" accepts "broaden", "extend"); the grader honors them.
- **Rewrites are judged by requirement, not string equality.** Must include "take into account"? Any sentence that genuinely uses it passes, even if worded differently. A batched reasoning pass double-checks edge cases.
- **Announced count always equals graded count.** The engine re-stamps question ids and counts after generation.
- Normalization strips punctuation, articles, casing; content-word overlap catches reordered phrases.

## Per-skill assessment

Grammar, vocabulary, writing, speaking, reading, listening — six separate probes with extended thinking, each grounded in real app evidence (writings, transcripts, review logs, corrections, exam scores). Each skill gets its own CEFR band, evidence lines, and a concrete next step. A chief-examiner pass merges one overall band. Stored per skill, shown on Progress, and the learner's level updates to the overall.

## Plugin-based GUI

- Every color in the app is now an RGB-triplet CSS variable (`--c-*`). One skill call repaints the entire UI live — sidebar, bubbles, buttons, charts, focus rings.
- 7 presets (midnight, violet, ocean, forest, sunset, rose, gold) plus custom hex with automatic shade derivation.
- The theme persists server-side and re-applies on load.
- A WebGL aura backdrop (raw WebGL1 shader, no libraries) drifts behind the shell and instantly re-colors with the theme.

## Under the hood

- SSE-streamed agent runs (`/api/chat`), exam grading endpoint (`/api/exam`).
- v2 chat envelopes: scripted-era messages can never re-enter the model's context.
- CI: lint + typecheck + build on every push (`.github/workflows/ci.yml`).
- SQLite via Prisma; new models: `Exam`, `SkillAssessment`, `Setting`.

## Run

```bash
bun install
bun run db:push
bun run dev        # http://localhost:3000
```

Release (PAT via environment only):

```bash
export GH_USER=your-username
export GITHUB_PAT=github_pat_xxx
bash scripts/release.sh
```
