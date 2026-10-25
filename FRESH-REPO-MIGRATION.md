# FRESH-REPO-MIGRATION — the account holder's chosen privacy closure

Written 2026-10-25 (Task 97). Decision recorded verbatim from the account
holder: the GitHub Support purge request is superseded — **"its okay we
will just make a fresh repo but later."** This document makes "later" a
checklist, not a research project, and defines what dies with the old repo.

## 1. Why this closes the privacy exposure (and what it does NOT close)

The exposure is: ~15 dangling-but-anonymously-retrievable pre-scrub commit
objects and one cached db blob in the PUBLIC repo `WasewaseX/rah-web`
(monitored daily by `scripts/privacy-sweep.py`; 15/16 dangling + blob
served as of 2026-10-25). Deleting/recreating the repository removes ALL
objects, refs, caches, and API reachability for that repo at once — the
dangling objects die with the repo. **It does not close**: third-party
caches/aggregators that may have already scraped the content (unverifiable
by anyone, including GitHub Support — the same residual risk the purge
request's fine print carried), and it does not affect the PRIVATE vault
repo (which holds only scrubbed snapshots by construction).

Until the migration happens: the daily sweep + alert layer keeps monitoring
(the standing gate), and `PRIVACY-PURGE-REQUEST.md` stays in the tree as
the fallback if the account holder ever prefers the Support route instead.

## 2. What moves to the fresh repo

- The full current git history FROM the flip commit forward is optional —
  the cleanest choice is a **fresh orphan history** (single initial commit
  = current tree state), which also guarantees no pre-scrub object ever
  re-ships via a push. Keep the old repo archived (read-only) for
  reference if desired.
- Everything in the tree EXCEPT: `PRIVACY-PURGE-REQUEST.md` +
  `download/GITHUB-SUPPORT-PURGE-REQUEST.md` (obsolete after migration),
  and anything else the sweep flags.
- GitHub settings to re-create: branch protection on main, Actions enabled
  (the ci.yml PG-service workflow ships in the tree), repo description.
- The vault repo is UNTOUCHED (private; separate lifecycle).

## 3. Migration checklist (execute in order, ~20 minutes)

1. Pick the moment right after a boot-guard + vault push (so db/backups +
   upload/rah-backups + vault are all fresh).
2. `git clone --no-hardlinks` the current repo to a scratch dir; run the
   privacy sweep one last time against the OLD repo and record the result
   (the before/after evidence pair).
3. Create the new GitHub repo (empty, private-or-public per the account
   holder's choice — the app repo was public by design; a fresh repo
   starts with ZERO dangling objects either way).
4. Orphan-start: `git checkout --orphan fresh && git add -A && git commit`
   (single initial commit), remove the two purge-request files first.
5. Push to the new repo; update any remotes/links that referenced the old
   URL; re-enable Actions (first run proves the PG-service CI).
6. Update this file + ROADMAP-STATUS with the new remote (SHA of the
   initial commit) and flip `scripts/privacy-sweep.py`'s repo target.
7. Archive (do not delete) the old repo for 30 days as evidence, then
   delete it — deletion is the step that actually kills the dangling
   objects; archiving first preserves the before/after audit trail.
8. Closure criteria (same shape as the purge request's): the raw blob URL
   404s; the old repo's API returns 404; TWO consecutive daily sweeps
   against the OLD repo return unreachable/CLEAN; the alert layer fires
   the CLEAN-day INFO.

## 4. Who does what

- Steps 3–5 need the account holder's GitHub session (repo creation +
  push rights) — the agent can prepare everything else (orphan branch,
  file removals, sweep retarget) as a ready-to-run script when "later"
  arrives.
- The daily sweep monitoring continues until step 8 completes.
