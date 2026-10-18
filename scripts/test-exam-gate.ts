/**
 * Answerability gate regression: replays the user's real broken exam items
 * ("wtf are these questions - you say a random statement and want me to
 * answer a vocab??") as permanent negative fixtures, plus the fair items
 * that must keep passing. Deterministic, no AI, no db.
 */
import { itemAnswerable, itemFairlyAsked } from "../src/lib/agent/exam-gate";

let failures = 0;
function drop(name: string, item: { type: string; q: string; a?: string; choices?: string[]; accept?: string[] }, why: string) {
  const v = itemAnswerable(item);
  if (!v.ok) console.log(`PASS dropped: ${name} (${v.ok ? "no" : v.reason})`);
  else {
    failures++;
    console.log(`FAIL should drop: ${name} -> gate passed it`);
  }
  void why;
}
function keep(name: string, item: { type: string; q: string; a?: string; choices?: string[]; accept?: string[] }) {
  const v = itemAnswerable(item);
  if (v.ok) console.log(`PASS kept: ${name}`);
  else {
    failures++;
    console.log(`FAIL should keep: ${name} -> ${v.reason}`);
  }
}

// === The user's real broken items (exam transcript, verbatim) ===

// "Despite the storm, the flight departed on schedule." -> "Write the full sentence"
drop(
  "bare statement shipped as rewrite",
  { type: "rewrite", q: "Despite the storm, the flight departed on schedule.", a: "anything" },
  "no task",
);

// "It's possible that they have already finished their meal." -> "Write the full sentence"
drop(
  "bare statement shipped as rewrite (second exam)",
  { type: "rewrite", q: "It's possible that they have already finished their meal.", a: "anything" },
  "no task",
);

// Trivia: "What term describes a cooking technique where food is cooked slowly in liquid at a low temperature?"
drop(
  "cooking-term trivia",
  { type: "short", q: "What term describes a cooking technique where food is cooked slowly in liquid at a low temperature?", a: "poaching" },
  "world knowledge",
);

// Trivia: "What is the term for the sport where two teams try to hit a ball into the other team's court using only their hands?"
drop(
  "sport-term trivia",
  { type: "short", q: "What is the term for the sport where two teams try to hit a ball into the other team's court using only their hands?", a: "handball" },
  "world knowledge",
);

// Trivia MCQ: "When traveling internationally, which document allows you to clear customs and immigration?"
drop(
  "document trivia as mcq",
  {
    type: "mcq",
    q: "When traveling internationally, which document allows you to clear customs and immigration?",
    choices: ["boarding pass", "itinerary", "customs declaration", "passport"],
    a: "passport",
  },
  "world knowledge",
);

// "Which verb collocates with 'city' to describe when it becomes busy with traffic?" - open key, several answers
drop(
  "open collocation quiz with no forced key",
  { type: "short", q: "Which verb collocates with 'city' to describe when it becomes busy with traffic?", a: "congest" },
  "ambiguous",
);

// MCQ whose key is not among the delivered choices
drop(
  "mcq key not among choices",
  { type: "mcq", q: "She ___ to school every morning.", choices: ["go", "goes", "gone"], a: "goes to" },
  "broken key",
);

// Cloze without a blank
drop("cloze without a blank", { type: "cloze", q: "Is this sentence grammatically correct?", a: "yes" }, "no blank");

// Key leaks into the sentence outside the blank
drop(
  "cloze key leaks into the sentence",
  { type: "cloze", q: "The traffic congestion was terrible this morning, it never ended in the ___.", a: "congestion" },
  "leak",
);

// === Fair items the gate must keep ===

// The rewrite WITH an instruction the user saw and accepted as sensible.
keep("rewrite with instruction + quoted sentence", {
  type: "rewrite",
  q: "Rewrite the sentence using more formal vocabulary: 'The new law really stops people from polluting rivers.'",
  a: "The new law prohibits people from polluting rivers.",
});

keep("future perfect mcq", {
  type: "mcq",
  q: "By the time we reach the airport, we ___ all our luggage.",
  choices: ["will have packed", "will pack", "are packing", "pack"],
  a: "will have packed",
});

keep("forced collocation cloze", {
  type: "cloze",
  q: "The committee came ___ a decision after hours of debate.",
  a: "to",
  accept: ["up with"],
});

keep("passive form short task", {
  type: "short",
  q: "Give the passive form of: 'The chef cooks the meal.'",
  a: "the meal is cooked by the chef",
});

keep("reported speech short task", {
  type: "short",
  q: "Change into reported speech: 'I am tired,' she said.",
  a: "she said she was tired",
});

// Question-only layer (used on live client payloads without keys)
const qOnly = itemFairlyAsked({ type: "rewrite", q: "Despite the storm, the flight departed on schedule." });
if (!qOnly.ok) console.log(`PASS question-only layer drops the bare statement (${qOnly.reason})`);
else {
  failures++;
  console.log("FAIL question-only layer passed a bare statement");
}

// Evidence items: deterministic quota enforcement built from family evidence.
// The blanked token must be the CORRECTION, not a bystander word.
import { evidenceItem } from "../src/lib/agent/exam-gate";

const ev1 = evidenceItem("articles", "I have lived here for 2019 -> I have lived here since 2019");
if (ev1 && ev1.a === "since" && ev1.q.includes("___") && ev1.tag === "articles") console.log("PASS evidence item blanks the correction (for -> since)");
else { failures++; console.log(`FAIL evidence item wrong -> ${JSON.stringify(ev1)}`); }

const ev2 = evidenceItem("countability", "childrens -> children are playing outside");
if (ev2 && ev2.a === "children") console.log("PASS evidence item prefers the stem-correction over bystander diffs");
else { failures++; console.log(`FAIL evidence item stem -> ${JSON.stringify(ev2)}`); }

const ev3 = evidenceItem("prepositions", "no clean evidence recorded");
if (ev3 === null) console.log("PASS evidence item returns null on unusable evidence");
else { failures++; console.log(`FAIL evidence item null -> ${JSON.stringify(ev3)}`); }

const ev4 = evidenceItem("articles", "I have lived here for 2019 -> I have lived here since 2019");
if (ev4 && itemAnswerable(ev4).ok) console.log("PASS evidence item passes the answerability gate");
else { failures++; console.log(`FAIL evidence item gate -> ${JSON.stringify(ev4)}`); }

console.log(failures === 0 ? "\nANSWERABILITY GATE: ALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
