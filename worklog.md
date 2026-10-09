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
