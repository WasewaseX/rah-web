// Hybrid grading evaluation: replays the user's real exam transcript.
// Mechanical layer: typos and multi-attempt answers pass, imprecise answers fail.
// AI arbiter: meaning-equal wording is accepted, real misses get coaching
// (rule + Farsi takeaway + trap tag) instead of a bare "wrong".
import { gradeAnswer, editDistance } from "@/lib/agent/fuzzy";
import { arbitrateMisses, TRAP_TAGS } from "@/lib/agent/exam-ai";

let failures = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

// --- Mechanical layer: the transcript cases ---
check(gradeAnswer({ given: "echology", type: "short", a: "ecology" }), "typo mercy: echology -> ecology accepted");
check(gradeAnswer({ given: "Biology/echology", type: "short", a: "ecology" }), "multi-attempt: biology/echology accepted (candidate split)");
check(!gradeAnswer({ given: "combine", type: "cloze", a: "blend" }), "mechanical: combine vs blend rejected (arbiter's job)");
check(!gradeAnswer({ given: "usage", type: "cloze", a: "footprint" }), "imprecise: usage vs footprint rejected");
check(!gradeAnswer({ given: "teach", type: "cloze", a: "equip" }), "imprecise: teach vs equip rejected");
check(!gradeAnswer({ given: "weather forcasting", type: "short", a: "phenology" }), "wrong answer: weather forcasting vs phenology rejected");
check(gradeAnswer({ given: "rains", type: "cloze", a: "rain" }), "inflection: rains -> rain accepted");
check(gradeAnswer({ given: "pouring rain", type: "cloze", a: "heavy rain", accept: ["pouring rain"] }), "synonym accept list works");
check(!gradeAnswer({ given: "advise", type: "cloze", a: "advice" }), "strict below 7 letters: advise vs advice rejected (different word)");
check(editDistance("echology", "ecology") === 1, "editDistance sanity");

// --- AI arbiter: the three answers the user fought about ---
const misses = [
  { id: "i1", type: "cloze", skill: "vocabulary", q: "The gallery owner was impressed by how the artist could ________ traditional techniques with modern digital elements.", a: "blend", given: "combine" },
  { id: "i2", type: "cloze", skill: "vocabulary", q: "The environmental report emphasized the need to reduce our carbon ________ and adopt more sustainable practices.", a: "footprint", given: "usage" },
  { id: "i3", type: "rewrite", skill: "vocabulary", q: "Rewrite using more precise vocabulary: 'The students have to learn these new rules.'", a: "The students must adhere to these new rules.", given: "the students must learn these new rules" },
];
const arb = await arbitrateMisses(misses);
const c1 = arb.get("i1");
const c2 = arb.get("i2");
const c3 = arb.get("i3");
check(c1?.accept === true, "arbiter accepts combine for blend (meaning-equal)", JSON.stringify(c1));
check(c2?.accept === false, "arbiter rejects usage for footprint (imprecise)");
check((c2?.rule.length ?? 0) > 10, "rejected miss carries a teaching rule", c2?.rule);
check((c2?.fa ?? "").length > 0, "rejected miss carries a Farsi takeaway", c2?.fa);
check(TRAP_TAGS.includes((c2?.tag ?? "") as never), "rejected miss carries a taxonomy tag", c2?.tag);
check(c3?.accept === false, "arbiter keeps rewrite strict (target pattern missing)");
check((c3?.rule.length ?? 0) > 10, "rewrite miss carries coaching", c3?.rule);

console.log(failures === 0 ? "\nHYBRID GRADING: ALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
