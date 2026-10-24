# SPEAK-RE — Reverse engineering Speak (Speak Method), the Rah way

Written 2026-10-24 (Task 95). Doctrine unchanged: observable workflows and
the vendor's own published method pages only — no proprietary source, no
assets.

## 1. What Speak observably does (verified against speak.com's own method page, their App Store listing, and a published 209-day independent review, 2026-10)

1. **The published method is a three-step loop**: LEARN the phrases native
   speakers actually use in a situation → PRACTICE them until they are
   automatic ("not just memorizing them, but making them natural") → APPLY
   them in a real back-and-forth with the AI tutor, where feedback targets
   "what actually matters" and retrying is free and unlimited.
2. **Phrase-first, not grammar-first**: lessons teach situation-bound
   expressions ("the phrases and patterns native speakers use in real
   situations - not textbook sentences"), so production starts on day one.
3. **Deliberate repetition from multiple angles**: the same phrase is
   repeated-after, produced-from-English, word-swapped, and re-encountered
   in mini-conversations — the independent review's #1 praise is that Speak
   "gives you the repetition you actually need — but never the boring kind."
4. **Improvisation inside a safe frame**: the app teaches a small set of
   expressions and then puts the learner in conversations where they must
   combine them — the reviewer's key moment was improvising "is this seat
   taken?" from partial vocabulary on day two.
5. **Scenario library maps to adult life**: job interviews, reservations,
   colleagues — practice has a stated purpose, not an open-ended chatbot.
6. **Honest weaknesses (from the same independent sources)**: correction
   quality is uneven ("you cannot tell when it is letting a mistake slide"),
   there is no phoneme/accent feedback, and nothing holds the learner
   accountable — gains plateau when stakes-free practice stops transferring.

## 2. What Rah should take: purposeful, progressively harder speaking — not an open chatbot

Rah's Talk mode today is closest to Speak's APPLY step standing alone. The
review's earlier caution and Speak's own structure say the same thing: an
open-ended chatbot is the weakest form of speaking practice. The take-away
architecture:

1. **Bind every Talk session to a goal**: the session starts with a
   situation and a phrase set the learner has ALREADY met in review
   (FSRS-scheduled items), so Apply re-uses Learn/Practice material instead
   of free-associating.
2. **Make the difficulty knob explicit**: session i uses rehearsed phrases
   in the rehearsed order; session i+n shuffles, injects a surprise turn, or
   demands a reformulation — the progression is a parameter, visible to the
   learner, not vibes.
3. **Close each session with a receipt**: which target phrases were
   produced, which were avoided, what the tutor corrected — the same
   evidence-doctrine as the coach agent (tools ran, what changed, what
   failed). Speak's admitted weakness ("you cannot tell when it lets a
   mistake slide") is exactly what Rah's measured-ledger doctrine must
   prevent.
4. **Feed the loop back**: phrases the learner avoided or fumbled in Apply
   become review cards again (mistake memory) — Speak's Smart Review does
   this informally; Rah can do it with the existing FSRS machinery.

## 3. What Rah should explicitly NOT copy

- **Stakes-free-only framing**: Speak's own reviewers note the plateau.
  Rah's pilot measures real outcomes (writing volume, retention), so
  speaking practice must land in the ledger — not just feel good.
- **Language-agnostic chat UX**: Speak spreads across 7+ languages with one
  conversation engine. Rah is a B2–C1 English product with a Farsi-speaking
  learner; the coach's Persian transfer-aware corrections are a differentiator
  to deepen, not dilute.
- **Screenshot-progress gamification without measurement**: Speak markets
  streaks; Rah's gamification stays tied to the measured pilot metrics
  (roadmap polish #8), which is a deliberate divergence.

## 4. Concrete takeaways → backlog mapping

| Speak behavior | Rah surface | Backlog item |
|---|---|---|
| Learn→Practice→Apply loop | review queue + Talk mode | F-5: voice-shadowing mode feeding Talk; T-3: goal-bound Talk sessions |
| Phrase-first teaching | curriculum graph + materials | T-2: expression/collocation cards (multi-word items as first-class review content) |
| Multi-angle repetition | FSRS directions (cloze/reverse/audio…) | T-2's context rotation: same expression, different frames |
| Session receipts | coach agent transparency | polish #4: evidence panel shows what was produced/corrected |
| Avoided-phrase feedback | mistake memory | polish #7: exact evidence for recurring weaknesses |
| Retry without penalty | Talk UX | keep; add honest "retried N times" counters to the ledger |

## 5. Verification note

§1 claims come from Speak's own published method page ("The Speak Method is
a proprietary loop based on three steps…"), their current App Store listing
(the four STEP lines), and the independent 209-day review + 2026 comparison
articles — all cited inline by name. No proprietary material was accessed;
the weaknesses quoted are the independent sources', not ours.

## 6. Implementation plan (Task 96)

The §2 architecture is now fully specified in **`SPEAK-PLAN.md`**: a
versioned scenario library (content-as-code), the Learn/Practice frame
rotation over already-met phrases, the earned D0→D1→D2 difficulty gate with
its exact arithmetic, the round-3 exit receipt contract, and the
fumbled/avoided → mistake-memory/FSRS feedback rules — plus a 10-case
deterministic test plan. Implementation is gated behind the open Part-A P0s
per `TASK-95-BACKLOG.md`; no further research iterations on this doc until
the plan ships.
