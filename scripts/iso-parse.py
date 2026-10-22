#!/usr/bin/env python3
"""Parse helper for the isolation battery (scripts/test-isolation.sh).

The battery shell cannot safely carry inline python list comprehensions
(the tool layer strips bracketed spans), so all JSON extraction lives here.
Usage: iso-parse.py <mode> [arg]
Reads the API JSON on stdin, prints a scalar result.
"""
import json, sys

mode = sys.argv[1]
d = json.load(sys.stdin)

def secret_count(messages, needle):
    n = 0
    for m in messages:
        if needle in str(m):
            n += 1
    return n

if mode == "chat_secret":
    print(secret_count(d.get("messages", []), sys.argv[2]))
elif mode == "chat_len":
    print(len(d.get("messages", [])))
elif mode == "writing_recent":
    print(len(d.get("recent", [])))
elif mode == "writing_recent_foreign":
    print(len([r for r in d.get("recent", []) if r.get("prompt") == sys.argv[2]]))
elif mode == "chain_len":
    print(len(d.get("chain", [])))
elif mode == "chain_revs":
    print(json.dumps([r.get("revision") for r in d.get("chain", [])]))
elif mode == "chain_texts":
    print(json.dumps([r.get("text") for r in d.get("chain", [])]))
elif mode == "speak_secret":
    n = 0
    for r in d.get("recent", []):
        blob = r.get("prompt", "") + json.dumps(r.get("result", {}))
        if sys.argv[2] in blob:
            n += 1
    print(n)
elif mode == "mistakes_len":
    print(len(d.get("families", [])) + len(d.get("healed", [])))
elif mode == "mistakes_secret":
    n = 0
    for f in d.get("families", []) + d.get("healed", []):
        if sys.argv[2] in str(f.get("evidence", "")) + str(f.get("label", "")):
            n += 1
    print(n)
elif mode == "mistakes_labels":
    print(json.dumps([f.get("label") for f in d.get("families", [])]))
elif mode == "mistakes_edited":
    print(1 if any(f.get("editedAt") for f in d.get("families", []) + d.get("healed", [])) else 0)
elif mode == "queue_has":
    print(len([x for x in d.get("batch", []) if x.get("card", {}).get("id") == sys.argv[2]]))
elif mode == "state_seen":
    print(int(d.get("seen", 0)))
elif mode == "state_unlocked":
    print(1 if sys.argv[2] in (d.get("game", {}).get("unlocked", []) or []) else 0)
elif mode == "speed_best":
    print(int(d.get("best", 0)))
elif mode == "placement_level":
    print(str(d.get("level", "?")))
elif mode == "materials_has":
    print(len([m for m in d.get("materials", []) if m.get("title") == sys.argv[2]]))
else:
    print("PARSE_ERR")
