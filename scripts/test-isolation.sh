#!/usr/bin/env bash
# Per-user data isolation battery (audit P0-1, Task 63). Proves - on a
# THROWAWAY stack with two registered users - that learner content does not
# cross accounts: chats, essays, transcripts and the writing revision chain
# are stamped with the creator's user id, filtered on every read/delete, and
# a wrong-user request gets a 404, not the data. Also proves the mailer
# idempotency ledger (audit P2): a repeated request-code inside the idem
# window records ONE delivery attempt, not two.
#
# The real learner's db/custom.db is never touched (own DB + own dist dir +
# RAH_OPEN_REGISTRATION scoped to this stack).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=3111
DB="file:/home/z/my-project/db/battery-isolation.db"
BASE="http://localhost:$PORT"
DIST=".next-isolation"
LOG=/tmp/isolation-server.log

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (want '$3' got '$2')"; fi; }

cleanup() { pkill -f "next dev -p $PORT" 2>/dev/null || true; }
trap cleanup EXIT

echo "== per-user isolation battery =="
export RAH_OPEN_REGISTRATION=1
rm -f db/battery-isolation.db db/battery-isolation.db-*
DATABASE_URL="$DB" bunx prisma db push --skip-generate > /dev/null 2>&1
echo "== throwaway db ready =="

NEXT_DIST_DIR="$DIST" DATABASE_URL="$DB" setsid nohup bunx next dev -p "$PORT" > "$LOG" 2>&1 < /dev/null &
for i in $(seq 1 60); do
  curl -sf "$BASE/api/version" > /dev/null 2>&1 && break
  [ "$i" = 60 ] && { echo "server never came up"; tail -20 "$LOG"; exit 1; }
  sleep 2
done
echo "== server up =="

# --- register two users ------------------------------------------------------
register() { # $1 email, $2 cookie jar
  local code
  code=$(curl -s -X POST "$BASE/api/auth/request-code" -H 'content-type: application/json' -d "{\"email\":\"$1\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("devCode",""))')
  [ -n "$code" ] || { echo "no dev code for $1"; return 1; }
  curl -s -c "$2" -X POST "$BASE/api/auth/verify" -H 'content-type: application/json' -d "{\"email\":\"$1\",\"code\":\"$code\"}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok" if d.get("ok") else "err")'
}
JA=/tmp/isolation-a.jar; JB=/tmp/isolation-b.jar; rm -f "$JA" "$JB"
A_RES=$(register "iso-a@rah.test" "$JA"); B_RES=$(register "iso-b@rah.test" "$JB")
check "register user A" "$A_RES" "ok"
check "register user B" "$B_RES" "ok"

# --- resolve user ids + seed scoped rows directly ----------------------------
python3 - "$DB" <<'PY'
import sqlite3, sys, os, json
db = sys.argv[1].replace("file:", "")
c = sqlite3.connect(db)
a = c.execute("SELECT id FROM User WHERE email='iso-a@rah.test'").fetchone()[0]
b = c.execute("SELECT id FROM User WHERE email='iso-b@rah.test'").fetchone()[0]
def seed(sql, args): c.execute(sql, args)
# chats
seed("INSERT INTO ChatMsg (userId, role, content) VALUES (?,?,?)", (a, "user", "A-SECRET-chat"))
seed("INSERT INTO ChatMsg (userId, role, content) VALUES (?,?,?)", (a, "coach", '{"reply":"A-SECRET-reply"}'))
seed("INSERT INTO ChatMsg (userId, role, content) VALUES (?,?,?)", (b, "user", "B-chat"))
# writing: a 2-step revision chain for A, 1 sub for B
p = c.execute("INSERT INTO WritingSub (userId, prompt, text, result, parentId, revision) VALUES (?,?,?,?,NULL,1)", (a, "pA", "AAA old essay", "{}")).lastrowid
child = c.execute("INSERT INTO WritingSub (userId, prompt, text, result, parentId, revision) VALUES (?,?,?,?,?,2)", (a, "pA", "AAA new essay", "{}", p)).lastrowid
c.execute("INSERT INTO WritingSub (userId, prompt, text, result, parentId, revision) VALUES (?,?,?,?,NULL,1)", (b, "pB", "BBB essay", "{}"))
# speak + reviews
seed("INSERT INTO SpeakSession (userId, prompt, transcript, round, result) VALUES (?,?,?,?,?)", (a, "pA", "A-SECRET-transcript", 1, "{}"))
seed("INSERT INTO SpeakSession (userId, prompt, transcript, round, result) VALUES (?,?,?,?,?)", (b, "pB", "B-transcript", 1, "{}"))
seed("INSERT INTO ReviewLog (userId, cardId, grade, ivl, day, source) VALUES (?,?,?,?,?,?)", (a, "cardA", 3, 1, 1, "review"))
seed("INSERT INTO ReviewLog (userId, cardId, grade, ivl, day, source) VALUES (?,?,?,?,?,?)", (b, "cardB", 3, 1, 1, "review"))
c.commit()
open("/tmp/isolation-ids.json", "w").write(json.dumps({"a": a, "b": b, "parent": p, "child": child}))
print(f"seeded: a={a} b={b} chain_parent={p}")
c.close()
PY
AID=$(python3 -c 'import json; print(json.load(open("/tmp/isolation-ids.json"))["a"])')
PARENT=$(python3 -c 'import json; print(json.load(open("/tmp/isolation-ids.json"))["parent"])')
CHILD=$(python3 -c 'import json; print(json.load(open("/tmp/isolation-ids.json"))["child"])')

# --- chats -------------------------------------------------------------------
A_SEES=$(curl -s -b "$JA" "$BASE/api/chat" | python3 scripts/iso-parse.py chat_secret "A-SECRET")
B_IN_A=$(curl -s -b "$JA" "$BASE/api/chat" | python3 scripts/iso-parse.py chat_secret "B-chat")
check "A sees own chats (2)"        "$A_SEES" "2"
check "A does NOT see B's chats"    "$B_IN_A" "0"
B_SEES=$(curl -s -b "$JB" "$BASE/api/chat" | python3 scripts/iso-parse.py chat_secret "B-chat")
A_LEAK=$(curl -s -b "$JB" "$BASE/api/chat" | python3 scripts/iso-parse.py chat_secret "A-SECRET")
check "B sees own chats (1)"        "$B_SEES" "1"
check "B does NOT see A's chats"    "$A_LEAK" "0"
ANON=$(curl -s "$BASE/api/chat" | python3 scripts/iso-parse.py chat_len)
check "unauthenticated sees nothing" "$ANON" "0"

# --- writing + revision chain ------------------------------------------------
W_A=$(curl -s -b "$JA" "$BASE/api/writing" | python3 scripts/iso-parse.py writing_recent)
W_B_IN_A=$(curl -s -b "$JA" "$BASE/api/writing" | python3 scripts/iso-parse.py writing_recent_foreign "pB")
check "A sees own writing (2 chain steps)" "$W_A" "2"
check "A does NOT see B's writing"         "$W_B_IN_A" "0"
CHAIN_AS_B=$(curl -s -o /dev/null -w '%{http_code}' -b "$JB" "$BASE/api/writing?id=$PARENT")
check "B gets 404 for A's submission"      "$CHAIN_AS_B" "404"
CHAIN=$(curl -s -b "$JA" "$BASE/api/writing?id=$CHILD" | python3 scripts/iso-parse.py chain_len)
CHAIN_REV=$(curl -s -b "$JA" "$BASE/api/writing?id=$CHILD" | python3 scripts/iso-parse.py chain_revs)
CHAIN_ORDER=$(curl -s -b "$JA" "$BASE/api/writing?id=$CHILD" | python3 scripts/iso-parse.py chain_texts)
check "revision chain has 2 steps (owner)"  "$CHAIN" "2"
check "chain revisions oldest-first"        "$CHAIN_REV" "[1, 2]"
check "chain order old->new"                "$CHAIN_ORDER" '["AAA old essay", "AAA new essay"]'

# --- speak -------------------------------------------------------------------
S_A=$(curl -s -b "$JA" "$BASE/api/speak" | python3 scripts/iso-parse.py speak_secret "pA")
S_LEAK=$(curl -s -b "$JB" "$BASE/api/speak" | python3 scripts/iso-parse.py speak_secret "pA")
check "A sees own speak session"       "$S_A" "1"
check "B does NOT see A's transcript"  "$S_LEAK" "0"

# --- scoped delete -----------------------------------------------------------
curl -s -b "$JA" -X DELETE "$BASE/api/chat" > /dev/null
A_LEFT=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
print(c.execute(\"SELECT COUNT(*) FROM ChatMsg WHERE userId=?\", ('$AID',)).fetchone()[0])")
B_LEFT=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
b = c.execute(\"SELECT id FROM User WHERE email='iso-b@rah.test'\").fetchone()[0]
print(c.execute(\"SELECT COUNT(*) FROM ChatMsg WHERE userId=?\", (b,)).fetchone()[0])")
check "A's delete removes only A's chats" "$A_LEFT" "0"
check "B's chats survive A's delete"      "$B_LEFT" "1"

# --- mailer idempotency ledger (P2) ------------------------------------------
curl -s -X POST "$BASE/api/auth/request-code" -H 'content-type: application/json' -d '{"email":"iso-c@rah.test"}' > /dev/null
curl -s -X POST "$BASE/api/auth/request-code" -H 'content-type: application/json' -d '{"email":"iso-c@rah.test"}' > /dev/null
sleep 1
MAIL_ROWS=$(python3 scripts/maillog-count.py "$(echo $DB | sed s/file://)" "iso-c@rah.test")
check "double request-code = ONE ledger row" "$MAIL_ROWS" "1"
echo ""
echo "=== ISOLATION BATTERY: $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ]
