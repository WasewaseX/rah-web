#!/usr/bin/env bash
# Pushes Rah to GitHub and creates the v2 release. Requires a GitHub PAT in
# the environment (GH_TOKEN or GITHUB_TOKEN). Never hardcode the token.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${GH_TOKEN:=${GITHUB_TOKEN:-}}"
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: set GH_TOKEN in the environment (GitHub PAT with repo scope) and re-run."
  exit 1
fi

REPO="WasewaseX/rah-web"
HEAD="https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$HEAD"
else
  git remote add origin "$HEAD"
fi

git push -u origin HEAD --force
git push origin --tags --force

# Release notes + release via API
NOTES=$(cat <<'EOS'
Rah v2: the coach is now a multi-step agent.

- Agent loop: routing -> skill execution (chains up to 3 steps) -> reply synthesis -> English-only verifier
- 23 executable skills incl. exam generation, deep two-pass level analysis, per-skill assessment, drills, roleplay, study plan, progress report, theme and GUI effect plugins
- Exams: 10-item generation, synonym/paraphrase-aware grading, accepted alternatives, precise per-item feedback, consistent counts
- Per-skill CEFR bands (grammar, vocabulary, writing, speaking, reading, listening) plus overall, persisted and rendered in Progress
- Plugin-based GUI control: change the whole app color from chat (7 presets or any hex), switch WebGL backdrop effects (aurora, waves, particles)
- Persian appears only inside correction cards; no plan lines, no fa_note, no AI artifacts
EOS
)
TAG="v2.0.0-agent"
curl -s -X POST \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/${REPO}/releases \
  -d "$(jq -n --arg tag "$TAG" --arg notes "$NOTES" '{tag_name:$tag,name:"Rah v2: Agent Coach + Skills",body:$notes,prerelease:false}')" \
  | jq -r '.html_url // .message'
echo "Done."
