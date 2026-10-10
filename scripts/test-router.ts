// Router coverage: the exact learner phrasings that previously bounced off
// the chatbot must all land on the right skill.
import { routeIntent } from "../src/lib/skills/agent";

const cases: [string, string][] = [
  ["make me an exam", "exam.build"],
  ["make me an exam on my weak spots", "exam.build"],
  ["generate a test", "exam.build"],
  ["quiz me", "exam.quick"],
  ["test me on collocations", "exam.quick"],
  ["assess my level deeply, skill by skill", "assess"],
  ["what's my level?", "assess"],
  ["deep analysis of my english", "assess"],
  ["drill me on collocations", "drill"],
  ["drill articles", "drill"],
  ["practice prepositions with me", "drill"],
  ["translate this: لطفا گزارش را ایمیل کن", "translate"],
  ["rewrite this to sound more professional", "rewrite"],
  ["review my recurring mistakes", "mistakes"],
  ["what do i keep getting wrong", "mistakes"],
  ["plan my week", "plan"],
  ["study plan for c1", "plan"],
  ["make the app emerald", "theme"],
  ["change the color to purple", "theme"],
  ["make it green", "theme"],
  ["dark mode please", "theme"],
  ["make me a vocab list", "vocab"],
  ["how am i doing", "progress"],
  ["show my progress report", "progress"],
  ["let's practice a job interview", "roleplay"],
  ["hi", "chat"],
  ["I have seen him yesterday at the office.", "chat"],
  ["practice a job interview roleplay", "roleplay"],
  ["make a 10 question exam", "exam.build"],
];

let pass = 0, fail = 0;
for (const [msg, want] of cases) {
  const got = routeIntent(msg);
  const ok = got.skill === want || (want === "drill" && got.skill === "drill");
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  "${msg}" -> ${got.skill}${got.drill ? `(${got.drill})` : ""} (want ${want})`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
