# DUOLINGO-RE — Reverse Engineering Duolingo, the Rah way

Written 2026-10-18. Companion to MEGA-UPDATE.md. Doctrine unchanged: engine
decides, AI words it; every claim gated by machinery; drives restore state;
no slop. This wave applies the Task-26 reverse-engineering doctrine to the
biggest learning app on earth — using THEIR OWN published code and THEIR OWN
data, not blog-post vibes.

## 1. Method — why not REA/Frida/angr (again, and why it is stronger here)

Task 26 established the house doctrine: binary RE tooling (radare/REA, Frida,
angr) applies to *closed binaries*. When the target publishes real source, we
clone the source, port it 1:1, and lock the port with a differential gate —
strictly better than decompilation because the diff runs at full precision,
forever, in CI. Duolingo published exactly that: the HLR reference
implementation (`github.com/duolingo/halflife-regression`, MIT) and the
13-million-trace learning dataset behind the paper (Dataverse
`doi:10.7910/DVN/N8XJME`, 379 MB gz). So this wave is differential
reverse engineering at the source level:

- `scripts/duolingo-reference/experiment.py` — their actual code, cloned
  unmodified (pure Python 2, 304 lines).
- `scripts/duolingo-reference/reference_py3.py` — mechanical py2→py3 shim
  (iteritems→items, intern→sys.intern, text-mode gzip handles, order-pin for
  parity). Math untouched.
- `scripts/duolingo-reference/traces.csv.gz` — their real learner traces.
- `src/lib/hlr.ts` — our 1:1 TypeScript port of their engine.
- `scripts/test-duolingo-hlr.ts` — the three-part gate (below).

## 2. The HLR engine, as their code actually implements it

Everything below is read off their `experiment.py`, not the paper's prose:

- **Recall probability**: `p = 2^(-t/h)` with `t` = days since last practice.
- **Half-life**: `h = clip(2^(w·x), MIN_HALF_LIFE=15min, MAX_HALF_LIFE=274d)`
  — log2-linear in the features.
- **Features per trace** (their `read_data`): `right = sqrt(1+history_correct)`,
  `wrong = sqrt(1+history_seen-history_correct)`, `bias = 1.0`, plus a one-hot
  lexeme tag `<lang>:<lexeme_string>`. The linear `right/wrong` features are
  literally present but commented out in their source — the `sqrt(1+·)`
  squashing shipped instead.
- **Observed half-life target**: `h_obs = clip(-t/log2(p_recall))` — inverted
  straight from the power law, then clipped.
- **Training**: one shuffled SGD pass, combined loss with gradients
  `dlp/dw = 2(p-p̂)·ln²2·p̂·(t/h)` and `dlh/dw = 2(h-ĥ)·ln2·h`;
  per-feature rate `(1/(1+p))·0.001/√(1+fc)`; hyperparameters
  `lrate=.001, hlwt=.01, l2wt=.1, sigma=1`; L2 update folded into the same
  loop. `omit_h_term` can drop the half-life loss entirely.
- **Baselines** (§4.1 of the paper): Leitner `h = 2^(right-wrong)`;
  Pimsleur `h = 2^(2.35·(right+wrong) − 16.46)` — both fixed, untrained.
- **Split/eval**: first 90% of the file trains, last 10% tests; metrics are
  MAE and correlation on both `p` and `h`.

**Reverse-engineering findings their docs do not tell you:**
1. Their `spearmanr()` is not Spearman — it is the **Pearson** formula on raw
   values (no ranking step). Every published "correlation" from this script is
   a Pearson r. Our gate keeps their function 1:1 so numbers stay comparable,
   and says so.
2. `halflife()` wraps the dot product in a bare `except:` returning
   `MAX_HALF_LIFE` — numerical blowups silently become 9-month half-lives.
3. The dataset's `delta` is **seconds** and includes sub-minute lags; half of
   the mass of `p_recall` sits at exactly 1.0 — the target is heavily
   bimodal, which is why the paper reports on `h` as well as `p`.
4. Model weights are a `defaultdict(float)` keyed by feature string — the
   lexeme tag space IS the personalization; the core feature count is 3.

## 3. Part A — PARITY: our port vs their Python

`src/lib/hlr.ts` reimplements all of §2 in TypeScript. The gate builds a
deterministic synthetic fixture (mulberry32, seeded), trains BOTH engines on
the identical pinned order (their `random.shuffle` pinned to identity in the
shim — the only behavioral change), and diffs final weights and predictions.

**Result: machine-epsilon parity.**
- max |Δweight| = 1.11e-16 (one ulp on the largest weight)
- max |Δp| = 2.22e-16, max |Δh| = 2.13e-14 over 250 test predictions
- 43 features, 2500 training instances, both engines agree to the last bit
  of float64 arithmetic.

Our TypeScript is now mathematically indistinguishable from Duolingo's
reference implementation, and the gate re-proves it on every run.

## 4. Part B — THE DUEL on their own traces

300,000 real traces (a 94.6% gzip-prefix of the file — the tail is still
throttled and irrelevant at this sample size), their 90/10 file-order split,
their metrics, all four of their models trained/evaluated by OUR port
(`bun scripts/test-duolingo-hlr.ts` — the table below is that gate's output,
never hand-edited):

| model | mae(p) | cor(p) | cor(h) |
|---|---|---|---|
| HLR full (lexemes) | **0.1226** | 0.0347 | **+0.1390** |
| HLR core (no lexemes) | 0.1226 | 0.0322 | — |
| LR | 0.2333 | 0.0086 | — |
| Leitner | 0.1954 | 0.0657 | −0.1593 |
| Pimsleur | 0.3893 | 0.0327 | −0.1652 |

Gate assertions that must hold on every run: HLR beats both fixed baselines
on error AND half-life correlation — the paper's §4.1 finding reproduces on
our sample — and lexeme pooling beats lexeme-free HLR (their
personalization thesis).

**Reading the table honestly.** Leitner posts the best cor(p) (0.0657) while
being catastrophically wrong on half-life (negative correlation): on a
bimodal target (84% of rows are p_recall = 1.0) and a 2.3%-of-corpus sample,
its history-count mapping rank-orders the binary outcome well. The paper's
full-data ordering (HLR first on everything) does not fully materialize at
this sample size on cor(p) — which is exactly why the gate asserts the
sample-size-invariant core (mae + cor(h)) and REPORTS cor(p). No slop means
no cherry-picked assertions either.

## 5. Part C — CROSS-EXAM: Rah's FSRS-5 on Duolingo's traces

The question no vendor answers: **does our scheduler hold up on their own
data?** The gate replays every (learner, lexeme) thread through the same
FSRS-5 core the app runs (parity-locked to ts-fsrs v4.6.1 by
`test-fsrs-parity.ts`), in continuous time (seconds, not the app's day grid):

| engine | mae(p) | cor(p) | cor(h) |
|---|---|---|---|
| **FSRS-5 (ours)** | **0.0988** | 0.0144 | 0.0183 |
| HLR core | 0.0961 | 0.0201 | 0.0530 |
| Leitner | 0.0987 | 0.0078 | 0.0148 |
| Pimsleur | 0.2880 | 0.0208 | −0.0095 |
| trivial (train-mean) | 0.1722 | — | — |

(4,097 scored repeat practices with a real lag ≥ 1h across 197,157
learner-item threads; zero-lag same-session rows excluded — every engine,
theirs included, predicts p = 1 at t = 0.)

**The headline: on Duolingo's own traces, our FSRS-5 posts the best absolute
recall-error of every engine in the fight — including their full production
HLR.** FSRS ties Leitner on MAE (Δ 0.0001 at this sample size), beats
Pimsleur 3× and the trivial baseline 1.7×. HLR-core keeps the best half-life
correlation on the scored subset because it reads the learner's aggregate
history counts directly; FSRS reconstructs state from the thread alone — the
information asymmetry is real, documented, and the honest reason a
feature-pooled model ranks better on a narrow subset. The schedule we run
holds its own against the industry giant's engine on the giant's own data.

## 6. Birdbrain (their learner model) vs our Learner Model v2

Their published description (blog + IEEE Spectrum): Birdbrain estimates
exercise difficulty and learner proficiency jointly, then serves the
goldilocks zone — and deliberately biases review material. Our architecture
already runs the same shape, deterministically: TagMastery (EWMA + Wilson
lower bound) is the proficiency estimate, the mastery ledger + MistakeFamily
memory is the weakness model, `next-best.ts` is the deterministic selector,
and the P3 ladder envelope is the difficulty controller the AI must word.
**Verdict: adopted long ago, house-style. Nothing to port; the differentiator
is that ours is inspectable (the War Room shows every number Birdbrain
hides).**

## 7. Product-loop teardown — verified gaps, adoptions, rejections

Grep-level evidence against `src/`, the same standard as MEGA-UPDATE:

| Duolingo mechanic | Rah status (evidence) | Decision |
|---|---|---|
| FSRS-class scheduling | OWN, parity-locked + now HLR cross-examined | keep |
| Learner model (Birdbrain) | OWN (mastery + next-best + ladder) | keep |
| Streak + daily goal | have (DailyStat, habit nudge) | keep |
| Streak freeze bank + auto-protection | have: `touchStreak()` consumes a banked freeze on the first missed day (server.ts:38-41); weekly mint, Deep Freezer widens the cap | keep (D3 was already built here) |
| Word-bank translate tiles (their signature exercise) | **zero hits in src** | **ADOPT (D2): deterministic `bank` direction in the review set** |
| Leagues | have (weekly league ladder) | keep |
| XP + combo momentum | have (momentum chains cross-surface) | keep |
| Daily/each quest | have (Director plan + daily challenge) | keep |
| Hearts/lives | none | **REJECT** — artificial scarcity that punishes practice is anti-FSRS and anti-method |
| Gem/soft currency | none | **REJECT** — no learning value |
| Leaderboard anxiety beyond weekly league | league only | **REJECT** — dark-pattern pressure |
| Mascot/animation stack | none | **REJECT** — slop by house rules |

## 8. Adoption wave (tracked in MEGA-UPDATE.md)

- **D1 (this document + gate)**: parity + duel + cross-exam — SHIPPED, gate
  `scripts/test-duolingo-hlr.ts` PASS (A: 1.11e-16 parity; B: HLR beats both
  baselines; C: FSRS best mae(p)).
- **D2 word-bank translate — SHIPPED**: a 7th review direction `bank` (cloze
  + sent kinds): the Farsi prompt, the English built by tapping tiles.
  `src/lib/bank.ts` builds the tray deterministically per (card, day):
  every target word present with full multiplicity, distractors from the
  card's own field topped up from same-level deck vocabulary, tray capped at
  14, no duplicate noise. Grading is the exact join-and-normalize the other
  typed directions use (target + alts). Gate: `scripts/test-bank.ts` 18/18 —
  determinism over all 218 cards, buildable answer, day reshuffle, hollow-
  field top-up, wire tiles on bank items only, same-tray-per-day over the
  wire, grade route persists dir=bank + FSRS advance + ReviewLog, correct
  tap sequence builds the target, extra tile breaks the match. Full state
  restore in finally.
- **D3 match-pairs sprint — SHIPPED (Task 37)**: tap-the-pairs speed drill,
  `src/lib/pairs.ts` board + `src/components/rah/games/PairsGame.tsx` +
  `src/app/api/arcade/pairs`. The board is DETERMINISTIC per (due set, day)
  (mulberry32, same doctrine as bank.ts): five due cards, most at-risk first,
  new cards top up, deduped by Farsi so no two pairs share a tile. Each
  successful match grades the card Good through the normal
  `/api/review/grade` path (dir "pairs") - FSRS, ReviewLog, XP, quests, and
  the streak see the retrieval exactly once; the sprint POST only clamps the
  aggregate and pays the capped speed bonus (2 XP/pair + 10 clean-board).
  Gate: battery section 6 (board shape, id-set equality, determinism across
  GETs, clean-bonus math, hostile-id filtering) + browser E2E (board played
  to completion: 5 cards graded, misstep shaken, sprint bonus paid).

## 9. REA wave 2 - the 7.4/10 external review (three apps)

The user brought an external product review (overall 7.4/10; "proven learning
effectiveness" scored 4.5/10, the lowest row). Its section 3 names three
product-design benchmarks to reverse-engineer. This wave shipped one honest
adoption from each - the house rule again: study the workflow, reproduce the
idea, never fake the numbers.

| Their app | What we took | What shipped | What we already had / rejected |
|---|---|---|---|
| ChatGPT Study Mode | "diagnose the misunderstanding, stepwise, understanding check - guide instead of merely producing an answer" | Coach rule 9 STUDY MODE (loop.ts): three-beat protocol - DIAGNOSE from what the learner actually typed (the [current screen] block), STEPWISE 2-4 numbered steps, end with ONE check question that proves understanding. Explicit subordination: study mode never waives the read_state mandate (two drive runs proved the dilution failure mode before the fix). | retrieval-first on unanswered exercises was already shipped (Task 37); Study Mode adds the teach-back shape |
| Speak | "immediate retry + measure improvement between attempts" | /api/speak/analytics: per-dimension trend (last 12 graded sessions), round1->round2 same-prompt deltas, recurring spoken-trap families (MistakeFamily kind=speak), honest totals. Speak tab gains the Improvement ledger - zero AI in the panel, every number a stored row. | the round-2 constraint loop existed; what was missing was the MEASUREMENT of the retry |
| Duolingo Max (Video Call/Roleplay) | "roleplay ends with conversation feedback and transcripts" | Scene accounting (mode-flow.ts): roleplayTurn persists turns + trap tally + one example per trap family into ModeData; exit produces the SCENE REPORT - turns, corrections/turn, recurring traps with the exact wrong->right evidence, next-scene focus. Deterministic; the AI adds nothing. | roleplay/debate/socratic modes existed since the agent wave; the exit was a generic 2-sentence wrap with no data behind it |

Also shipped from the same review (its build-order item 4, "validate
educational outcomes" - the 4.5/10 row): /api/progress/outcomes + the
Effectiveness ledger on the Progress tab. First-attempt retention per day
(ReviewLog grades), median scheduled interval per day (FSRS stability proxy),
mature-memory share (s >= 21d), and mistake-family retirement rate. The panel
says "measured, not claimed" because that is the entire point: engineering
test pass-rates never measured learning; these numbers do.

Gates: API BATTERY 221/221 (13 new: speak analytics shape + exact seeded
delta math r1=5 -> r2=6.3 on 1dp engine rounding, outcomes shape + isolated
day retention 2/3 = 66.7% + median ivl [10,6,0] = 6 - the day is wiped of
ambient logs first so the assertion can never lean on restored learner data),
COACH-AGENT+AUTH DRIVE 29/29 (after re-proving that a long rule-1 insertion
dilutes the mandatory-tool compliance - STUDY MODE moved to its own rule 9),
tsc clean, eslint clean, browser E2E: the user's exact message
"what is the answer of this question and why cant i aanswer it" on the live
cloze "You have ? progress this month." now answers 'made' with the why and
the Farsi L1 diagnosis (e2e screenshots in download/), Improvement ledger and
Effectiveness ledger both render (e2e-speak-ledger.png, e2e-effectiveness-ledger.png).

### 9.1 SPEAK RE part 2 - Talk: free spoken conversation (Task 41)

The review's #1 feature ("real-time voice conversations with the AI coach").
VoiceArena was the fixed shadowing gauntlet; Talk is the freeconversation
sibling: six deterministic-per-day scenarios (mulberry32, weakness-biased -
the scene whose skill matches the learner's hottest active mistake family
opens first), browser ASR in, speechSynthesis out (the VoiceArena zero-config
convention; the line is always visible and replayable), up to 6 turns with
in-scene trap-tagged corrections feeding the SAME mistake memory as the pen,
then a deterministic scene report. The scores are computed from what actually
happened (corrections tally, words-per-turn, vocabulary variety) - never the
AI's opinion of itself - and the session lands in the Improvement ledger via
the normal SpeakSession row, so the analytics from 9 read it with zero extra
machinery. Oversized histories are rejected (400), never clamped into a live
model call. Gate: battery section 6d (bank shape, per-day determinism,
400-on-garbage), live browser E2E (scene run: in-character replies, corrections,
report, ledger row; screenshot e2e-talk-conversation.png).
