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
export async function arbitrateMisses(
  misses: MissForArbitration[],
  onDegraded?: (reason: string) => void,
): Promise<Map<string, ArbitrationVerdict>> {
  const out = new Map<string, ArbitrationVerdict>();
  if (misses.length === 0) return out;
  try {
    const raw = await aiJson<{ verdicts?: (Partial<ArbitrationVerdict> & { id?: string })[] }>(
      arbSystem(misses),
      [{ role: "user", content: `Arbitrate all ${misses.length} misses now. Follow the accept rules strictly.` }],
      () => ({}),
      {
        deep: false,
        temperature: 0.2,
        degraded: (reason) => {
          // The fallback envelope means no real verdicts arrived: every miss
          // below keeps its regex verdict with the FALLBACK note. The caller
          // must label the graded result as degraded (audit P1-7).
          onDegraded?.(reason);
        },
      },
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
  } catch (e) {
    onDegraded?.(`arbiter unreachable: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`);
    for (const m of misses) out.set(m.id, { ...FALLBACK, rule: m.why || FALLBACK.rule });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Layer 2 of the answerability gate: AI vetting BEFORE delivery. The
// deterministic gate (exam-gate.ts) kills bare statements, trivia and
// structurally broken items; this pass judges what regex cannot see:
// ambiguous keys (several natural answers), MCQ choices that are as
// defensible as the key, and weakness tags slapped onto items that do not
// actually force that trap. Nothing reaches a learner unvetted.
// ---------------------------------------------------------------------------

export interface ItemForVetting {
  id: string;
  type: string;
  skill: string;
  q: string;
  choices?: string[];
  a: string;
  accept: string[];
  tag?: string;
}

export interface VetVerdict {
  ok: boolean;
  keepTag: boolean;
  reason: string;
}

function vetSystem(items: ItemForVetting[]): string {
  return `You are the answerability gate inside Rah, an English exam app. The items below were generated for a learner; they passed structural checks. Your job: make sure each one is FAIRLY ANSWERABLE - a competent learner given only the question text could produce the key (or something on its accept list) with confidence.

An item is NOT answerable (ok=false) when ANY holds:
(a) NO REAL TASK: a bare statement with nothing asked, or a "rewrite" whose instruction lives only in your imagination - the question text alone does not say what to do;
(b) AMBIGUOUS KEY: several natural, equally correct answers exist and the accept list does not cover them (open vocabulary blanks like "a distinct ___" where flavor/aroma/taste all fit; "which verb collocates" with multiple candidates; definition questions with several possible terms);
(c) TRIVIA / WORLD KNOWLEDGE: the item tests facts, terms, or general education instead of English structure, collocation, register, or meaning in context;
(d) UNFAIR MCQ: another choice is as defensible as the key, or the key cannot be chosen without guessing;
(e) BROKEN KEY: the key is grammatically wrong in its sentence, or does not fit the blank.

keepTag: items may carry a "tag" naming the mistake family they hunt (e.g. articles). keepTag=false when the item does not GENUINELY force that exact weakness - a tag slapped on an unrelated item poisons the healing loop. The item itself can still be fine (ok=true).

Output ONE JSON object, nothing else:
{"vetted": [{"id": "...", "ok": true, "keepTag": true, "reason": "max 10 words; empty when ok"}]}
One entry per item, same order, same ids. Never use the em dash character.

The items:
${items
  .map(
    (it) =>
      `id=${it.id} [${it.type}/${it.skill}] q: ${JSON.stringify(it.q)}${it.choices ? ` choices: ${JSON.stringify(it.choices)}` : ""} key: ${JSON.stringify(it.a)} accept: ${JSON.stringify(it.accept)}${it.tag ? ` tag: ${it.tag}` : ""}`,
  )
  .join("\n")}`;
}

export async function vetItems(items: ItemForVetting[]): Promise<Map<string, VetVerdict>> {
  const out = new Map<string, VetVerdict>();
  if (items.length === 0) return out;
  try {
    const raw = await aiJson<{ vetted?: { id?: string; ok?: boolean; keepTag?: boolean; reason?: string }[] }>(
      vetSystem(items),
      [{ role: "user", content: `Vet all ${items.length} items now. Judge answerability strictly; an unfair item teaches nothing.` }],
      () => ({}),
      // Deep mode: the vet runs once per exam and is the last line before the
      // learner; a missed ambiguous key costs a whole item. Spend the tokens.
      { deep: true, temperature: 0.1 },
    );
    for (const it of items) {
      const v = (raw.vetted ?? []).find((x) => String(x.id ?? "") === it.id);
      if (!v) {
        out.set(it.id, { ok: true, keepTag: true, reason: "" });
        continue;
      }
      out.set(it.id, {
        ok: v.ok !== false,
        keepTag: v.keepTag !== false,
        reason: String(v.reason ?? "").trim(),
      });
    }
  } catch {
    // The gate must never stall generation: on failure, trust the
    // deterministic layer and deliver.
    for (const it of items) out.set(it.id, { ok: true, keepTag: true, reason: "" });
  }
  return out;
}
