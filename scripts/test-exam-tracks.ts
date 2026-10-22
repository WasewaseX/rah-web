// Exam-track battery (Task 66 - audit P1 curriculum). Pure, deterministic:
// track bank shape, band-reference monotonicity and boundary honesty, title
// prefixing. Run: bun scripts/test-exam-tracks.ts

import { EXAM_TRACKS, isTrackId, bandReference, trackTitle, type TrackId } from "../src/lib/agent/exam-tracks";

let pass = 0;
let fail = 0;
function check(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? " - " + detail : ""}`);
  }
}

const IDS: TrackId[] = ["ielts", "toefl", "c1a"];

// 1. bank shape: every track carries the honesty load
for (const id of IDS) {
  const t = EXAM_TRACKS[id];
  check(t.id === id && t.label.length > 3 && t.titlePrefix.length > 3, `${id}: label + prefix present`);
  check(/not affiliated/i.test(t.disclaimer), `${id}: disclaimer says not affiliated`, t.disclaimer.slice(0, 60));
  check(/rough reference/i.test(t.disclaimer), `${id}: disclaimer says rough reference`);
  check(t.brief.includes("EXAM FORMAT") && t.brief.length > 200, `${id}: brief carries the format block`);
  check(t.minutesPerItem > 0 && t.defaultCount >= 4, `${id}: timing + count sane`);
}
check(isTrackId("ielts") && !isTrackId("toeic"), "isTrackId gates the union");

// 2. band reference: monotone, bounded, labeled
for (const id of IDS) {
  const seq = [0, 20, 40, 50, 60, 70, 80, 90, 100].map((p) => bandReference(p, id).band);
  check(seq[0] !== seq[seq.length - 1], `${id}: band moves across the range`, seq.join(" > "));
  check(seq.every((b) => typeof b === "string" && b.length > 1), `${id}: every band is a range string`);
  const r = bandReference(72, id);
  check(/not an official score/i.test(r.note) && /72% correct/.test(r.note), `${id}: note carries pct + disclaimer`, r.note);
  check(bandReference(150, id).band === bandReference(100, id).band, `${id}: clamped above 100`);
  check(bandReference(-5, id).band === bandReference(0, id).band, `${id}: clamped below 0`);
}

// 3. IELTS/TOEFL/C1A flavor boundaries differ (they are different scales)
check(bandReference(80, "ielts").band !== bandReference(80, "toefl").band, "IELTS and TOEFL scales differ at the same pct");
check(/\d{3}/.test(bandReference(90, "toefl").band), "TOEFL band reaches the 3-digit scale at the top", bandReference(90, "toefl").band);
check(/Grade/.test(bandReference(85, "c1a").band), "C1A bands use Cambridge grade language", bandReference(85, "c1a").band);

// 4. title prefixing: idempotent, never doubled, never empty
check(trackTitle("Register in formal emails", "ielts") === "IELTS-style practice: Register in formal emails", "title gets the track prefix");
check(trackTitle("ielts-style practice: already prefixed", "ielts") === "ielts-style practice: already prefixed", "prefixed title is not doubled");
check(trackTitle("", "c1a") === "C1 Advanced-style practice: Practice set", "empty title falls back to Practice set");

// 5. skill routing: track keywords must route to the track skill, not the
// generic exam builder - the track block only exists on this path.
{
  const { POWER_SKILLS } = await import("../src/lib/agent/skills-power");
  const trackSkill = POWER_SKILLS.find((s) => s.id === "exam-track")!;
  const genericSkill = POWER_SKILLS.find((s) => s.id === "generate-exam")!;
  const routes = (text: string, triggers: RegExp[]) => triggers.some((r) => r.test(text));
  check(routes("generate an ielts practice exam", trackSkill.triggers), "'ielts practice exam' routes to the track skill");
  check(routes("give me a toefl mock test", trackSkill.triggers), "'toefl mock test' routes to the track skill");
  check(routes("cambridge c1 advanced practice", trackSkill.triggers), "'cambridge c1 advanced' routes to the track skill");
  check(!routes("give me a grammar exam", trackSkill.triggers), "generic exam text does NOT hit the track skill");
  check(routes("give me a grammar exam", genericSkill.triggers), "generic exam text still routes to the exam builder");
}

console.log(`\nexam-track battery: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
