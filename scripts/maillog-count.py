#!/usr/bin/env python3
"""MailLog probe for the isolation battery.
Usage: maillog-count.py <db-path> <email> [mode]
mode: count (default) | status
"""
import sqlite3, sys

db, email = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else "count"
c = sqlite3.connect(db)
col = '"to"'
if mode == "count":
    print(c.execute(f"SELECT COUNT(*) FROM MailLog WHERE {col}=?", (email,)).fetchone()[0])
else:
    row = c.execute(f"SELECT status FROM MailLog WHERE {col}=?", (email,)).fetchone()
    print(row[0] if row else "none")
c.close()
