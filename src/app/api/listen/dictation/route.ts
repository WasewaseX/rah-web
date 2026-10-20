import { NextResponse } from "next/server";
import { buildProfile, bumpDaily } from "@/lib/server";
import { proximity } from "@/lib/proximity";
import { deckCardForToken, scheduleExamOutcomes, LISTEN_CARD_PREFIX } from "@/lib/exam-cards";
import { recordMistakes } from "@/lib/mistakes";
import { awardXp } from "@/lib/arcade";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// P4: the dictation endpoint. The client sends { sentences: [{target, typed}] }
// from the Listen lab's Dictate pass; the SERVER re-runs the proximity diff
// (the client's per-word display is cosmetic, this is the authority), then:
//   - every scheduled slip (content word, not recalled) lands on the FSRS
//     schedule through the same pipe as exam outcomes: a real deck card when
//     the token IS a deck word, a listen:<token> healing card otherwise;
//   - ReviewLog rows carry source "dictation" provenance;
//   - the miss feeds the mistake memory as a listen family whose evidence is
//     "typed -> target", so the healing loop can hunt it and the review
//     queue can render the card from the learner's own sentence pair.
// Caps keep one bad round from flooding the schedule (max 8 sentences,
// max 6 scheduled tokens per call).

interface SentencePair {
  target: string;
  typed: string;
}

export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const body = (await req.json().catch(() => null)) as { sentences?: SentencePair[] } | null;
  const pairs = Array.isArray(body?.sentences) ? body!.sentences!.slice(0, 8) : [];
  const clean = pairs
    .filter((p) => p && typeof p.target === "string" && typeof p.typed === "string")
    .map((p) => ({ target: p.target.slice(0, 300).trim(), typed: p.typed.slice(0, 300).trim() }))
    .filter((p) => p.target.length > 0);
  if (clean.length === 0) {
    return NextResponse.json({ error: "sentences required" }, { status: 400 });
  }

  const profile = await buildProfile();
  const results = clean.map((p) => ({ target: p.target, typed: p.typed, ...proximity(p.target, p.typed) }));
  const allSlips = [...new Set(results.flatMap((r) => r.slips))].slice(0, 6);

  // Resolve slips to FSRS targets: deck card when possible, healing card otherwise.
  const targets: { cardId: string; grade: 1; tag?: string; via: "deck" | "family" }[] = [];
  const seen = new Set<string>();
  for (const slip of allSlips) {
    const deck = deckCardForToken(slip);
    const cardId = deck ? deck.id : `${LISTEN_CARD_PREFIX}${slip}`;
    if (seen.has(cardId)) continue;
    seen.add(cardId);
    targets.push({ cardId, grade: 1 as const, tag: deck ? undefined : slip, via: (deck ? "deck" : "family") as "deck" | "family" });
  }
  let scheduled: Awaited<ReturnType<typeof scheduleExamOutcomes>> = [];
  try {
    scheduled = await scheduleExamOutcomes(targets, "dictation");
  } catch {
    scheduled = [];
  }

  // Mistake memory: one listen family per sentence that had slips, evidence
  // "typed -> target" so the blanked review card resurfaces the correction.
  const families = results
    .filter((r) => r.slips.length > 0)
    .slice(0, 6)
    .map((r) => ({ kind: "listen" as const, tag: r.slips[0], wrong: r.typed || "(nothing typed)", right: r.target }));
  if (families.length > 0) {
    try {
      await recordMistakes(families);
    } catch {
      // memory is an enhancement; the schedule above is the load-bearing write
    }
  }

  await bumpDaily("listened");
  await awardXp(5 + Math.round(results.reduce((a, r) => a + r.score, 0) * 5), { chainHit: results.some((r) => r.score >= 0.8) });

  return NextResponse.json({
    results: results.map((r) => ({
      target: r.target,
      typed: r.typed,
      score: r.score,
      verdicts: r.verdicts.map((v) => ({ token: v.token, ok: v.ok, near: v.near, slip: v.slip })),
    })),
    scheduled,
    band: profile.level,
  });
}
