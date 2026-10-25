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
BASE="http://localhost:$PORT"
DIST=".next-isolation"
LOG=/tmp/isolation-server.log

# Engine-agnostic throwaway (Task 97, post-PG-flip): derive the throwaway
# DATABASE_URL from the deployment's own .env. postgresql -> a throwaway
# DATABASE (rah_isolation) on the same local PG instance, dropped + created
# per run - seeding/stamp checks go through psql. file: -> the legacy SQLite
# path (kept for a possible re-flip; the seed blocks below are PG-dialect and
# a re-flip must convert them back). Either way the live store is untouched.
ENV_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
case "$ENV_URL" in
  postgresql://*)
    PG_BASE_URL="${ENV_URL%/*}"
    DB="$PG_BASE_URL/rah_isolation"
    q() { psql -X -q -t -A "$DB" -c "$1"; }
    ;;
  *)
    echo "ABORT: this battery currently seeds PG-dialect SQL; point .env at postgresql or convert the seed blocks back (Task 97 note)" >&2
    exit 1
    ;;
esac

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (want '$3' got '$2')"; fi; }

cleanup() {
  pkill -f "next dev -p $PORT" 2>/dev/null || true
  [ -n "${PG_BASE_URL:-}" ] && psql -X "$PG_BASE_URL/postgres" -c "DROP DATABASE IF EXISTS rah_isolation WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== per-user isolation battery =="
export RAH_OPEN_REGISTRATION=1
case "$DB" in file:*) rm -f db/battery-isolation.db db/battery-isolation.db-* ;; esac
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

# --- resolve user ids + seed scoped rows directly (psql; Task 97 PG conversion)
AID=$(q "SELECT id FROM \"User\" WHERE email='iso-a@rah.test'")
BID=$(q "SELECT id FROM \"User\" WHERE email='iso-b@rah.test'")
[ -n "$AID" ] && [ -n "$BID" ] || { echo "ABORT: fixture users missing"; exit 1; }
q "INSERT INTO \"ChatMsg\" (\"userId\", role, content) VALUES ('$AID', 'user', 'A-SECRET-chat')" >/dev/null
q "INSERT INTO \"ChatMsg\" (\"userId\", role, content) VALUES ('$AID', 'coach', '{\"reply\":\"A-SECRET-reply\"}')" >/dev/null
q "INSERT INTO \"ChatMsg\" (\"userId\", role, content) VALUES ('$BID', 'user', 'B-chat')" >/dev/null
PARENT=$(q "INSERT INTO \"WritingSub\" (\"userId\", prompt, text, result, \"parentId\", revision) VALUES ('$AID', 'pA', 'AAA old essay', '{}', NULL, 1) RETURNING id")
CHILD=$(q "INSERT INTO \"WritingSub\" (\"userId\", prompt, text, result, \"parentId\", revision) VALUES ('$AID', 'pA', 'AAA new essay', '{}', $PARENT, 2) RETURNING id")
q "INSERT INTO \"WritingSub\" (\"userId\", prompt, text, result, \"parentId\", revision) VALUES ('$BID', 'pB', 'BBB essay', '{}', NULL, 1)" >/dev/null
q "INSERT INTO \"SpeakSession\" (\"userId\", prompt, transcript, round, result) VALUES ('$AID', 'pA', 'A-SECRET-transcript', 1, '{}')" >/dev/null
q "INSERT INTO \"SpeakSession\" (\"userId\", prompt, transcript, round, result) VALUES ('$BID', 'pB', 'B-transcript', 1, '{}')" >/dev/null
q "INSERT INTO \"ReviewLog\" (\"userId\", \"cardId\", grade, ivl, day, source) VALUES ('$AID', 'cardA', 3, 1, 1, 'review')" >/dev/null
q "INSERT INTO \"ReviewLog\" (\"userId\", \"cardId\", grade, ivl, day, source) VALUES ('$BID', 'cardB', 3, 1, 1, 'review')" >/dev/null
printf '%s\n' "{\"a\": \"$AID\", \"b\": \"$BID\", \"parent\": $PARENT, \"child\": $CHILD}" > /tmp/isolation-ids.json
echo "seeded: a=$AID b=$BID chain_parent=$PARENT"
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

# --- coach-agent ChatMsg stamp (Task 92-bis: the isolation-sweep straggler) ---
# The agent surface wrote ChatMsg with the schema default 'me' while every
# other content write resolved the session user - the split that required
# scripts/merge-legacy-user-rows.py. Pinned here: a coach turn through the
# agent route must stamp user A's id, never the 'me' default.
CA_RES=$(curl -s --max-time 90 -b "$JA" -X POST "$BASE/api/coach-agent" -H 'content-type: application/json' -d '{"message":"isolation stamp probe"}' -o /dev/null -w "%{http_code}")
check "coach-agent responds for A" "$CA_RES" "200"
CA_STAMP=$(ME_ROWS=$(q "SELECT COUNT(*) FROM \"ChatMsg\" WHERE \"userId\"='me' AND content LIKE '%isolation stamp probe%'") ; A_ROWS=$(q "SELECT COUNT(*) FROM \"ChatMsg\" WHERE \"userId\"='$AID' AND role='user' AND content LIKE '%isolation stamp probe%'") ; echo "$A_ROWS/$ME_ROWS")
# role='user' pins the LEARNER's own message row (exactly 1). The coach reply
# row sometimes echoes the probe phrase in its text (model-dependent), so
# counting all roles made this check flaky - the 92-ter doctrine is about the
# stamp (never 'me'), which both counts still pin.
check "coach-agent stamps A's id (a-rows/me-rows)" "$CA_STAMP" "1/0"

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
q "INSERT INTO \"MistakeFamily\" (id, \"userId\", kind, tag, label, count, evidence, \"updatedAt\") VALUES ('$AID:chat:statives', '$AID', 'chat', 'statives', 'Statives A', 3, 'A-SECRET-wrong -> A-RIGHT', now())" >/dev/null
q "INSERT INTO \"MistakeFamily\" (id, \"userId\", kind, tag, label, count, evidence, \"updatedAt\") VALUES ('$BID:chat:statives', '$BID', 'chat', 'statives', 'Statives B', 1, 'B-wrong -> B-right', now())" >/dev/null
A_FAM="$AID:chat:statives"
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
A_STILL=$(q "SELECT COUNT(*) FROM \"MistakeFamily\" WHERE id='$A_FAM'")
check "A's family survived B's attempts"  "$A_STILL" "1"
OK_CORRECT=$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" -X POST "$BASE/api/mistakes" -H 'content-type: application/json' -d "{\"id\":\"$A_FAM\",\"label\":\"Statives A (edited)\"}")
check "A corrects own family = 200"       "$OK_CORRECT" "200"
A_EDITED=$(curl -s -b "$JA" "$BASE/api/mistakes" | python3 scripts/iso-parse.py mistakes_edited)
check "correction sets editedAt provenance" "$A_EDITED" "1"
OK_FORGET=$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" -X DELETE "$BASE/api/mistakes?id=$A_FAM")
check "A forgets own family = 200"        "$OK_FORGET" "200"
TOMB=$(q "SELECT COUNT(*) FROM \"MistakeForgiven\" WHERE id='$A_FAM'")
check "forget leaves a tombstone"         "$TOMB" "1"

# --- scoped delete -----------------------------------------------------------
curl -s -b "$JA" -X DELETE "$BASE/api/chat" > /dev/null
A_LEFT=$(q "SELECT COUNT(*) FROM \"ChatMsg\" WHERE \"userId\"='$AID'")
B_LEFT=$(q "SELECT COUNT(*) FROM \"ChatMsg\" WHERE \"userId\"='$BID'")
check "A's delete removes only A's chats" "$A_LEFT" "0"
check "B's chats survive A's delete"      "$B_LEFT" "1"

# --- state isolation (Task 67): FSRS queue + arcade meta + bands + materials --
# The Task-63/65 sweeps left CardState (the deck queue) + arcade meta global.
# Task 67 keys ALL of them (userId, ...) - this section proves the queue, the
# trophies, the game records, quests, the rival, the measured bands, the
# placement history and the imported materials are per-user now.
q "INSERT INTO \"CardState\" (\"userId\", \"cardId\", s, d, due, state) VALUES ('$AID', 'col002', 3, 5, 1, 'review')" >/dev/null
q "INSERT INTO \"CardState\" (\"userId\", \"cardId\", s, d, due, state) VALUES ('$BID', 'col003', 3, 5, 1, 'review')" >/dev/null
q "INSERT INTO \"Achievement\" (\"userId\", key, at) VALUES ('$AID', 'millennium', now())" >/dev/null
q "INSERT INTO \"GameStat\" (\"userId\", key, best, plays, \"updatedAt\") VALUES ('$AID', 'speed:best', 321, 1, now())" >/dev/null
q "INSERT INTO \"Placement\" (\"userId\", id, answers, phase, level, \"writingLevel\", \"updatedAt\") VALUES ('$AID', 'main', '{}', 'done', 'C1', 'C1', now())" >/dev/null
q "INSERT INTO \"Material\" (id, \"userId\", title, source, text, words, \"createdAt\") VALUES ('m_isoA', '$AID', 'A-SECRET-material', 'test', 'A secret reading passage for isolation testing. A secret reading passage for isolation testing. A secret reading passage for isolation testing. A secret reading passage for isolation testing. ', 24, now())" >/dev/null
q "INSERT INTO \"MaterialCard\" (id, \"materialId\", front, answer, context, note) VALUES ('mat:isoA', 'm_isoA', '___ passage', 'secret', 'A secret reading passage.', 'hint')" >/dev/null
echo "seeded state rows"
A_Q=$(curl -s -b "$JA" "$BASE/api/review/queue" | python3 scripts/iso-parse.py queue_has "col002")
B_Q=$(curl -s -b "$JB" "$BASE/api/review/queue" | python3 scripts/iso-parse.py queue_has "col002")
check "A's queue serves A's card"          "$A_Q" "1"
check "B's queue never serves A's card"    "$B_Q" "0"
curl -s -b "$JA" -X POST "$BASE/api/review/grade" -H 'content-type: application/json' -d '{"cardId":"col001","grade":3,"dir":"cloze"}' > /dev/null
A_SEEN=$(curl -s -b "$JA" "$BASE/api/state" | python3 scripts/iso-parse.py state_seen)
B_SEEN=$(curl -s -b "$JB" "$BASE/api/state" | python3 scripts/iso-parse.py state_seen)
check "A's seen count = own cards (2)"     "$A_SEEN" "2"
check "B's seen count = own cards (1)"     "$B_SEEN" "1"
A_ACH=$(curl -s -b "$JA" "$BASE/api/state" | python3 scripts/iso-parse.py state_unlocked "millennium")
B_ACH=$(curl -s -b "$JB" "$BASE/api/state" | python3 scripts/iso-parse.py state_unlocked "millennium")
check "A has own trophy"                   "$A_ACH" "1"
check "B does NOT have A's trophy"         "$B_ACH" "0"
A_BEST=$(curl -s -b "$JA" "$BASE/api/arcade/speed" | python3 scripts/iso-parse.py speed_best)
B_BEST=$(curl -s -b "$JB" "$BASE/api/arcade/speed" | python3 scripts/iso-parse.py speed_best)
check "A sees own speed record"            "$A_BEST" "321"
check "B does NOT see A's speed record"    "$B_BEST" "0"
# Quests + rival: lazily created per user by /api/state - both users must get
# their OWN rows under the SAME day and the SAME ids (composite PK allows it).
curl -s -b "$JA" "$BASE/api/state" > /dev/null; curl -s -b "$JB" "$BASE/api/state" > /dev/null
QA=$(q "SELECT COUNT(*) FROM \"Quest\" WHERE \"userId\"='$AID'")
QB=$(q "SELECT COUNT(*) FROM \"Quest\" WHERE \"userId\"='$BID'")
check "A has own quest rows (3)"           "$QA" "3"
check "B has own quest rows (3)"           "$QB" "3"
RIVALS=$(q "SELECT COUNT(*) FROM \"Rival\"")
check "rival rows are per-user (2)"        "$RIVALS" "2"
A_PL=$(curl -s -b "$JA" "$BASE/api/placement" | python3 scripts/iso-parse.py placement_level)
B_PL=$(curl -s -b "$JB" "$BASE/api/placement" | python3 scripts/iso-parse.py placement_level)
check "A reads own placement band (C1)"    "$A_PL" "C1"
check "B does NOT read A's placement"      "$B_PL" "?"
MAT_B=$(curl -s -o /dev/null -w '%{http_code}' -b "$JB" "$BASE/api/materials?id=m_isoA")
check "B reading A's material = 404"       "$MAT_B" "404"
MAT_DEL=$(curl -s -o /dev/null -w '%{http_code}' -b "$JB" -X DELETE "$BASE/api/materials?id=m_isoA")
check "B deleting A's material = 404"      "$MAT_DEL" "404"
MAT_A=$(curl -s -b "$JA" "$BASE/api/materials" | python3 scripts/iso-parse.py materials_has "A-SECRET-material")
check "A sees own material in list"        "$MAT_A" "1"

# --- mailer idempotency ledger (P2) ------------------------------------------
curl -s -X POST "$BASE/api/auth/request-code" -H 'content-type: application/json' -d '{"email":"iso-c@rah.test"}' > /dev/null
curl -s -X POST "$BASE/api/auth/request-code" -H 'content-type: application/json' -d '{"email":"iso-c@rah.test"}' > /dev/null
sleep 1
MAIL_ROWS=$(q "SELECT COUNT(*) FROM \"MailLog\" WHERE \"to\"='iso-c@rah.test'")
check "double request-code = ONE ledger row" "$MAIL_ROWS" "1"
echo ""
echo "=== ISOLATION BATTERY: $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ]
