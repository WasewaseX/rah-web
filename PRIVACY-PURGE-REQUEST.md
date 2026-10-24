# GitHub Support — sensitive-data purge request (READY TO FILE)

> Status: PREPARED, awaiting the one action only the account holder can take
> (filing it). Every dangling object below was re-verified anonymously on
> 2026-10-24 (Task 95): the raw CDN still serves the leaked database snapshot
> with HTTP 200, and the five commit SHAs that are not resolvable from the
> local rewritten clone were confirmed retrievable via the public commits
> atom feed. When this request is filed, record the ticket number in
> `worklog.md` and let the daily sweep confirm closure.

---

## Step 1 — where to file

Open https://support.github.com/request , sign in as the account holder
(**WasewaseX**), choose the category **"Removing data from GitHub"**
(sensitive-data removal / GitHub Privacy Office). Paste the subject and body
below verbatim.

## Step 2 — verbatim subject

```
Sensitive data removal request — dangling pre-rewrite commits + cached SQLite blob in WasewaseX/rah-web (history already rewritten; purge unreachable objects)
```

## Step 3 — verbatim body

```
Hello GitHub Privacy / Support team,

I am the account holder of WasewaseX. My repository WasewaseX/rah-web
contained an accidentally committed local SQLite database
(db/sync/rah-latest.db). I rewrote the repository's history with git
filter-repo and force-pushed, so the file no longer exists on any reachable
ref. However, the pre-rewrite objects are still anonymously retrievable by
hash: the raw CDN serves the cached blob, and the old commit objects remain
fetchable.

Request: please run garbage collection / evict the cached views for the
objects listed below so they stop being served by hash.

One blob is confirmed live right now (HTTP 200 on the raw CDN):

- db/sync/rah-latest.db at commit 5156b4b0e9cb07782bbce95e1f982affe8d73a8f
  evidence URLs:
  https://raw.githubusercontent.com/WasewaseX/rah-web/5156b4b0e9cb07782bbce95e1f982affe8d73a8f/db/sync/rah-latest.db
  https://api.github.com/repos/WasewaseX/rah-web/contents/db/sync/rah-latest.db?ref=5156b4b0e9cb07782bbce95e1f982affe8d73a8f
  https://codeload.github.com/WasewaseX/rah-web/tar.gz/5156b4b0e9cb07782bbce95e1f982affe8d73a8f

The following 15 pre-rewrite commit objects (all reachable by hash from the
same repository) should be made unreachable as well:

4d4f582c31a37cc0c5a0d9f6fc13b18e0c3faf73
240100a460abf097a524dac34be36034a4faacbf
0c029591722da541c0c25faa41cfcf6f800f0c68
0e9100ebd6bcb68395409f80d355b451a913f2cb
3b2049f2708bec2dffee692dd5628c3b0b9b4785
d1722f7a664242747fdb81712dc450e0f0b8db10
161d7cbd1df0d2401d7aa15f47e7aabff03f744c
f52e593511ee1522f712447c23c8aa9320657218
cd35f157f8209dd76f164bcafa3c46e6dbcf50c6
3e49329f128ac2d980e390669d08bac340f44ffa
6b9fda438c5207641407d369cab738117a71e852
5156b4b0e9cb07782bbce95e1f982affe8d73a8f
b02be56c5f3407562e7a69a64cc6e98ecbb3b8a0
79ac327182566b7d08a6980592d3d6561ee9402d
ab9514a4d164a2f6c960267ca833f1ec557a2c6a

(16 objects were probed originally; one, 9b9c360, is already gone — evidence
that the purge process works and this is the remaining tail.)

The history rewrite is already complete on our side: the current default
branch contains no database files, the working tree has been scanned for
learner data paths (zero), and a private offsite vault now holds the only
copies. We are requesting cleanup of the unreachable historical objects
only.

Thank you.
```

## Step 4 — closure criteria (how we will know it worked)

1. `scripts/privacy-sweep.py` exits 0 (0 dangling of 16 probed, blob no
   longer served). The sweep runs daily from the watchdog and appends to
   `db/privacy-sweep.log`; two consecutive CLEAN days = closed.
2. The raw CDN URL for the blob returns 404.
3. The atom feed for each old SHA stops resolving.

## Step 5 — standing hygiene (unchanged doctrine)

- The published email address must continue to be treated as EXPOSED
  regardless of purge outcome (cached downstream copies cannot be recalled).
- Backups stay in the private vault (`WasewaseX/vault`, folder `rah-web/`).
  The public repo carries zero learner data paths — enforced by the REG-2
  pre-push scan.
- No live learner data ever enters public Git history again.

## Fresh evidence log (this file's verification runs)

| Date (UTC) | Check | Result |
|---|---|---|
| 2026-10-24 15:01 | daily sweep | 15/16 dangling, blob-still-served=1, vault private=True |
| 2026-10-24 15:06 | raw CDN blob | HTTP 200 (still served) |
| 2026-10-24 15:06 | atom feed, 5 SHAs | all 5 resolve anonymously (cd35f15, 3e49329, 6b9fda4, 5156b4b, b02be56) |
