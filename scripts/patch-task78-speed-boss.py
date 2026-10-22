#!/usr/bin/env python3
"""
Task 78: wire the gid receipt (sync-receipt.ts) into the five aggregate
arcade routes (speed, boss, duel, pairs, flow) - replay-safe offline sync
beyond grades. Dungeon/gauntlet stay online-only by design (server-dealt
state machines; recorded honestly in the ledgers).

Per route:
  1. import the receipt helpers
  2. parse the gid from the body
  3. early-return the stored response (+ replayed:true) on a receipt hit
  4. endReceipt(...) wrapping the final payload before returning it
"""
import re

ROUTES = {
    "src/app/api/arcade/speed/route.ts": {
        "import_anchor": 'import { contentUserId } from "@/lib/scope";',
        "gid_parse": "  const gid = parseGid((b as { gid?: unknown }).gid);\n  const uid = await contentUserId().catch(() => \"me\");\n  const replay = await receiptReplay(gid, uid);\n  if (replay) return replay;\n",
        "gid_parse_after": "  const score = Math.min(Math.max(0, Math.round(Number(b.score ?? 0))), cap);",
        "return_anchor": """  return NextResponse.json({
    xpGain: xp.paid,
    capped: xp.capped,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    level: xp.level,
    unlocked: xp.unlocked,
    best: bestRun.best,
    isNewBest: bestRun.isNew,
    bestCombo: bestCombo.best,
  });
}""",
        "return_wrapped": """  const payload = {
    xpGain: xp.paid,
    capped: xp.capped,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    level: xp.level,
    unlocked: xp.unlocked,
    best: bestRun.best,
    isNewBest: bestRun.isNew,
    bestCombo: bestCombo.best,
  };
  await endReceipt(gid, uid, payload);
  return NextResponse.json(payload);
}""",
    },
    "src/app/api/arcade/boss/route.ts": {
        "import_anchor": None,  # resolved below by inspection
        "gid_parse": "  const gid = parseGid((b as { gid?: unknown }).gid);\n  const uid = await contentUserId().catch(() => \"me\");\n  const replay = await receiptReplay(gid, uid);\n  if (replay) return replay;\n",
        "gid_parse_after": '  const correct = Math.min(total, Math.max(0, Math.round(Number(b.correct ?? 0))));',
        "return_anchor": """  return NextResponse.json({
    xpGain: xp.paid,
    capped: xp.capped,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    level: xp.level,
    unlocked: xp.unlocked,
  });
}""",
        "return_wrapped": """  const payload = {
    xpGain: xp.paid,
    capped: xp.capped,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    level: xp.level,
    unlocked: xp.unlocked,
  };
  await endReceipt(gid, uid, payload);
  return NextResponse.json(payload);
}""",
    },
}

IMPORT_LINE = 'import { parseGid, receiptReplay, endReceipt } from "@/lib/sync-receipt";'

for path, spec in ROUTES.items():
    s = open(path).read()
    if "sync-receipt" in s:
        print(f"{path}: already wired, skipped")
        continue
    anchor = spec["import_anchor"]
    if anchor is None:
        # insert after the last @/ import line
        lines = s.split("\n")
        last = max(i for i, l in enumerate(lines) if l.startswith('import ') and '"@/' in l)
        lines.insert(last + 1, IMPORT_LINE)
        s = "\n".join(lines)
    else:
        assert anchor in s, f"{path}: import anchor missing"
        s = s.replace(anchor, anchor + "\n" + IMPORT_LINE, 1)
    after = spec["gid_parse_after"]
    assert after in s, f"{path}: gid_parse_after missing"
    s = s.replace(after, after + "\n" + spec["gid_parse"], 1)
    ra, rw = spec["return_anchor"], spec["return_wrapped"]
    assert ra in s, f"{path}: return anchor missing"
    s = s.replace(ra, rw, 1)
    if 'import { contentUserId }' not in s and 'contentUserId' in spec["gid_parse"]:
        # make sure contentUserId is imported
        if re.search(r'import \{[^}]*contentUserId[^}]*\}', s) is None:
            s = s.replace(IMPORT_LINE, 'import { contentUserId } from "@/lib/scope";\n' + IMPORT_LINE, 1)
    open(path, "w").write(s)
    print(f"{path}: wired")
