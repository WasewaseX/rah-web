// Hybrid grading, second stage. The mechanical fuzzy grader decides fast and
// deterministic; every item it REJECTED goes through one AI arbitration pass
// that judges meaning, not spelling. It either accepts a right answer the
// regex was too blind to see ("combine" for "blend") or writes a coaching
// note that teaches the miss instead of just announcing it. Every coached
// miss also earns a trap tag so the mistake memory can hunt it later.

import { aiJson } from "@/lib/ai";

export interface MissForArbitration {
  id: string;
  type: string;
  skill: string;
  q: string;
  a: string;
  given: string;
  why?: string;
}

export interface ArbitrationVerdict {
  accept: boolean;
  rule: string; // one English sentence: the takeaway, not a repetition of "wrong"
  fa: string; // one Farsi sentence for a Farsi speaker
  tag: string; // Farsi-interference trap tag for the memory
}

export const TRAP_TAGS = [
  "statives", "articles", "countability", "plurals", "copula", "prepositions",
  "perfect", "question_order", "adjectives", "that_omission", "th_sounds",
  "w_v", "clusters", "ng", "stress", "spelling", "word_choice", "register",
  "collocation",
] as const;

const FALLBACK: ArbitrationVerdict = {
  accept: false,
  rule: "The target answer is different from what you wrote; study the key and the why.",
  fa: "",
  tag: "word_choice",
};

function arbSystem(misses: MissForArbitration[]): string {
  return `You are the grading arbiter inside Rah, an English app for Farsi speakers. The mechanical grader rejected the answers below; your job is second-opinion grading plus coaching.

THE GOLDEN RULE: if a competent native speaker could naturally produce the learner's word in this blank and the sentence would keep its meaning, you MUST accept it - even when the key is the "best" word. Rejecting a natural answer is the worst failure this app can commit; the learner typed "combine" where the key was "blend" and both are perfect English. Never reject on imprecision alone.

Reject ONLY when one of these holds:
(a) the answer is grammatically wrong in this sentence (wrong form, broken agreement, unidiomatic pattern like "teach students with practical skills");
(b) the answer changes what the sentence means;
(c) the question asks for a NAME or TERM ("what do you call...", "the term for...") and the answer names a different thing;
(d) the item explicitly drills one standard collocation and the learner's pairing is NOT idiomatic English (e.g. "carbon usage" for "carbon footprint").
When you reject, the "rule" field must teach the precise point - what a native would say and why, never just "wrong".

For EACH miss decide:

1. "accept" - true or false per the rules above.
2. "rule" - ONE English sentence (max 24 words) teaching the takeaway: name the pattern or the precise word, and when useful contrast it with what they wrote. No "you are wrong" phrasing; teach instead.
3. "fa" - ONE Farsi sentence explaining the takeaway specifically for a Farsi speaker (the interference, the false friend, the register trap). No English inside the fa string except the target word itself.
4. "tag" - exactly one of: ${TRAP_TAGS.join(", ")}. Pick the tag that best names WHY this miss happens for this learner; use "word_choice" only when nothing else fits.

Output ONE JSON object, nothing else:
{"verdicts": [{"id": "the item id from the list", "accept": false, "rule": "", "fa": "", "tag": ""}]}
One verdict per miss, same order, same ids. Never use the em dash character.

The misses:
${misses.map((m) => `id=${m.id} [${m.type}/${m.skill}] question: ${JSON.stringify(m.q)} key: ${JSON.stringify(m.a)} learner wrote: ${JSON.stringify(m.given)}`).join("\n")}`;
}

// One batched call for the whole exam's misses. On any failure every miss
// falls back to the deterministic coaching note - grading never stalls.
export async function arbitrateMisses(misses: MissForArbitration[]): Promise<Map<string, ArbitrationVerdict>> {
  const out = new Map<string, ArbitrationVerdict>();
  if (misses.length === 0) return out;
  try {
    const raw = await aiJson<{ verdicts?: (Partial<ArbitrationVerdict> & { id?: string })[] }>(
      arbSystem(misses),
      [{ role: "user", content: `Arbitrate all ${misses.length} misses now. Follow the accept rules strictly.` }],
      () => ({}),
      { deep: false, temperature: 0.2 },
    );
    for (const m of misses) {
      const v = (raw.verdicts ?? []).find((x) => String(x.id ?? "") === m.id);
      if (!v) {
        out.set(m.id, { ...FALLBACK, rule: m.why || FALLBACK.rule });
        continue;
      }
      const accept = v.accept === true;
      const tag = TRAP_TAGS.includes(String(v.tag ?? "") as never) ? String(v.tag) : "word_choice";
      out.set(m.id, {
        accept,
        rule: String(v.rule ?? "").trim() || m.why || FALLBACK.rule,
        fa: String(v.fa ?? "").trim(),
        tag,
      });
    }
  } catch {
    for (const m of misses) out.set(m.id, { ...FALLBACK, rule: m.why || FALLBACK.rule });
  }
  return out;
}
