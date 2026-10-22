#!/usr/bin/env python3
"""
Task 75 — P0 privacy-incident completion: DANGLING-COMMIT SWEEP.

Probes the public repo (WasewaseX/rah-web) for pre-scrub commit SHAs (the
REG-2 history rewrite replaced every commit SHA; the OLD shas are recorded in
the roadmap velocity logs). Any sha that still resolves on the GitHub API is
a DANGLING commit that third parties could still fetch by hash -> needs a
GitHub Support cache purge. Also re-verifies: (a) the vault repo is private,
(b) the public tree carries zero learner-data paths.

Read-only: uses the GitHub API with the token embedded in the origin URL.
Never prints the token. Never prints learner content.
"""
import json
import re
import subprocess
import sys
import urllib.request

REPO = "WasewaseX/rah-web"
VAULT = "WasewaseX/vault"

# Pre-scrub SHAs from ROADMAP-STATUS.md velocity log + incident log
# (every commit recorded before the Task-62 filter-repo force-push).
PRE_SCRUB = [
    "4d4f582", "240100a", "0c02959", "0e9100e", "3b2049f", "d1722f7",
    "161d7cb", "f52e593", "cd35f15", "3e49329", "6b9fda4", "5156b4b",
    "9b9c360", "b02be56", "79ac327", "ab9514a",
]

def token():
    url = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True).stdout.strip()
    m = re.search(r"https://[^:]+:([^@]+)@", url)
    return m.group(1) if m else None

def api(path, tok):
    req = urllib.request.Request(f"https://api.github.com{path}")
    if tok:
        req.add_header("Authorization", f"token {tok}")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return -1, str(e)

def main():
    tok = token()
    print("=== DANGLING-COMMIT SWEEP (public repo) ===")
    dangling = []
    for sha in PRE_SCRUB:
        status, _ = api(f"/repos/{REPO}/commits/{sha}", tok)
        state = "DANGLING-RETRIEVABLE" if status == 200 else ("gone" if status in (404, 422) else f"probe-error({status})")
        if status == 200:
            dangling.append(sha)
        print(f"  {sha}: {state}")

    print(f"\n=== RESULT: {len(dangling)} dangling of {len(PRE_SCRUB)} probed ===")
    if dangling:
        print("  ACTION: request a GitHub Support cache purge for these SHAs; until then they are fetchable by hash only (not listed anywhere).")

    # raw blob probe at the worst-case sha: was the leaked snapshot file itself still served?
    print("\n=== RAW SNAPSHOT BLOB PROBE (pre-scrub paths at pre-scrub SHAs) ===")
    for sha in (PRE_SCRUB if dangling else ["9b9c360"]):
        for path in ("db/sync/rah-latest.db", "backups/"):
            status, _ = api(f"/repos/{REPO}/contents/{path}?ref={sha}", tok)
            print(f"  {path} @ {sha}: {'STILL SERVED' if status == 200 else status}")

    # events API: any public push events still carrying pre-scrub SHAs?
    print("\n=== PUBLIC EVENTS API (last page) ===")
    status, ev = api(f"/repos/{REPO}/events?per_page=100", tok)
    if status == 200 and ev:
        shas = set()
        for e in ev:
            if e.get("type") == "PushEvent":
                for c in e.get("payload", {}).get("commits", []):
                    shas.add(c.get("sha", "")[:7])
        old = shas & set(PRE_SCRUB)
        print(f"  {len(ev)} events, {len(shas)} pushed shas, pre-scrub shas present: {sorted(old) if old else 'NONE'}")
    else:
        print(f"  events probe: {status}")

    # vault privacy
    print("\n=== VAULT PRIVACY CHECK ===")
    status, v = api(f"/repos/{VAULT}", tok)
    if status == 200 and v:
        print(f"  {VAULT}: private={v.get('private')} (must be True)")
    else:
        print(f"  {VAULT}: probe {status}")

    # public tree zero-learner-data re-verification
    print("\n=== PUBLIC TREE SWEEP (tracked paths that must not exist) ===")
    bad = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout.splitlines()
    patterns = ("db/sync/", "backups/", "db/battery-isolated", "db/custom.db", ".sqlite", "rah-latest")
    hits = [p for p in bad if any(p.startswith(x) or p.endswith(x) for x in patterns)]
    print("  " + ("ZERO learner-data paths tracked" if not hits else f"LEAK: {hits}"))
    sys.exit(1 if dangling or hits else 0)

main()
