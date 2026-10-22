# LingQ RE — the imported-reading loop, reverse-engineered

**Created:** 2026-10-22 (Task 71) · **Purpose:** the audit's last open reverse-engineering target (LingQ — "imported-reading workflow study, feeds feature #1 BYO materials"). Same playbook as `DUOLINGO-RE.md`: study the loop, take what survives our honesty rules, ship it, and write down what was deliberately NOT copied.

---

## 1. What LingQ actually does (the loop, stripped to mechanics)

LingQ's product is one loop wrapped around text the learner chose themselves:

1. **Import** — the learner brings any real text (articles, books, emails). The content IS the curriculum; nothing is pre-written. (Rah equivalent: Task 54 BYO materials — shipped.)
2. **Read with tap-to-lookup** — every word is tappable. Unknown words become blue "LingQs" (a linked hint + dictionary form); words you have marked known turn white/checked. The reading screen is a vocabulary-state heatmap over your own text.
3. **LingQs become reviewables** — every created LingQ is a flashcard (term, hint, sample sentence = the sentence you met it in). SRS review exists but is secondary; the primary review surface is READING THE NEXT TEXT.
4. **Known-word accounting** — the killer metric: "you know X of Y words in this text" before you even start, and a running "known words" total. The number makes growth legible: import something scary, watch the unknown % fall.
5. **Audio alongside** — every text has native audio; the daily stats panel counts minutes read + words read + LingQs created. Streaks attach to *contact with the language*, not to quiz scores.

Why it works (the part worth copying): **vocabulary is acquired in the exact sentence where it was used**, the learner's own material supplies infinite context, and the known-word counter turns reading volume into visible progress.

## 2. What Rah already had (before this task)

| LingQ mechanic | Rah status pre-71 |
|---|---|
| Import your own text | ✅ Task 54 (AI extraction with deterministic source validation) + Task 55/59 (CSV/TSV + real .apkg) |
| Extracted items keep their source sentence | ✅ every MaterialCard carries `context` verbatim |
| Items review on one schedule | ✅ MaterialCards enter the SAME FSRS queue (Task 54 doctrine: one source of truth) |
| Read the text inside the app | ⚠️ the full text was buried behind a "Show the full text" `<details>` — readable, not *usable* |
| Tap a word in context → grade it | ❌ nothing — the gap this task closes |
| Known-word accounting | ❌ (v2; needs a per-word known/unknown state, see §4) |

## 3. What ships now (v1 — the honest core)

**The material IS a reading.** On the Read tab, "Read your materials" opens any imported material as a full-text reading surface:

- The complete text, rendered paragraph-by-paragraph in the same style as the built-in readings.
- Every extracted card's answer is **highlighted in the text where it appears** — your own "LingQs", in the sentence the extraction validated them against.
- **Tap a highlighted word → inline card**: the note (meaning hint), the exact source sentence, and two retrieval buttons — **Got it** (grade Good) / **Forgot** (grade Again). The grade goes through `/api/review/grade`, so the SAME FSRS schedule, ReviewLog, XP, quests, streak and momentum chain see the retrieval exactly once. No parallel system, no double counting.
- Offline-safe by inheritance: the grade call is the Task-68 offline-aware path — grade while offline and it queues with a gid receipt like every other review.
- The panel states the honest scope on its face: "grading here is retrieval practice; the full review queue still schedules these cards" — reading is not a replacement for the queue, it is another road into it.

## 4. Deliberately NOT copied (and why)

- **Known/unknown word-state for every word in the text.** LingQ tracks ~every token; that requires a per-lemma word-state store and a lookup dictionary. V1 grades the words Rah already extracted as cards (validated, sourced). A per-token known-word ledger is the natural v2 — it needs the lookup API and a real dictionary source, and a fake one would violate the honesty rules.
- **Dictionary pop-ups for arbitrary words.** Same reason: no licensed dictionary content, and an AI-dictionary answer presented as a dictionary fact would be an inference dressed as a reference. (Rah's Sound Lab epistemics: measured vs inferred are never mixed.)
- **Marketplace/courses.** Content economy, not a learning loop.
- **Streak-on-contact stats.** Rah's streak already exists and is fed by retrievals; duplicating it with "minutes read" would fork the habit metric into two competing truths.

## 5. Verification

- Browser E2E on the throwaway mobile stack: material with cards → text renders → highlighted answers tap → inline panel → "Got it" → ReviewLog row with `source: review`, FSRS schedule advanced, XP paid; offline variant queues via the outbox (Task 68 path).
- The grade goes through the same `/api/review/grade` the queue uses — the battery's existing pins (schedule math, gid idempotency, per-user scoping) all apply unchanged.
