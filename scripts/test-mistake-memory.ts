// Mistake-memory evaluation: two chat turns with the same Farsi interference
// trap must aggregate into one family with count 2, surface via the /mistakes
// skill, and ride along in the live profile that prompts consume.
const BASE = "http://localhost:3000";

interface ChatResp { reply?: string; skill?: string }
interface MistakesResp { families: { id: string; kind: string; tag: string; count: number; evidence: string }[] }

async function chat(message: string): Promise<ChatResp> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [] }),
  });
  return (await res.json()) as ChatResp;
}

let failures = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

// Two stative-verb mistakes (the "daram midunam: I am knowing" trap).
const r1 = await chat("I am knowing the answer since two hours.");
console.log(`turn 1 (${r1.skill}): ${r1.reply?.slice(0, 90)}`);
const r2 = await chat("I am knowing him very well for many years.");
console.log(`turn 2 (${r2.skill}): ${r2.reply?.slice(0, 90)}`);
await new Promise((r) => setTimeout(r, 2500)); // let the fire-and-forget writes land

const mres = await fetch(`${BASE}/api/mistakes`);
const mdata = (await mres.json()) as MistakesResp;
const statives = mdata.families.filter((f) => f.tag === "statives" && f.kind === "chat");
console.log("families on file:", mdata.families.map((f) => `${f.id} x${f.count}`).join(", ") || "(none)");
check(statives.length === 1, "one chat:statives family", `got ${statives.length}`);
check((statives[0]?.count ?? 0) >= 2, "family count is at least 2", `got ${statives[0]?.count}`);

// The /mistakes skill must surface it.
const r3 = await chat("what are my recurring mistakes?");
check(r3.reply?.toLowerCase().includes("stative") || r3.reply?.toLowerCase().includes("statives"), "/mistakes reply names the family", r3.reply?.slice(0, 140));

// The live profile carries the memory (this is what tutor/exam prompts consume).
const sres = await fetch(`${BASE}/api/state`);
const sdata = (await sres.json()) as { profile?: { mistakes?: { tag: string; count: number }[] } };
check((sdata.profile?.mistakes?.some((m) => m.tag === "statives" && m.count >= 2)) === true, "profile carries the family into prompts", JSON.stringify(sdata.profile?.mistakes ?? []));

console.log(failures === 0 ? "\nMISTAKE MEMORY: ALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
