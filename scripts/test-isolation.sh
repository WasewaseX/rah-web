#!/usr/bin/env bash
# Per-user data isolation battery (audit P0-1, Tasks 63+65). Proves - on a
# THROWAWAY stack with two registered users - that learner content does not
# cross accounts: chats, essays, transcripts, the writing revision chain AND
# the mistake memory (families, corrections, forget-tombstones) are stamped
# with the creator's user id, filtered on every read/delete, and a wrong-user
# request gets a 404, not the data. Also proves the mailer idempotency ledger
# (audit P2): a repeated request-code inside the idem window records ONE
# delivery attempt, not two.
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

# --- mistake memory: scoping + corrections (Task 65) --------------------------
# One family per user under the SAME kind:tag key; each caller must see only
# their own, cross-user corrections/forgets must 404, and forget must leave a
# tombstone so the rejected pair cannot re-aggregate.
python3 - "$DB" <<'PY'
import sqlite3, sys, json
db = sys.argv[1].replace("file:", "")
c = sqlite3.connect(db)
a = c.execute("SELECT id FROM User WHERE email='iso-a@rah.test'").fetchone()[0]
b = c.execute("SELECT id FROM User WHERE email='iso-b@rah.test'").fetchone()[0]
c.execute("INSERT INTO MistakeFamily (id, userId, kind, tag, label, count, evidence, updatedAt) VALUES (?,?,?,?,?,?,?,datetime('now'))", (a + ":chat:statives", a, "chat", "statives", "Statives A", 3, "A-SECRET-wrong -> A-RIGHT"))
c.execute("INSERT INTO MistakeFamily (id, userId, kind, tag, label, count, evidence, updatedAt) VALUES (?,?,?,?,?,?,?,datetime('now'))", (b + ":chat:statives", b, "chat", "statives", "Statives B", 1, "B-wrong -> B-right"))
c.commit()
open("/tmp/isolation-famids.json", "w").write(json.dumps({"a_fam": a + ":chat:statives"}))
print("seeded families")
c.close()
PY
A_FAM=$(python3 scripts/iso-id.py /tmp/isolation-famids.json a_fam)
MM_A1=$(curl -s -b "$JA" "$BASE/api/mistakes" | python3 scripts/iso-parse.py mistakes_secret "Statives A")
MM_A2=$(curl -s -b "$JA" "$BASE/api/mistakes" | python3 scripts/iso-parse.py mistakes_secret "Statives B")
check "A sees own family"                 "$MM_A1" "1"
check "A does NOT see B's family"         "$MM_A2" "0"
MM_B2=$(curl -s -b "$JB" "$BASE/api/mistakes" | python3 scripts/iso-parse.py mistakes_secret "Statives B")
MM_B1=$(curl -s -b "$JB" "$BASE/api/mistakes" | python3 scripts/iso-parse.py mistakes_secret "Statives A")
check "B sees own family"                 "$MM_B2" "1"
check "B does NOT see A's family"         "$MM_B1" "0"
X_CORRECT=$(curl -s -o /dev/null -w '%{http_code}' -b "$JB" -X POST "$BASE/api/mistakes" -H 'content-type: application/json' -d "{\"id\":\"$A_FAM\",\"label\":\"hacked\"}")
check "B correcting A's family = 404"     "$X_CORRECT" "404"
X_FORGET=$(curl -s -o /dev/null -w '%{http_code}' -b "$JB" -X DELETE "$BASE/api/mistakes?id=$A_FAM")
check "B forgetting A's family = 404"     "$X_FORGET" "404"
A_STILL=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
print(c.execute('SELECT COUNT(*) FROM MistakeFamily WHERE id=?', ('$A_FAM',)).fetchone()[0])")
check "A's family survived B's attempts"  "$A_STILL" "1"
OK_CORRECT=$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" -X POST "$BASE/api/mistakes" -H 'content-type: application/json' -d "{\"id\":\"$A_FAM\",\"label\":\"Statives A (edited)\"}")
check "A corrects own family = 200"       "$OK_CORRECT" "200"
A_EDITED=$(curl -s -b "$JA" "$BASE/api/mistakes" | python3 scripts/iso-parse.py mistakes_edited)
check "correction sets editedAt provenance" "$A_EDITED" "1"
OK_FORGET=$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" -X DELETE "$BASE/api/mistakes?id=$A_FAM")
check "A forgets own family = 200"        "$OK_FORGET" "200"
TOMB=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
print(c.execute('SELECT COUNT(*) FROM MistakeForgiven WHERE id=?', ('$A_FAM',)).fetchone()[0])")
check "forget leaves a tombstone"         "$TOMB" "1"

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

# --- Task 72: aggregate-state isolation (CardState + arcade meta) ------------
# The FSRS deck queue, GameStat records, achievements and the league row are
# per-user keyed now; a grade or game played by A must be invisible to B.
GRADE_CARD="col012"
AG=$(curl -s -b "$JA" -X POST "$BASE/api/review/grade" -H 'content-type: application/json' -d "{\"cardId\":\"$GRADE_CARD\",\"grade\":3,\"dir\":\"cloze\"}")
echo "$AG" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ivl") is not None' && ok "A grades a deck card (FSRS applies)" || bad "A grades a deck card"
CS_A=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
a = c.execute(\"SELECT id FROM User WHERE email='iso-a@rah.test'\").fetchone()[0]
rows = c.execute(\"SELECT userId FROM CardState WHERE cardId=?\", ('$GRADE_CARD',)).fetchall()
print('a-only' if len(rows)==1 and rows[0][0]==a else 'leak:'+repr(rows))")
check "A's grade creates exactly ONE CardState row stamped with A's id" "$CS_A" "a-only"
BQ_STATE=$(curl -s -b "$JB" "$BASE/api/review/queue" | python3 -c "
import json,sys
d=json.load(sys.stdin)
e=[x for x in d.get('batch',[]) if x.get('card',{}).get('id')=='$GRADE_CARD']
# 'absent' is clean too: the card is not in B's round at all (budget/skill mix).
print('clean' if not e else ('new' if e[0].get('state',{}).get('state')=='new' else 'LEAK:'+json.dumps(e[0].get('state'))))")
check "B's queue never sees A's schedule for that card" "$BQ_STATE" "clean"
curl -s -b "$JA" -X POST "$BASE/api/flow" -H 'content-type: application/json' -d '{"correct":10,"total":12,"ms":600000}' > /dev/null
GS_A=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
a = c.execute(\"SELECT id FROM User WHERE email='iso-a@rah.test'\").fetchone()[0]
rows = c.execute(\"SELECT userId, best FROM GameStat WHERE key='flow:best'\").fetchall()
print('a-only' if len(rows)==1 and rows[0][0]==a and rows[0][1]==10 else 'leak:'+repr(rows))")
check "A's flow run stamps GameStat with A's id (one row)" "$GS_A" "a-only"
BFLOW=$(curl -s -b "$JB" "$BASE/api/flow" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("clean" if d.get("best")==0 and d.get("streak")==0 else "leak")')
check "B's flow view reads zero (A's run invisible)" "$BFLOW" "clean"
ACH_A=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
a = c.execute(\"SELECT id FROM User WHERE email='iso-a@rah.test'\").fetchone()[0]
rows = c.execute(\"SELECT userId FROM Achievement WHERE key='first_words'\").fetchall()
print('a-only' if len(rows)==1 and rows[0][0]==a else 'leak:'+repr(rows))")
check "first_words awarded to A only (one row, A's id)" "$ACH_A" "a-only"
BACH=$(curl -s -b "$JB" "$BASE/api/state" | python3 -c 'import json,sys; d=json.load(sys.stdin); u=d.get("game",{}).get("unlocked",[]); print("clean" if "first_words" not in u else "leak")')
check "B's trophy case does not show A's trophy" "$BACH" "clean"
curl -s -b "$JA" "$BASE/api/arcade/league" > /dev/null; curl -s -b "$JB" "$BASE/api/arcade/league" > /dev/null
LGE=$(python3 -c "
import sqlite3
c = sqlite3.connect('$(echo $DB | sed s/file://)')
rows = c.execute(\"SELECT userId FROM League\").fetchall()
ids={r[0] for r in rows}
a = c.execute(\"SELECT id FROM User WHERE email='iso-a@rah.test'\").fetchone()[0]
b = c.execute(\"SELECT id FROM User WHERE email='iso-b@rah.test'\").fetchone()[0]
print('per-user' if len(rows)==2 and ids=={a,b} else 'leak:'+repr(rows))")
check "league rows are per-user (A and B each own one)" "$LGE" "per-user"

# --- mailer idempotency ledger (P2) ------------------------------------------
curl -s -X POST "$BASE/api/auth/request-code" -H 'content-type: application/json' -d '{"email":"iso-c@rah.test"}' > /dev/null
curl -s -X POST "$BASE/api/auth/request-code" -H 'content-type: application/json' -d '{"email":"iso-c@rah.test"}' > /dev/null
sleep 1
MAIL_ROWS=$(python3 scripts/maillog-count.py "$(echo $DB | sed s/file://)" "iso-c@rah.test")
check "double request-code = ONE ledger row" "$MAIL_ROWS" "1"
echo ""
echo "=== ISOLATION BATTERY: $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ]
