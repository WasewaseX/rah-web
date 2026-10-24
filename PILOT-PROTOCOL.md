# LEARNER PILOT PROTOCOL — turning "tests pass" into "learning happens" evidence

**Created:** 2026-10-22 (Task 76, the evaluator's P1 #3) · **Instrument:** `scripts/pilot-metrics.mjs` (zero-AI, read-only) · **Series log (local, gitignored):** `db/pilot/series.md`

Purpose: the audit's warning is binding — passing tests proves the application behaves as coded, NOT that learners improve their English. This protocol defines, IN ADVANCE, what will be measured, how often, with what sample-size honesty rules, and what would count as improvement. Pre-registration is the point: the verdict criteria are written before the data exists, so the goalposts cannot move after the fact.

---

## 1. The four tracks (and their exact data sources)

| Track | Metric | Source (real tables, zero AI) | Honest limit |
|-------|--------|------------------------------|--------------|
| Retention | First-attempt recall per week + interval survival (cards with >=7d intervals, lifetime lapses) | `ReviewLog` (grade >= 3 = good) + `CardState` | FSRS grades measure retrieval of THIS deck, not general English |
| Writing | Revision behavior: original submissions, chains, revisions; quality deltas once the rubric-history system ships | `WritingSub` (`parentId`/`revision` chains) | Quality deltas are NOT claimable until the rubric-history PARTIAL closes (audit boundary restated here) |
| Listening | Dictation first-attempt accuracy per week | `ReviewLog` WHERE source='dictation' | Item difficulty is not yet difficulty-controlled — trends only, no absolute claims |
| Speaking | Session volume + stored overall-score trend; read-aloud measured assessments (word-level, ASR alignment) | `SpeakSession` (+ round=0 rows) | Scores stay PROXY-labeled until the Azure phoneme tier measures real audio (standing precision claim) |

Substrate track: **consistency** (active days, weekly volume) — the pilot's validity depends on the habit existing; a pilot on 2 active days measures nothing.

**Volume instrumentation (Task 89, live):** `DailyStat` now carries `written` / `spoken` / `listened` counters alongside `reviews`, and `/api/progress` returns 7-day + 28-day volume rolls from that ledger (zero extra queries). The Progress view renders a **Practice volume card — shown even at all-zeros**, because an empty week is exactly what the pilot must see. This closes the Week-0 gap the evaluator flagged (baseline had 17 first attempts and NO recorded writing/speaking/dictation volume): from now on every weekly cell carries its own volume numbers, so the writing/speaking tracks can accumulate their first real cells without any manual logging.

## 2. Cadence and mechanics

1. Run `node scripts/pilot-metrics.mjs` once per week (same weekday), append the output verbatim to `db/pilot/series.md` with the week number. The file lives in gitignored `db/pilot/` — it derives from learner data and stays out of the public repo; it can be regenerated from the DB at any time. **(Task 92-bis automation: the watchdog's daily tick now also enforces the weekly cadence — every 7 days it appends a `## Weekly checkpoint (watchdog-automated)` row to `db/pilot/series.md` itself, so the series can no longer rot waiting for a manual run. Manual interim checkpoints (like the ones below) remain welcome between the automated rows.)**
2. Do not edit old snapshots. Corrections happen as new rows (the series must stay append-only, like the MailLog ledger).
3. The Week-0 baseline (2026-10-22): 17 first attempts, recall 29%, 2 active days, 17 cards, 9 lifetime lapses, 0 writing/speaking/dictation volume. Every series starts somewhere — the honesty rule flags these as small samples, not trends.
4. **Weekly volume roll (Task 90 addition):** each weekly append now copies the Practice-volume numbers (7d/28d written · spoken · listened · reviews) from `/api/progress` next to the `pilot-metrics.mjs` output, so every cell is self-contained even before the learner touches the writing/speaking surfaces. Pre-instrumentation weeks keep their zeros honestly — do not backfill.

## 3. Sample-size honesty rules (non-negotiable)

- A weekly cell with < 20 first attempts is displayed but labeled "a real signal, not a trend" (the Task 70 rule).
- A weekly VERDICT (below) requires >= 50 first attempts in that week's cell.
- Fewer than 4 weekly cells: no trend language at all, anywhere, for any audience.
- Any surface that shows pilot numbers must carry the small-sample labels mechanically (dimmed cells), not by wording choice.

## 4. Verdict criteria (pre-registered)

**Minimum pilot:** 4 consecutive weeks with >= 50 first attempts/week. **Target pilot:** 8 weeks. A track "shows improvement" only if ALL of its hold:

- **Retention:** weekly recall does not decline across the window (flat-or-up), AND interval survival grows (>=7d-interval cards increase, lapse ratio does not inflate), AND volume holds.
- **Listening:** dictation accuracy flat-or-up across >= 4 cells with volume.
- **Speaking:** the newer-half average of stored session scores is >= the older-half average AND read-aloud measured assessments accumulate (their own curve once volume exists).
- **Writing:** volume + revision behavior reported; quality claims only after the rubric-history system ships and produces criterion-level deltas.

**Failure handling:** a declining track is reported as a declining track — the pilot's value is the truth, not a marketing series. A decline triggers investigation (item difficulty? scheduling? engagement?) before any feature response.

## 5. What this pilot CANNOT prove (say it out loud)

- One learner, no control group: the verdict language is "the learner's measured recall/accuracy improved over N weeks while using the app" — never "Rah raises IELTS scores" or any population claim.
- Engagement metrics (XP, streaks, gems) are proxies and stay labeled as proxies (the Task 70 caveat block).
- The pilot gates PRODUCT claims, not the release decision — the deployment-lock decision is separate (ROADMAP-AUDIT.md open critical list #1).

## 6. Weekly roll log (Task 90 mechanics, appended per week)

**2026-10-23 (interim checkpoint, mid-week — not a verdict cell):** reviews 20 (last-7), 4 active days in last-28, **listened 1 (last-7) — the first non-zero listening volume since the instrument went live**; written 0, spoken 0 (the writing/speaking tracks still hold their honest zeros until the learner touches them). `pilot-metrics.mjs`: all weekly cells below the 50-first-attempt bar → no trend language anywhere, per the section-3 rules. The Task-91 incident note: today's 60xp listening day had zero reviews, which is exactly the row class the pre-Task-91 repair would have dropped — the ledger extension now protects it.

**2026-10-24 (interim checkpoint, day-roll — not a verdict cell):** no new learner activity recorded yet today (the ledger still ends at day 20749, xp=60/listened=1/reviews=0); last-7 windows unchanged: reviews 20, listened 1, written 0, spoken 0. `pilot-metrics.mjs` re-run: week-0 18 first attempts @ 33% recall (small-sample labels intact, no trend language), writing 0 submissions, speaking 0 scored sessions, consistency 4 active days / 28. Instrumentation status: the Practice volume card (Task 89) is live in the prod build and the daily roll is now part of the session protocol; the writing/speaking zeros remain the honest gap until the learner touches those tracks — the study needs volume, not the tool's willingness.
