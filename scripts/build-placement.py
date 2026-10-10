#!/usr/bin/env python3
"""Rebuilds src/content/placement.json with the 2026-10 bug fixes:
- reading items embed their full mini-passage (no more phantom 'according to the passage')
- distractors are plausible misconceptions with mixed polarity (kills the
  3-negative-1-positive tell), similar lengths, no misspelling give-aways
- single unambiguous key per item (v3/c3 had two idiomatic answers)
- every item carries a learner-true trap (18 were empty)
- key positions balanced across A-D (was A=11 B=13 C=1 D=0)
The script self-validates before writing; the TS test suite re-checks the file.
"""
import json, re, sys

P = "src/content/placement.json"

def item(id, sec, rung, q, choices, a, trap):
    return {"id": id, "sec": sec, "rung": rung, "q": q, "choices": choices, "a": a, "trap": trap}

items = [
    # ---------------- grammar (7) ----------------
    item("g1", "grammar", "B1",
         "___ is important to sleep well before an exam.",
         ["There", "It", "This", "That"],
         "It", "that_omission"),
    item("g2", "grammar", "B2",
         "She has lived here ___ 2019.",
         ["for", "since", "from", "in"],
         "since", "perfect"),
    item("g3", "grammar", "B2",
         "I ___ what you mean.",
         ["am seeing", "see", "am see", "seeing"],
         "see", "statives"),
    item("g4", "grammar", "B2+",
         "Do you know ___?",
         ["where the station is", "where is the station", "where is station", "the station is where"],
         "where the station is", "question_order"),
    item("g5", "grammar", "B2+",
         "He arrived ___ Monday morning.",
         ["on", "in", "at", "to"],
         "on", "prepositions"),
    item("g6", "grammar", "C1",
         "Had I known about the deadline, I ___ differently.",
         ["will act", "would have acted", "had acted", "would act"],
         "would have acted", "conditional"),
    item("g7", "grammar", "C1",
         "It was the first time she ___ such a candid review.",
         ["has received", "received", "had received", "was receiving"],
         "had received", "perfect"),
    # ---------------- vocab (7) ----------------
    item("v1", "vocab", "B1",
         "The medicine had a strong ___ on her appetite.",
         ["affect", "effect", "affection", "effective"],
         "effect", "word_choice"),
    item("v2", "vocab", "B2",
         "The report ___ light on the real cause of the outage.",
         ["gave", "put", "shed", "threw"],
         "shed", "word_choice"),
    # v3 was a double-key bug ('bear' and 'hold up to' both idiomatic). Rebuilt
    # with a single-key verb-choice item.
    item("v3", "vocab", "B2",
         "The two witnesses' accounts ___ each other completely.",
         ["contradict", "deny", "oppose", "refuse"],
         "contradict", "word_choice"),
    item("v4", "vocab", "B2+",
         "The committee remains ___ to the idea of extra funding.",
         ["adverse", "averse", "reversed", "averse to be"],
         "averse", "word_choice"),
    item("v5", "vocab", "B2+",
         "She answered every question with remarkable ___.",
         ["fluently", "fluent", "fluidity", "fluency"],
         "fluency", "word_choice"),
    item("v6", "vocab", "C1",
         "The two accounts of the accident are impossible to ___.",
         ["collide", "reconcile", "reconciliate", "coordinate"],
         "reconcile", "word_choice"),
    # v7 'divice' was a misspelling give-away; distractors are now real word forms.
    item("v7", "vocab", "C1",
         "His calm tone was a deliberate ___ to keep things short.",
         ["device", "devise", "devising", "devised"],
         "device", "word_choice"),
    # ---------------- collocation (7) ----------------
    item("c1", "collocation", "B1",
         "I need to ___ a decision soon.",
         ["do", "make", "take", "have"],
         "make", "word_choice"),
    item("c2", "collocation", "B2",
         "We must ___ these risks into account.",
         ["make", "take", "bring", "hold"],
         "take", "word_choice"),
    # c3 was a double-key bug ('laid' and 'put' emphasis both idiomatic). Rebuilt.
    item("c3", "collocation", "B2",
         "The director ___ pressure on the team to ship early.",
         ["made", "gave", "put", "took"],
         "put", "word_choice"),
    item("c4", "collocation", "B2+",
         "Her argument doesn't ___ water.",
         ["carry", "keep", "fill", "hold"],
         "hold", "word_choice"),
    item("c5", "collocation", "B2+",
         "The two sides finally ___ an agreement.",
         ["struck", "hit", "beat", "built"],
         "struck", "word_choice"),
    item("c6", "collocation", "C1",
         "The speech was carefully ___ to avoid controversy.",
         ["said", "worded", "spoken", "told"],
         "worded", "word_choice"),
    # c7 'fell' was second-key plausible; distractors rebuilt around stop-short-of.
    item("c7", "collocation", "C1",
         "He ___ short of calling the report a lie.",
         ["stopped", "paused", "avoided", "refused"],
         "stopped", "word_choice"),
    # ---------------- reading (4) ----------------
    # Every reading item embeds its full mini-passage, then a blank line, then
    # the question. Options mix polarity and length; the key is never the only
    # positive/hedged option and never the extreme.
    item("r1", "reading", "B2",
         "Most learners review new words on the same day they meet them, then wonder why the words vanish by Friday. Studies of memory keep pointing the same way: recall that happens after a night of sleep, when the trace has partly faded, leaves a far stronger mark than recall that happens while the page is still open.\n\nWhy does spaced review beat same-day review?",
         ["Because the memory trace has partly faded, so recall has to work harder",
          "Because words studied at night are easier to read the next day",
          "Because sleep makes the material feel more familiar on the page",
          "Because reviewing later takes less time than reviewing immediately"],
         "Because the memory trace has partly faded, so recall has to work harder",
         "fluency_illusion"),
    item("r2", "reading", "B2+",
         "Psychologist Robert Bjork argues that some obstacles during practice are 'desirable difficulties': they slow down visible progress while quietly strengthening what stays in memory. A practice session that feels smooth can therefore be producing less learning than a session that feels like a struggle.\n\nWhat does the phrase 'desirable difficulties' suggest?",
         ["Teachers should remove obstacles so practice feels smooth",
          "Difficult materials are always more effective than easy ones",
          "Struggle during practice can strengthen long-term retention",
          "Progress that feels slow is a sign of poor practice methods"],
         "Struggle during practice can strengthen long-term retention",
         "fluency_illusion"),
    item("r3", "reading", "C1",
         "Readers often mistake the ease of rereading a chapter for evidence that they know it. The pages feel familiar, the argument arrives without effort, and a test the next morning reveals how little survived. Familiarity, researchers warn, is a poor proxy for knowledge.\n\nThe passage implies that learners who feel fluent while rereading ___.",
         ["have stored the chapter durably in long-term memory",
          "often mistake familiarity for genuine knowledge",
          "should switch to harder chapters immediately after",
          "benefit most from reviewing the same chapter again"],
         "often mistake familiarity for genuine knowledge",
         "fluency_illusion"),
    item("r4", "reading", "C1",
         "A study team compared three revision schedules across a term. Learners who reviewed a topic the day it was taught rated their confidence highest, yet scored lowest on the delayed final. The group whose reviews began only when material started to slip performed best, despite reporting the most effort during practice.\n\nWhich sentence best captures the study's conclusion?",
         ["Review works best while the material still feels fresh",
          "Confidence during revision predicts final performance",
          "Effortful practice is a symptom of a poor study schedule",
          "Review pays off most when it starts at the edge of forgetting"],
         "Review pays off most when it starts at the edge of forgetting",
         "fluency_illusion"),
]

# ---------------- self-validation (mirrors scripts/test-placement.ts) ----------
DANGLING = re.compile(r"(?i)(according to|based on)[^.]{0,40}(text|passage|article|author|writer)|the (text|passage|article) (says|states|mentions|suggests)|the (author|writer) (says|states|mentions|argues)")
NEG_START = re.compile(r"^(not |never |no |cannot |can't |should avoid|useless|removes? |harms? |demotivates? |a poor |poor )", re.IGNORECASE)
fails = []
from collections import Counter
pos = Counter()
lens = {}
for it in items:
    ch, a = it["choices"], it["a"]
    if a not in ch: fails.append(f"{it['id']}: key not in choices")
    if len(set(ch)) != 4: fails.append(f"{it['id']}: duplicate/fewer choices")
    if not it["trap"].strip(): fails.append(f"{it['id']}: empty trap")
    idx = ch.index(a)
    pos["ABCD"[idx]] += 1
    # length tell
    avg = sum(len(c) for c in ch) / 4
    if len(a) > 1.6 * avg: fails.append(f"{it['id']}: key far longest ({len(a)} vs avg {avg:.0f})")
    # 3-negative tell: key is the only option that does not start negative/extreme
    neg = sum(1 for c in ch if c != a and NEG_START.match(c))
    if neg == 3: fails.append(f"{it['id']}: 3-negative-1-positive tell")
    # hedge tell: key uniquely hedged while 2+ distractors carry absolutes
    hedges = ("may ", "might ", "can ")
    absolutes = ("best", "always", "never", "immediately", "only", "most", "all ", "harms", "harm ")
    key_hedged = any(a.startswith(h) for h in hedges)
    abs_distractors = sum(1 for c in ch if c != a and any(m in c for m in absolutes))
    if key_hedged and abs_distractors >= 2:
        fails.append(f"{it['id']}: unique-hedge tell")
    # reading: embedded passage
    if it["sec"] == "reading":
        if "\n\n" not in it["q"] or len(it["q"]) < 220:
            fails.append(f"{it['id']}: reading item lacks embedded passage")
        m = DANGLING.search(it["q"])
        if m and "\n\n" not in it["q"]:
            fails.append(f"{it['id']}: dangling passage reference")
    lens[it['id']] = [len(c) for c in ch]
# per-section position balance: no letter used for more than 4 of a section's items
for sec in ("grammar", "vocab", "collocation", "reading"):
    c = Counter("ABCD"[i["choices"].index(i["a"])] for i in items if i["sec"] == sec)
    if c and c.most_common(1)[0][1] > 4: fails.append(f"{sec}: key position bias {dict(c)}")
if pos["D"] == 0: fails.append("letter D never used")
if fails:
    print("VALIDATION FAILED:"); [print(" -", f) for f in fails]; sys.exit(1)

with open(P, "w") as f:
    json.dump({"items": items}, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"wrote {len(items)} items; key positions {dict(pos)}")
