#!/usr/bin/env python3
"""One-shot migration companion: rewrite bare DailyStat unique-key usages in
test scripts to the composite (userId, day) key introduced in Task 65.
Idempotent: already-patched lines are left untouched."""
import re
import glob

# dailyStat.findUnique({ where: { day } })          (shorthand)
# dailyStat.findUnique({ where: { day: today } })   (explicit)
# dailyStat.update({ where: { day: today }, data: ...
PAT = re.compile(
    r"(dailyStat\.(?:findUnique|update|upsert)\(\{ where: \{ )(day[^{}]*?)\s*\}",
)
PAT_DATA = re.compile(
    r"(dailyStat\.update\(\{ where: \{ )(day[^{}]*?)\s*\}(\s*, data:)",
)
DEL = re.compile(
    r"(dailyStat\.deleteMany\(\{ where: \{ )(day[^{}]*?)\s*\}",
)

def uniq(m):
    key = "day" + (m.group(3) or "")
    return f'{m.group(1)}userId: "me", {key}{m.group(4)}' if m.group(2) else f'{m.group(1)}userId: "me", day{m.group(4)}'

changed = []
for path in glob.glob("scripts/*.ts"):
    src = open(path).read()
    new = PAT_DATA.sub(lambda m: f'{m.group(1)}userId_day: {{ userId: "me", {m.group(2).strip()} }}{m.group(3)}', src)
    new = PAT.sub(lambda m: f'{m.group(1)}userId_day: {{ userId: "me", {m.group(2).strip()} }}', new)
    new = DEL.sub(lambda m: f'{m.group(1)}userId: "me", {m.group(2).strip()} }}'.replace(" }}", " }"), new)
    if new != src:
        open(path, "w").write(new)
        changed.append(path)

print("patched files:")
for c in changed:
    print(" ", c)
