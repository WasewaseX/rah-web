#!/usr/bin/env bash
# Rah GitHub release script. Creates the private repo, pushes, tags v2.0.0
# and opens a GitHub release. The PAT is read from the environment ONLY:
#   export GITHUB_PAT=github_pat_xxx   (or GH_TOKEN)
#   export GH_USER=your-username
#   bash scripts/release.sh
set -euo pipefail

: "${GITHUB_PAT:=${GH_TOKEN:-}}"
: "${GH_USER:?Set GH_USER to your GitHub username}"
: "${GITHUB_PAT:?Set GITHUB_PAT (or GH_TOKEN) in the environment. Never hardcode it.}"

REMOTE="https://${GH_USER}:${GITHUB_PAT}@github.com/${GH_USER}/rah.git"
TAG="v2.0.0"

echo "==> Committing any pending work"
git add -A
git commit -m "Rah v2: agent coach, skill registry, per-skill assessment, theme plugin, exam engine" --allow-empty -q || true

echo "==> Pushing main to github.com/${GH_USER}/rah (private)"
if git remote | grep -q origin; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi
git push -u origin main --force

echo "==> Creating tag ${TAG}"
git tag -f "$TAG"
git push origin "$TAG" --force

echo "==> Creating GitHub release ${TAG}"
API_JSON=$(cat <<'EOF'
{
  "tag_name": "v2.0.0",
  "name": "Rah v2.0.0 — The Agent Release",
  "body": "## Coach is now an agent\n- Plan -> execute -> compose loop: one message becomes a multi-step run with live progress in the chat.\n- 23 executable skills: exam generation, deep level analysis, drills, readings, listening pieces, writing tasks, word lookups, form comparisons, vocab packs, streak/goal/plan management, and app-control plugins.\n\n## Exams that grade like a human\n- Synonym-aware grading: accepted alternatives are part of the exam contract, not an afterthought.\n- Rewrite questions judged by required collocation, not exact string match.\n- Announced count always equals graded count.\n\n## Per-skill assessment\n- Grammar, vocabulary, writing, speaking, reading, listening each get their own CEFR band from a deep multi-probe analysis (extended thinking on), plus one merged overall band.\n\n## Plugin-based GUI\n- set_theme skill repaints the whole app live (7 presets + custom hex). All colors are CSS-variable tokens now.\n- WebGL aura backdrop reacts to theme changes.\n\n## Housekeeping\n- Zero scripted fallbacks: the scripted chatbot era is gone from the model context.\n- CI workflow: lint + typecheck + build on every push.",
  "draft": false,
  "prerelease": false
}
EOF
)
curl -sf -X POST \
  -H "Authorization: Bearer ${GITHUB_PAT}" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/${GH_USER}/rah/releases \
  -d "$API_JSON" | grep -E '"html_url"' | head -2

echo "==> Done. Repo: https://github.com/${GH_USER}/rah (private)"
