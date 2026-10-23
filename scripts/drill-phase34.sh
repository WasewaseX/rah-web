#!/usr/bin/env bash
# Task 87-b PHASE 3+4: fresh-deployment drill + vault privacy/offsite proofs.
#
# Phase 3: a FRESH deployment (git clone -> bun install -> the real boot
#   sequence with clone-scoped GUARD_* env) must restore the learner from the
#   surviving offsite mount (upload/rah-backups) - the exact mechanism that
#   saved the deployment in Tasks 60-63. NOT a disposable test database: the
#   restored payload must match the LIVE learner state.
# Phase 4a: the vault repo must be PRIVATE (anonymous ls-remote fails) while
#   the public repo stays public (anonymous ls-remote works).
# Phase 4b: the snapshot that vault-sync pushes is SCRUBBED (zero Session /
#   LoginCode rows) and carries the learner state (restorable).
# Phase 4c: vault-ONLY restore - no db/sync, no OSS mount, ONLY the vault
#   clone's rah-latest.db -> boot must restore the learner from the vault.
set -u
cd /home/z/my-project
MAIN="/home/z/my-project"
CLONE="$MAIN/drill-clone"
SAFE="$MAIN/db/drill-safety"
FAILED=0
pass() { echo "PASS $*"; }
fail() { echo "FAIL $*"; FAILED=1; }

LIVE_JSON="$(python3 - <<'PY'
import sqlite3, json
c = sqlite3.connect("db/custom.db")
xp, streak = c.execute("SELECT xp, streak FROM Learner WHERE id='me'").fetchone()
created = c.execute("SELECT createdAt FROM Learner WHERE id='me'").fetchone()[0]
print(json.dumps({"xp": xp, "streak": streak, "created": created}))
PY
)"
echo "live learner: $LIVE_JSON"
LIVE_XP="$(python3 -c "import json;print(json.loads('''$LIVE_JSON''')['xp'])")"
LIVE_STREAK="$(python3 -c "import json;print(json.loads('''$LIVE_JSON''')['streak'])")"
LIVE_CREATED="$(python3 -c "import json;print(json.loads('''$LIVE_JSON''')['created'])")"

echo "=== PHASE 3: fresh-deployment drill ==="
rm -rf "$CLONE"
git clone -q "$MAIN" "$CLONE" && pass "fresh clone at $(cd "$CLONE" && git log --oneline -1 | cut -c1-72)" || { fail "clone failed"; exit 1; }
mkdir -p "$CLONE/db" "$CLONE/db/backups"

cd "$CLONE"
if timeout 240 bun install --frozen-lockfile > "$SAFE/bun-install.log" 2>&1; then
  pass "bun install (frozen lockfile) on the fresh tree"
else
  echo "  (bun install failed - hardlink fallback: $(tail -2 "$SAFE/bun-install.log" | head -1))"
  cp -al "$MAIN/node_modules" "$CLONE/node_modules" 2>/dev/null && fail "used hardlink fallback for node_modules (recorded honestly)" || fail "no node_modules available"
fi

# the surviving OSS mount: gitignored content that outlives the workspace
mkdir -p upload/rah-backups
cp "$MAIN/upload/rah-backups/rah-latest.db" upload/rah-backups/rah-latest.db
pass "surviving OSS mount emulated (upload/rah-backups/rah-latest.db staged)"

echo "DATABASE_URL=file:$CLONE/db/custom.db" > .env

# the real boot sequence, clone-scoped (same order as ensure-server.sh)
export GUARD_ROOT="$CLONE" GUARD_DB="$CLONE/db/custom.db" GUARD_LOCAL="$CLONE/db/backups"
export GUARD_OFFSITE="$CLONE/upload/rah-backups" GUARD_LOG="$CLONE/db/guard.log"
export GUARD_SYNC="$CLONE/db/sync/rah-latest.db" GUARD_VAULT="$CLONE/db/vault-work/rah-web/rah-latest.db"
export GUARD_KEEP=14

bash scripts/db-guard.sh boot > "$CLONE/db/guard.log" 2>&1 || true
bash scripts/db-restore.sh >> "$CLONE/db/guard.log" 2>&1 || true
bash scripts/db-migrate-safe.sh >> "$CLONE/db/guard.log" 2>&1 || true
bash scripts/db-integrity-repair.sh >> "$CLONE/db/guard.log" 2>&1 || true
RESTORED="$(grep -c "RESTORE OK" "$CLONE/db/guard.log" || true)"
ls -la "$CLONE/db/custom.db" 2>/dev/null || true
[ "$RESTORED" -ge 1 ] && pass "boot path restored the learner DB (RESTORE OK in guard log)" || fail "no RESTORE OK in the clone boot"

# client-sync guard (Task 87-a) on the fresh tree
bunx prisma generate > /dev/null 2>&1 && echo "$(sha256sum prisma/schema.prisma | cut -d' ' -f1)" > node_modules/.prisma/client/.rah-schema-stamp

DATABASE_URL="file:$CLONE/db/custom.db" nohup bunx next dev -p 3100 > "$SAFE/clone-dev.log" 2>&1 &
CLONE_PID=$!
UP=0
for _ in $(seq 1 30); do
  sleep 2
  curl -sf -o /dev/null --max-time 3 http://localhost:3100/api/version && UP=1 && break
done
if [ "$UP" = "1" ]; then
  pass "fresh deployment answers on :3100"
  V="$(curl -s http://localhost:3100/api/version)"
  echo "  clone version payload: $V"
  python3 - "$V" "$LIVE_XP" "$LIVE_STREAK" <<'PY'
import sys, json
v = json.loads(sys.argv[1])
d = v.get("data", {})
ok = d.get("xp") == int(sys.argv[2]) and d.get("streak") == int(sys.argv[3]) and str(d.get("createdAt", "")).startswith("2026-10-20")
print(("PASS" if ok else "FAIL") + f" fresh deployment serves the LIVE learner state (xp={d.get('xp')}, streak={d.get('streak')}, createdAt={d.get('createdAt')})")
sys.exit(0 if ok else 1)
PY
  [ $? -ne 0 ] && FAILED=1
else
  fail "fresh deployment never became healthy on :3100"
fi
kill $CLONE_PID 2>/dev/null; pkill -f "next dev -p 3100" 2>/dev/null; pkill -f "drill-clone" 2>/dev/null || true

# Task 92: the clone is a drill artifact - leaving it inside the tree broke
# tsc/eslint (the clone legitimately lacks node_modules and tsc scans it).
# Remove it so the tree is always gate-clean after a drill run.
rm -rf "$CLONE"

echo "=== PHASE 4a: vault privacy (anonymous access must fail) ==="
cd "$MAIN"
if git -c credential.helper= ls-remote https://github.com/WasewaseX/vault.git HEAD >/dev/null 2>&1; then
  fail "vault repo answered an ANONYMOUS ls-remote - it is reachable without credentials"
else
  pass "vault repo rejects anonymous access (private)"
fi
if git -c credential.helper= ls-remote https://github.com/WasewaseX/rah-web.git HEAD >/dev/null 2>&1; then
  pass "public repo answers anonymous access (still public, as intended)"
else
  fail "public repo rejected anonymous access (unexpected)"
fi

echo "=== PHASE 4b: the pushed snapshot is scrubbed + restorable ==="
python3 - "$MAIN/db/sync/rah-latest.db" "$MAIN/db/vault-work/rah-web/rah-latest.db" <<'PY'
import sqlite3, sys, os
ok = True
for path in sys.argv[1:]:
    if not os.path.exists(path):
        print(f"FAIL {path} missing"); ok = False; continue
    c = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    sess = login = 0
    for t, var in (("Session", "s"), ("LoginCode", "l")):
        try:
            n = c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
            if t == "Session": sess = n
            else: login = n
        except Exception:
            pass
    try:
        xp, streak = c.execute("SELECT xp, streak FROM Learner WHERE id='me'").fetchone()
    except Exception:
        xp = streak = -1
    c.close()
    good = sess == 0 and login == 0 and xp > 0
    print(("PASS" if good else "FAIL") + f" {path}: Session={sess} LoginCode={login} xp={xp} streak={streak}")
    ok = ok and good
sys.exit(0 if ok else 1)
PY
[ $? -ne 0 ] && FAILED=1

echo "=== PHASE 4c: vault-ONLY restore (no sync, no OSS mount) ==="
rm -rf "$CLONE"
git clone -q "$MAIN" "$CLONE"
cd "$CLONE"
mkdir -p db/vault-work/rah-web db/backups
cp -al "$MAIN/node_modules" "$CLONE/node_modules" 2>/dev/null || true
cp "$MAIN/db/vault-work/rah-web/rah-latest.db" db/vault-work/rah-web/rah-latest.db
[ -f db/vault-work/rah-web/rah-latest.db ] && pass "only the VAULT snapshot staged (no db/sync, no OSS mount)" || fail "vault snapshot missing"
export GUARD_ROOT="$CLONE" GUARD_DB="$CLONE/db/custom.db" GUARD_LOCAL="$CLONE/db/backups"
export GUARD_OFFSITE="$CLONE/upload/rah-backups" GUARD_LOG="$CLONE/db/guard.log"
export GUARD_SYNC="$CLONE/db/sync/rah-latest.db" GUARD_VAULT="$CLONE/db/vault-work/rah-web/rah-latest.db"
bash scripts/db-guard.sh boot > "$CLONE/db/guard.log" 2>&1 || true
bash scripts/db-restore.sh >> "$CLONE/db/guard.log" 2>&1 || true
if grep -qiE "vault" "$CLONE/db/guard.log" && grep -q "RESTORE OK" "$CLONE/db/guard.log"; then
  pass "boot restored from the VAULT source (restore chain proven)"
else
  grep -iE "RESTORE|vault|no verified|fallback" "$CLONE/db/guard.log" | tail -4
  fail "vault-source restore not proven in restore log"
fi
V="$(python3 - "$CLONE/db/custom.db" "$LIVE_XP" "$LIVE_STREAK" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
try:
    xp, streak = c.execute("SELECT xp, streak FROM Learner WHERE id='me'").fetchone()
except Exception:
    xp = streak = -1
ok = xp == int(sys.argv[2]) and streak == int(sys.argv[3])
print(("PASS" if ok else "FAIL") + f" vault-restored db carries the live learner state (xp={xp}, streak={streak})")
sys.exit(0 if ok else 1)
PY
)"
echo "$V"
case "$V" in PASS*) ;; *) FAILED=1;; esac

cd "$MAIN"
exit $FAILED
