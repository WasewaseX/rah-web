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
