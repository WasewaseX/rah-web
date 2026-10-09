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
