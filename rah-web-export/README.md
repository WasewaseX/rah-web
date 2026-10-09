# Rah · Web

English learning platform for Farsi speakers targeting B2 to C1.

- Built-in AI coach (Socratic turns, elaborated Farsi corrections) with zero configuration
- FSRS-5 spaced retrieval over 218 multi-direction cards (gap fill, meaning, listening)
- Adaptive placement: 20 item ladder + AI graded writing sample
- Writing lab: CEFR four dimension grading with C1 upgrades
- Speaking loop: 2 minute monologue, four aspect diagnosis, harder repeat
- Listening decoder: five pass protocol with AI generated material
- Six graded readings, each convertible to a retrieval quiz
- Progress: 5 week activity, leak rates per skill, deck maturity, AI score trends

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma + SQLite · z-ai-web-dev-sdk (server side AI)

## Run

```bash
bun install
cp .env.example .env
bun run db:push
bun run dev
```

The AI is built in. No keys, no setup.
