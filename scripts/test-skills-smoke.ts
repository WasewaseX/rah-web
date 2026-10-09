// Smoke test for the 10 new super-agent skills and the mode machinery.
// Fast paths where possible; one live AI round per mode starter.
const BASE = "http://localhost:3000";

interface Resp {
  skill?: string;
  reply?: string;
  exam?: { id: string; count: number };
  fa_note?: string;
  steps?: { label: string }[];
}

let failures = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}
async function chat(message: string): Promise<Resp> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [] }),
  });
  return (await res.json()) as Resp;
}

// 1. coach-report: deterministic data report
const rep = await chat("/week");
check(rep.skill === "coach-report" && /Last 7 days/.test(rep.reply ?? ""), "/report gives the numbers", rep.reply?.slice(0, 80));

// 2. minimal-pairs: curated, instant
const pr = await chat("/pairs");
check(pr.skill === "minimal-pairs" && /vs/.test(pr.reply ?? "") && (pr.fa_note ?? "").length > 0, "/pairs serves pairs + Farsi tip");

// 3. drill: AI-built repair drill on a named spot
const dr = await chat("/drill prepositions");
check(dr.skill === "repair-drill" && (dr.exam?.count ?? 0) >= 4, "/drill builds a drill exam", `count=${dr.exam?.count}`);

// 4. roleplay mode: start, continue in character, exit cleanly
const rp = await chat("/roleplay job interview");
check(rp.skill === "roleplay" && /Scene:/.test(rp.reply ?? ""), "roleplay starts with a scene");
const rp2 = await chat("Sorry, could you tell me what are the responsibilities of this position?");
check(rp2.skill === "roleplay", "roleplay continues in character (mode interception)", rp2.skill);
const rp3 = await chat("end scene");
check(/Back in coach mode|back in coach mode/i.test(rp3.reply ?? ""), "roleplay exits cleanly", rp3.reply?.slice(0, 60));

// 5. socratic mode: on then off
const so = await chat("/socratic");
check(so.skill === "socratic" && /Socratic mode is on|guide/i.test(so.reply ?? ""), "socratic mode starts");
const so2 = await chat("end");
check(/coach mode|Back in coach/i.test(so2.reply ?? ""), "socratic exits", so2.reply?.slice(0, 50));

// 6. daily challenge: start, answer, graded, mode cleared
const dc = await chat("/daily");
check(dc.skill === "daily-challenge" && /Today's challenge/.test(dc.reply ?? ""), "daily challenge starts");
const dc2 = await chat("skip");
check(/The answer was/.test(dc2.reply ?? ""), "daily skip reveals and clears mode", dc2.reply?.slice(0, 60));

// 7. explain: one-shot lesson with Farsi tail
const ex = await chat("explain present perfect vs past simple");
check(ex.skill === "explain" && (ex.reply ?? "").length > 60 && (ex.fa_note ?? "").length > 0, "/explain teaches with Farsi tail");

// 8. remediate on clean sheet (no crash path)
const rm = await chat("practice my misses");
check(rm.skill === "remediate" && (rm.reply ?? "").length > 10, "remediate answers", rm.reply?.slice(0, 60));

console.log(failures === 0 ? "\nSKILLS + MODES SMOKE: ALL PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

export {}
