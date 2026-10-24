# Azure pronunciation tier — validation protocol (Task 95, review P1 #7)

> The review is precise about the gate: "Verify phoneme-level feedback
> against real recordings before making phonetic scoring claims." This
> document is that gate, made executable. Until every check below passes
> with a real key and real clips, the UI keeps the honest tier labels
> (`measured:asr-alignment` for the built-in word-level scorer; no phoneme
> claims anywhere) — that rule is pinned by the 23-test pronunciation
> battery and is not relaxed by this work.

## What exists today (the code this validates)

- `src/lib/azure-speech.ts` — the adapter, dormant without credentials.
  Opt-in via `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`. Contract: REST
  pronunciation assessment, `HundredMark` scoring, `Phoneme` granularity,
  miscue enabled, word + phoneme arrays, tier label `measured:azure-phoneme`.
- `src/lib/pronunciation.ts` — the always-on measured tier: server-side ASR
  of the learner's real audio + deterministic word alignment. Deterministic,
  battery-pinned, and the REQUIRED fallback: any Azure outage or failed
  validation check degrades to this tier, labeled in the response.
- The route prefers Azure when configured and labels which tier answered;
  the UI renders the label verbatim. This split is the load-bearing honesty
  seam this validation protects.

## Acceptance criteria (all must pass before any UI says "phoneme")

1. **Transport**: with a real key, the adapter returns a parseable assessment
   for a clean 8-second clip for all three target locales tested
   (`en-US`, `en-GB`, `en-AU` — availability differs per locale; record which
   features each actually returns).
2. **Phoneme presence**: the response contains a non-empty phoneme array for
   every scored word, each with an `accuracyScore` in 0..100.
3. **Known-error detection**: on a clip with a deliberately mispronounced
   word (script below), the mispronounced word's `errorType` is
   `Mispronunciation` (not `None`) in ≥4 of 5 independent recordings.
4. **Omission/insertion**: a clip that skips one target word reports
   `Omission` for it; a clip with one added word reports it as an insertion
   or in the transcript — either is acceptable, but it must be consistent
   across 3 takes.
5. **Stability**: the same clip submitted twice returns identical scores
   (deterministic transport; if scores jitter, the adapter must pin
   `Randomize`-free settings or the jitter must be documented and <2 points).
6. **Degradation**: with the key REMOVED mid-session, the next assessment
   returns the `measured:asr-alignment` tier with HTTP 200 — never an error
   to the learner, never a silent phoneme claim.
7. **Latency budget**: p50 assessment round-trip <2.5s and p95 <5s over 20
   clips (the coach round-trip already runs longer; the pronunciation path
   must not feel slower than the current ASR tier).

## The harness

`scripts/azure-pron-validate.ts` runs the whole gate:

```
# no key: honest skip, exit 0, says exactly what it skipped and why
bunx tsx scripts/azure-pron-validate.ts

# with key: runs all 7 checks against scripts/pron-validation-clips/
AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=... bunx tsx scripts/azure-pron-validate.ts
```

It exits 1 on any failed criterion and prints a per-criterion PASS/FAIL
table. That table (plus the clip set hash) is the evidence block that goes
into `db/pilot/series.md` and the roadmap status. Clips live in a
gitignored directory (voice is biometric data — it never enters Git, public
or private-vault, per the REG-2 spirit: the vault carries learner data
because it must, not because it may).

## Clip set (record fresh; ~10 minutes total)

| Clip | Content | Purpose |
|---|---|---|
| clean-01..03 | 3 neutral sentences, careful native-ish delivery | criterion 1/5 baseline |
| mispron-01..05 | same sentence ×5, one target word deliberately distorted (e.g. "comfortable" → /kɔm-FOR-tee-bul/) | criterion 3 |
| omission-01..03 | 3 takes skipping one word | criterion 4 |
| insertion-01..03 | 3 takes adding one word | criterion 4 |
| noisy-01..02 | 2 clips with background noise | undocumented behavior probe (record, don't gate) |
| fast-01..02 | 2 clips at fast casual rate | fluency-score sanity |

Each clip: WAV or MP3, ≤15s, spoken by the person filing the validation
(the learner/owner), recorded on a phone — the same acoustic class as real
use, not studio audio.

## After validation passes

- Flip the UI claim gate: Sound Lab may then say "phoneme-level feedback
  (Azure)" on assessed words, and the pilot metrics may record phoneme-tier
  usage — separately from `measured:asr-alignment` counts, never merged.
- Keep the fallback path pinned: the 23-test battery keeps asserting the
  degradation contract so a future Azure outage cannot turn into a silent
  phoneme claim.
- Add the validation table to this file with dates; re-run the harness when
  the adapter, locale set, or Azure API version changes.
