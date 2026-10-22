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
else:
    print("PARSE_ERR")
