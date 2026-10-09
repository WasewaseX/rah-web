import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLACEMENT_ITEMS, type PlacementItem } from "@/lib/content";
import { aiJson, placementWritingSystem } from "@/lib/ai";
import { getLearner, bumpDaily } from "@/lib/server";

export const dynamic = "force-dynamic";

// Adaptive placement: four sections walked by a difficulty ladder
// (2 right in a row climb one rung, 1 miss drops one), then a writing
// sample graded by the built-in AI. Ported from crates/rah-core placement.rs.

const RUNGS = ["B1", "B2", "B2+", "C1"];
const SECTIONS = ["grammar", "vocab", "collocation", "reading"];
const PER_SECTION = 5;

interface Session {
  sec: string;
  idx: number;
  rung: number;
  streak: number;
  answers: { id: string; rung: string; correct: boolean; trap: string }[];
  asked: Record<string, boolean>;
  sectionScores: Record<string, number>;
}

function freshSession(): Session {
  return {
    sec: "grammar",
    idx: 0,
    rung: 1,
    streak: 0,
    answers: [],
    asked: {},
    sectionScores: {},
  };
}

function sectionItems(sec: string): PlacementItem[] {
  const order = (r: string) => Math.max(0, RUNGS.indexOf(r));
  return PLACEMENT_ITEMS.filter((it) => it.sec === sec).sort((a, b) => order(a.rung) - order(b.rung));
}

function pickItem(s: Session): PlacementItem | undefined {
  const secit = sectionItems(s.sec);
  const offs = [0, -1, 1, -2, 2, -3, 3];
  for (const o of offs) {
    const r = s.rung + o;
    if (r < 0 || r > 3) continue;
    for (const it of secit) {
      if (RUNGS[r] === it.rung && !s.asked[it.id]) return it;
    }
  }
  return undefined;
}

function sectionDone(s: Session): boolean {
  return s.idx >= PER_SECTION || !pickItem(s);
}

function pctToLevel(p: number): string {
  if (p >= 85) return "C1";
  if (p >= 70) return "B2+";
  if (p >= 45) return "B2";
  return "B1";
}

async function loadSession(): Promise<Session> {
  const row = await db.placement.findUnique({ where: { id: "main" } });
  if (!row) return freshSession();
  try {
    return JSON.parse(row.answers) as Session;
  } catch {
    return freshSession();
  }
}

async function saveSession(s: Session, phase: string) {
  await db.placement.upsert({
    where: { id: "main" },
    create: { id: "main", answers: JSON.stringify(s), phase },
    update: { answers: JSON.stringify(s), phase },
  });
}

async function readRow() {
  return db.placement.findUnique({ where: { id: "main" } });
}

export async function GET() {
  const l = await getLearner();
  const row = await readRow();
  const phase = row?.phase ?? "quiz";
  const s = await loadSession();
  if (phase !== "quiz") {
    return NextResponse.json({ phase, level: row?.level ?? "?", writingLevel: row?.writingLevel ?? "?", sectionScores: s.sectionScores });
  }
  const item = pickItem(s);
  if (!item) {
    // All sections exhausted: jump to writing.
    await saveSession(s, "writing");
    await db.learner.update({ where: { id: "me" }, data: { placementPhase: "writing" } });
    return NextResponse.json({ phase: "writing" });
  }
  return NextResponse.json({
    phase: "quiz",
    sec: s.sec,
    secIndex: SECTIONS.indexOf(s.sec),
    sections: SECTIONS.length,
    idx: s.idx,
    rung: RUNGS[Math.max(0, Math.min(3, s.rung))],
    item: { id: item.id, q: item.q, choices: item.choices },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = String(body.action ?? "");

  if (action === "start") {
    const s = freshSession();
    await saveSession(s, "quiz");
    await db.learner.update({ where: { id: "me" }, data: { placementPhase: "quiz" } });
    const item = pickItem(s)!;
    return NextResponse.json({
      phase: "quiz",
      sec: s.sec,
      secIndex: 0,
      sections: SECTIONS.length,
      idx: 0,
      rung: RUNGS[s.rung],
      item: { id: item.id, q: item.q, choices: item.choices },
    });
  }

  if (action === "answer") {
    const s = await loadSession();
    const item = PLACEMENT_ITEMS.find((i) => i.id === body.itemId);
    if (!item) return NextResponse.json({ error: "bad item" }, { status: 400 });
    const correct = item.a === body.choice;
    s.answers.push({ id: item.id, rung: item.rung, correct, trap: item.trap });
    s.asked[item.id] = true;
    if (correct) {
      s.streak += 1;
      if (s.streak >= 2) {
        s.streak = 0;
        s.rung = Math.min(3, s.rung + 1);
      }
    } else {
      s.streak = 0;
      s.rung = Math.max(0, s.rung - 1);
    }
    s.idx += 1;

    if (sectionDone(s)) {
      const secAnswers = s.answers.filter((a) => sectionOf(a.id) === s.sec);
      const right = secAnswers.filter((a) => a.correct).length;
      s.sectionScores[s.sec] = Math.floor((100 * right) / secAnswers.length + 0.5);
      const nextSec = SECTIONS.find((sec) => !(sec in s.sectionScores));
      if (!nextSec) {
        await saveSession(s, "writing");
        await db.learner.update({ where: { id: "me" }, data: { placementPhase: "writing" } });
        return NextResponse.json({ correct, phase: "writing" });
      }
      s.sec = nextSec;
      s.idx = 0;
      s.streak = 0;
      const item2 = pickItem(s);
      if (!item2) {
        await saveSession(s, "writing");
        await db.learner.update({ where: { id: "me" }, data: { placementPhase: "writing" } });
        return NextResponse.json({ correct, phase: "writing" });
      }
      await saveSession(s, "quiz");
      await bumpDaily("reviews");
      return NextResponse.json({
        correct,
        phase: "quiz",
        sec: s.sec,
        secIndex: SECTIONS.indexOf(s.sec),
        idx: s.idx,
        rung: RUNGS[Math.max(0, Math.min(3, s.rung))],
        item: { id: item2.id, q: item2.q, choices: item2.choices },
      });
    }

    const nextItem = pickItem(s);
    await saveSession(s, "quiz");
    await bumpDaily("reviews");
    return NextResponse.json({
      correct,
      phase: "quiz",
      sec: s.sec,
      secIndex: SECTIONS.indexOf(s.sec),
      idx: s.idx,
      rung: RUNGS[Math.max(0, Math.min(3, s.rung))],
      item: nextItem ? { id: nextItem.id, q: nextItem.q, choices: nextItem.choices } : null,
    });
  }

  if (action === "writing") {
    const text = String(body.text ?? "").trim();
    if (text.length < 40) return NextResponse.json({ error: "Write at least a few sentences." }, { status: 400 });
    type WRes = { level: string; confidence: number; reasons: string };
    const res = await aiJson<WRes>(placementWritingSystem(), [{ role: "user", content: text }]);
    const s = await loadSession();
    const g = s.sectionScores["grammar"] ?? 50;
    const v = s.sectionScores["vocab"] ?? 50;
    const r = s.sectionScores["reading"] ?? 50;
    const mcq = pctToLevel(Math.round(0.35 * g + 0.35 * v + 0.3 * r));
    // Writing sample is the strongest single signal; MCQ is the cross-check.
    const finalLevel = RUNGS.indexOf(res.level) >= 0 ? res.level : mcq;
    await db.placement.upsert({
      where: { id: "main" },
      create: { id: "main", answers: JSON.stringify(s), phase: "done", level: finalLevel, writingLevel: res.level },
      update: { answers: JSON.stringify(s), phase: "done", level: finalLevel, writingLevel: res.level },
    });
    await db.learner.update({
      where: { id: "me" },
      data: { placementPhase: "done", level: finalLevel },
    });
    await bumpDaily("written");
    return NextResponse.json({ phase: "done", level: finalLevel, writingLevel: res.level, mcq, reasons: res.reasons, signals: (res as { signals?: unknown }).signals ?? [] });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

function sectionOf(itemId: string): string {
  return PLACEMENT_ITEMS.find((i) => i.id === itemId)?.sec ?? "";
}
