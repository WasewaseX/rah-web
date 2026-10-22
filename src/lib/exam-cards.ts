import { db } from "@/lib/db";
import { contentUserId } from "@/lib/scope";
import { DECK, type Card } from "@/lib/content";
import { dayIndex, defaultState, review, type FsrsState } from "@/lib/fsrs";
import { getLearner } from "@/lib/server";
import { blankCorrection } from "@/lib/agent/exam-gate";
import type { ExamItem } from "@/lib/agent/types";

// P1 of the mega-update: exam outcomes land on the FSRS schedule.
//
// Before this module, api/exam/grade fed the mastery ledger, the mistake
// families and the per-skill level engine, then stopped - the FSRS scheduler
// never heard about anything proven or broken in an exam. A vocab item the
// learner bombed left its card untouched; a card due that day stayed due even
// though the exam just proved the learner knows it. This bridge closes that
// loop with the same honesty rules as everywhere else in the app:
//
//   - Real deck cards are resolved DETERMINISTICALLY from the item's answer
//     (answer / en / alt match, case-insensitive). No fuzzy guessing.
//   - Tagged items with no deck match become synthetic healing cards in the
//     "exam:<tag>" namespace, rendered at queue time from the family's own
//     recorded "wrong -> right" evidence (same blanking heuristic as the exam
//     gate - one source of truth for what the correction is).
//   - Untagged items with no deck match schedule nothing. No invention.
//   - Several items hitting the same card in one exam merge into ONE outcome
//     with the WORST grade, so a single exam can never inflate stability
//     twice from two items testing the same word.
//   - Grades are honest: correct = 3 (a plain retrieval success - an exam
//     gives no confidence signal, so never 4), wrong = 1.

export const EXAM_CARD_PREFIX = "exam:";
export const LISTEN_CARD_PREFIX = "listen:";

export interface ExamCardTarget {
  cardId: string;
  grade: number; // 3 correct, 1 wrong - the honest mapping
  tag?: string; // the family tag when resolved via the healing namespace
  via: "deck" | "family";
}

export interface ScheduledOutcome {
  cardId: string;
  due: number; // dayIndex the card is next due
  grade: number;
  via: "deck" | "family";
}

function normToken(s: string): string {
  return s.trim().toLowerCase().replace(/[.,!?;:]+$/, "");
}

// Pure resolver: which cards does this exam's final verdicts land on?
// verdicts must be FINAL (post AI-arbiter, post healing loop) - the caller in
// exam.ts runs this after every correction pass has had its say.
export function resolveExamCardTargets(
  items: ExamItem[],
  verdicts: { itemId: string; correct: boolean; given: string }[],
): ExamCardTarget[] {
  const merged = new Map<string, ExamCardTarget>();
  for (const it of items) {
    const v = verdicts.find((x) => x.itemId === it.id);
    if (!v) continue;
    // An unanswered item is no evidence either way - schedule nothing.
    if (!v.given.trim()) continue;
    const grade = v.correct ? 3 : 1;

    // Deterministic deck match: the item's key answer against the deck's
    // answer / en / alt fields. First match in deck order wins (stable).
    const key = normToken(it.a);
    let resolved: ExamCardTarget | null = null;
    if (key) {
      const deckHit = DECK.find(
        (c) =>
          normToken(c.answer) === key ||
          normToken(c.en) === key ||
          c.alt.some((a) => normToken(a) === key),
      );
      if (deckHit) resolved = { cardId: deckHit.id, grade, via: "deck" };
    }
    // Healing fallback: tagged items land in the exam:<tag> namespace.
    if (!resolved && it.tag) resolved = { cardId: `${EXAM_CARD_PREFIX}${it.tag}`, grade, tag: it.tag, via: "family" };
    if (!resolved) continue;

    const prev = merged.get(resolved.cardId);
    // Worst grade wins: one exam, one card, one honest outcome.
    if (!prev || resolved.grade < prev.grade) merged.set(resolved.cardId, { ...resolved, grade });
  }
  return [...merged.values()];
}

// Write the resolved outcomes through the SAME FSRS pipe the review route
// uses. No arcade calls here on purpose: exam XP/misses are already awarded
// by the exam route - scheduling is evidence capture, not a second reward.
// source marks the ReviewLog provenance: "exam" (P1) or "dictation" (P4).
export async function scheduleExamOutcomes(
  targets: ExamCardTarget[],
  source: "exam" | "dictation" | "shadow" = "exam",
): Promise<ScheduledOutcome[]> {
  if (targets.length === 0) return [];
  const l = await getLearner();
  const u = await contentUserId();
  const today = dayIndex();
  const out: ScheduledOutcome[] = [];
  for (const t of targets) {
    const row = await db.cardState.findUnique({ where: { userId_cardId: { userId: u, cardId: t.cardId } } });
    // Suspended cards keep their suspension - the learner opted out.
    if (row?.suspended) continue;
    const st: FsrsState = row
      ? { s: row.s, d: row.d, due: row.due, last: row.last, lapses: row.lapses, reps: row.reps, state: row.state, lastivl: row.lastivl }
      : defaultState();
    const res = review(st, t.grade, today, l.retention);
    const f = res.fsrs;
    await db.cardState.upsert({
      where: { userId_cardId: { userId: u, cardId: t.cardId } },
      create: { userId: u, cardId: t.cardId, s: f.s, d: f.d, due: f.due, last: f.last, lapses: f.lapses, reps: f.reps, state: f.state, lastivl: f.lastivl, dir: "" },
      update: { s: f.s, d: f.d, due: f.due, last: f.last, lapses: f.lapses, reps: f.reps, state: f.state, lastivl: f.lastivl },
    });
    await db.reviewLog.create({ data: { cardId: t.cardId, grade: t.grade, ivl: res.ivl, day: today, source, userId: u } });
    out.push({ cardId: t.cardId, due: res.due, grade: t.grade, via: t.via });
  }
  return out;
}

// Deterministic deck resolution for a single token: the deck card whose
// answer / en / alt equals it, first in deck order. Shared by the dictation
// route so a slipped word that IS a deck word schedules the REAL card.
export function deckCardForToken(token: string): Card | null {
  const key = normToken(token);
  if (!key) return null;
  return (
    DECK.find(
      (c) =>
        normToken(c.answer) === key ||
        normToken(c.en) === key ||
        c.alt.some((a) => normToken(a) === key),
    ) ?? null
  );
}

// Render a synthetic healing card at queue time from the family's own
// evidence. Handles BOTH namespaces the FSRS bridge writes:
//   exam:<tag>    - a tagged exam miss resurfacing
//   listen:<tok>  - a dictation/read-aloud slip resurfacing
// kind "sent" on purpose: its retrieval directions are cloze + audio only,
// which is all an evidence-derived card can honestly offer (no Farsi field
// exists for it, so fa2en/reverse would be fake).
export async function derivedExamCard(cardId: string): Promise<Card | null> {
  const prefix = [EXAM_CARD_PREFIX, LISTEN_CARD_PREFIX].find((p) => cardId.startsWith(p));
  if (!prefix) return null;
  const tag = cardId.slice(prefix.length);
  if (!tag) return null;
  const u = await contentUserId().catch(() => "me");
  const family = await db.mistakeFamily.findFirst({
    where: { userId: u, tag, OR: [{ resolvedAt: null }, { resolvedAt: { gt: new Date(0) } }] },
    orderBy: [{ resolvedAt: "asc" }, { updatedAt: "desc" }],
  });
  if (!family) return null;
  const blanked = blankCorrection(family.evidence);
  if (!blanked) return null;
  return {
    id: cardId,
    unit: prefix === LISTEN_CARD_PREFIX ? "listen_healing" : "exam_healing",
    skill: family.kind, // where the miss happened: exam | listen | writing | chat | ...
    level: "trap",
    kind: "sent",
    prompt: blanked.prompt,
    answer: blanked.answer,
    alt: [blanked.answer.toLowerCase()],
    en: blanked.prompt.replace("___", blanked.answer),
    fa: "",
    note: `${prefix === LISTEN_CARD_PREFIX ? "Listening slip" : "Healing target"}: ${family.label}. Resurfaced from your own recorded miss.`,
    traps: [],
    distractors: [],
  };
}
