#!/usr/bin/env python3
"""
Task 89-h: the SINGLE-RUN PostgreSQL cutover proof.

The sandbox proof must complete inside ONE process: pgserver's server and any
daemon started by a previous tool call get reaped when that call ends, so the
provision -> schema -> copy -> verify sequence is atomic here. The live SQLite
db is opened READ-ONLY the whole time; PG is a throwaway userspace instance.

Output: per-table count verification + learner checksum. Exit 0 only when
every count matches. This is the evidence the review's P0 #3 needs before
anyone flips the real deployment.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pg_copy_data import TABLES, SERIAL_TABLES, esc  # the exact same stream builder the real cutover uses

ROOT = "/home/z/my-project"
# PG tooling lives OUTSIDE the project tree: Turbopack's dir-asset tracing
# panics on the venv's python3 symlink ("points out of the filesystem root"),
# which broke `next build` when the venv sat under scripts/out (Task 89).
PGDATA = "/home/z/rah-pg/pgdata"
SQLITE = f"{ROOT}/db/custom.db"
SCHEMA_SQL = f"{ROOT}/scripts/out/pg-schema.sql"

os.environ.setdefault("XDG_RUNTIME_DIR", "/tmp/runtime-1001")
import pgserver  # noqa: E402

srv = pgserver.get_server(PGDATA)
sock = srv.get_uri().split("host=")[-1]
psql_bin = (os.path.dirname(pgserver.__file__) + "/pginstall/bin/psql")
if not os.path.exists(psql_bin):
    sys.exit(f"ABORT: bundled psql not found at {psql_bin}")


def psql(sql: str, db: str = "rah", expect_fail: bool = False) -> str:
    env = dict(os.environ, PGHOST=sock, PGUSER="postgres", PGDATABASE=db)
    p = subprocess.run([psql_bin, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-tA"],
                       input=sql, capture_output=True, text=True, env=env)
    if p.returncode != 0 and not expect_fail:
        sys.stderr.write(p.stdout[-2000:] + p.stderr[-2000:])
        sys.exit("ABORT: psql failed")
    return p.stdout


print("== sandbox PG up ==", sock)
# idempotent: each proof starts from a FRESH rah database (a previous failed
# run may have left partial tables; WITH (FORCE) drops stale connections)
psql('DROP DATABASE IF EXISTS "rah" WITH (FORCE);', db="postgres", expect_fail=True)
psql('CREATE DATABASE "rah";', db="postgres", expect_fail=True)

print("== schema apply ==")
psql(open(SCHEMA_SQL).read())

print("== data copy (read-only toward SQLite) ==")
import sqlite3  # noqa: E402
src = sqlite3.connect(f"file:{SQLITE}?mode=ro", uri=True)
stream = ["BEGIN;",
          f'TRUNCATE TABLE {", ".join(chr(34) + t + chr(34) for t in TABLES)} RESTART IDENTITY CASCADE;']
total = 0
for t in TABLES:
    cols = [(r[1], r[2]) for r in src.execute(f"PRAGMA table_info({t})")]  # (name, declared type)
    collist = ", ".join(f'"{c}"' for c, _ in cols)
    rows = src.execute(f'SELECT {collist} FROM "{t}"').fetchall()
    stream.append(f'COPY "{t}" ({collist}) FROM STDIN;')
    for row in rows:
        stream.append("\t".join(esc(v, kind) for v, (_, kind) in zip(row, cols)))
    stream.append("\\.")
    total += len(rows)
for t in SERIAL_TABLES:
    stream.append(f"SELECT setval(pg_get_serial_sequence('\"{t}\"', 'id'), COALESCE((SELECT MAX(id) FROM \"{t}\"), 1), true);")
stream.append("COMMIT;")
psql("\n".join(stream) + "\n")
print(f"copy done: {total} rows across {len(TABLES)} tables")

print("== verification ==")
bad = 0
for t in TABLES:
    n_sql = src.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    n_pg = int(psql(f'SELECT COUNT(*) FROM "{t}";').strip() or "-1")
    if n_sql != n_pg:
        bad += 1
        print(f"  MISMATCH {t}: sqlite={n_sql} pg={n_pg}")
if bad == 0:
    print(f"  all {len(TABLES)} table counts MATCH")
l = src.execute("SELECT xp, streak FROM Learner WHERE id='me'").fetchone()
lp = psql('SELECT xp, streak FROM "Learner" WHERE id=\'me\';')
print(f"  learner checksum sqlite: xp={l[0]} streak={l[1]} | pg: {lp.strip()}")
bad += 0 if (lp and str(l[0]) in lp and str(l[1]) in lp) else 1
src.close()
print("== PG CUTOVER PROOF: PASS ==" if bad == 0 else "== PG CUTOVER PROOF: FAIL ==")
sys.exit(1 if bad else 0)
