#!/usr/bin/env python3
"""
Task 89-h: SQLite -> PostgreSQL data copier for the physical cutover.

Reads the live SQLite db (read-only) and streams every learner table into the
target PostgreSQL through psql's COPY FROM STDIN (the fast, escaping-correct
path). Preserves explicit ids (Prisma SERIALs accept them), then resets each
serial sequence. Verification (per-table counts + learner checksum) is a
separate mode so the copy and the proof can be run independently.

Modes:
  copy   <sqlite-path> <psql-args...>   stream data (TRUNCATE + COPY + setval)
  verify <sqlite-path> <psql-args...>   per-table counts + learner checksum

psql-args: everything after the db path is passed to psql verbatim, e.g.
  -h 127.0.0.1 -p 5439 -U postgres -d rah
or (unix socket): -d /path/to/socketdir  (psql treats a -d path with a leading
slash as the socket directory when host looks like a dir).

Never writes to SQLite. Fails loudly (exit 1) on any COPY error via ON_ERROR_STOP.
"""
import sqlite3
import subprocess
import sys

# Insert order: FK parents before children. WritingSub.parentId has no FK
# relation in the Prisma schema (plain Int?), so its self-reference is fine.
TABLES = [
    "User", "Learner", "Session", "LoginCode", "MailLog", "GradeAck",
    "Placement", "ChatMsg", "WritingSub", "SpeakSession", "DailyStat",
    "QuizItem", "Exam", "SkillLevel", "Achievement", "GameStat", "Quest",
    "Rival", "League", "RunState", "Briefing", "MistakeFamily",
    "TagMastery", "MistakeForgiven", "Goal", "ContentFlag", "Material",
    "MaterialCard", "ReviewLog", "CardState",
]
SERIAL_TABLES = ["LoginCode", "MailLog", "ChatMsg", "WritingSub",
                 "SpeakSession", "QuizItem", "ContentFlag", "ReviewLog"]


def esc(v, kind: str = "") -> str:
    """PostgreSQL COPY TEXT escaping. Prisma-SQLite stores DateTime as INTEGER
    epoch millis - converted to ISO 8601 here (the declared DATETIME column
    type is how we detect it). NULL -> \\N."""
    if v is None:
        return "\\N"
    if isinstance(v, int) and ("DATETIME" in kind.upper() or "TIMESTAMP" in kind.upper()):
        import datetime as _dt
        ms = v if v > 10**11 else v * 1000  # seconds-precision fallback
        dt = _dt.datetime.fromtimestamp(ms / 1000.0, _dt.timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + "+00"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return repr(v)
    s = str(v)
    return (s.replace("\\", "\\\\").replace("\t", "\\t")
             .replace("\n", "\\n").replace("\r", "\\r"))


def run_psql(psql_args, sql_input: str) -> str:
    # -t -A (tuples-only, unaligned): count probes must return JUST the number.
    # Without them psql appends a "(N rows)" footer and the parser reads that
    # as the count (Task 92: found by the full external rehearsal - the Task-89
    # sandbox proof used pg-sandbox-proof.py's own verify, so this exact path
    # was never exercised until now).
    p = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", *psql_args],
        input=sql_input, capture_output=True, text=True,
    )
    if p.returncode != 0:
        sys.stderr.write(p.stdout[-3000:] + "\n" + p.stderr[-3000:] + "\n")
        raise SystemExit(f"psql failed (exit {p.returncode})")
    return p.stdout


def main():
    if len(sys.argv) < 4 or sys.argv[1] not in ("copy", "verify"):
        print(__doc__)
        raise SystemExit(2)
    mode, sqlite_path, psql_args = sys.argv[1], sys.argv[2], sys.argv[3:]
    src = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)

    if mode == "verify":
        bad = 0
        for t in TABLES:
            try:
                cols = [r[1] for r in src.execute(f"PRAGMA table_info({t})")]
                n_sql = src.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            except Exception as e:
                print(f"  {t}: SQLITE READ FAIL {e}")
                bad += 1
                continue
            out = run_psql(psql_args, f"SELECT COUNT(*) FROM \"{t}\";").strip()
            try:
                n_pg = int(out.splitlines()[-1])
            except Exception:
                n_pg = -1
            mark = "OK " if n_sql == n_pg else "MISMATCH"
            if n_sql != n_pg:
                bad += 1
            print(f"  {mark} {t}: sqlite={n_sql} pg={n_pg}")
        l = src.execute("SELECT xp, streak FROM Learner WHERE id='me'").fetchone()
        print(f"  learner checksum (sqlite): xp={l[0]} streak={l[1]}" if l else "  learner row MISSING in sqlite")
        src.close()
        raise SystemExit(1 if bad else 0)

    # ---- copy mode ----
    stream = ["BEGIN;"]
    stream.append(f'TRUNCATE TABLE {", ".join(chr(34) + t + chr(34) for t in TABLES)} RESTART IDENTITY CASCADE;')
    total = 0
    for t in TABLES:
        cols = [(r[1], r[2]) for r in src.execute(f"PRAGMA table_info({t})")]  # (name, declared type)
        collist = ", ".join(f'"{c}"' for c, _ in cols)
        rows = src.execute(f'SELECT {collist} FROM "{t}"').fetchall()
        stream.append(f'COPY "{t}" ({collist}) FROM STDIN;')
        for row in rows:
            stream.append("\t".join(esc(v, kind) for v, (_, kind) in zip(row, cols)))
        stream.append("\\.")
        stream.append(f"-- {t}: {len(rows)} rows")
        total += len(rows)
    for t in SERIAL_TABLES:
        stream.append(
            f"SELECT setval(pg_get_serial_sequence('\"{t}\"', 'id'), COALESCE((SELECT MAX(id) FROM \"{t}\"), 1), true);"
        )
    stream.append("COMMIT;")
    src.close()
    run_psql(psql_args, "\n".join(stream) + "\n")
    print(f"copy done: {total} rows across {len(TABLES)} tables")


if __name__ == "__main__":
    main()
