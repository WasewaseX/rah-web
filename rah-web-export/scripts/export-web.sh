#!/bin/bash
# Export the website source to a clean git working tree.
set -e
SRC=/home/z/my-project
DST=/home/z/my-project/rah-web-export
rm -rf "$DST"
mkdir -p "$DST"
cd "$SRC"
for item in src prisma public scripts .github package.json bun.lock tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts components.json eslint.config.mjs .gitignore README.md; do
  if [ -e "$item" ]; then cp -r "$item" "$DST/"; fi
done
cat > "$DST/.env.example" <<'ENVEOF'
# Copy to .env and adjust if needed. The app works with this default.
DATABASE_URL="file:/home/z/my-project/db/rah.db"
ENVEOF
cat > "$DST/README.md" <<'RMEOF'
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
RMEOF
echo "exported to $DST"

# Initialize a fresh git history for the export.
cd "$DST"
git init -q -b main 2>/dev/null || (rm -rf .git && git init -q -b main)
git add -A
git -c user.name="rah-bot" -c user.email="rah-bot@users.noreply.github.com" commit -qm "Rah web: fullstack site with built-in AI coach, FSRS-5 review, placement, writing, speaking, listening, readings"
echo "git history ready in $DST"
