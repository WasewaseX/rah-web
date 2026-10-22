#!/usr/bin/env python3
"""Task 75: write REG-2 addendum 3 (dangling-commit sweep findings) into ROADMAP-AUDIT.md."""
s = open('/home/z/my-project/ROADMAP-AUDIT.md').read()

addendum = """**ADDENDUM 3 (Task 75, 2026-10-22) — the dangling-commit sweep: the scrub is complete on the history, but GitHub still serves the past by hash.** The auditor's warning ("third-party caches of earlier commits may survive") was probed with evidence, not assumed:

- **15 of 16 pre-scrub SHAs are STILL RETRIEVABLE** via `GET /repos/WasewaseX/rah-web/commits/<sha>` (dangling objects on GitHub's side): 4d4f582, 240100a, 0c02959, 0e9100e, 3b2049f, d1722f7, 161d7cb, f52e593, cd35f15, 3e49329, 6b9fda4, 5156b4b, b02be56, 79ac327, ab9514a. Only 9b9c360 is gone.
- **WORST FINDING: the leaked snapshot itself is anonymously fetchable at 5156b4b** (the Task-60 era commit that carried `db/sync/rah-latest.db`): `raw.githubusercontent.com/WasewaseX/rah-web/5156b4b/db/sync/rah-latest.db` returns **HTTP 200, 217,088 bytes, NO authentication**, and the whole pre-scrub tree downloads via `codeload.github.com/.../tar.gz/5156b4b`. At every OTHER dangling SHA the snapshot paths 404 (the leak window was Oct-20 18:57 through Task 60's commit range; the audit's 14-row sizing applies to this blob).
- Clean re-verifications: public events API carries zero pre-scrub SHAs; the public tree carries ZERO learner-data paths; the vault repo is `private=true`; nothing is LISTED anywhere — every exposure requires knowing a hash.

**What this means (honest):** the history rewrite did its job for anyone browsing or pulling the repo; it CANNOT expunge GitHub's object CDN. The email + first-session progress must be treated as EXPOSED (standing doctrine since REG-2). The one remaining human action is the account holder filing GitHub Support's "remove sensitive data" (trailing/cached views) request — it cannot be filed from inside the sandbox. Template (ready to paste):

> Subject: Purge dangling commits and cached views after a force-push (sensitive data removal)
>
> Repo: WasewaseX/rah-web (public). We rewrote history via git filter-repo and force-pushed (old tip 9b9c360). The following PRE-REWRITE commits are still retrievable by hash via the contents API, raw.githubusercontent.com and codeload tarballs, and one still serves a sensitive SQLite file (db/sync/rah-latest.db containing a user email address):
>
> [paste the 15 SHAs above, one per line]
>
> Please run a GC / purge these unreachable objects and cached views from all endpoints (API, raw CDN, codeload, web UI). We understand the objects are not linked from any branch or tag.

Re-run the sweep any time: `python3 scripts/privacy-sweep.py` (exit 1 = human action still pending). This addendum closes the SWEEP half of incident-response item #2; the purge-request half stays open until the learner files it and the sweep returns clean.

---

"""

marker = "### REG-3 (2026-10-22 06:51 UTC, 4th wipe, CONTAINED-BY-DESIGN)"
assert marker in s, "REG-3 marker not found"
s = s.replace(marker, addendum + marker, 1)

old2 = "2. **P0 — Finish the privacy incident response.** Third-party caches of pre-scrub commits may survive the force-push. The published email is treated as EXPOSED (re-registration with it works, or claim a fresh address); remaining cached history should be checked and purged where possible; all future backups stay private (vault-only doctrine, opt-in encryption shipped in Task 63)."
new2 = "2. **P0 — Finish the privacy incident response.** **SWEEP DONE (Task 75, evidence in REG-2 addendum 3):** 15/16 pre-scrub SHAs confirmed dangling-retrievable, and the leaked snapshot blob is anonymously fetchable by hash at 5156b4b (raw CDN + codeload, 217 KB) — the auditor's cache warning is now EVIDENCE, not assumption. The published email stays treated as EXPOSED. **Remaining: one human action — the account holder files GitHub Support's sensitive-data removal with the ready-made template (incident log); `scripts/privacy-sweep.py` re-runs until it exits 0.** All future backups stay private (vault-only doctrine, opt-in encryption shipped in Task 63)."
assert old2 in s, "open-critical item 2 not found"
s = s.replace(old2, new2, 1)

open('/home/z/my-project/ROADMAP-AUDIT.md', 'w').write(s)
print("AUDIT updated: addendum 3 + open-critical #2")
