# Offline behavior — physical-device test protocol (Task 95, review P1 #8)

> The browser E2E suite proves the offline queue's LOGIC on a desktop-class
> machine. It cannot prove what a real phone does with real radios, real
> backgrounding, and real storage pressure. This protocol closes that gap.
> It is written to be executed by one person with two physical devices in
> about 45 minutes, and it names the exact code contract each step exercises.

## Scope under test

| Surface | Offline behavior | Code contract |
|---|---|---|
| Review grading | Queued locally, replayed on reconnect | `src/lib/offline.ts` outbox v1 (`rah-outbox-v1`), gid receipt |
| Supported games (arcade decks) | Queued locally, replayed on reconnect | `rah-outbox-games-v1` |
| Chat / essays / speech / dictation | REFUSED with a speakable message | honesty rule: model surfaces never fake a queue entry |
| Dungeon / Gauntlet | REFUSED (server-dealt state machines) | same honesty rule |
| Queue status | Always visible to the learner | `src/components/rah/OfflineBadge.tsx` + toasts |

Hard rules the tests must CONFIRM, not assume: (1) only NETWORK failures
enqueue — a 4xx refusal is dropped and counted, never retried forever;
(2) a queued grade is announced, never silently pretended to have synced;
(3) replaying twice is safe — the server answers a duplicate gid with the
original response (`GradeAck` dedupe).

## Preconditions

- Device A: the learner's actual phone (Android or iOS), app loaded once on
  Wi-Fi, then used throughout. Device B (optional): a second phone or the
  desktop browser for the account-switch scenario.
- The learner account signed in on device A before starting.
- Note the current XP and review count (Progress screen) as the baseline.

## Scenario 1 — airplane-mode grading and reconnect replay

1. Load the app, open the Review queue, then enable airplane mode.
2. Grade 3 cards (any grades). EXPECT: grading works; the offline badge
   appears with a count of 3; a toast announces queued grades.
3. Disable airplane mode. EXPECT: within seconds the badge count drops to 0
   and a sync confirmation appears.
4. Check Progress: XP and review counts reflect exactly the 3 grades — once.
5. Refresh the page. EXPECT: counts unchanged (no double-count).

Proves: enqueue → auto-flush → server dedupe, the full happy path, on real
radios (the network stack is the variable a desktop E2E cannot represent).

## Scenario 2 — duplicate replay safety (the nastiest real-world case)

1. Grade 2 cards in airplane mode.
2. Kill the browser (not just the tab — swipe the app away) BEFORE
   reconnecting, so the flush never ran.
3. Reopen the app (still offline): EXPECT the 2 grades are still queued
   (localStorage survives process death; verify the badge).
4. Reconnect, then force-kill and reopen the app again immediately after the
   flush begins (the timing should straddle the flush).
5. EXPECT: exactly 2 grades counted server-side. Run this flush-straddle
   three times — a duplicate means the gid receipt contract broke.

Proves: queue persistence across process death + replay idempotence under
the exact interruption real users cause.

## Scenario 3 — mid-session browser closure and day-later return

1. Airplane mode on; grade 1 card; close the browser for at least 1 hour
   (overnight is better).
2. Return (reconnect on open). EXPECT: the grade replays and counts.
3. Confirm the DailyStat day attribution matches the day the grade was MADE,
   not the day it replayed (check the Progress activity bars) — this is the
   acceptable-known-quirk boundary: if attribution lands on the replay day,
   record it as a finding; it changes pilot-metric interpretation.

Proves: durability of queued state and honest bookkeeping across time.

## Scenario 4 — storage eviction (the case localStorage loses)

1. In airplane mode, queue 5 grades.
2. Evict site data: iOS Safari → Settings → Safari → Advanced → Website Data
   → delete; Android Chrome → Site settings → Data stored. (Physical devices
   can also die of storage pressure — eviction is the same code path.)
3. Reopen offline. EXPECT: queue is gone (honest loss — localStorage has no
   cross-device copy), and the app does NOT crash or show a stale badge.
4. Grade 2 new cards offline, reconnect, EXPECT exactly those 2 replay.

Proves: graceful degradation when queued state is destroyed; no phantom
counts. A finding here is a PRODUCT decision candidate (indexeddb or cloud
queue — see backlog item F-3), not a code bug.

## Scenario 5 — account switching on one device

1. With 3 grades queued offline, sign out and sign in as a different account
   (or the same account on device B).
2. EXPECT: the queue is either bound to the signed-out account and dropped
   with an announcement, or replayed to the ORIGINAL account — it must never
   silently land in the new account's ledger.
3. Verify on Progress (both accounts) where the 3 grades went.

Proves: the queue cannot leak grades across identities — the exact
data-isolation class Task 92-ter closed server-side, now tested client-side.

## Scenario 6 — refused surfaces stay honest offline

1. Airplane mode; attempt: a coach chat message, an essay submission, a
   speak session, and a Dungeon run.
2. EXPECT: each refuses with a clear speakable message; NONE creates a queue
   entry (badge count unchanged); no spinner pretends progress.
3. Reconnect; verify nothing from step 1 ever appears in the ledgers.

Proves: the honesty boundary — only measurable, replayable actions queue.

## Scenario 7 — reconnect storm (radio flapping)

1. Toggle airplane mode rapidly 5-6 times while grading between toggles
   (aim for ~8 queued grades across the toggles).
2. Leave the radio on and wait 2 minutes.
3. EXPECT: final count is exact; no duplicate toasts stuck; no console
   errors; badge reaches 0.

Proves: the flush's single-flight lock (`flushing` flag) survives chaos —
concurrent flush attempts must not double-send.

## Recording results

Append a dated block to `db/pilot/series.md` (it is now vault-backed, so the
record survives recycles) with: device model, OS version, browser version,
per-scenario PASS/FAIL and any deviation. A FAIL becomes a backlog entry
with the scenario number as its regression test name.
