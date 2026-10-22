#!/usr/bin/env python3
"""Task-72 companion: patch direct-db test scripts onto the composite PKs.

The lost wave gave CardState/GameStat/Quest/Rival/League/Achievement/RunState/
Placement/SkillLevel a (userId, ...) primary key. The src/ tree was re-threaded
by hand; the bun test scripts hit the same models directly with the OLD
where-shape. This patcher rewrites only those models' where/create clauses,
stamping the singleton key 'me' (the battery dbs are single-user by design).

Brace-balanced by construction: the where-pattern consumes the where-clause's
single closing brace and re-emits composite + where closes, so statements that
continue (", data: ...") or end (" })" ) both stay balanced.

Runs idempotently: already-patched shapes do not match again.
"""
import re
import pathlib

MODELS = "cardState|gameStat|quest|rival|league|achievement|runState|placement|skillLevel"
SCRIPTS = [
    "scripts/test-api-battery.ts",
    "scripts/test-arcade-live.ts",
    "scripts/test-arcade2.ts",
    "scripts/test-arena-live.ts",
    "scripts/test-bank.ts",
    "scripts/test-dictation.ts",
    "scripts/test-engine-smoke.ts",
    "scripts/test-exam-fsrs.ts",
    "scripts/test-mastery.ts",
]

# where-clause rewrites for the composite-PK models - ONLY for the methods
# that take a WhereUniqueInput (findUnique/update/upsert/delete). Filter-input
# methods (findMany/findFirst/count/deleteMany/updateMany) keep plain wheres.
UNIQ_METHODS = r"(?:findUnique|update|upsert|delete)"
CALL = r"(?:db|prisma|prS)\.(?:%s)\.%s\(\s*\{\s*where:\s*\{\s*" % (MODELS, UNIQ_METHODS)
WHERE_PATTERNS = [
    (re.compile(r"(" + CALL + r")cardId:([^{}]*?)\}"),
     r'\g<1>userId_cardId: { userId: "me", cardId:\2} }'),
    (re.compile(r"(" + CALL + r")key:([^{}]*?)\}"),
     r'\g<1>userId_key: { userId: "me", key:\2} }'),
    (re.compile(r"(" + CALL + r")id:([^{}]*?)\}"),
     r'\g<1>userId_id: { userId: "me", id:\2} }'),
]
# create-data stamps (brace-neutral insertions)
CREATE_CALL = r"(?:db|prisma|prS)\.(?:%s)\.create\(\s*\{\s*data:\s*\{\s*" % MODELS
CREATE_PATTERNS = [
    (re.compile(r"(" + CREATE_CALL + r")(cardId:|key:|id:|skill:)"),
     r'\g<1>userId: "me", \2'),
]
UPSERT_CREATE = [
    (re.compile(r"((?:db|prisma|prS)\.(?:%s)\.upsert\(\s*\{\s*where:[^,]+?,\s*create:\s*\{\s*)(cardId:|key:|id:|skill:)" % MODELS),
     r'\g<1>userId: "me", \2'),
]

def patch_file(p: pathlib.Path) -> int:
    s = p.read_text()
    n = 0
    for pat, rep in WHERE_PATTERNS + CREATE_PATTERNS + UPSERT_CREATE:
        s, k = pat.subn(rep, s)
        n += k
    p.write_text(s)
    return n

def main() -> None:
    total = 0
    for f in SCRIPTS:
        p = pathlib.Path(f)
        if not p.exists():
            print(f"skip (missing): {f}")
            continue
        k = patch_file(p)
        total += k
        print(f"{f}: {k} rewrite(s)")
    print(f"TOTAL: {total}")

if __name__ == "__main__":
    main()
