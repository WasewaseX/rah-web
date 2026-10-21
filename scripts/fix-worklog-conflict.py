import re

p = "/home/z/my-project/worklog.md"
src = open(p, encoding="utf-8").read()

m = re.search(r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/main\n", src, re.S)
assert m, "conflict block not found"
mine, theirs = m.group(1), m.group(2)

# Their entry = Task 60 (as-is). Mine = Task 61 (continuation note).
mine = mine.replace("Task ID: 60", "Task ID: 61", 1)
mine = mine.replace(
    'Task: Investigate "first word achievement fired again" report; fix learner-data survival across updates; create ROADMAP-AUDIT.md.',
    'Task: SECOND data-wipe wave (20:28 reprovision, stale clone pre-dating the Task-60 fix): rebuilt the survival layer from scratch, merged it with the remote Task-60 layer, verified recovery limits.',
    1,
)
merged = theirs + "\n\n---\n\n" + mine + "\n"
src = src[: m.start()] + merged + src[m.end():]
open(p, "w", encoding="utf-8").write(src)
print("worklog conflict resolved: Task 60 (theirs) + Task 61 (mine)")
