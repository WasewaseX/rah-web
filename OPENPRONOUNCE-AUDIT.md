# OPENPRONOUNCE-AUDIT — the $0 self-hosted phoneme tier candidate

Written 2026-10-25 (Task 97), per the account holder's strict-$0 directive:
"Audit OpenPronounce (https://github.com/Halleck45/OpenPronounce) as the
leading self-hosted candidate for phoneme-level pronunciation analysis."
Audited from a shallow clone of the public repo (2026-10-25, HEAD
2026-08-15). No weights downloaded; no claims adopted.

## 1. Verdict

> **SUPERSEDED 2026-10-26 (Task 98) — REJECTED for this deployment by the
> account holder's standing lightweight rule** ("make things lightweight and
> only use apis to avoid render fails"): two ~1.2 GB checkpoint downloads +
> a ~2–3 GB RAM inference sidecar cannot fit beside the app + PostgreSQL on
> the ~4 GB box. The findings below stay as the verified reference for any
> future box with RAM headroom; the word-level `measured:asr-alignment`
> tier remains the only validated pronunciation measurement.

**Original verdict (Task 97, superseded): ADOPT as the phoneme-tier CANDIDATE
behind the provider interface — labeled `experimental:local-phoneme` from day
one.** It is the only
evaluated option that is free, self-hosted, offline-capable, licensed for
reuse (MIT), maintained (last commit ~10 weeks before audit), and honest
about its own error rates in its own README. It does NOT replace the
word-level `measured:asr-alignment` tier (which stays the validated
measurement); it sits BESIDE it, experimental until a reproducible
benchmark against human ratings passes — the same gate shape backlog F-2
uses for exam scoring, applied to pronunciation.

## 2. Findings (verified in the clone)

| Dimension | Finding |
|---|---|
| License | MIT (© 2025 Jean-François Lépine) — permissive, no adoption risk |
| Maturity | 60+ python tests (audio 16, phones 24, languages 15, server 5, device 3); FastAPI server; tests need only espeak-ng + ffmpeg, NOT weights or network — CI-safe |
| Models | Two Wav2Vec2 checkpoints, ~1.2 GB each (~2.4 GB total, HF Hub, first-use download; `HF_HUB_OFFLINE=1` works afterwards = true offline inference) |
| Runtime | Python 3.12, torch/transformers/librosa; CPU inference; expect ~2–3 GB RAM during inference; a sidecar process like PG's |
| API | POST `/pronunciation` (the one Rah needs), `/speech2text`, `/phonemes`, `/tts`; GET `/languages`, `/health` — clean HTTP contract |
| Maintenance | Last commit 2026-08-15 (recent); CHANGELOG + CITATION + Dockerfiles present |
| Honest limits (their own README) | phone recognizer errs ~1 sound in 10 on clean native reading; on speechocean762 one flagged word in five is human-rated mispronounced while seven of ten human-rejected words are caught — "a calibrated heuristic, not a model trained on annotated learner speech"; ONLY English is calibrated against human ratings |

## 3. Integration shape (design; implementation waits on the P0-cleared queue)

1. **Provider interface**: `src/lib/azure-speech.ts` is already an
   env-gated optional provider. Add `src/lib/openpronounce.ts` with the
   same shape: `openPronounceConfigured()` (sidecar URL env), graceful
   fallback to the built-in word tier on any error — the assess route's
   honesty rules (tier label always travels with the score) apply
   unchanged.
2. **Tier label**: a NEW `experimental:local-phoneme` label with a fixed
   note ("local open-source phoneme estimate — experimental, not validated
   against human ratings"). NEVER merged with, or rendered as, the
   `measured:asr-alignment` numbers. The pronunciation battery gains pins:
   tier labels never mix; failure → honest word-tier fallback.
3. **Ops**: sidecar managed by the supervisor/watchdog like PG
   (`openpronounce serve`), weights cached in `HF_HOME` OUTSIDE version
   control (gitignored), downloaded once at provision time (never in CI —
   the suite runs without weights).
4. **Validation path**: OpenPronounce ships a speechocean762 benchmark
   harness (`benchmarks/speechocean762.py`) — the SAME shape as backlog
   F-2's human-calibration gate. Rah's acceptance for calling the tier
   anything other than experimental: a reproducible benchmark on
   representative learner recordings with human-rated results (the $0
   directive's own wording), recorded in PRONUNCIATION-VALIDATION.md's
   successor section.

## 4. Resource cost (the "exact disk/RAM requirements" the directive asks for)

- Disk: ~2.4 GB model checkpoints + ~2 GB python/torch env (one-time,
  outside git).
- RAM: ~2–3 GB during inference (CPU), bursty (per assessment, not
  resident model serving — model loads lazily; plan for resident ~2.5 GB
  if the sidecar keeps the model warm).
- Ongoing: $0. No metered API. No quota.

## 5. What stays true regardless

- Azure is de-escalated per the account holder's directive: NEVER required
  for normal operation (it already isn't — the adapter is env-gated and
  dormant with no key; `azure-pron-validate.ts` remains only as the
  reference-comparison harness, marked as such).
- Local Whisper (faster-whisper / whisper.cpp) remains the candidate for
  GENERAL transcription replacement if the current ASR ever becomes
  metered — transcription accuracy and pronunciation accuracy are separate
  claims and must not be conflated (the directive's own warning).
- The word-level measured tier and its battery are untouched by any of
  this.
