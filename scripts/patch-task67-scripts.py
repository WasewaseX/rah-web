#!/usr/bin/env python3
"""Task 67 companion: sweep the test scripts onto the (userId, ...) composite keys.

The scripts run against the throwaway battery DB as the singleton user "me",
so every unique-where on the newly isolated tables becomes the composite form
with userId "me". Regexes are anchored on `db.<table>.<op>(` so other tables'
where-clauses are never touched. tsc is the verifier after this runs.
"""
import re
import pathlib

ROOT = pathlib.Path("/home/z/my-project")
FILES = [
    "scripts/test-arcade-live.ts",
    "scripts/test-arcade2.ts",
    "scripts/test-arena-live.ts",
    "scripts/test-bank.ts",
    "scripts/test-dictation.ts",
    "scripts/test-engine-smoke.ts",
    "scripts/test-exam-fsrs.ts",
    "scripts/test-mastery.ts",
    "scripts/test-placement-live.ts",
    "scripts/test-api-battery.ts",
]

STR = r'"[^"]*"'
TPL = r'`[^`]*`'
IDENT = r'[A-Za-z_$][\w$.]*'
EXPR = rf'(?:{STR}|{TPL}|{IDENT})'

TABLES = r'(?:cardState|achievement|gameStat|quest|rival|league|runState|skillLevel|placement)'
CLIENT = r'(?:db|prisma|prS)'

# db.<table>.<op>({ ... where: { <field>: <expr> } ...  ->  composite where
COMPOSITE = re.compile(
    rf'({CLIENT}\.{TABLES}\.\w+\(\{{\s*)where: \{{ (key|id|cardId|skill): ({EXPR}) \}}',
    re.DOTALL,
)

# Shorthand: where: { cardId } / { key } / { id } (no colon) -> composite.
SHORTHAND = re.compile(
    rf'({CLIENT}\.{TABLES}\.\w+\(\{{\s*)where: \{{ (key|id|cardId|skill) \}}',
    re.DOTALL,
)

# The first pass wrapped filter (deleteMany/findMany) wheres in a UNIQUE
# composite - filters need the plain WhereInput shape. Convert those back.
FILTER_UNIQUE = re.compile(
    rf'({CLIENT}\.{TABLES}\.(?:deleteMany|findMany|count|aggregate|groupBy)\(\{{\s*)where: \{{ userId_(?:key|id|cardId|skill): \{{ userId: "me", (key|id|cardId|skill): ({EXPR}) \}} \}}',
    re.DOTALL,
)

# deleteMany filter forms: add userId to the where-filters so cleanup never
# touches other users' rows in the shared throwaway DB.
FILTER_RULES = [
    (re.compile(rf'({CLIENT}\.gameStat\.deleteMany\(\{{ where: \{{) (key: \{{ in:)'),
     r'\1 userId: "me", \2'),
    (re.compile(rf'({CLIENT}\.gameStat\.deleteMany\(\{{ where: \{{) (key: \{{ startsWith: "shield:")'),
     r'\1 userId: "me", \2'),
    (re.compile(rf'({CLIENT}\.runState\.deleteMany\(\{{ where: \{{) (id: \{{ in:)'),
     r'\1 userId: "me", \2'),
]


def composite_repl(m: re.Match) -> str:
    head, field, expr = m.group(1), m.group(2), m.group(3)
    return f'{head}where: {{ userId_{field}: {{ userId: "me", {field}: {expr} }} }}'


def shorthand_repl(m: re.Match) -> str:
    head, field = m.group(1), m.group(2)
    return f'{head}where: {{ userId_{field}: {{ userId: "me", {field} }} }}'


def filter_unique_repl(m: re.Match) -> str:
    head, field, expr = m.group(1), m.group(2), m.group(3)
    return f'{head}where: {{ userId: "me", {field}: {expr} }}'


for rel in FILES:
    p = ROOT / rel
    src = p.read_text()
    orig = src
    src, n1 = COMPOSITE.subn(composite_repl, src)
    src, n3 = SHORTHAND.subn(shorthand_repl, src)
    src, n4 = FILTER_UNIQUE.subn(filter_unique_repl, src)
    n2 = 0
    for pat, rep in FILTER_RULES:
        src, k = pat.subn(rep, src)
        n2 += k
    if src != orig:
        p.write_text(src)
    print(f"{rel}: composite={n1} shorthand={n3} filterfix={n4} filter={n2}")
