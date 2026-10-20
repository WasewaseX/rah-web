# Rah project worklog

---
Task ID: 1
Agent: Super Z (main)
Task: Rebuild Rah as a native Tauri app (Rust + TypeScript), test + screenshot it, publish via GitHub CI.

Work Log:
- Verified repo WasewaseX/rah exists (private, created via PAT earlier this session chain)
- Recovered full source from git: operon modules (app/src/*.op), content (218 cards, 6 readings, placement.json), legacy ui/, embedder/
- Releases v1.0.0 and v1.0.1 already published with legacy operon rah.exe
- Read all core operon modules to port: fsrs.op, review.op, mastery.op, placement.op, prompts.op, ai.op, store.op, util.op, main.op handlers
- Cloned repo to /home/z/my-project/rah-repo (working tree for the rebuild)
- Plan: crates/rah-core (all logic, unit-testable, no tauri dep) + src-tauri (thin tauri v2 shell) + src (TypeScript vite frontend, demo backend for browser testing) + updated CI workflows, release v2.0.0 (portable exe + NSIS installer)

Stage Summary:
- Source recovered; rebuild starting. User requirements: native app (no localhost GUI), Rust + TypeScript (Tauri), science-proven method preserved (FSRS-5, retrieval, interleaving, Four Strands, elaborated Farsi feedback), zero slop, self-test + screenshots, GitHub CI release.

---
Task ID: 2
Agent: Super Z (main)
Task: Native Tauri rebuild, self-test + screenshots, CI release v2.0.0

Work Log:
- Ported all operon logic to Rust: crates/rah-core (fsrs, review, mastery, placement, prompts, ai, store, content) — 45 unit tests, all green
- Built Tauri v2 shell (src-tauri) with lock-free async command pattern (prep/commit phases so no MutexGuard crosses await)
- Rebuilt UI in TypeScript (vite, no framework): 10 views, hash router, keyboard-first, demo backend with FSRS-TS mirror + seeded persona + canned AI for browser testing
- Playwright self-test: full click-through (placement incl. writing skip, review grading miss/hit + FSRS interval previews + undo, chat correction flow, writing grading, quiz build+answer, readings, deck add/import, stats, settings) — zero console errors
- Screenshot audit fixed: brand glyph, duplicate plan row, review meta dedupe, stats bar labels every 5th, hit/hits plural, deck "due now", demo chat correction matching
- Workflows rewritten: ci.yml (ubuntu tests + windows tauri build artifact), release.yml (v* tags -> portable exe + NSIS installer -> GitHub Release)
- Key safety: state/export never carry raw keys; token never committed (scanned)
- Pushed main (13dc54d), tagged v2.0.0, both workflows running

Stage Summary:
- Awaiting CI results; release will carry rah.exe (portable) + NSIS installer. Screenshots in /home/z/my-project/download/screenshots/.

---
Task ID: 3
Agent: Super Z (main)
Task: CI release pipeline green, deliver v2.0.0

Work Log:
- CI run 1 failed: 7 type errors in src-tauri shell (u128 ms, closure E inference). Fixed with try_app helper + i64 cast.
- CI run 2 failed: NSIS has no Persian.nlf. Installer language set to English.
- CI run 3 failed: staging paths assumed src-tauri/target; cargo workspace puts target/ at repo root. Fixed paths.
- CI run 4: SUCCESS (release + ci). Release v2.0.0 published with rah.exe (12.11 MB portable, assets embedded) and Rah_2.0.0_x64-setup.exe (2.94 MB NSIS).
- Final screenshot set regenerated from the fixed UI (15 shots, zero console errors).

Stage Summary:
- Rah v2.0.0 native (Tauri + Rust + TypeScript) is released via GitHub CI at https://github.com/WasewaseX/rah/releases/tag/v2.0.0
- Core: 45/45 unit tests. UI: click-through self-test clean. Screenshots: /home/z/my-project/download/screenshots/
- Legacy operon v1 kept in repo + releases v1.0.x untouched.

---
Task ID: 4
Agent: Super Z (main)
Task: Port Rah to a full-stack website with a truly built-in AI; deliver preview link; push to private repo with CI.

Work Log:
- Initialized fullstack env (Next.js 16 scaffold, port 3000) and loaded LLM skill for server-side AI via z-ai-web-dev-sdk
- Ported content from recovered rah-repo: 218 cards (deck.json), 25 placement items, 6 readings -> src/content/
- Prisma schema: Learner, CardState (FSRS-5 state), ReviewLog, Placement, ChatMsg, WritingSub, SpeakSession, DailyStat, QuizItem; db pushed
- Ported FSRS-5 engine 1:1 from crates/rah-core fsrs.rs to src/lib/fsrs.ts (19 weights, DECAY=-0.5, FACTOR=19/81, same-day + lapse + recall stability, previews)
- Built-in AI layer src/lib/ai.ts: tutor/writing/quiz/speak/listen/placement prompts ported from prompts.rs + JSON envelope extraction with truncation repair + retry
- 11 API routes: state, review/queue (multi-direction: cloze/reverse/fa2en/mcq_fa/fae/audio), review/grade, placement (adaptive ladder + AI writing), chat, writing, quiz, speak, listen, progress, health
- Frontend: single-page app in / with hash routing, 9 views (Home, Review, Coach, Writing, Speaking, Listening, Reading, Placement, Progress), brilliant-inspired design (emerald/amber/rose on warm neutrals, no AI slop)
- Browser-verified end to end with agent-browser: home dashboard, review grade flow with live interval previews, full 20-question placement + AI writing grading (level B2 assigned), coach chat corrections with Farsi, reading quiz generation, progress analytics; 16+ screenshots in download/screenshots/
- Fixed during self-test: AI JSON truncation (repair + retry), placement result clobber, revealed-answer color logic, 5 TS type errors caught by CI
- Created private repo WasewaseX/rah-web (201), pushed clean export (token scanned, PAT only via env), CI workflow (bun + prisma + lint + tsc) -> GREEN on 70eed43

Stage Summary:
- Rah web is LIVE on port 3000 with a built-in AI that works with zero configuration (verified: "responsible of -> responsible for", "much informations -> much information" both with Farsi explanations)
- Preview link delivered: https://preview-16721396.space-z.ai/
- Repo: https://github.com/WasewaseX/rah-web (private, CI green)
- Level engine live: placement assigned B2, schedules and coach prompts now target it

---
Task ID: 5
Agent: Super Z (main)
Task: Fix the 404 preview, harden the built-in AI, verify the whole app in the browser, deliver preview link.

Work Log:
- Diagnosed user's "404 page not found": dev server was down between sessions; preview gateway had nothing to route to. Server auto-restarted on port 3000 (GET / -> 200).
- Reproduced a REAL built-in AI failure: POST /api/chat with chat history returned "no json in ai reply". Root cause: coach history was flattened to plain text, so the model mimicked prose and dropped the JSON contract; retries repeated the identical prompt and failed identically.
- Fixed src/lib/ai.ts: retries now escalate (attempts 2 and 3 re-assert the JSON contract next to the latest user turn); aiJson accepts a fallback builder so the coach wraps raw text into a minimal envelope instead of dying. Coach history now stays as stored JSON to reinforce the envelope pattern.
- Verified raw SDK, prefill, and nudge strategies with scripts/test-ai-raw.ts and test-ai-fixes.ts before patching.
- End-to-end AI suite (scripts/test-all-ai.ts): chat, writing, quiz, listen, speak ALL PASS (1.8s to 12.7s per call).
- Browser verification with agent-browser: home, review (cloze "met the deadline" -> Correct + live FSRS intervals Again 1d / Hard 1d / Good 3d / Easy 16d), coach chat (two corrections with Farsi explanations and trap tags, Socratic follow-up), reading, progress (218 card deck, AI graded skills). Zero console errors, zero page errors. Screenshots in download/screenshots/web-01..09.
- Lint clean. GET / and /api/state return 200.

Stage Summary:
- The 404 was a dead server, not a broken app; the app is live and browser-verified.
- Built-in AI is now reliable under conversational history (escalating contract retries + never-unreachable fallback).
- Preview link: https://preview-16721396.space-z.ai/

---
Task ID: 6
Agent: Super Z (main)
Task: Screenshot Duolingo + brilliant.org as design references, rebuild the whole GUI in dark blue + dark gray (user judged the old GUI sloppy), self-test in the browser, push to the private repo.

Work Log:
- Captured reference shots: duolingo.com (ref-duolingo-01..03) and brilliant.org (ref-brilliant-01..04) at 1600x1000 into download/screenshots/.
- Distilled the design language: Duolingo contributes chunky pressable keys (solid bottom edge, compress on press), ultra-bold display type, four-color grade keys, progress rings; brilliant contributes floating rounded cards, big-number stat tiles, section kickers, generous whitespace.
- Defined the "Rah Midnight" system: bg #10131a, surfaces #1a1f2b, primary #4e8cff (edge #2650a3), amber #ffb02e for streak/Hard, rose #ff6b81 for Again/danger, emerald #2fc273 for success/Easy, cyan #4cc9f0 info; fixed blue-tinted radial glow on the body, dark scrollbars, blue selection.
- Rewrote globals.css (tokens + rah-rise/pop/pulse keyframes + .rah-3d pressable primitive), layout.tsx (html.dark, theme-color, Vazirmatn via next/font for Farsi), ui.tsx (Btn with 3D press variants, Card rounded-3xl layered shadow, dark chips, gradient Ring/Bar, Vazirmatn FA runs, Note callouts).
- Rebuilt all 9 views + shell: App.tsx (navy gradient rail, blue active indicator, glass mobile bars), Home (navy hero panel with daily ring + tinted feature tiles), Review (Duolingo four-key grading: AGAIN/HARD/GOOD/EASY with live FSRS intervals), Chat (blue user bubbles, dark coach bubbles, amber correction cards with Farsi), Write, Speak, Listen, Read, Placement, Progress (big-number stat tiles, blue activity bars).
- Cleaned invalid utility classes (px-4.5, h-13, uppercase-none) to valid arbitrary values.
- Browser-verified every view at desktop 1600x1000 and mobile 390x844 (mid-01..13 screenshots): review grading flow end to end (type "did" -> reveal "does" + Farsi + four keys -> Good -> XP 204->238, progress bar advances), AI coach end to end ("If I will pass..." -> correction to "If I pass" with Farsi explanation, trap tag, Socratic follow-up, XP 246). Zero page errors.
- Lint clean. Re-exported clean source, pushed 2a7b030 to WasewaseX/rah-web (private, PAT via env only), CI green.

Stage Summary:
- The GUI is no longer sloppy: cohesive midnight design system with Duolingo-grade button physics and brilliant-grade card hierarchy, in the requested dark blue + dark gray palette.
- Preview link: https://preview-16721396.space-z.ai/

---
Task ID: 7
Agent: Super Z (main)
Task: Make the stale-preview problem never happen again; store the user's GitHub PAT securely; rebuild the coach as a multi-step agent with a revived skill registry, per-skill assessment, fuzzy exam grading, deep analysis, and plugin-based theme control; release to GitHub.

Work Log:
- Diagnosed the stale preview: the space-z preview URL is a LIVE PROXY to the dev server; the previous session's work never landed on disk (sandbox restore), so the user kept seeing the Oct 7 snapshot. There is no separate deploy step; freshness = code on disk + dev server up.
- Guarantee #1: added /api/version beacon (git SHA + dirty count); comparing localhost vs preview now proves freshness in one curl. Verified: both serve c5816c373571.
- Guarantee #2: pushed the full state to private repo WasewaseX/rah-web after every meaningful change (sandbox restores are now recoverable from GitHub).
- Stored the user's GitHub PAT in .env (gitignored; .env was historically tracked - untracked it, verified git check-ignore). Token read only via env vars, never hardcoded.
- Schema: + Exam (server-side keys, status pending/graded, result JSON), + SkillLevel (per-skill band, rolling mastery 0..1, samples), Learner.theme.
- Agent core in src/lib/agent/: types.ts, run.ts (route -> skill -> verify loop, never-unreachable envelopes), planner.ts (slash commands -> trigger table -> LLM planner fallback), verify.ts (English-only reply, banned AI-sign phrases stripped, Farsi only in fa fields, fa_note suppressed when no corrections, exam count consistency), registry.ts.
- Revived 22 skills: chat, correct, translate, collocation-drill, vocab-drill, phrasal-verbs, idioms, grammar-drill, pronunciation, word-of-the-day, paraphrase, writing-prompt, generate-exam, assess-level, deep-analysis, skill-report, study-plan, exam-history, theme-control, navigate, focus-skill, settings. Slash routing live (/exam, /assess, /deep, /theme ocean, /skills...). Unknown slash returns the directory.
- Exam engine v2 (exam.ts + fuzzy.ts): keys never sent to client; grading = normalize (case/punct/articles) + accept-variant lists from generation + token-set similarity with light stemming + mustInclude patterns for rewrites. 15/15 self-tests pass incl. the user's exact failures ("take the advantage of" accepted, "pouring rain" accepted for "heavy rain", "rains" for "rain", "raise" correctly rejected for "address"). Announced count == graded count enforced. Grading updates SkillLevels.
- Per-skill bands (levels.ts): grammar, vocabulary, writing, speaking, reading, listening each with own CEFR band + one overall; rolling updates so early evidence moves fast, later evidence moves slow.
- Deep analysis: 5 AI passes with extended reasoning (production errors, composed texts, synthesis, verification, coaching note) + 25s minimum working window; zero-score bands for unevidenced skills filtered out.
- Theme plugin (theme.ts + theme-bus.ts + /api/theme): 6 presets + custom hex tokens; validation server side; paints CSS vars --rah-*; persists in Learner.theme; App applies on load so it survives reloads. Replaced all 5 identity hexes with var() across components (Tailwind v4 color-mix handles opacity modifiers).
- Chat UI: step trace chips (expandable), inline interactive ExamCard (answers, submit, per-skill result bars, item-by-item review), AssessCard (band bars + overall), actions applied client side (theme paint, hash navigation), progressive phase labels while busy.
- Browser-verified end to end at the PREVIEW URL: /skills directory, theme ocean applied + persisted + violet repaint visible, generate exam -> answered -> graded (count consistent, per-skill bars, item review), /deep full run (48s, 11 steps, bands updated), navigate + focus plugins, correction with Farsi trap tag. Zero console/page errors. Lint + tsc clean.
- Pushed c5816c3; GitHub Actions CI GREEN.

Stage Summary:
- The coach is an agent now: 22 skills, slash routing, step traces, exam engine with synonym-mercy grading, per-skill bands, 5-pass deep analysis, theme plugin. No scripted strings left (grepped: old fingerprints gone).
- Preview freshness is guaranteed and verifiable: /api/version matches on localhost and preview-chat-d027ce73-...space-z.ai, and every push to WasewaseX/rah-web (private, CI green) doubles as disaster recovery.
- Screenshots: download/screenshots/agent-01..08 (chat, exam card, graded, violet repaint, midnight reset, preview live).

---
Task ID: 8
Agent: Super Z (main)
Task: Fix the AI exam bug from the user's transcript ("generate a 12 question vocab only exam" returned a mixed exam), make the repo PUBLIC, keep the preview fresh.

Work Log:
- Root-caused the exam focus bug: skills-power.ts parsed requested skills with /vocabular\w*/, which does NOT match the bare word "vocab" in "vocab only exam"; the empty match silently fell back to the default collocation+grammar+vocabulary mix. ExamCard then labeled the exam "mixed: collocation, grammar, vocabulary" while the model also slipped writing-tagged rewrites inside.
- Fix 1 (parser): regex now /vocab\w*/ and the normalizer maps vocab/vocabulary alike, so "vocab only" yields exactly ["vocabulary"].
- Fix 2 (exam.ts): HARD FOCUS RULE in the examiner prompt (every item's skill field must be in targetSkills; a rewrite in a vocab exam is a vocabulary item); harvest() drops off-focus items and dedupes; one locked top-up generation round keeps announced count == graded count without shrinking silently.
- Fix 3 (ExamCard): single-skill exams now read "focus: vocabulary" instead of "mixed: vocabulary".
- Live regression scripts/test-exam-focus.ts: vocab-only 12q PASS (all items vocabulary), grammar-only 6q PASS (all items grammar); test-fuzzy.ts 15/15; test-all-ai.ts all endpoints PASS (chat, writing, quiz, listen, speak).
- Public-release hygiene: swept all git history and tracked files for the PAT (clean), untracked db/custom.db (user chat logs must not publish going forward; local file intact) and stale rah-web-export/ (106 files), removed the stray rah-repo gitlink so the /api/version beacon reads dirty:0.
- PATCHed repo visibility via API: WasewaseX/rah-web is now PUBLIC.
- Pushed 387e70b and 5d17af3 to main; remote main sha verified == local; /api/version identical on localhost and the preview URL (5d17af35070f, dirty 0).

Stage Summary:
- "vocab only exam" and every other "<skill> only" request now produces a strictly focused exam with matching label; announced count always equals graded count.
- Repo public at https://github.com/WasewaseX/rah-web (CI green), no secrets in history, runtime DB no longer published with future pushes.
- Preview serves the exact pushed commit: verifiable via /api/version on both origins.

---
Task ID: 9
Agent: Super Z (main)
Task: Fix the three AI failures from the user's transcript (reading question with no text, recycled exams, "4 questions vocab only no grammar" returning grammar items); respond to the external capability audit.

Work Log:
- Bug 1 (phantom text): the probe asked "According to the text, what was the main reason...?" with no passage. Fixed with a READING RULE in the examiner prompt (text-based items must embed their 2-4 sentence mini-text inside q) plus a broken-item guard: DANGLING_TEXT_REF regex drops any item that references a text/passage/author while being too short to carry one.
- Bug 2 (recycled exams): built a freshness moderator in exam.ts: 16 topic domains, 4 drawn at random per generation and required for at least half the items; an OVERUSED blacklist naming the exact cliches the user hit ("The new policy had a significant ___ on", "make something less severe", "By the time we arrived at the party", ...); loadFreshness() reads the last 4 exams from the DB and turns their sentences AND answer keys into an explicit ban list (no reused teaching points, no reused keys as answers or distractors); generation temperature raised to 0.9 via a new { deep, temperature } options param on aiJson/completeRaw (all call sites migrated off the positional deep flag).
- Bug 3 (negation ignored): "make an exam with only 4 questions and only vocab no grammar" parsed [vocabulary, grammar] because the word "grammar" matched inside the negation. skills-power.ts now strips negated mentions (no/not/without/except/other than/aside from/anything but, with optional filler words, typo-proof via gram\w* matching "grammer") into an exclusion set, matches skills only from the remaining text, applies exclusions to the default mix too, and relabels collocation items to vocabulary when vocabulary is the requested focus (the level engine already folds collocation into vocabulary), so the count promise survives. Top-up loop extended to two rounds.
- Count honored: the user's exact request now returns exactly 4 vocabulary items (was 4 items with 1 grammar, or 3 items the attempt before).
- scripts/test-exam-quality.ts: 9-assertion eval replaying the user's real failures - exact count (4/4, 12/12), focus exclusivity, zero recycled questions between two consecutive mixed exams, no dangling text references across all exams, no overused templates. ALL PASS, verified against genuinely fresh DB rows.
- Pushed 10ee30a to WasewaseX/rah-web (public); /api/version identical on localhost and preview (dirty 0).

Stage Summary:
- Exams are now moderated for freshness, focus, count, and self-contained reading items; the eval suite makes regressions visible instead of anecdotal.
- Audit response: adopted its P0 "automated evaluations" in the exam domain; learner memory of recurring mistakes and multi-skill orchestration are the next slices, graded quality gates before new skills.

---
Task ID: 10
Agent: Super Z (main)
Task: Point the user to the live site, make the deployment permanent ("never let this happen again"), and continue the roadmap (learner memory P0).

Work Log:
- Live link verified: https://preview-chat-d027ce73-8b7f-4fc0-910a-b2c665a663c0.space-z.ai/ (the old preview-16721396 short link is dead; chat-id form is the live one). Beacon matches on both origins.
- DEPLOY ROOT CAUSE FOUND by reading /start.sh (PID 1 = tini -- /start.sh): the platform boots the dev server ONCE with no supervision; if it dies, nothing revives it until a full reboot. This is the origin of every historical 404. Also discovered the official hook: /start.sh runs /home/z/my-project/.zscripts/dev.sh instead of the default flow when it exists.
- Deploy guarantee installed: .zscripts/dev.sh is a platform-owned self-healing supervisor (bun install, db push, restart-on-exit, restart after 60s of failed /api/version health checks, stale next-server cleanup). It activates at every platform boot from now on.
- Sandbox constraint discovered and documented: processes spawned from agent tool calls are reaped within ~20s (setsid/nohup do not survive), so a resident watchdog daemon is impossible; the boot-level supervisor is the correct layer. scripts/ensure-server.sh (idempotent reviver), scripts/watchdog.sh (optional), scripts/deploy.sh (one command: revive, verify, push, print proof) all kept for manual and agent use. A deliberate kill-test proved the reaper constraint and the reviver path.
- Mistake memory (audit P0 'genuine learner memory', slice 1): MistakeFamily model keyed kind:tag over the existing Farsi-interference trap taxonomy (statives, articles, prepositions, perfect, ...). recordMistakes upserts families with count + latest evidence; hooks on chat corrections (coachTurn, fire-and-forget), essay errors (/api/writing) and spoken errors (/api/speak). buildProfile carries the top 5 families; tutorSystem hunts them (a family at 3+ hits earns a dedicated turn); the examiner prompt prioritizes items that force those weaknesses into play, still under the freshness ban lists.
- New surfaces: /mistakes skill (counts + evidence + next action), GET /api/mistakes, 'Recurring mistakes' card on the progress page.
- Evals: scripts/test-mistake-memory.ts ALL PASS (two 'I am knowing' turns -> chat:statives x2, /mistakes names it, profile carries it); scripts/test-all-ai.ts all endpoints PASS; tsc and eslint clean.
- Pushed e474abd to WasewaseX/rah-web (public); remote main verified; deploy.sh printed matching beacons for local and preview, dirty 0.

Stage Summary:
- The site's permanent supervisor now lives at the layer the platform actually controls (boot), so the dead-server 404 class is structurally closed; within-session revives stay one command away (ensure-server.sh / deploy.sh).
- The coach remembers: recurring production mistakes now persist, surface, and steer every future prompt instead of being rediscovered from zero each session.

---
Task ID: 11
Agent: Super Z (main)
Task: Mistake-memory slice 2 - close the healing loop (weakness quota in exams, resolution, relapse reopening); keep deploying.

Work Log:
- Pushed 02526ec (file-mode normalization + worklog sync), then 38a942f with the healing loop; /api/version matched on localhost and the preview URL, dirty 0, after each push.
- Schema: MistakeFamily += streakClean, resolvedAt. Learner += mode, modeData (for Task 12).
- mistakes.ts: topMistakes(limit, activeOnly); noteExamAnswer(tag, wrong, right, correct) - correct answers extend the clean streak, 2 clean hits resolve the family, any new production mistake or exam miss reopens it (recordMistakes update now also clears resolvedAt/streakClean).
- Exam engine: spec.weakTags from the learner's active families (top 3); examiner prompt upgraded from a soft PRIORITY line to a WEAKNESS QUOTA (>= ceil(count/3) items must carry a validated "tag"); harvest drops model-invented tags; client items expose tag; grading reports every tagged item's outcome to noteExamAnswer.
- buildProfile filters resolved families out of prompt steering (activeOnly) and surfaces mistakesHealed; Progress card shows a "N healed" badge; /mistakes skill shows active leaks with clean-hit progress plus a "Healed and retired" section.

Stage Summary:
- The mistake loop is closed: mistake -> family -> exam items that hunt it -> two clean hits -> family retired -> prompts fall silent -> relapse reopens. Verified live end to end (Task 12's eval).

---
Task ID: 12
Agent: Super Z (main)
Task: Fix the grading failures from the user's transcript ("answered correctly but marked wrong", typos nuked, no coaching), and make the agent architecture 10/10 with 10 new super-agent skills.

Work Log:
- Fuzzy grader: slash/semicolon/or-separated answers are now graded as separate candidates ("Biology/echology" -> two shots); one-edit typo mercy on 7+ letter keys ("echology" -> "ecology" passes, advise/advice stays strict); inflection mercy unchanged (15/15 fuzzy suite).
- Hybrid grading (exam-ai.ts): every mechanical miss goes through one batched AI arbitration pass. GOLDEN RULE: if a native could naturally produce the learner's word in the blank, it MUST be accepted ("combine" for "blend" now accepted); rejection requires grammatical breakage, meaning change, term questions, or non-idiomatic collocation ("carbon usage" for "carbon footprint" still coaches). Every rejected miss gets a coaching card (rule + Farsi takeaway + trap tag). Stats recompute after arbitration, so the learner is never punished for regex blindness. Grading never stalls: deterministic fallback per miss.
- Every exam miss feeds the mistake memory: item tag first, arbiter's trap tag as fallback - so untagged misses land in families too, and the remediation loop has material.
- ExamCard: accepted items show "accepted: your wording works here"; misses show an amber coaching card with the rule and a right-to-left Farsi line.
- Repair loop (drill.ts): generateRepairDrill rebuilds the SAME teaching points in FRESH sentences (ban list covers old sentences, never the keys). remediate skill ("practice my misses") reads the last 3 graded exams' misses; repair-drill skill ("/drill prepositions") aims at named families.
- Mode machinery: Learner.mode/modeData persist conversation state across reloads; run.ts consults runModeFlow before skill routing (slash commands still win); every mode has clean exits with wrap-up. roleplay (6 preset scenes + custom, in-character partner, corrections on cards), debate (opponent takes the other side, 3 rounds, scored verdict), socratic (questions only, correction cards still reveal), daily challenge (one item built from the weakest spot, graded on the spot via the fuzzy engine, feeds the memory).
- 10 new skills: remediate, repair-drill, roleplay, socratic, explain (the one lecturing mode, with Farsi tail), debate, daily-challenge, coach-report (deterministic weekly numbers), minimal-pairs (curated Farsi-phonology pairs: th, w/v, clusters, ng, stress), summarize (fidelity + language check, corrections feed memory), plus exit-mode (/end /exit /stop).
- Central memory hook moved to the agent boundary: /api/chat records corrections from ANY skill envelope once (roleplay/debate/socratic/summarize all feed the same families; per-skill hook removed to avoid double counting).
- Evals: test-grading.ts replays the user's transcript (10 mechanical checks + 7 arbiter checks) ALL PASS; test-mistake-loop.ts (14 checks: seed -> steering -> tagged quota items -> clean hit 1 -> resolution -> steering silenced -> healed surfaced -> relapse reopen) ALL PASS; test-skills-smoke.ts (12 checks incl. roleplay continue-in-character and clean exits) ALL PASS; test-fuzzy 15/15; tsc + eslint clean.
- Live-AI regression note: test-mistake-memory's two chat turns hit provider 429s during the final battery; the same pipeline is covered by test-mistake-loop (recordMistakes + profile) and by the smoke test's roleplay correction landing as chat:prepositions x1. Rerun when the quota window resets.
- Supabase-style restart lesson recorded: the running dev server held the pre-db:push Prisma client, so new columns silently failed in noteExamAnswer until the server restarted (supervisor auto-revived it in ~3s, proving the boot guard again).

Stage Summary:
- Grading now has two brains: a deterministic regex layer that is fast and strict about patterns, and an arbiter that is generous about meaning and coaches every miss in Farsi. "All wrong" nukings of natural answers are structurally over.
- The agent grew from 22 to 33 skills with persistent conversation modes and a closed remediation loop; every new capability has a replayable assertion.

---
Task ID: 13
Agent: Super Z (main)
Task: Fix the Turbopack runtime error the user hit, restore full service after a platform volume restore, restore repo integrity, and keep the roadmap rolling ("countinue never stop").

Work Log:
- Diagnosed the Turbopack panic: an external root-owned dir (research/operon-lang, created 19:28 by the platform boot) was unreadable by user z; Tailwind v4's project-wide scan tracked the glob and "Permission denied" killed the whole /page endpoint. Fix: @source not exclusions for research/shots/download/rah/rah-run/tool-results/scripts in globals.css + .gitignore entries. Verified / compiles and serves 200 with no new panic logs.
- Second outage found while verifying: a platform volume restore had rolled db/custom.db back to a pre-healing-loop schema (no MistakeFamily table, no Learner.mode column) - /api/state and /api/chat were 500ing silently. The boot's `db:push || true` had failed without a trace. Fix: manual db:push + server restart, then hardened .zscripts/dev.sh with a canary probe (MistakeFamily.count) that retries db:push loudly 3x at boot so a restored schema self-heals from now on.
- Repo completeness: 70+ live files were untracked (the public repo would have been broken if cloned): all API routes, lib/agent-exam-tutor-skills libs, content, test suites. Security-scanned for tokens (none; release scripts use env-only), checked case-collisions (Tutor/tutor, Progress/progress) before adding. Committed and pushed 54ce20b.
- Dead legacy v1 layer (21 files: api/ai|bootstrap|checkpoint|coach|grammar|settings|track|tutor|tts|asr, lib/agent.ts|skills*|tutor*|builtin-ai|prompts|exam.ts, content/listening|practice) referenced the old Prisma schema and no live code reaches it - archived locally under download/_legacy-v1 and removed from src (b2bc6f8). tsc + eslint now fully clean.
- Git mode-churn silenced permanently with core.fileMode false (65 files of exec-bit flips were polluting every status).
- Tests: test-mistake-loop had a flaky assumption (examiner may hunt one family with 2+ tagged items in one exam -> resolves after a single exam); made the test count total clean hits instead. All suites green: fuzzy 15/15, grading ALL, mistake-loop 14/14 (incl. early resolution), skills+modes smoke ALL, mistake-memory ALL (the previously 429-blocked regression cleared).
- Live-AI suites needed provider-quota spacing (429s during back-to-back runs); staggered reruns passed. Test-seeded mistake families cleaned from the real db so they never steer the learner's prompts.

Stage Summary:
- The site survived two silent infra failures (unreadable scan dir + rolled-back schema) and both failure classes are now structurally guarded: @source-not build-guard in CSS and a canary-probe schema guard at boot.
- The public repo now contains the complete live app (frontend + backend + tests), type-checks clean from a fresh clone, and the beacon serves dirty:0 at b2bc6f8 on localhost and the preview URL.

---
Task ID: 14
Agent: Super Z (main)
Task: Fix the placement-test bugs the user reported ("whatt passage??" - reading items referencing passages that do not exist; options that give away the answer with 3 negative distractors + 1 positive) and sweep the whole bank for more of the same.

Work Log:
- Audited all 25 placement items; bugs found: all 4 reading items referenced an unseen passage (r1/r3/r4 said "the passage", r2 quoted an unseen phrase); the reading distractors were classic give-aways (3 negative strawmen + 1 hedged/positive key, longest-is-correct on r1); 18 of 25 items had empty trap fields; v3 ('bear' vs 'hold up to' scrutiny) and c3 ('laid' vs 'put' emphasis) had TWO idiomatic keys; v7 used a misspelling distractor ('divice'); keys sat on A/B in 96% of items (A=11 B=13 C=1 D=0); the route collected trap codes but never showed any feedback, and start did pickItem(s)! with no guard.
- Rebuilt the bank (scripts/build-placement.py writes src/content/placement.json and self-validates before writing): every reading item now embeds its full 2-3 sentence mini-passage before the question; distractors are plausible misconceptions with mixed polarity and similar lengths; v3 and c3 rebuilt as single-key items; all traps filled with learner-true misconceptions (incl. new codes conditional, fluency_illusion added to TAG_LABELS).
- Route (/api/placement): choices are now Fisher-Yates shuffled per delivery (grading compares text, so this is safe) which makes static position bias irrelevant; answer responses now return key + human trap label (via new exported tagLabel() in mistakes.ts) on every miss; start guards against an empty bank.
- UI (Placement.tsx): question renders whitespace-pre-line so embedded passages read as a passage block; a miss now shows "Correct answer: X" plus "The trap: ..." for 4.2s instead of a bare "Missed." flash of 0.9s.
- New deterministic gate scripts/test-placement.ts (25-item structural checks, phantom-passage regex, 3-negative/unique-hedge/longest-key tells, trap presence, per-section key-position balance) plus scripts/test-placement-live.ts which walks the whole placement flow against the running server (verifies shuffling in delivery, passages in reading items, key+trap on a deliberate miss) and restores the learner's placement state afterwards so the user's real result is untouched.
- Verification: test-placement ALL PASS, test-placement-live ALL PASS (12 live checks), test-fuzzy 15/15, test-grading ALL PASS, tsc + eslint clean, / and /api/placement return 200.

Stage Summary:
- The placement test can no longer ask about a passage it never showed, its options no longer self-signal the answer, every miss teaches (key + trap), and a build-time gate plus a live drive keep this class of bug from ever shipping again.

---
Task ID: 15
Agent: Super Z (main)
Task: Close the diagnostic gap the placement bug-sweep left behind - placement misses were stored but never fed the mistake-memory healing loop - and add the first orchestration hook (result screen hands the coach its next move).

Work Log:
- Found the gap: /api/placement stored every answer's trap code but nothing ever called recordMistakes/noteExamAnswer, so the richest signal the app gets (a measured, deliberate miss on a tagged trap) was thrown away. Added kind "placement" to MistakeInput (schema comment updated; kind is a plain String, no migration).
- mistakes.ts: foldPlacementMisses() - groups misses by normalized tag, records placement:* families with evidence "pick -> key", and reopens every family sharing the tag regardless of kind (same relapse rule an exam miss follows); returns a TrapSummary[] (label + count) for the result screen.
- /api/placement: Session answers now keep the exact picked text (pick); the terminal "writing" action folds all misses into the loop after the level is written and returns `traps` in the done response.
- Placement.tsx done screen: "Traps to watch" amber panel (labeled chips with miss counts) + a "Hunt these traps now" button that seeds rah.pendingCommand and routes to #chat - the examiner's weakness quota picks the new families up automatically.
- Chat.tsx: consumes rah.pendingCommand exactly once after history loads (orchestration bus any view can use); fixed stale copy "Twenty-two skills" -> "Thirty-six skills" (and header comment).
- test-placement-live.ts upgraded from a quiz-walk to a full-flow drive with total state restoration: submits the writing sample (live AI), asserts the trap summary, the placement:* families, evidence text, the reopen of pre-seeded healed chat:word_choice / chat:fluency_illusion families, and that /api/state profile now steers with those tags; restores placement row, learner fields, ALL MistakeFamily rows and today's DailyStat afterwards. Also fixed a pre-existing tsc error (line 76 boolean coercion) surfaced by --incremental false.
- Verification: PLACEMENT LIVE ALL PASS (22 checks incl. reopen + steering), PLACEMENT BANK ALL PASS, fuzzy 15/15, HYBRID GRADING ALL PASS, HEALING LOOP ALL PASS, tsc + eslint clean, / and /api/placement 200.
- Pushed b9b0fec to WasewaseX/rah-web; /api/version = b9b0fec390c5 dirty:0 on localhost and the preview URL.

Stage Summary:
- Placement is no longer a dead-end diagnostic: every tagged miss now seeds a family, reopens healed ones, shows on the result screen, and steers the very next exam - the loop the user demanded ("wont ever let it happen") now starts at the measurement itself.
- The orchestration bus (pendingCommand) gives every surface a one-line way to hand the coach its next move; the placement result uses it first.

---
Task ID: 16
Agent: Super Z (main)
Task: Root out the ARCHITECTURE flaw behind the recurring broken-exam bug class ("you say a random statement and want me to answer a vocab??") - bare statements shipped as rewrite tasks, trivia shipped as English items, ambiguous keys, MCQ keys not among choices, fake weakness tags.

Work Log:
- Root cause identified: exam generation was validated for SHAPE only (fields exist, choices present, skill in focus). Nothing between the model and the learner ever asked "can this item be answered?" - so every failure mode of the generator reached the user. The same shape-only philosophy had caused phantom passages and recycled exams before; each got a point fix while the class stayed open.
- Architectural fix - a two-layer ANSWERABILITY GATE, same pattern as the two-brain grading:
  * Layer 1 (deterministic, src/lib/agent/exam-gate.ts): TRIVIA_REF bans encyclopedic term-hunting ("what term describes...", "which document..."); bare-statement ban (no blank + no question + no instruction verb = dead regardless of claimed type); rewrite must carry its instruction inside q; cloze must contain a forced blank; short needs a blank or an explicit form task; MCQ key must be among the delivered choices; cloze key must not leak into the sentence. itemFairlyAsked exported for keyless client payloads.
  * Layer 2 (AI, exam-ai.ts vetItems): one deep-mode batched pass over the whole pool judging ambiguity (several natural answers not covered by accept), unfair MCQs, broken keys - and a tag-integrity audit that STRIPS a weakness tag from any item that does not genuinely force that trap (a fake tag poisons the healing loop). Failure never stalls generation (falls back to layer 1).
  * Generator prompt now carries per-type CONTRACTS (mcq single-defensible-key rules, forced cloze, forced short, instruction-inside-q rewrite, trivia ban) so the model wastes fewer items; harvest drops gate failures and keeps a report; a converging top-up loop (up to 3 gated+vetted rounds) preserves the count promise the coach announces; spec.weakTags is pruned to families that actually survived the tag audit, so "hunting: articles" is only ever announced truthfully.
- The user's verbatim broken items are now permanent negative fixtures in scripts/test-exam-gate.ts (15 checks: bare statements from two exams, cooking/sport/document trivia, open collocation quiz, key-off-choices mcq, blankless cloze, key leak; plus 5 fair items that must keep passing). Live eval (test-exam-quality.ts) gained 3 assertions: every delivered item passes the gate, zero trivia phrasing, every rewrite carries its instruction.
- Orchestration (bus.ts completed): handCoach() = sessionStorage command + BUS_EVENT + navigation to #chat (both halves: event wakes a mounted chat, navigation reaches an unmounted one); Chat consumes exactly-once with a busy-safe retry (command stays queued while a turn runs). ExamCard result view gained "Drill these misses with fresh sentences" (remediate handoff); Placement result's "Hunt these traps now" migrated to the bus.
- Verification: ANSWERABILITY GATE ALL PASS (15), EXAM QUALITY live ALL PASS (13, incl. 4/4 and 12/12 counts through the gated pipeline), HEALING LOOP ALL PASS (14) on the new pipeline, PLACEMENT BANK ALL PASS, fuzzy 15/15, tsc + eslint clean. Provider 429s during back-to-back suites confirmed the graceful degradation path ("The exam builder stalled... one more try usually lands it").
- Visual proof from a fresh mixed exam: every rewrite carries an instruction ("Rewrite using more formal vocabulary: '...'"), the articles-tagged item genuinely drills articles ("Correct the sentence by adding appropriate articles: 'I need to buy ___ new luggage before my trip to ___ Japan...'").
- Pushed cf62fc1 to WasewaseX/rah-web; /api/version = cf62fc18c1c5 dirty:0 on localhost and preview; home + chat API 200.

Stage Summary:
- The bug class is structurally closed: an item cannot reach a learner without passing a deterministic fairness gate and an AI answerability arbiter, and the eval suite replays the user's exact broken items as permanent fixtures. Quality failures now fail loudly in CI-style checks instead of shipping to the user.
- The count promise survives the gate (converging top-up), and the weakness banner can no longer lie (tag integrity audit + weakTags pruning).

---
Task ID: 17-24 (one mega-slice, 7 commits)
Agent: Super Z (main)
Task: "add 10 game breaking mind blowing features" - build a full game layer on top of the healing loop without stopping the roadmap.

Work Log:
- Task 17 (engine): schema += Learner.xp/freezes, Achievement, GameStat, Quest, Rival (db:push clean). src/lib/arcade.ts: 40-level ladder (50*(L-1)^1.45) with names, awardXp() single XP faucet (pays Learner.xp + DailyStat.xp + evaluates 17 achievements), ensureQuests (deterministic 3/day from 12 templates), progressQuest (sum|max kinds, auto-pays XP), bumpStat records, rubber-band rival (weekly XP = 80% of learner's trailing 7-day average with seeded per-day jitter; rollover settles win/loss and rerolls name+taunt), getGameView with 90s recent-unlock window. touchStreak grew the Streak Forge: freeze auto-absorbs a 1-day gap, 7-day streaks mint freezes (cap 2). All 7 XP routes refactored onto awardXp (review, exam, chat, writing, speak, quiz, listen) + quest hooks. /api/state + new /api/arcade expose the game layer; App.tsx got trophy fanfare toasts (sessionStorage-deduped); Home hero got the level XP bar. Engine smoke (10 checks incl. full state restore) green.
- Task 18 (games): src/lib/arcade-items.ts builds zero-latency pools from the 218-card DECK biased by active mistake-family tags (mcq from card distractors, cloze from prompt/answer). Speed Round: 60s, 5x combo cap, server clamps submitted score to the accuracy ceiling (10*tri(min(5,combo)) + 50*(correct-combo)) so tampered clients cannot mint records - proven by a cheat test. Boss Battle vs The Examiner: 3 phases x 8 weakness weapons, 3 hearts, taunts per phase, flawless-run tracking. Arcade.tsx floor with tab nav + trophy cabinet; App nav += Arcade (Gamepad2). Live drive: 19/19 with restore. Learned the new react-hooks compiler lints the hard way: no ref reads/writes in effects-render paths (refactored SpeedRound tally to state+handler-written ref, deferred fetch effects).
- Task 19 (retention): Home got Today's Missions panel (progress bars, instant-pay chips, all-cleared state) and the Weekly Race strip (dual-color bar, taunt, W/L record); Progress got the Streak Forge card (freeze bank + next-freeze countdown).
- Task 20 (voice): /api/arena/voice serves 5 speakable (4-14 word) drills biased by active families; browser ASR captures the shadow; server scores via LCS word-diff (arena-score.ts: matched/missed/extra, extras penalize half, accuracy 0-100) and pays 30/20/10 XP by band; quest arena_5 hooked; reps logged to SpeakSession (prompt "arena:" prefix, disposable). VoiceArena.tsx: TTS playback, live listening state, per-rep scorecard with missed-word chips, session summary. Live drive 10/10 incl. perfect=100, missed/extra detection, garbage-low.
- Task 21 (SRS Blitz): BlitzDeck.tsx - swipe-mode review on the same queue/grade endpoints: tap/space to flip, swipe or arrow keys to grade (left Again, right Good, up Easy), 4-second decision bar that auto-grades Again on hesitation, live FSRS interval previews on the grade buttons, session stats with fastest decision. Review.tsx gained a Classic/Blitz segmented toggle. More compiler-lint refactors: unmemoized grade closure, deferred load, dragging as state.
- Task 22 (war room + mind reader): /api/progress now returns per-day correct + the six SkillLevel rows. Progress.tsx: Mastery radar (pure-SVG hexagon with grid rings + per-skill dots), Accuracy trail (35-day polyline against the 85% C1 zone), C1 distance panel (gap in points, the two lagging skills, rough graded-items-to-C1 estimate divided by current evidence pace - labeled as rough). Mind Reader: /api/mistakes GET now returns active + healed families; DELETE ?id= forgets a family; MindReader.tsx lists each family with its wrong->right evidence, count, heal progress bar (streakClean/2) and a two-step Forgive & Forget button. Replaced the old thin mistakes card.
- Task 23 (share + social): src/lib/battle-card.ts draws a 1080x1350 canvas battle card (level ring, XP, streak/trophy/accuracy/freeze tiles, mastery radar, game records, rival race bar) -> PNG download; BattleCardButton (self-fetching) placed on Progress and the trophy cabinet. Home's race card gained "Get a revenge plan from the coach" - a handCoach() orchestration-bus handoff that navigates to the chat with a flip-the-race plan request when losing.
- Task 24 (gates): tsc clean, eslint src fully clean, PLACEMENT BANK ALL PASS, ANSWERABILITY GATE ALL PASS, fuzzy 15/15, HYBRID GRADING ALL PASS, ENGINE SMOKE 10/10, ARCADE LIVE 19/19, VOICE ARENA 10/10 (all live drives restore state).
- PUSH BLOCKER: the GitHub PAT embedded in the origin remote is now rejected for writes ("Invalid username or token") though anonymous reads still work (public repo). No env/credential-helper fallback exists on this box. All work is committed locally (7 commits on top of cf62fc1); the push needs a fresh token from the user.

Stage Summary:
- The healing loop became a game economy: every surface pays one XP currency into a 40-level ladder, 17 trophies read real behavior, daily missions aim at the leaks, and the two new games (Speed Round, Boss Battle) plus the Voice Arena drill the exact mistake families the coach is hunting.
- Trust and shareability shipped alongside: the Mind Reader exposes the coach's memory with a forget switch, the War Room turns mastery into radar/trail/distance, and the battle card makes progress portable.
- Anti-cheat is structural on the only client-scored surface (accuracy-ceiling clamp), and the whole layer is regression-locked with state-restoring live drives.

---
Task ID: 25
Agent: Super Z (main)
Task: "test again" (new GitHub token) + "refine the features to maximum give the features 4 sub feature each (40+)" - ship the Maximum Edition: 10 features x 4 sub-features, all surfaces live-tested.

Work Log:
- Token tested: API says 401 Bad credentials in both Bearer and Basic shapes (revoked/expired/mangled - not a permissions issue). Pushes remain queued; retried after every commit. User must mint a fresh fine-grained PAT with Contents: Read/Write on WasewaseX/rah-web.
- Platform volume restore had AGAIN resurrected the deleted legacy v1 layer (40+ files: lowercase component twins, dead api routes, old libs) which broke tsc with a Tutor/tutor case collision; purged all of it again (kept new api/coach/briefing).
- Slice A (engine, b9a969e): schema += Learner.chain/chainDay/sp/perks/persona, League, RunState, Briefing (db:push clean). arcade.ts: momentum chain (registerHit/registerMiss, per-day, miss halves, heat tiers 1.0/1.05/1.1/1.2/1.3 at chains 0/5/10/15/25), awardXp(amount, {chainHit, perkXp}) applies heat + perk multipliers and banks 1 SP per level-up, talent catalog (6 real perks) with getPerksView/buyPerk (retroactive SP catch-up on first open), weekly League (6 divisions Wood->Rahiator, 7 deterministic ghost rivals from the rubber-band daily target, top-3 promoted +150 XP, bottom-3 demoted, history). arcade-items.ts: seededShuffle + buildDungeonFloors (3 floors x 4 items, day-seeded, difficulty and weak-tag density climb), duelPar (deterministic rival hits from the learner's trailing accuracy), buildGauntletItem (escalating pools: shallows -> B2 -> C1 -> hot tags). 8 new APIs: league, dungeon (server-graded, keys never ship), duel (client-graded + par + clamps), gauntlet (server-graded, one life, shield save), perks (GET/POST), flow, exam/replay (shelf + bundle), coach/briefing (cached daily AI plan + persona switch). Momentum hooks wired into all 10 XP routes; freeze_cap widens the streak-freeze cap to 3 in touchStreak; /api/state now carries league + chain. 9 new trophies, 5 new quests.
- Slice B (UI, aab020d): Arcade gained six floors (League standings with promotion/demotion cut lines + history, Dungeon with hearts and floor theme, Duel with live timer/par, Gauntlet with live PB banner + shield chip, Talent tree with per-branch SP cards, Focus Flow with 15-min shield). Momentum chips in the shell header, Arcade header and Home hero (chain xN, heat multiplier). Home gained the AI Director briefing card (priority + 3-step plan + pep line, mentor/drill/zen switch, speech-synthesis Listen, re-brief). Progress gained Replay Theater (step through graded exams turn-by-turn: your answer, the key, the coaching rule) and Writing Portfolio (band chips, error diffs, first-vs-latest growth note).
- INCIDENT (root-caused, self-inflicted): my manual dev-server restart at 21:06 left a SECOND supervisor loop running; every supervisor generation starts by pkill-ing next-server, so two supervisors slaughtered each other's server every ~60s - the "crash" that killed exam-via-chat was SIGTERM from my own rogue loop, not app code. Bisected via stash + a c6596f9 worktree on :3001 to prove the app was innocent, then killed the rogue. One platform supervisor remains; stability verified.
- Slice C (gates, 7b0d672): scripts/test-arcade2.ts = 55-check live drive with restore-in-finally (survives crashes). The drive caught THREE real bugs: (1) toMcq shipped RAW accepts while the dungeon grades normalizeAnswer(pick) - any Persian key with parentheses never matched, so server-graded MCQs were unwinnable; (2) tier-2/3 perks were unreachable (same-branch rule, but most branches hold a single perk) - gate now counts global perks owned; (3) the Gauntlet could never restart after death - fresh GET now rolls a new run. Also rewired dungeon_perfect to the perfect stat (it unlocked on best-floors>=3), and the weak-tag bias surfaced two deck data holes: grm137/grm138 were blank-cloze cards with EMPTY answers (zero-article items that could never be answered) - rewritten as definite-article items with matching distractors, plus a pool-level usable() guard so this card class can never enter any pool again.
- Regression fixes in suites: engine-smoke neutralizes momentum before its deterministic +10 XP check (and restores chain); arcade2 retries 5xx cold-compiles and treats provider-429 briefings as SKIP not FAIL.
- Verification: MAXIMUM EDITION LIVE 55/55, ARCADE LIVE 20/20 (was 19/1), ENGINE SMOKE 10/10, HEALING LOOP ALL, HYBRID GRADING ALL, ANSWERABILITY GATE ALL, PLACEMENT BANK ALL, fuzzy 15/15, SKILLS+MODES ALL. tsc + eslint clean. Beacons 7b0d6720c1ca dirty:0 on localhost AND preview.
- State integrity: reconstructed and reverted the 429-XP drift from the crashed first drive (xp 465->36, sp 5->0, perks cleared, persona drill->mentor, test GameStats/achievements/RunState/Briefing rows deleted).

Stage Summary:
- The Maximum Edition is live end to end: momentum makes every correct answer anywhere heat up XP everywhere; the League gives the week a ladder; the Dungeon/Duel/Gauntlet drill leaks with real stakes; talents make mastery spendable; the Director plans the day in the learner's chosen voice; replays and the portfolio make growth visible.
- The 55-check drive is the new arcade regression gate, and it already paid for itself by catching an unwinnable-MCQ grading bug, an unreachable-perk economy, an unrestartable mode, and two dead deck cards.
- Blocked only on the GitHub token: 3 commits queued (b9a969e, aab020d, 7b0d672) on top of remote cf62fc1; every retry fails with 401 Bad credentials. The moment a valid PAT lands, one push drains the queue.

---
Task ID: 26
Agent: Super Z (main)
Task: "the app is better now but still sloppy countinue then reverse engineer for real use these (REA/Frida/angr)" - real source-level reverse engineering of the reference engines + ship.

Work Log:
- REA/Frida/angr assessed: binary-level tools, inapplicable to open-source targets where we hold REAL source (strictly better than pseudocode) and to our own app. Did the legitimate version: cloned the reference implementations' source and differential-tested our ports against them.
- FSRS PARITY GATE built (scripts/test-fsrs-parity.ts): our hand-rolled FSRS-5 vs ts-fsrs v4.6.1 (pinned; v5.x defaults are FSRS-6/21 weights, our port documents v4.6.1 agreement). Dual-reference design: enable_short_term=false matches our day-granular app (new-card init + all long-gap steps), short-term mode matches the same-day learning ladder. 400 randomized mulberry32-seeded sequences.
- THE GATE CAUGHT 3 REAL ALGORITHM BUGS in src/lib/fsrs.ts (all fixed, parity now EXACT to 6 decimals):
  (1) recall/forget stability consumed the just-UPDATED difficulty; reference feeds the PRE-review difficulty into (11 - D);
  (2) post-lapse stability capped at s/exp(w17*w18) - the SHORT-TERM scheduler rule; reference long-term rule is clamp(preS, S_MIN, S_forget) - every post-lapse interval was too short;
  (3) the four grade intervals are ORDER-CONSTRAINED in the reference (Again < Hard < Good < Easy, min gap 1) - a new Hard was scheduling 1 day, reference says 2; review() now computes all four candidate stabilities and order-constrains, same-day ladder aligned to learningState (Again/Hard stay in today's queue, Easy clears a Good by a day).
- LanguageTool adopted (src/lib/languagetool.ts): public API client (api.languagetool.org/v2/check, picky level, 8s timeout, one 429 retry, 2.5s spacing, graceful null). Error-vs-style separation (ERROR_CATEGORIES vs STYLE_CATEGORIES), trap-tag mapping onto our mistake families (spelling/prepositions/articles/countability/statives/perfect/...), overlap-aware backstop merge into graded errors (cap 6), findingsBlock() grounds the LLM. /api/grammar-check route shipped. Writing route rewired: rule engine FIRST (screenText), LLM SECOND with findings in-prompt, backstop merge, ruleChecks persisted + shown in Write.tsx (rule-engine strip: errors flagged / style notes / caught-by-rules-alone).
- Gates: tsc clean, bun eslint clean (src), FSRS PARITY PASS (400 trials zero divergence), GRAMMAR CHECK 20/20 (incl. live api.languagetool.org round-trip: "didn't went -> didn't go"), EXAM FOCUS ALL PASS, ANSWERABILITY GATE ALL PASS, PLACEMENT BANK ALL PASS, ENGINE SMOKE 10/10, HEALING LOOP ALL, FUZZY 15/15, MAXIMUM EDITION LIVE 55/55 with full state restore.
- Cleanup: deleted stale scripts/test-exam-grade.ts (targets the removed /api/coach/exam v1 endpoint); test-exam-quality.ts now SKIPs (exit 2) on provider-429 text fallbacks instead of failing.
- Provider 429 quota window active during the final live drives (exam-quality vocab-count check + one live writing POST): LT pre-check proved working inside the route, AI step quota-blocked; SKIP not FAIL per established protocol. Retried before commit.

Stage Summary:
- The scheduler is no longer "ported 1:1" as a claim - it is a regression-locked fact: 400 randomized sequences, zero divergence from the reference implementation, permanent gate in scripts/test-fsrs-parity.ts.
- The writing coach now stands on a deterministic rule engine: free, offline-grade findings with offset-accurate excerpts ground the LLM and backstop its misses; errors and style are separated and only errors feed the mistake memory.
- The user's pasted broken exam classes remain regression-locked by the answerability gate (fixtures in test-exam-gate.ts); exam focus + quality suites re-prove count/focus promises live.

---
Task ID: 26-final
Agent: Super Z (main)
Task: harden + live-prove the LanguageTool fast path; ship everything.

Work Log:
- Live writing drives: first two returned ruleChecks null - isolated via direct LT probes (1s responses, healthy) to the public API's per-IP BURST throttle triggered by our rapid successive calls during the AI-quota retries. Hardened src/lib/languagetool.ts: timeout 8s->10s, dedicated RETRY_BACKOFF_MS 6000.
- Final live writing run PROVED the full architecture end to end: LanguageTool screened 4 errors -> grounded LLM confirmed all 4 (backfilled: 0 - zero misses by the AI on rule-engine findings) -> added its own 5th -> ruleChecks strip populated in the response; corrections are real teaching pairs ("should to spend"->"should spend", "childrens"->"children", "the parks is"->"the parks are").
- Final gates: tsc clean, GRAMMAR CHECK 16 pass / 0 fail / 1 skip (endpoint check raced the writing drive's spacing - unit + live client checks all green), FSRS PARITY PASS.
- PUSHED: 8bf26ce (RE slice) + 85000ce (hardening) to github.com/WasewaseX/rah-web main. Push backlog DRAINED (was 15 commits behind).
- Beacons: localhost AND preview both serve 85000ce314e3 dirty:0. Tree clean.

Stage Summary:
- Reverse engineering delivered the real thing: a differential parity gate that caught 3 genuine scheduler bugs and now permanently locks our FSRS-5 to the reference implementation; a rule-engine fast path under the writing coach with error/style separation and mistake-memory tagging; everything regression-locked, deployed (dirty:0 both surfaces), and on GitHub.

---
Task ID: 27
Agent: Super Z (main)
Task: "countinue never stop" - ship Learner Model v2 (the central learner model from the repo brief): per-tag mastery + uncertainty + deterministic next-best-action.

Work Log:
- Orientation: tree was clean at db3f610, both P0s confirmed closed (handCoach navigates; answerability gate live). Pushed the queued worklog commit db3f610.
- Schema: TagMastery {tag @id, ok, no, ewma, lastOk, lastNo} - the fine-grained half of the learner model; MistakeFamily only ever tracked failures, so the app could not say "articles: 45%, rising". db:push clean.
- src/lib/mastery.ts: noteTagOutcome (EWMA alpha 0.35, swallows its own errors so the ledger never breaks a surface), wilsonLower (95% z=1.96) - 2/2 correct stays "unproven" (bound ~0.34) instead of 100%, classifyTag statuses danger/fragile/rising/solid/unproven with trend arrows on a 0.12 ewma-vs-raw gap, getMasteryView (sorted, human summary line), masteryWeakTags (danger+fragile for the exam quota).
- src/lib/next-best.ts: deterministic selector, urgency-ordered, max 4: review (due cards, 0.98 when full queue), drill (Wilson danger tags, urgency scaled by depth), test (near-healed families streakClean>=1 - cheapest win, retires them), review fragile, test hot unresolved families, teach weakest measured band. Every action carries its measured reason + a coach command string.
- KEY-UNIFICATION BUG (caught by my own drive before shipping): mastery.normalizeTag originally collapsed to hyphens while mistakes.normalizeTag canonizes to lowercase underscores - same raw tag would fork into two keys across ledger/family memory. Fixed by mirroring the family canon exactly; the drive now proves "Drive Prepositions!" lands on the same row as drive_prepositions and NO hyphen fork exists. Display side replaces [_-] with spaces.
- Evidence wired: exam grade (Promise.all noteExamAnswer + noteTagOutcome per tagged item, BOTH outcomes), mode-flow daily challenge, writing route (LanguageTool trap tags debit on confirmed production errors), placement foldPlacementMisses (debits per miss tag).
- Surfaces: /api/state carries mastery + nextBest; Progress War Room gains "Mastery ledger" panel (wilson bars, trend arrows, status colors, ok/no counts) and "Coach's next moves" panel (urgency-ordered actions with one-tap handCoach handoff); briefing route grounds the Director with enginePlan (priority+plan MUST follow the engine's decided moves - engine decides, AI words it); exam generator weakTags = families + proven danger/fragile tags (cap 3).
- Ops incident handled the safe way: dev server had loaded the pre-generate Prisma client (db.tagMastery undefined, /api/state 500); ONE controlled restart via pkill + ensure-server.sh (single supervisor, no rogue loops) - healthy in 4s.
- Gates: MASTERY DRIVE 29/29 (state-restoring: ledger math, real exam-grade route integration credits AND debits, family-key unification, state payload, selector ordering/cap/commands, near-healed close-out, summary names the leak). ANSWERABILITY GATE ALL. FSRS PARITY PASS (400 seq). ENGINE SMOKE 10/10. FUZZY 15/15. tsc clean, eslint clean. Healing-loop + arcade drives hit the provider-429 quota window mid-run (exam 2 generation 429) - SKIP per protocol, retried below.
- PUSHED 8230ef4 to WasewaseX/rah-web main. Beacons 8230ef402eaa dirty:0 on localhost AND preview.

Stage Summary:
- The app now owns a real central learner model: per-tag success ledger with statistical honesty (Wilson), recency-weighted form (EWMA), trend arrows, and a deterministic next-best-action engine that decides the day's moves and hands them to the learner with one tap. The AI Director executes the engine's plan instead of improvising its own.
- The drive caught and locked a key-unification fork that would have silently split the ledger from the family memory for any tag containing a hyphen or space.

---
Task ID: 28
Agent: Super Z (main)
Task: regression battery + root-cause the stochastic healing-loop failures (user's standing "root out the architecture flaw" directive applied one layer deeper).

Work Log:
- Regression battery exposed a SECOND stochastic flaw in the exam architecture, same bug class as P0-2: the weakness quota was prompt-steered, not enforced. When the model skipped the quota OR the AI vet stripped every tag (both observed live), tag honesty collapsed spec.weakTags to [] and the exam shipped with ZERO hunting items - the healing loop stalled randomly (mistake-loop drive: 4, then 7, then 15-check failure variance across runs).
- Fix, exam.ts: tag honesty evaluated ONCE at the end; hunted tags with zero surviving items trigger (1) a tag-locked CRITICAL OVERRIDE generation round, then (2) deterministic evidence items from exam-gate.evidenceItem() - the family's recorded "wrong -> right" IS a forced cloze; stem-similarity heuristic blanks the correction token ("childrens -> children are playing" blanks "children", not "playing"). Quota items sort first so the count slice can never amputate them. spec.weakTags re-honested after enforcement.
- Placement 500 flaw (exposed live): the writing action had no provider-failure fallback - a 429 bricked placement completion. Now degrades to the MCQ-derived level with writingFallback flag; placement always completes. The drive PROVED the fallback live during the active quota window.
- test-skills-smoke.ts: adopted the established SKIP-on-429 protocol + cascade guards (throttled mode start skips its continuation checks) + full-detail diagnostics; suite now separates app-broken from provider-throttled (5 honest SKIPs, 0 false FAILs).
- test-placement-live.ts: null-body guard with actionable failure instead of a TypeError crash.
- Gates: MASTERY 29/29, ANSWERABILITY ALL (4 new evidence-item checks incl. gate-compatibility), HEALING 15/15 DETERMINISTIC, EXAM FOCUS ALL, ENGINE 10/10, FUZZY 15/15, FSRS PARITY PASS, MAXIMUM EDITION 55/55, PLACEMENT LIVE ALL, SKILLS+MODES ALL (5 SKIP), GRAMMAR 16/0/1. tsc + eslint clean.
- PUSHED 3884649. Beacons 3884649b4b03 dirty:0 on localhost AND preview.

Stage Summary:
- The exam architecture's promise chain is now enforced end to end: count (slice guard), answerability (gate), focus (skill filter), and NOW the weakness quota - every promise the exam card makes is backed by deterministic machinery, with AI as the generator and evidence items as the last-resort floor.
- The healing loop can no longer stall: a family with evidence ALWAYS gets its hunting item, even with the AI provider completely down.

---
Task ID: 29
Agent: Super Z (main)
Task: "countinue never stop" - mega-update spec ("Close Every Loop" wave) + ship P1 (exam->FSRS unification).

Work Log:
- Re-orient: clean tree at 8776e10, both Task-28 P0s confirmed closed, PAT live (ls-remote OK), beacons healthy. Gap audit grounded in grep evidence: exam grades never touched CardState; no manifest/SW/notifications; Read static six texts; Listen lab already strong (5 steps) but no dictation/proximity scoring; no JSON export.
- MEGA-UPDATE.md: the Close Every Loop wave spec - five pillars, each with a verified gap, concrete design, and a live gate: P1 exam->FSRS unification, P2 PWA + habit loop, P3 content ladder v2, P4 listening lab v2 (dictation + pronunciation proximity), P5 portability + CEFR map. Wave order justified. Pushed 87864f1.
- P1 SHIP: ReviewLog.source column (review|exam|dictation|shadow, additive, db:push clean). New src/lib/exam-cards.ts: resolveExamCardTargets (deck match by answer/en/alt case-insensitive, tagged fallback to exam:<tag> namespace, unresolvable items schedule NOTHING, same-card outcomes merge to the WORST grade so one exam can never inflate stability twice), scheduleExamOutcomes (SAME review() pipe as the review route, no arcade calls - scheduling is evidence capture, not a second reward; suspended cards respected), derivedExamCard (renders exam:<tag> at queue time from the family's own wrong->right evidence).
- blankCorrection extracted from exam-gate.evidenceItem so the exam gate and the schedule share ONE definition of what "the correction" is; evidenceItem refactored onto it.
- exam.ts: scheduling after verdicts are final (post-arbiter, post-healing), wrapped in try/catch so it can never break grading; ExamResult.scheduled surfaced to the client. Queue route resolves due states through cardById ?? derivedExamCard - the old code silently DROPPED unknown cardIds, so healing cards would have existed but never surfaced; caught in design review before the drive.
- Drive test-exam-fsrs.ts (state-restoring, full snapshot incl. CardStates, exam-source logs, family, ledger, learner, DailyStat, quests, achievements): 18/18 ALL PASS. Two drive-only calibration findings, both assertions corrected to test the true claim: (1) the engine is a long-term FSRS - a grade-1 lapse schedules the post-lapse minimum (lastivl 1, due tomorrow, lapses+1, stability crushed), identical to the review route for the same grade; (2) queue surfacing proven on the real-world timeline (yesterday's bomb due today). Live-proven: route grading writes both targets, provenance rows exist, queue renders the healing cloze with the family label in its note, unknown tags yield null honestly.
- Ops: one controlled server restart (single supervisor) after the drive exposed stale-module grading (scheduled: []) - the known class; rerun clean.
- Gates: EXAM-FSRS 18/18, ANSWERABILITY ALL, FUZZY 15/15, FSRS PARITY 400 seq, ENGINE 10/10, MASTERY 29/29, HEALING ALL, EXAM FOCUS ALL, EXAM QUALITY partial (1 honest SKIP, provider 429), SKILLS+MODES ALL (5 SKIP), GRAMMAR 20/0, ARCADE 18/0, MAXIMUM EDITION 55/55. tsc + eslint clean.
- PUSHED a6299f7. Beacons a6299f734edd dirty:0 on localhost AND preview.

Stage Summary:
- The last open loop between surfaces is closed: knowledge proven or broken in an exam now moves the FSRS schedule. A bombed vocab word comes back tomorrow at the post-lapse minimum; a proven word's interval extends; a tagged miss becomes a review-queue healing card rendered from the learner's own recorded evidence. Every outcome carries ReviewLog.source=exam provenance, and the app can now separate scheduled reviews from exam-verified outcomes in stats.
- Next wave per the spec: P2 PWA + habit loop (manifest, service worker with SHA-versioned caches, honest local notifications).

---
Task ID: 30
Agent: Super Z (main)
Task: MEGA-UPDATE wave, P2 - PWA + habit loop ("installable, unbrappable").

Work Log:
- Icons: scripts/gen_pwa_icons.py renders the Tauri road glyph as 192/512/maskable-512/apple-180 PNGs into public/icons/ (same brand, same colors: #10131a bg, #2dd4a7 road).
- src/app/manifest.ts: standalone manifest served at /manifest.webmanifest, layout metadata wired (manifest link, apple-web-app, icons).
- public/sw.js, honesty-first: cache name = rah-<git SHA> read LIVE from /api/version at install; activate evicts every non-current cache (a new deploy self-evicts stale shells); /api/version is NEVER cached (the deploy guarantee must not be maskable by a cache hit); /api/* network-first with 4.5s timeout, cached grace when offline, honest 503 JSON when nothing cached; navigations network-first with cached-shell fallback; static/_next/icons cache-first; local reminder messages (RAH_REMIND) and notificationclick focus-or-open.
- PwaBootstrap client half: registers the worker, install banner on beforeinstallprompt (dismiss once per session), habit nudge: on a fresh open with due>0 or streak-at-risk, asks notification permission ONCE and fires one local notification; no push server, so nothing beyond local is promised; app must run clean when SW or notifications are unavailable.
- Drive scripts/test-pwa.py (browser-level, Playwright): 12/12 ALL PASS - manifest shape (standalone + 192/512 + maskable), SW registered AND controlling, SHA-versioned cache carrying the live SHA, shell precached, OFFLINE reload renders the real app (title + body), /api/version un-fetchable offline (never cached), /api/state offline = grace or honest 503, clean boot with notifications ungranted, install banner renders on a synthetic beforeinstallprompt.
- Lint caught a real ordering bug in my first PwaBootstrap (maybeNotify referenced before declaration inside the effect) - hoisted to module scope, dead block removed, tsc+eslint clean, drive re-run green.
- Gates: PWA 12/12, ENGINE SMOKE 10/10, ARCADE 18/0, tsc+eslint clean.
- PUSHED 2e42115. Beacons 2e4211512112 dirty:0 on localhost AND preview (preview serves the manifest).

Stage Summary:
- The web app regained what the Tauri build had: installable, own window, offline shell - plus SHA-versioned caches that self-evict on deploy and a notification habit nudge that promises exactly what a local-only setup can deliver. The deploy beacon stays honest because the worker refuses to cache it.
- Next wave per the spec: P3 content ladder v2 (one shared difficulty envelope steering Read/Listen/Speak/games off the placement level + mastery).

---
Task ID: 31
Agent: Super Z (main)
Task: MEGA-UPDATE wave, P3 - content ladder v2 ("placement steers everything").

Work Log:
- src/lib/ladder.ts: the shared difficulty envelope. ladderFor(level) -> {band, monologueWords, sentenceWords, idiomDensity, ttsRate, speakStrictness, quizLevels, readOrder}; ladderBrief(l, what) emits deterministic instruction blocks; orderReadings sorts the shelf (own band first, adjacent after). Pure, synchronous, unit-provable; "?" defaults to B2 (the app's standing assumption).
- Consumers wired: listen route injects the brief and returns ladder {band, ttsRate}; Listen client paces TTS from the envelope, chips stay RELATIVE (baseRate x multiplier, clamped 0.5..2); listenSystem de-hardcoded so the envelope wins over defaults; speak route grades under the ladder bar (GENTLE = intelligibility first for B1, STRICT = register/collocation for C1); dungeon floors take the band as the staircase FLOOR (B1 climbs B2-first with C1 as spice; C1 gets C1 mixed into floor 1; B2 keeps the classic staircase); Read shelf orders by band with a "your band" badge on matching texts.
- Drive scripts/test-ladder.ts: 20/20 ALL PASS. Two drive-only findings fixed: (1) the item payload carries no level - ArcadeItem ids encode the source card, resolve through the deck; (2) the drive's RunState cleanup used the wrong prefix (dungeon*; real id is day:<n>) so a stale morning row masked the route-level proof with all-C1 floors - after the prefix fix the route proves both bands live. The drive caught this by asserting through the REAL route, not just the builder.
- Live listen generation carried the envelope in the payload (B1 band + rate) during the active window.
- Gates: LADDER 20/20, ARCADE 18/0, MAXIMUM 55/55, ANSWERABILITY ALL, tsc + eslint clean.
- PUSHED 9200670. Beacons 9200670c2900 dirty:0 on localhost AND preview. Spec tracker: P1/P2/P3 marked shipped.

Stage Summary:
- The placement level now steers EVERY generator through one deterministic envelope: the engine decides the difficulty, the AI words it. A B1 learner gets slower, plainer, shorter listening material at a gentler grading bar and a B2-first dungeon; a C1 learner gets dense, fast material judged strictly. The drive proves the shift through the real routes with forced levels and full state restore.
- Next wave per the spec: P4 listening lab v2 (dictation with word-diff -> scheduled targets, pronunciation proximity scoring).

---
Task ID: 32
Agent: Super Z (main)
Task: MEGA-UPDATE wave, P4 - listening lab v2 (dictation + pronunciation proximity).

Work Log:
- src/lib/proximity.ts: the single word-level diff engine behind dictation AND read-aloud checks - exact after normalization, NEAR at char-similarity >= 0.8 (edit distance over the longer length; the fuzzy module's similarity() turned out to be token-set overlap, wrong tool for single words - caught by the drive's near-typo check), function-word stoplist so "the" never becomes an FSRS event, greedy consume for repeats, deterministic. Client display and server scheduling share this one source of truth.
- api/listen/dictation: server-authoritative diff; slips resolve to FSRS targets (deckCardForToken precedence - a slipped word that IS a deck word schedules the REAL card; listen:<token> healing card otherwise) through the SAME scheduleExamOutcomes pipe (now takes source: exam|dictation|shadow); ReviewLog provenance "dictation"; listen families via recordMistakes (kind union extended) with evidence "typed -> target"; caps 8 sentences / 6 tokens per call.
- derivedExamCard serves both namespaces (exam: + listen:) from the shared blanking heuristic; the queue renders listen cards with unit listen_healing and a "Listening slip" note.
- Listen.tsx: 6th Dictate pass - play sentence by sentence, type OR hold the mic (webkitSpeechRecognition fills the same field, so mumbled speech goes through the same diff), per-word hit/near/slip coloring, scheduled-count feedback. State resets on new generation; ASR-missing browsers hide the mic, never break.
- Drive test-dictation.ts 18/18 ALL PASS, full state restore. The drive caught TWO engine bugs pre-ship: similarity() misuse (near-typo marked slip) and "the" being scheduled (stoplist added). EXAM-FSRS provenance assertion made snapshot-aware (a stray pre-existing exam-source row from an earlier crashed run broke the naive arithmetic).
- Gates: DICTATION 18/18, EXAM-FSRS 18/18, LADDER 20/20, FUZZY 15/15, tsc + eslint clean.
- PUSHED 6e679c1. Beacons 6e679c10992f dirty:0 on localhost AND preview. Tracker: P4 shipped.

Stage Summary:
- Listening slips now live in the same physics as every other miss: a word your ear (or tongue) dropped comes back tomorrow as a review card rendered from your own typed-vs-target sentence pair. The lab's five existing passes gained a measurement layer instead of replacing anything.
- Remaining per the spec: P5 portability + CEFR map (full JSON export/import, War Room band map with proven vs assumed evidence).

---
Task ID: 33
Agent: Super Z (main)
Task: MEGA-UPDATE wave, P5 - portability + CEFR map ("the learner owns the state"). Wave complete.

Work Log:
- src/lib/portable.ts: the 20-table registry (fixed order, rows sorted, stable JSON) behind a deterministic sha256 content hash. planImport validates format + hash + per-table presence BEFORE any write; commitImport runs one transaction of delete-then-create with DateTime coercion - idempotent by construction.
- api/export (hash-sealed rah.v1 bundle, attachment disposition) + api/import (dryRun reports counts and writes nothing; commit is all-or-nothing; wrong hash/missing table -> 422 with an actionable message).
- Progress: the CEFR band map - A1..C1 cells colored by REAL evidence only (measured skills, recent graded exams with pass counts and best pct), "unproven" rendered honestly otherwise, "you are here" on the placement band; computed server-side from rows, the AI never rates it. Plus the BackupPanel: download, pick file, dry-run diff message, confirm-to-restore.
- Drive test-portable.ts 15/15 ALL PASS: hash verifies locally from tables alone, wipe (15 cards + 1 family) -> dryRun leaves state untouched -> import restores a hash-IDENTICAL export, second import idempotent, tampered bundle refused with zero writes, missing table refused, bands from real rows, Playwright confirms the map renders.
- Full wave battery re-run: EXAM-FSRS 18/18, DICTATION 18/18, LADDER 20/20, PWA 12/12, ANSWERABILITY ALL. tsc + eslint clean.
- PUSHED df9a170. Beacons df9a170d05dc dirty:0 on localhost AND preview. Tracker: ALL FIVE PILLARS SHIPPED. RELEASE-NOTES.md gains the Close Every Loop entry.

Stage Summary:
- The Close Every Loop wave is complete: exam->FSRS unified (P1), PWA + habit loop (P2), one ladder steering every generator (P4's dictation slips included), listening slips scheduled as reviews (P4), and the learner owns a hash-sealed portable state with an honest band map (P5). Every pillar shipped with its own live drive, and the standing regression battery stayed green throughout.

---
Task ID: 34
Agent: Super Z (main)
Task: "did you implement reverse engineering completely? also reverse engineer duolingo" - DUOLINGO-RE wave (differential RE of Duolingo's engine + word-bank adoption).

Work Log:
- Answered the question with live proof: Task 26's RE is complete and regression-locked (FSRS PARITY PASS re-run: 400 randomized sequences, zero divergence from ts-fsrs v4.6.1; LanguageTool fast path shipped; REA/Frida/angr correctly rejected for open-source targets in favor of differential source-level testing).
- D1: cloned Duolingo's ACTUAL HLR reference implementation (github.com/duolingo/halflife-regression, MIT, experiment.py 304 lines, unmodified) + their py2->py3 shim (math untouched, order-pin for parity). Ported 1:1 to src/lib/hlr.ts (features sqrt(1+right)/sqrt(1+wrong), h=clip(2^(w.x), 15min..274d), p=2^(-t/h), their exact SGD gradients + hyperparams, Leitner/Pimsleur baselines, their Pearson-named-"spearmanr" quirk kept for comparability).
- Downloaded their 13M-trace dataset (Dataverse doi:10.7910/DVN/N8XJME, 379MB gz) against aggressive throttling (chunked range downloader with per-chunk verify; 376MB prefix = 94.6% of file; sample.csv = first 300k traces).
- Gate scripts/test-duolingo-hlr.ts: PART A machine-epsilon parity vs their Python (max |dw|=1.11e-16, max |dp|=2.22e-16, pinned order). PART B: all four of their models retrained on THEIR OWN traces, their 90/10 split, their metrics - HLR beats Leitner (mae 0.1226 vs 0.1954) and Pimsleur (vs 0.3893), only positive cor(h) (+0.139 vs -0.159/-0.165), lexeme pooling confirmed. PART C: our FSRS-5 replays their traces (continuous-time, cold-start from observed half-life, grades from objective session recall, zero-lag rows excluded) - BEST mae(p) of all engines (0.0988 vs full HLR 0.1226, Pimsleur 0.288, trivial 0.172), ties Leitner, HLR-core cor(h) edge honestly documented as information asymmetry.
- The gate caught THREE of my own bugs on the way: namedtuple field names (right/wrong not right_this), a double-mk in the oracle, and the eval() object-destructure of a tuple return (NaN factory). Also learned: dataset must never enter git (376MB push killed by GitHub's 100MB limit - stripped, gitignored, re-pushed).
- D2: word-bank translate (Duolingo's signature tile exercise) as the 7th review direction: src/lib/bank.ts deterministic per-(card,day) trays (mulberry32 + FNV hash), every target word present with full multiplicity, deck-fed distractors with hollow-field top-up (22 cards), 14-tile cap, day-seeded reshuffle; queue attaches tiles to bank items only; Review.tsx builds by tapping (tap built word to return it); grading = shared join-and-normalize; grade route persists dir=bank into FSRS+ReviewLog.
- Drive test-bank.ts 18/18 ALL PASS with full state restore (forced 8 cloze cards into the audio->bank rotation surgically, snapshots restored in finally). Caught: duplicates are legal ONLY from repeated target words; rotation needed the surgical forcing.
- DUOLINGO-RE.md teardown: engine spec + 4 undocumented quirks, duel/cross-exam tables (gate output, never hand-edited), Birdbrain-vs-LearnerModel verdict (already covered, ours inspectable), product-loop adopt/reject matrix (streak-freeze auto-protection ALREADY existed at server.ts:38-41 - grep gap corrected; hearts/gems/leaderboard-anxiety REJECTED as anti-method), D3 match-pairs sprint specced for next wave.
- Regression battery: FSRS PARITY PASS (400 seq), ENGINE SMOKE 10/10, tsc clean, eslint clean on src.
- PUSHED bc4c167 to WasewaseX/rah-web main (after stripping the dataset artifacts; commit 2184 insertions). Beacon bc4c1677c8e2 dirty:0 on localhost (app 200).

Stage Summary:
- The reverse-engineering question is answered twice: the existing Task-26 gates still pass, and the same doctrine now covers the industry reference itself. Our TS port of Duolingo's HLR is machine-epsilon identical to their Python; their own 13M-trace data proves HLR beats their legacy baselines (their paper's finding reproduces) AND that our FSRS-5 posts the best absolute recall error of every engine in the fight on their own traces. Their signature word-bank exercise now runs on Rah's engine, drive-locked 18/18. Next wave: D3 match-pairs sprint (specced in DUOLINGO-RE.md), and the remaining 21MB of the dataset if the throttle ever lifts.

---
Task ID: 29
Agent: Super Z (main)
Task: "no coach tab - make a coach sidebar that can access anything on all tabs; make it an agent with abilities (read files, make files, multi-step, agentic, coding); add login with email + gmail + emailed codes; continue reverse engineering" - the coach becomes an agent and the app gains accounts.

Work Log:
- Re-oriented on a moved tree: project lives at /home/z/my-project (rah-web). Found the parallel timeline had pushed Tasks 30-34 (P1-P5 close-every-loop wave + the DUOLINGO-RE wave) while this session built locally on Task 28's base; rebased this work on top (one .gitignore conflict) and re-proved BOTH timelines' gates on the merged tree.
- COACH TAB REMOVED. The coach is now a global sidebar (src/components/rah/CoachSidebar.tsx): FAB on every tab + Ctrl/Cmd+J + a rail button, right-side drawer with live agent trace. It renders thought/tool/observe events as they stream and EXECUTES the agent's final commands (navigate any view, refresh state, start_review, open_placement, toast) - the agent can act anywhere in the app, from any tab.
- THE AGENT (src/lib/coach-agent/): runAgent() is a real multi-step tool loop, JSON turn protocol (the house pattern), MAX_STEPS=6 with a forced close. Tools: read_state (full learner truth: profile, mastery ledger, mistake families, next-best actions, 7-day stats), list_files/read_file/write_file sandboxed to data/coach-workspace (safePath rejects absolute paths and traversal), run_js (child bun process in the workspace, 12s SIGKILL timeout, stdout+stderr captured - the coding ability: write a script, run it, read output, fix itself), web_search + page_reader (SDK built-ins), coach_skill (the entire existing skill engine stays reachable). Failures feed back as observations so the model can retry with different args. Streams over SSE from /api/coach-agent; turns persist to ChatMsg so the sidebar has memory across reloads.
- LOGIN (User/LoginCode/Session models): email + 6-digit code flow - codes are 10min TTL, single-use, 5-per-15min rate-limited; session tokens stored sha256-hashed, httpOnly lax cookie, 30-day TTL. nodemailer SMTP when SMTP_* env is set; without it, DEV delivery surfaces the code in a clearly-marked dev-inbox strip so the app is fully usable with zero setup. Gmail: /api/auth/google/start+callback OAuth is active when GOOGLE_CLIENT_ID/SECRET exist; otherwise the login screen says so and the email-code flow covers gmail addresses with no setup. The shell renders the Login gate until /api/auth/session resolves a user; /api/coach-agent and /api/shop return 401 to anonymous callers.
- DUOLINGO RE SLICE (this session): gems economy + Shop. Gems mint on level-ups (30/level) and quest finishes (10); sinks are a streak freeze (100g) and an XP boost x2 (150g, until end of tomorrow) applied inside awardXp - the single faucet - so every surface doubles honestly. /api/shop + Home shop strip. RECONCILED with the parallel timeline's DUOLINGO-RE.md teardown, which REJECTED hearts+gems as anti-method anxiety mechanics: our version is earn-only (no real money, no heart paywall, no loss framing - it funds mechanics that already existed honestly: the freeze bank and XP). Flag in the worklog: if the teardown verdict should win, removing shop.ts + the two schema fields is one commit.
- Drive: scripts/test-coach-agent-auth.ts 29/29 live - malformed-email rejection, code issue + dev delivery, wrong-code and code-reuse rejection, session cookie, 401 gating on agent+shop, sandbox traversal/absolute-path rejection, write_file -> run_js stdout capture ("DRIVE_RESULT 35"), read_file round-trip, read_state truth, shop math (broke-buy rejected, freeze banks, boost sets boostUntil, double-boost rejected, awardXp doubles, level-up mints gems), LIVE SSE agent run with real tool calls and a data-grounded final reply, turn persistence, sign-out. State restore in finally.
- Merged-tree regression battery: COACH-AGENT+AUTH 29/29, MAXIMUM EDITION 55/55, BANK 19/0, EXAM-FSRS 19/0, DICTATION 19/0, ARCADE 18/0 (earlier run), MASTERY 29/29, ENGINE 10/10, FSRS PARITY PASS (400 seq), tsc clean, eslint clean. db:push after rebase (merged schema: remote's ReviewLog.source + this task's User/LoginCode/Session/gems/boostUntil); one controlled server restart; beacon 9ec09dc dirty:0.
- PUSHED 9ec09dc (rebased) to WasewaseX/rah-web main.

Stage Summary:
- The coach is no longer a tab and no longer a chat: it is an agent with hands - it reads the learner's live state, writes and executes code in a sandbox, searches the web, drives the existing skill engine, and its answers can navigate the app - visible on every tab, streaming its work as it goes.
- The app has accounts now: email-code login (with gmail covered and OAuth ready), hashed session tokens, gated agent and shop surfaces.
- The two timelines merged cleanly: the close-every-loop wave and the Duolingo RE wave keep their green gates on the merged tree, and this task's agent+auth+gems sit on top of both.

---
Task ID: 35
Agent: Super Z (main)
Task: "check all apis use github tools and check everything with playwright never stop" - full API battery + browser E2E + the coach-agent fixes the user's chat log exposed.

Work Log:
- Built scripts/test-api-battery.ts: EVERY route in src/app/api (39 routes, grep-verified method map) hit anonymously AND authed, GET+POST, with empty bodies AND type-hostile garbage - the wall is "nothing answers 500, ever". Deep-shape checks on the reads the UI leans on (state, review/queue batch, progress, mistakes, version, shop gems+items, arcade, chat, export rah.v1 bundle, hostile import dry-run, coach-agent 400 on empty message). Auth gating pinned: coach-agent + shop are 401 to anonymous. RESULT: 163/163 PASS (after fixing MY battery's own assertions: queue shape is {batch}, shop shape is {gems,items}, google/start's 501 is the designed not-configured signal).
- Loop units pinned inside the battery against the EXACT wild payloads from the user's chat log: the mangled '{"thought":...,"tool":"coach_skill","args":{"message":"/exam vocabulary B2"}}}' (unbalanced braces) now salvages tool+args and NEVER becomes a reply; truncated JSON repairs via a string-aware brace-balancer; thought-only turns are caught by shape (no tool, no final) and go to the nudge branch; fenced JSON, prose finals, sanitizeReply unwrap/replace all pinned.
- THE FIX (src/lib/coach-agent/loop.ts): extractTurn rewritten with JSON repair (salvageObject balance-scanner, salvageArgs, salvageString) + junk classification so raw protocol JSON can never leak to the learner; sanitizeReply as last-line unwrapper; callModel with 429/quota/network-aware retries (1.5s+4s backoff, "Model hiccup - retrying" events); thought-only/junk turns now NUDGE the model back on protocol (max 2) instead of dead-ending into "no output"; step-budget close uses the same retry+sanitize path. System prompt now makes read_state MANDATORY for any state question (the [live context] hint is explicitly NOT enough) - fixed the flaky no-tool run in the drive.
- CoachSidebar.tsx: history written before the fix is scrubbed at render (scrubHistoryReply unwraps nested replies, marks leaked rows honestly); a run that ends without a final now ALWAYS posts a visible coach message ("I hit a snag (Model unreachable)...") - "sometimes only think no output" is dead at both layers; the live agent trace auto-collapses once the final lands (conversation shows one clean reply, tools stay as chips) and stays inspectable after failures; trace rows compacted (110-char details).
- COACH ICON: GraduationCap replaces Sparkles on the FAB, sidebar header, empty state, and the App rail button (achievement/XP sparkles untouched).
- Browser E2E with agent-browser (Playwright-driven): login gate -> email -> "Send login code" -> code read from LoginCode table (what SMTP would deliver) -> verify -> dashboard. Coach sidebar opened via FAB; LIVE agent run #1 "Read my state and tell me exactly what I should do right now" -> read_state + coach_skill, data-grounded reply, Start review command executed and the app NAVIGATED to Review. LIVE agent run #2 "Write me a 3-day drill plan file for my weak collocations" -> wrote data/coach-workspace/collocation_drill_plan.md (2482 bytes, verified on disk) and named the artifact in the reply. Screenshots in download/. Stray pre-fix JSON in history replaced by the cleanup script (chatMsg #10) - scripts/cleanup-leaked-agent-turns.ts, idempotent.
- Real-database proof for the user's question: direct Prisma counts against db/custom.db (Learner/User/Session/ChatMsg/DailyStat rows persist across the session's restarts; drive restores are the only reason counters read 0); all API mutations go through SQLite, no in-memory state.
- Regression battery: API BATTERY 163/163, COACH-AGENT+AUTH DRIVE 29/29 (re-run after the prompt fix - the multi-step tool call is back), tsc clean, eslint clean on src.
- Server ops note: `nohup bun run dev &` inside a tool-call shell dies with the process group; `setsid nohup ... < /dev/null &` survives. ensure-server.sh still works as the idempotent guard.

Stage Summary:
- Every one of the 39 API routes is now battery-locked (163 checks) and the coach's two live failure modes the user actually saw - raw JSON in the chat and silent no-output turns - are fixed, unit-pinned against the exact wild payloads, scrubbed from history, and re-proven in a real browser: the agent read state, wrote a real drill-plan file, and drove the app's navigation from the sidebar.

---
Task ID: 36
Agent: Super Z (main)
Task: "Sign in to talk to your coach. i already signed in?" + "countinue task from before never stop" - the 401-while-signed-in bug, root-caused to TWO stacked causes (cookie-less embedded contexts + the service worker freezing stale JS), plus the "which tab am i" view-awareness gap.

Work Log:
- VIEW AWARENESS (the "which tab am i" flail): the agent had NO idea which tab the learner was on - it guessed, then reached for page_reader (a WEB tool) to answer a question about the app itself. App.tsx now passes the live `view` to CoachSidebar; the sidebar sends it in the POST body; /api/coach-agent forwards it; runAgent appends current_view to the [live context] line; the system prompt gains the rule: "which tab am I" answers from current_view directly, final, no tools - and page_reader/web_search are FORBIDDEN for anything about the app itself. Browser-proven: on the Review tab the agent answers "You are currently on the review tab" with zero tool calls.
- CAUSE 1 - COOKIE-LESS CONTEXTS: the user's sessions EXIST in SQLite (two fresh 30-day rows) yet coach-agent 401'd: they use the app inside the preview iframe where browsers DROP SameSite=lax + non-Secure cookies entirely - verify POST succeeds server-side and the dashboard renders from its JSON body, but no cookie is ever stored, so every later call is cookie-less. FIX (token fallback auth): /api/auth/verify now returns the token in the body; src/lib/rah-fetch.ts self-installs a fetch wrapper in the App shell that stores it (localStorage rah_token) and attaches x-rah-token to every same-origin /api request; server side getSessionUserWithRequest resolves cookie OR header (coach-agent, shop, auth/session GET+DELETE all wired; DELETE destroys both tokens). Battery gains section 4b: session resolves from header alone, coach-agent 400-not-401 with header, null without either. Browser-proven at the extreme: cookies DELETED entirely -> /api/auth/session resolves the user, POST /api/coach-agent -> 200, the agent answers normally.
- CAUSE 2 - THE SERVICE WORKER WAS FREEZING THE APP (found while the token kept coming back NULL): sw.js served /_next/static chunks CACHE-FIRST under a cache name keyed by the git SHA - but dev/preview recompile while the SHA stands still, so the SW served the last COMMITTED bundle forever (chunk 91eaf8fb survived even a full `rm -rf .next` + restart because the SW, not the server, was answering). This is ALSO why the user's preview kept showing old behavior after fixes. FIX: resolveCacheName now reads dirty count + version from /api/version; a dirty tree (or missing SHA) => cache rah-dev-nocache and the fetch handler bypasses respondWith for /_next/static entirely (network-only). Production (clean tree, content-hashed chunks) keeps cacheFirst. Browser-proven: poisoned rah-9adf88cfbd33 cache evicted on the new SW's activate; with the clean worker the login flow immediately stored the token the old shell had been refusing to save.
- Login.tsx stores the token at verify; CoachSidebar sign-out clears it alongside the cookie destroy.
- Regression: COACH-AGENT+AUTH DRIVE 29/29 (cookie path intact), API BATTERY 167/167 (4 new header-auth checks green), tsc clean. Screenshots: download/e2e-cookieless-coach.png (cookieless coach answering on the review tab), e2e-coach-sidebar.png, e2e-dashboard.png.

Stage Summary:
- "Sign in to talk to your coach" while already signed in is dead at both layers: embedded/no-cookie contexts authenticate via the token header, and the service worker can no longer freeze stale JS over a moving dev/preview build. The "which tab am i" question now answers instantly and correctly from live app context. Next: SMTP creds for real email delivery remain the only config-dependent gap.

---
Task ID: 37
Agent: Super Z (main)
Task: "still far from perfect countinue never stop use REA for reverse enginnering" - the three gaps the user's newest chat log exposed (PDF impossible, coach blind to the current question, deliverables undeliverable) + the REA wave: DUOLINGO-RE.md D3 shipped.

Work Log:
- REAL PDF ENGINE (src/lib/coach-agent/pdf.ts, pdf-lib + fontkit, both added): markdown -> A4 PDF with Liberation Sans (Helvetica metrics) + Noto Serif SC for CJK runs + DejaVu Mono for code, subset-embedded (9.3MB raw CJK -> 35.8KB report; CJK font lazy-embedded only when the text uses it). Own layout: h1-h3 with accent rule, bold/italic/inline-code runs, word-wrap with per-glyph widths, monster-word hard-break, bullet/numbered lists, code blocks, blockquotes with bar, tables with header repeat across pages, page breaks, footers. Baseline-convention bug (headings drew at c.y-size, next block drew 3.5pt ABOVE the heading baseline) found by RENDERING the PDF to PNG and reading it - fixed by unifying on "c.y IS the next baseline"; visual proof in tool-results/smoke4-1.png.
- make_pdf TOOL (tools.ts): source_md (workspace .md) or inline markdown -> real PDF in the sandbox; guards: .pdf-only out paths, safePath escape rejection, missing-source rejection. Prompt rules now: PDF requests use make_pdf, NEVER claim PDFs are impossible; deliverables appear in the Workspace panel and must be named in the reply. THE USER'S LOG LINE "the PDF conversion tool encountered technical limitations" IS DEAD.
- WORKSPACE DELIVERY: GET /api/workspace (auth-gated list, depth-2 walk) + GET /api/workspace/file (auth-gated download: safePath sandbox, inline preview or dl=1 attachment, correct content-types incl. application/pdf). CoachSidebar gains a WORKSPACE panel (count chip, per-file size, preview + download) - downloads go through fetch (token-aware) NOT <a href>, because plain navigation cannot carry x-rah-token and the user's preview iframe drops cookies; blob object-URL download/preview.
- COACH SEES THE CURRENT QUESTION (the user's log: "Could you please share the actual question from your review?"): src/lib/activity-store.ts (module store, unmount-cleared), Review.tsx reports the live exercise (dir, exact prompt, the answer FOR THE CURRENT DIRECTION, choices, tiles, what the learner typed/picked, revealed), sidebar sends it, /api/coach-agent caps it at 4KB, loop.ts buildLiveContext (exported, pure, battery-pinned) appends a [current screen] JSON block; prompt rule: "what is the answer / why can't I answer / explain this one" answers from that block, NEVER asks the learner to paste, retrieval-first when not yet revealed. BROWSER-PROVEN against the user's EXACT message: on-screen cloze "Our team ? research on battery life." -> coach answered "The correct answer is 'does'... collective unit... takes the singular verb" with ZERO tool calls (both runs; one added the Farsi-L1 insight that verbs don't inflect for number).
- REA WAVE - D3 MATCH-PAIRS SPRINT SHIPPED (DUOLINGO-RE.md spec'd item, doc updated): src/lib/pairs.ts deterministic board per (due set, day) via mulberry32 (due cards most-at-risk first, new cards top up, deduped by Farsi); games/PairsGame.tsx (tap Farsi tile -> tap English; match pops + locks, misstep shakes via new rah-shake keyframe); /api/arcade/pairs GET board + POST clamped aggregate (2 XP/pair + 10 clean-board, hostile ids filtered). ENGINE-GRADED honestly: every match calls /api/review/grade {grade:3, dir:"pairs"} - FSRS, ReviewLog, quests, streak see the retrieval exactly once; the pairs POST never touches cardState. Review tab now has Classic | Blitz | Pairs.
- GATES: API BATTERY 208/208 (41 new: workspace list/file sandbox+types+dl, make_pdf real-%PDF-bytes + guards, buildLiveContext pins incl. no-undefined-strings, pairs shape/determinism/clean-bonus/hostile-filter; ROUTES map now 42 paths). COACH-AGENT+AUTH DRIVE 29/29. PDF smoke (scripts/test-pdf-engine.ts): blocks/runs units + 4 renders incl. CJK + monster-word + wide table. DUOLINGO-RE gate PASS. tsc clean, eslint clean. Browser E2E: login -> review tab -> the question-answer run above -> "Make me a progress report as a PDF" suggestion -> progress-report.pdf (33KB) in workspace + PANEL screenshot (download/e2e-workspace-panel.png) -> pairs board played to completion (5 FSRS rows dir=pairs, +10 XP sprint bonus, e2e-pairs-complete.png). The agent's PDF even wove the live screen into the report ("Question: 'Our team ___ research on battery life.' / Correct Answer: 'does'").

Stage Summary:
- The coach can now DELIVER: real PDFs the learner downloads from a workspace panel that works in cookie-less preview iframes; the coach sees the exact exercise on the learner's screen and explains it instead of asking for a paste; the Duolingo RE wave's last spec'd item (match-pairs) is shipped with its gates. The three "still far from perfect" gaps from the user's log are each fixed, unit-pinned, and browser-proven.

---
Task ID: 38
Agent: Super Z (main)
Task: P0-2 closure - the dedicated live retest of the coach's /exam flow (the exact trigger of the user's logged JSON leak: "no output male an exam" -> mangled {"tool":"coach_skill","args":{"message":"/exam vocabulary B2"}}).

Work Log:
- Found the P0-2 architecture (two-layer answerability gate, Task 16/28) already shipped; what was missing was a LIVE retest of the full chain through runCoach with the wild payload - scripts/test-coach-exam.ts now provides it (22 checks, state-restoring).
- Chain proven live: (1) the EXACT mangled turn salvages to tool=coach_skill + args.message="/exam vocabulary B2" and NEVER becomes a reply; (2) coach_skill("/exam vocabulary B2") returns a verified envelope - prose reply announcing the exercise, zero protocol keys anywhere; (3) the exam payload: announced count == delivered items, every item passes itemAnswerable, vocabulary focus honored, WIRE payload is KEYLESS by design (mcq keys never leak to the client) while the STORED exam row's keys exist and sit among their choices; (4) plain-English "make an exam" routes to a real skill and stays clean prose.
- Three initial FAILs were my own assertions, not the app: the reply says "B2 Vocabulary: ... 4 questions" (no literal word "exam"); focused single-skill exams legitimately run 3-5 items; and the mcq key check ran against the keyless wire payload. The key-vs-choices check was moved server-side where the key actually lives.
- Full gates after: /exam retest 22/22, tsc clean.

Stage Summary:
- The last open pipeline item (P0-2 retest) is closed: the /exam path that produced the user's leaked-JSON turn now provably routes, generates a gated exam, stores keys server-side, and speaks clean prose end to end. The pipeline (PAT -> P0-1 -> commit/push -> P0-2 -> mega-update spec) has P0-1, P0-2 and the coach sidebar/agentic/login waves all shipped and gated; the mega-update spec remains as the next standing item.

---
Task ID: 39
Agent: Super Z (main)
Task: The 7.4/10 external review acted upon - REA wave 2: one honest adoption from each of the review's three reverse-engineering targets (ChatGPT Study Mode, Speak, Duolingo Max) + its lowest-scored row (proven learning effectiveness 4.5/10).

Work Log:
- Mapped the review onto the standing REA doctrine: three named apps -> three shippable adoptions + the outcomes gap; recorded the teardown verdicts (adopt / already-have / reject) in DUOLINGO-RE.md section 9.
- ChatGPT STUDY MODE RE (src/lib/coach-agent/loop.ts): new rule 9 - three-beat teaching protocol: DIAGNOSE from what the learner actually typed/picked (the [current screen] block from Task 37), STEPWISE 2-4 numbered steps, end with ONE understanding-check question that proves understanding (never "does that make sense?"). CRITICAL PROCESS FINDING: my first placement of the protocol INSIDE rule 1 diluted the MANDATORY read_state compliance - the drive went 28/29 twice (agent answered streak/due from [live context] without tools); moving STUDY MODE to its own rule restored 29/29. Rule 9 explicitly says study mode never waives rule 1 and that history containing a similar answer is never a reason to skip read_state (state changes between asks).
- SPEAK RE (src/app/api/speak/analytics/route.ts + Speak.tsx): deterministic analytics over the engine's own rows - trend (last 12 graded sessions), round1->round2 same-prompt deltas (the review's "immediate retry + improvement between attempts"), recurring spoken-trap families from MistakeFamily kind=speak, clamped 0-10 1dp math. Speak tab gains the Improvement ledger (sessions / avg / best / retries-beaten tiles, accuracy bars colored by round, delta chips, top traps) - zero AI in the panel; re-fetches after every diagnosis via ledgerTick.
- DUOLINGO MAX ROLEPLAY RE (src/lib/agent/mode-flow.ts): roleplayTurn now persists scene accounting into ModeData (turns count, trap tally, one wrong->right example per trap family, corrections-optional safe); exit wrapUp for roleplay produces the deterministic SCENE REPORT - turns, corrections/turn, recurring traps with evidence, next-scene focus ("pressure-test: <top trap> - it cost you the most"), zero-correction scenes honestly told the scene was too easy. No invented stats: the report is computed from what the partner actually corrected.
- OUTCOMES (src/app/api/progress/outcomes/route.ts + Progress.tsx EffectivenessPanel): the review's 4.5/10 row answered with machinery - first-attempt retention per day (ReviewLog grade>=3 share), median scheduled interval per day (FSRS stability proxy), mature-memory share (s>=21d) + median stability + lapsing cards, mistake-family retirement rate (resolvedAt healing loop), 7d/30d summary. UI: "Effectiveness ledger - measured, not claimed" with tiles, interval bars, honest paragraph.
- Battery (scripts/test-api-battery.ts): ROUTES +2 (54 paths), new section 6b - speak analytics shape + EXACT seeded delta math (r1 5 -> r2 6.3 on the engine's 1dp overall rounding, accuracyDelta 3), outcomes shape + isolated-day retention (2/3 = 66.7%) + median ivl [10,6,0] = 6; the day's ambient restored logs are deleted first so assertions can never lean on learner data; seeds removed after. RESULT 221/221.
- Fixed scripts/test-coach-exam.ts (export {} module marker) - 11 TS1375 top-level-await errors that CI's `bunx tsc --noEmit` would have failed on; full-project tsc now genuinely clean.
- FALSE ALARM investigated: Progress.tsx line "const sg, setMsg]" appeared corrupted in tool output; od -c proved the bytes are "const [msg, setMsg]" - the display layer ate "[m". File, tsc, and bun parse all fine. Lesson: verify suspicious bytes with od before touching "corrupted" files.
- Browser E2E (agent-browser): logged-in session -> Review tab -> live cloze "You have ? progress this month." (B2 collocation, unanswered) -> the user's EXACT message "what is the answer of this question and why cant i aanswer it" -> coach replies "The correct answer is 'made'..." with the fixed-expression why and the Farsi L1 diagnosis - the Task-35 failure ("Could you please share the actual question?") is dead in the real UI. Speak tab: Improvement ledger renders (2 sessions, +1.3 overall retry chip) after honest seed rows (scripts/seed-speak.ts); Progress tab: Effectiveness ledger renders (100% recall, 0% mature, stability paragraph). Screenshots: download/e2e-speak-ledger.png, download/e2e-effectiveness-ledger.png. Console clean.
- Gates: battery 221/221, coach drive 29/29, tsc clean, eslint clean. PUSHED 9457519 to WasewaseX/rah-web main.

Stage Summary:
- Each of the review's three RE targets now has a shipped, gated adoption: the coach teaches Study-Mode-style (diagnose -> stepwise -> check) on the learner's real screen; Speak's measured retry loop is visible as an honest improvement ledger; roleplay exits with a deterministic scene report. The 4.5/10 "proven effectiveness" row is answered by the Effectiveness ledger - the engine's own retention/stability/extinction numbers, no AI wordsmithing. Next standing items: Duolingo-RE list (pronunciation/phoneme feedback, curriculum map, learner-materials ingestion), SMTP for real email delivery, mega-update spec.

---
Task ID: 40
Agent: Super Z (main)
Task: The 7.4/10 review's C-priority ("make the agent genuinely dependable - the project's differentiator"): feature #15 (stop/cancel a long agent run) + feature #17 (human feedback / content correction queue) + the read_state mandate moved from prompt-hope to loop-enforced code.

Work Log:
- STOP THE AGENT (#15): runAgent gains signal?: AbortSignal, checked BETWEEN steps (the in-flight model call finishes, then the loop closes); new exported stoppedReply(steps) closes gracefully - names what WAS completed, drops Mode:/Unknown noise, never pretends the task finished; AgentTurn.stopped flag. Route passes req.signal (client abort => server sees it). CoachSidebar: per-run AbortController + a pulsing Stop square beside Send while running; abort shows the honest local message and refreshes workspace/state. The stopped turn still persists to ChatMsg - history never loses what ran.
- READ_STATE ENFORCEMENT IN CODE: the Task-35 MANDATORY prompt rule kept flaking (3 of 5 recent drives answered streak/due from [live context] with zero tools - including twice after the Task-39 rule restructure, and once after "Call read_state once" was in the USER MESSAGE ITSELF). House doctrine applied - engine decides, never prompt-hope: isStateQuestion(message) (exported, pure) + one deterministic server-side nudge when a final lands with zero tool calls on a state-shaped question; screen/work questions ("what is the answer", "make me a PDF") correctly do NOT trigger it. Drive result: the model skipped, the loop enforced, the agent then read_state and answered - the flake is dead in code.
- CONTENT FLAGS (#17): schema ContentFlag (cardId/kind/note/status/at; db pushed, client regenerated, server restarted). /api/feedback: GET+POST, auth-gated (401 anon), kind clamped to the 5-reason set, note<=300 ctrl-char-stripped, cardId<=64, OPEN_CAP 500 (429), exact duplicate of an open flag refused honestly ({duplicate:true}). read_state now carries contentFlags{open,recent[]} and the summary line gains "N open content flag(s)" so the agent knows the queue exists. Review.tsx: flag button on the exercise header -> inline panel (5 reason chips + optional note) -> POST; resets per card; honest success copy.
- Battery: ROUTES 43 paths; section 6c - stoppedReply zero/full pins, isStateQuestion catches/doesn't-catch pins, feedback 401x2, hostile kind clamp (run-unique note so reruns never trip the duplicate guard), POST lands, duplicate refused, GET shape, queue visibility, seeds removed. 238/238.
- Drive: new 4c STOP-THE-AGENT block - guaranteed multi-step request (read_state -> write file -> read_state again), abort after the first real tool event, then poll ChatMsg until the graceful stopped turn lands. 32/32.
- Browser E2E: login -> Review -> flag flow (button -> panel -> send -> row col001/wrong_answer verified in DB) -> coach sidebar: "Agent is working..." + Stop square visible -> Stop clicked -> "Stopped." locally + server persisted "Stopped, as you asked. Completed before the stop: read..." -> residue cleaned (flags, scratch file, e2e user). tsc clean, eslint clean.
- PUSHED with Task 39 in this session: 9457519 (REA wave 2) and this task's commit.

Stage Summary:
- The agent is now CONTROLLABLE and the mandate is MACHINE-enforced: Stop works end to end (client abort -> between-step close -> persisted graceful turn), state questions cannot be answered tool-free anymore (code nudge, not prompt hope), and learners can flag wrong content into a queue the coach actually reads. The review's "agent genuinely dependable" trio (transparent #14 - shipped earlier as the live trace; controllable #15; correctable #17) is complete.

---
Task ID: 41
Agent: Super Z (main)
Task: The 7.4/10 review's #1 feature - "real-time voice conversations with the AI coach" - as SPEAK RE part 2: Talk, the free spoken-conversation drill (the free-topic sibling of VoiceArena's fixed shadowing).

Work Log:
- /api/speak/conversation: GET returns 6 deterministic-per-day scenarios (mulberry32 over the day index, same doctrine as pairs/bank) each targeting a Farsi-interference family (register, perfect, countability, word_choice, prepositions, articles), weakness-biased - the scene matching the learner's hottest active mistake family sorts first (topMistakes read, try-wrapped for fresh DBs). POST advances the scene: aiJson in-character partner (ladder-briefed, profile-blocked), corrections <=2 trap-tagged with Farsi feeding recordMistakes(kind=speak) - the mouth feeds the same memory as the pen; XP 3/turn + 15 completion, bumpDaily(spoken), touchStreak, quest speak_1. On end: a SpeakSession row with ENGINE-COMPUTED scores (accuracy dinged 0.5/trap across the conversation, fluency from words-per-turn, range from unique-word ratio, delivery their average) - the report never asks the AI to grade itself - so /api/speak/analytics and the Improvement ledger read conversations with zero new machinery.
- CONTRACT: oversized histories (>6 turns) are REJECTED 400, not clamped - the first battery run proved the clamp design would fire a live model call on garbage and persist a junk session; the clamp was wrong, the reject is right.
- Speak.tsx: mode switch (Monologue drill | Talk: conversation); ConversationDrill - scenario cards, in-scene chat bubbles (coach lines replayable via speechSynthesis, always visible), turn counter, Speak/Stop mic button (browser ASR, VoiceArena convention), end-the-scene, deterministic scene report card with "Scores are computed from what happened in the scene, not an opinion." The line input is ALWAYS present (it doubles as the edit box for recognized speech - headless Chrome exposes SpeechRecognition but has no mic, which is how the gap was found); pluralization fixed ("1 turn").
- Battery: ROUTES +1; section 6d - bank shape (6 scenes, 6-turn cap), per-day order determinism across GETs, scene+opening completeness, 400 on unknown scenario, 400 on empty transcript, 400 on oversized history. 250/250.
- Browser E2E live: login -> Speaking -> Talk -> "Faulty order" scene -> typed a deliberately flawed line ("I am very disappoint about this purchase") -> in-character reply from "Dana" asking for the order number + corrections -> end the scene -> report (fluency 7.1 / range 8.8 / accuracy 8 / delivery 7.6; "1 turn, 4 corrections") -> Improvement ledger absorbed the row ("conversation: Faulty order", 3 sessions). Install-banner (PWA toast) blocked one click - dismissed with its own Later button, no code change needed. Screenshot: download/e2e-talk-conversation.png. Residue cleaned (conversation session row, e2e user).
- tsc clean, eslint clean (0 errors). Battery 250/250.

Stage Summary:
- The review's headline ask - real voice conversation - is now a shipped, gated surface with the house doctrine intact: deterministic scenarios, in-scene coach, corrections that feed the persistent learner model, and scores the engine computes instead of the AI's self-image. Speaking now has three honest modes: shadowing (VoiceArena), monologue + diagnosis + harder repeat (Speak), and free conversation (Talk). Next candidates from the review: #12 Anki/deck interoperability (TSV export/import on top of the rah.v1 bundle), #9 learner-materials ingestion into review cards.

---
Task ID: 42
Agent: Super Z (main)
Task: The 7.4/10 review's follow-ups, wave C: #12's honest export half (Anki TSV), #17's missing loop-closer (coach triage_flags tool), #14 polish (trace copy button), plus the stale MEGA-UPDATE D3 line fixed.

Work Log:
- /api/export/anki: GET, text/plain TSV in Anki's import dialect (#separator:tab / #html:false headers, front<TAB>back<TAB>tags, one row per deck card - 218 rows). Cell sanitizer strips control chars and flattens tabs/newlines so no cell can break the TSV. HONESTY HEADER: "Rah's FSRS schedule does NOT round-trip into Anki" - rah state travels as a plain informational tag (rah:new|review|mature), no fake scheduling interop. Progress BackupPanel gains the "Export deck (.tsv for Anki)" button. IMPORT half deliberately deferred: the deck is a static content pipeline (deck.json, unit/skill/trap metadata, distractors) - true custom-card ingestion is a schema+pipeline change tracked for the mega-update, not a quick win to rush.
- triage_flags coach tool (tools.ts, house style: dynamic db import): action=list shows open flags with full notes; action=resolve {id, status: fixed|wontfix} closes one - numeric-id and status-set validation, unknown-id rejection. This closes #17's loop: learner flags -> queue -> read_state surfaces it -> the coach can now RESOLVE it in conversation. Unit-pinned in battery (hostile status rejected, non-numeric id rejected, empty-queue list ok).
- CoachSidebar trace header gains a copy button (clipboard, appears when the run is not active) - #14's "inspect what the agent did" now leaves the sidebar too.
- Battery: ROUTES +1 (44 paths); section 6e - anki header, >=200 rows, exactly-3-cells-per-row, TSV-cell safety, disclaimer present, triage units. 261/261.
- CAUGHT MY OWN PROCESS BUG: the anki route's first Write failed (parent dir missing) and the file never existed - the battery caught it as 404-HTML-instead-of-TSV (4 FAILs). Never assume a staged file exists because the tool call "succeeded"; the battery is the arbiter.
- tsc clean, eslint clean. MEGA-UPDATE.md D3 line corrected from "spec only" to SHIPPED (Task 37) - it had drifted.

Stage Summary:
- Wave C closed: the deck leaves the app in a standard format with an honest disclaimer, the flag queue is now a closed loop the coach can triage, and the agent trace is copyable. Remaining review items (#9 ingestion, #7 exam formats, #5 curriculum depth, #2 phoneme feedback, #20 offline sync) are mega-update scale and stay tracked.

---
Task ID: 43
Agent: Super Z (main)
Task: The 7.4/10 review's #2 feature - phoneme-level pronunciation feedback - as SPEAK RE part 3: the Sound Lab, a deterministic sound-contrast engine over the ASR diff.

Work Log:
- src/lib/phonemes.ts (zero AI, zero network, fully deterministic): Needleman-Wunsch word alignment produces PAIRED substitutions (the old LCS split into missed/extra and lost the pairs); letter-pattern detectors then classify each pair against the documented Farsi-speaker confusion set: w<->v (no /w/ in Persian; tolerates the stacked silent-h drop - where->vere), p<->b (unaspirated p reads as b), th->t/s/d/z (think->tink, brother->broder), final -ng->-n (singing->sinin), s<->sh, tense/lax vowel collapse (i/ee/ea, a/e, u/oo, o/u - ship/sheep, bad/bed, full/fool), cluster reduction (asked->ast; run-of-2+ consonants anywhere, deletions + one t/d voicing swap). HONESTY DOCTRINE: pairs matching no pattern stay in `other` ("no known pattern"), a clean rep reports NOTHING - the mic evidence is measured, the sound behind it is an inference, and the note on every panel says exactly that.
- Each contrast ships: evidence pairs ("you aimed at the, the mic heard te"), an articulation tip (paper-strip test for p/b, tongue-between-teeth for th), and 2-3 playable minimal-pair drills (TTS speaks front then back).
- /api/arena/voice POST: response now carries the sound report alongside the word score; on weak reps (<85%) the contrasts feed recordMistakes as kind=speak tags sound_* (evidence = heard->target pair) - the MOUTH now leaks into the same persistent memory as the pen, so the coach, the mistake ledger and future weakness-bias all see recurring sounds. Clean reps never pollute the memory. tagLabel renders sound_* readably ("Sound: w vs v", "Sound: vowels (i ee) collapse").
- VoiceArena.tsx: Sound Lab panel under the score (contrast chips, evidence, tips, play-the-pair buttons, honesty note); always-present editable transcript input (the Task-41 no-mic lesson applied to the arena - headless/no-mic browsers can now train by typing); entry no longer gated on speech recognition (warning chip instead of a wall).
- Engine gaps FOUND IN LIVE TESTING and fixed: where->vere initially fell to `other` (two stacked changes beat the single-sub detectors) - w-v and th rules now tolerate exactly one co-occurring dropped letter after the signature swap (delOne subsequence check); singing->sinin needed replaceAll(ng->n); asked->ast needed mid-word cluster runs; seat->set needed ea->e.
- Battery: section 6f - 16 pins: 12 engine cases (want/vant+think/tink, singing, stacked where->vere, brother->broder, asked/seat, clean-rep emptiness, unmatchable-honesty negative, byte-identical determinism, tag labels) + arena response shape (sound.contrasts keys, honesty note, 400 on empty transcript). 277/277.
- tsc clean, eslint clean (0 errors). CI-relevant: the panel is a plain component (SoundPanel) - TS narrowing survives the callbacks.
- Browser E2E (agent-browser, live): login -> Arcade -> Voice -> typed "ze honesty of te report" as the shadow -> 40% + Sound Lab panel verified (th chip, BOTH evidence pairs, 3 drill pairs, note) -> screenshot download/e2e-sound-lab.png (full-page). Clean rep (100%) correctly shows NO panel. Also verified the memory loop: speak:sound_th family appeared with count 1 after the weak rep.
- E2E friction fixed en route: find-by-text clicks raced React's disabled-state (button clicked while still disabled, POST never fired) - click by ref after fill; GET drill sets re-roll per session (Math.random shuffle), so the loop re-rolled sessions until a contrast-rich sentence landed.
- Residue cleaned: 7 arena SpeakSession rows, 2 sound_* families, XP/gems/streak/chain reset to 0, today's ambient dailyStat row, e2e user + login codes. Verified zero residue after.

Stage Summary:
- The review's #2 is shipped and gated: pronunciation feedback is now SOUND-level (w-v, th, vowels, clusters) with honest epistemics - measured evidence, inferred label, drills as the point. The arena closes the loop: mouth mistake -> persistent memory -> weakness bias -> future drills. Remaining review items: #9 learner-materials ingestion, #7 exam formats (IELTS/TOEFL), #5 curriculum depth, #20 offline sync - all mega-update scale. PUSHED 577d39a to WasewaseX/rah-web main.

---
Task ID: 44
Agent: Super Z (main)
Task: Task 44 - the user played the app and reported four pains: (1) "after 10 review it just stops showing more", (2) "why is the review only shows collocation, grammar and vocab is completely different", (3) "why is fsrs incomplete", (4) confusing feature names ("who tf is behnam blackout") + direct order: actually use the app, find what is annoying/unplayable, fix it.

Work Log:
- DB-level smoking gun first: dev DB had exactly 10 cardStates, ALL collocation, 0 due, newLeft=0 - the 10 reviews consumed the whole daily new budget, then every surface dead-ended.
- Root cause (1): TWO sources of truth - /api/state's dueCount() computed the new budget WITHOUT subtracting today's introductions (server.ts) while /api/review/queue subtracted them, so Home advertised "Review 10 due" over a queue returning an empty batch. Reproduced live in the browser: Home badge said 10 due, Review tab rendered an empty finished screen with a useless "Load another round" refetch loop.
- Root cause (2): new cards were introduced in FILE ORDER and deck.json opens with 40 straight collocation cards (col001-col040), so week one of reviews is 100% collocation; grammar (54) and vocabulary (107) never appear.
- Fix A (one source of truth): queueCounts() in server.ts now computes due/newLeft/reviewedToday/newPerDay/seen/unseen + schedule forecast (nextDue, dueTomorrow, due3days); dueCount() = due + newLeft (the badge promises exactly what one round delivers); state route, coach briefing, next-best all inherit it.
- Fix B (collocation-only intro): interleaveBySkill() in the queue route - unseen cards shuffled into per-skill pools, introduced in a 2 vocabulary : 1 collocation : 1 grammar rotation (the deck's own 107/57/54 mix), with dry-pool fallback to the fullest pool.
- Fix C (dead-end): "Keep practicing" (ahead) mode - GET /api/review/queue?ahead=1 serves the 40 soonest-coming-back known cards (due > today, never new), shuffled, each tagged ahead:true; FSRS folds early reviews into the schedule normally. Review.tsx auto-continues: grading the last card silently fetches the next round in the same mode (Again cards roll straight back), session stats survive; the finished screen only appears after a confirmed-empty fetch.
- Fix D (FSRS feels invisible): finished screen now shows forecast chips ("next card back in 2 days", "N due tomorrow", "N new left today") + the honest budget line ("You met today's 10 new cards - that pace is what keeps future reviews small. Fresh items open tomorrow."); every card carries a scheduler line ("Last seen 3d ago - 4 reviews - normally returns every 6d" / "First meeting. Rah schedules it from here."); grade buttons keep live intervals (AGAIN1d/HARD2d/GOOD3d/EASY16d).
- Fix E (noob copy): rival name in Home's Weekly race now wears a "PRACTICE BOT" badge next to "Behnam Blackout" (self-labeling beats buried explanation); Freeze/Boost shop buttons got title tooltips explaining what they do; Btn component gained a title prop.
- Battery section 6g (8 new checks, 285/285): forecast fields present, first-round skill mix exactly 2:1:1 (vocabulary 5 / collocation 3 / grammar 2 for budget 10), badge due == queue promise, budget subtracts today's introductions, ahead mode shape (mode=ahead, all entries ahead:true, all due>today, never new cards).
- Live E2E (agent-browser + Playwright script scripts/e2e-task44-review.mjs): real login -> dead-end state now renders forecast + explanation + Keep practicing; ahead round loads with "Extra practice" chip and FSRS line ("Reviewed today - 1 review - normally returns every 2d"); auto-continue verified (after card 10 the next round rolled in seamlessly, "Card 1 of 10"); fresh DB first round opens with a vocabulary card, not collocation; Home shows "Behnam Blackout PRACTICE BOT". Screenshots + console clean.
- Residue: cardStates + reviewLogs restored to the pre-E2E snapshot exactly; queue seeds removed by battery restore. Process miss, disclosed: the snapshot omitted the Learner row, so the E2E grading's XP/chain/daily-stat gains remain (cosmetic, positive-only, review behavior unaffected - the fields the scheduler reads are exact).
- tsc + eslint clean.

Stage Summary:
- The "review stops after 10" wall is gone: the badge no longer lies (one source of truth), the round auto-continues, and when the day's honest budget is spent the app says WHY and offers Keep practicing instead of dead-ending. First-week reviews now mix all three skills instead of 40 straight collocations. FSRS is visible (per-card schedule line, forecast chips, live intervals, budget explanation). Rival self-labels as a practice bot. Battery 285/285, live E2E verified in a real browser as a noob user.

---
Task ID: 45
Agent: Super Z (main)
Task: P0-2 from the new external audit - make GitHub CI green. The audit flagged Task 44 (7ca3697) failing at Typecheck with exit 2 while the worklog claimed local tsc clean; reconcile.

Work Log:
- Pulled the real CI logs via the GitHub API: EVERY recent run failed, always the same error - scripts/test-portable.ts(121,37): TS2307 "Cannot find module 'playwright'". Lint passed; Typecheck was the only failing step.
- ROOT CAUSE (environment-contaminated typecheck): playwright was never in package.json/bun.lock; it exists only as a stray install in the PARENT directory (/home/z/node_modules/playwright). TypeScript module resolution walks up parent dirs, so local `tsc --noEmit` resolved it and reported clean - while CI's fresh checkout (frozen lockfile, no parent node_modules) correctly failed. The worklog's "tsc clean" claims were reading a contaminated environment, and CI was right every time.
- FIX: scripts/test-portable.ts now imports playwright through a VARIABLE specifier (const pwName = "playwright"; await import(pwName)) inside try/catch with a graceful "SKIP browser proof" fallback + minimal structural PwPage/PwBrowser types. TS cannot statically resolve a variable specifier (no TS2307 anywhere), and the dep stays what it truly is: an optional E2E-only tool CI does not need.
- VERIFIED AS CI, NOT AS MY MACHINE: temporarily moved /home/z/node_modules/playwright away (true fresh-checkout simulation), ran tsc -> exit 0, zero errors, restored after.
- Audit claim "branches: ain]" checked byte-exact: ci.yml actually reads `branches: [main]` correctly (the audit misread a rendering artifact) - no change needed there.
- BONUS pre-existing failure fixed: with CI honesty restored, the portable drive's own browser check was failing 14/15 (baseline confirmed on the unmodified script) because Progress is auth-gated and the drive never logged in. Added the Task-44-style real email-code login (UI fill + /api/auth/request-code devCode) before the Band-map assertion. Drive now 15/15 ALL PASS.
- Battery 285/285. eslint clean on the touched file.

Stage Summary:
- CI is unblocked: the typecheck failure that made every push red is fixed at the root (optional-dep import), the misleading "tsc clean locally" lesson is recorded (parent-dir node_modules = contaminated typechecks; CI is the arbiter), and the portable drive is green again with a real login. The audit's other ci.yml claim was a false positive.

---
Task ID: 46
Agent: Super Z (main)
Task: P0-3 + P0-4 from the new external audit - remove the browser-readable localStorage token and harden email-code authentication (hash at rest, atomic consume, brute-force + per-IP limits, resend invalidation, no code logging in prod).

Work Log:
- LoginCode schema + attempts column (db push): failed verify guesses are counted per code; 5 strikes invalidate the code, so the 1,000,000-combination space cannot be walked inside the 10-minute TTL.
- auth.ts rewrite of the code path: codes are stored as sha256 HASHES (plaintext lives only in memory between issuance and the email - a DB leak no longer yields usable codes); issueLoginCode invalidates all previous unused codes on resend (newest code is the only valid one); verifyLoginCode looks up the newest unused unexpired row, counts wrong guesses, then consumes ATOMICALLY via updateMany guarded on usedAt: null (two racing verifies cannot both win - exactly one gets count === 1).
- Per-IP issuance throttle (in-memory, 10/15min) layered on the existing per-email DB limit (5/15min). OPERATIONAL BUG FOUND AND FIXED: loopback IPs are exempt - everything-local traffic (dev, battery, E2E) shares 127.0.0.1 and the limit hard-locked the whole toolchain within one session; abuse protection on loopback is meaningless anyway. Found because the E2E itself got "Too many codes requested from this network".
- request-code route: mails the in-memory plaintext from issueLoginCode (the old route re-read the DB row - impossible once codes are hashed); devCode returned ONLY when SMTP is unconfigured AND NODE_ENV !== production (belt and braces over the mailer's own dev gate).
- TOKEN LADDER (P0-3): verify returns the raw login token in the body ONLY for embedded callers that declare x-rah-embed: 1; normal logins receive NO browser-readable credential at all. Server additionally sets rah_session_embed (httpOnly, SameSite=None, Secure, Partitioned/CHIPS) for embedded callers in production; the embed cookie is only honored by getSessionUserWithRequest when the request carries the custom x-rah-embed header (cross-site forms cannot forge custom headers => CSRF guard for the looser cookie). Resolution order: rah_session cookie -> embed cookie (with header) -> x-rah-token header.
- rah-fetch.ts: token storage moved localStorage -> sessionStorage (dies with the tab); any legacy localStorage token is scrubbed on load; x-rah-embed: 1 added to same-origin /api calls when window.self !== window.top; header fallback only engaged in embedded contexts.
- Battery: login section rebuilt - verify with embed marker (token + cookie), consumed-code replay refused, NORMAL verify leaks NO body token + still sets the httpOnly cookie, code stored as 64-hex sha256 (DB read pin), resend invalidates the previous code (old one 400s, fresh one 200s), 5 wrong guesses kill the code (even the correct code then 400s). 293/293.
- E2E (scripts/e2e-task46-auth.mjs) 8/8 in a real browser: A) top-level login renders the dashboard with ZERO JS-readable tokens (localStorage AND sessionStorage empty of rah_token) and the session resolves from the httpOnly cookie alone; B) same-origin iframe login: embed detection active, token in sessionStorage only, NEVER in localStorage, dashboard renders, session resolves through the ladder. Playwright lessons: wrapper page via setContent (app hydration detached injected iframes), frameLocator everywhere (cached contentFrame handles go stale after re-render).
- tsc clean; portable drive 15/15 still green.

Stage Summary:
- The audit's two auth P0s are closed with the embedded-context constraint respected instead of broken: normal users get a pure httpOnly-cookie login with no JS-readable credential; preview-iframe users get a partitioned-cookie-first, sessionStorage-token-last-resort ladder guarded against CSRF by the custom-header rule; a DB leak yields neither usable codes nor usable sessions. The brute-force window on a 6-digit code is now 5 guesses before self-destruction.
