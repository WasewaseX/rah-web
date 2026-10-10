// Deep assessment skill: reads every signal the app has, weighs grammar,
// vocabulary, and production separately, then sets a level for each and one
// overall. Slow on purpose: several focused passes beat one rushed guess.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import {
  grammarAssessSystem,
  vocabAssessSystem,
  productionAssessSystem,
  assessSynthesisSystem,
} from "./prompts";
import type { Assessment, SkillLevel } from "./types";

export interface AssessCtx {
  profile: ProfileJson;
  emit: (step: { label: string; state: "run" | "done"; detail?: string }) => void;
}

interface DimResult {
  level: string;
  score10?: number;
  note?: string;
  signals?: { trap?: string; seen?: boolean }[];
}

function clean(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").trim();
}

// ---------- evidence gathering (all local, no network) ----------

async function grammarEvidence(): Promise<string> {
  const logs = await db.reviewLog.findMany({ where: { grade: 1 }, orderBy: { id: "desc" }, take: 30 });
  const { cardById } = await import("@/lib/content");
  const trapCount = new Map<string, number>();
  for (const r of logs) {
    const c = cardById(r.cardId);
    if (!c) continue;
    for (const t of c.traps) trapCount.set(t, (trapCount.get(t) ?? 0) + 1);
  }
  const msgs = await db.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "desc" }, take: 40 });
  const corrections: string[] = [];
  for (const m of msgs) {
    try {
      const j = JSON.parse(m.content) as { corrections?: { wrong: string; right: string; trap?: string }[] };
      for (const c of j.corrections ?? []) {
        corrections.push(`${c.wrong} -> ${c.right}${c.trap && c.trap !== "none" ? ` [${c.trap}]` : ""}`);
      }
    } catch {
      // legacy or unparsable row; skip
    }
  }
  const states = await db.cardState.findMany({ where: { lapses: { gt: 0 } }, orderBy: { lapses: "desc" }, take: 10 });
  const lapses = states.map((s) => `${s.cardId}: ${s.lapses} lapses / ${s.reps} reps`).join("; ");
  const trapLine = [...trapCount.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} x${n}`).join(", ") || "none";
  return [
    `Recurring review trap tags (last ${logs.length} lapses): ${trapLine}`,
    `Recent corrections from live practice (newest first, max 15): ${corrections.slice(0, 15).join(" | ") || "none"}`,
    `Cards with the most lapses: ${lapses || "none"}`,
  ].join("\n");
}

async function vocabEvidence(): Promise<string> {
  const states = await db.cardState.findMany({ where: { state: { not: "new" } } });
  const { cardById } = await import("@/lib/content");
  const bySkill = new Map<string, { reps: number; lapses: number; ok: number }>();
  for (const s of states) {
    const c = cardById(s.cardId);
    if (!c) continue;
    const row = bySkill.get(c.skill) ?? { reps: 0, lapses: 0, ok: 0 };
    row.reps += s.reps;
    row.lapses += s.lapses;
    if (s.reps > s.lapses) row.ok += 1;
    bySkill.set(c.skill, row);
  }
  const skills = [...bySkill.entries()].map(([k, v]) => `${k}: ${v.ok} held, ${v.lapses} lapses over ${v.reps} reps`).join("; ");
  const writes = await db.writingSub.findMany({ orderBy: { id: "desc" }, take: 3 });
  const upgrades: string[] = [];
  for (const w of writes) {
    try {
      const j = JSON.parse(w.result) as { upgrades?: { plain: string; c1: string }[]; scores?: Record<string, number> };
      for (const u of j.upgrades ?? []) upgrades.push(`${u.plain} -> ${u.c1}`);
    } catch { /* skip */ }
  }
  return [
    `Deck performance by skill: ${skills || "no reviews yet"}`,
    `Vocabulary upgrades already suggested in writing feedback (max 8): ${upgrades.slice(0, 8).join(" | ") || "none"}`,
    `Deck size seen so far: ${states.length} cards in rotation`,
  ].join("\n");
}

async function productionEvidence(): Promise<string> {
  const writes = await db.writingSub.findMany({ orderBy: { id: "desc" }, take: 3 });
  const speaks = await db.speakSession.findMany({ orderBy: { id: "desc" }, take: 3 });
  const parts: string[] = [];
  for (const w of writes) {
    let scores = "unread scores";
    let level = "?";
    try {
      const j = JSON.parse(w.result) as { level?: string; scores?: Record<string, number>; verdict?: string };
      scores = JSON.stringify(j.scores ?? {});
      level = j.level ?? "?";
    } catch { /* skip */ }
    parts.push(`WRITING (${w.at.toISOString().slice(0, 10)}, band ${level}, scores ${scores}): ${w.text.slice(0, 500)}`);
  }
  for (const s of speaks) {
    let scores = "unread scores";
    try {
      const j = JSON.parse(s.result) as { scores?: Record<string, number> };
      scores = JSON.stringify(j.scores ?? {});
    } catch { /* skip */ }
    parts.push(`SPOKEN (round ${s.round}, scores ${scores}): ${s.transcript.slice(0, 400)}`);
  }
  return parts.join("\n\n") || "No writing or speaking submissions recorded yet.";
}

// ---------- the pipeline ----------

const BANDS = new Set(["B1", "B1+", "B2", "B2+", "C1"]);

function safeDim(r: DimResult, fallback: string): SkillLevel {
  return {
    skill: "",
    level: BANDS.has(r.level ?? "") ? r.level : fallback,
    score10: Math.max(1, Math.min(10, Math.round(Number(r.score10 ?? 6)) || 6)),
    note: clean(String(r.note ?? "")).slice(0, 220),
  };
}

export async function deepAssess(ctx: AssessCtx): Promise<Assessment> {
  ctx.emit({ label: "Gathering everything you have done here", state: "run" });
  const [grammar, vocab, production] = await Promise.all([grammarEvidence(), vocabEvidence(), productionEvidence()]);
  const evd = [grammar.length, vocab.length, production.length];
  ctx.emit({
    label: "Gathering everything you have done here",
    state: "done",
    detail: `${evd[0] + evd[1] + evd[2]} characters of real activity data`,
  });

  ctx.emit({ label: "Analyzing grammar and accuracy", state: "run" });
  const grammarRes = await aiJson<DimResult>(
    grammarAssessSystem(ctx.profile, grammar),
    [{ role: "user", content: "Assess now." }],
    undefined,
    { deep: true },
  ).catch(() => ({ level: ctx.profile.level, score10: 5, note: "Analysis did not complete; level held." } as DimResult));
  ctx.emit({ label: "Analyzing grammar and accuracy", state: "done", detail: `band ${grammarRes.level}` });

  ctx.emit({ label: "Analyzing vocabulary and range", state: "run" });
  const vocabRes = await aiJson<DimResult>(
    vocabAssessSystem(ctx.profile, vocab),
    [{ role: "user", content: "Assess now." }],
    undefined,
    { deep: true },
  ).catch(() => ({ level: ctx.profile.level, score10: 5, note: "Analysis did not complete; level held." } as DimResult));
  ctx.emit({ label: "Analyzing vocabulary and range", state: "done", detail: `band ${vocabRes.level}` });

  ctx.emit({ label: "Analyzing writing and speaking", state: "run" });
  const prodRes = await aiJson<DimResult>(
    productionAssessSystem(ctx.profile, production),
    [{ role: "user", content: production === "No writing or speaking submissions recorded yet."
        ? "No production samples exist yet. Say so in the note and give the level you can infer from the other evidence, at lower confidence."
        : "Assess now." }],
    undefined,
    { deep: true },
  ).catch(() => ({ level: ctx.profile.level, score10: 4, note: "Analysis did not complete; level held." } as DimResult));
  ctx.emit({ label: "Analyzing writing and speaking", state: "done", detail: `band ${prodRes.level}` });

  ctx.emit({ label: "Setting your levels", state: "run" });
  const previous = ctx.profile.level;
  const parts = [
    `GRAMMAR: ${JSON.stringify(grammarRes)}`,
    `VOCABULARY: ${JSON.stringify(vocabRes)}`,
    `PRODUCTION: ${JSON.stringify(prodRes)}`,
  ].join("\n");
  const synthesis = await aiJson<{
    overall: string; confidence: number; evidence: string[]; plan: string[]; fa_note: string;
  }>(
    assessSynthesisSystem(ctx.profile, previous, parts),
    [{ role: "user", content: "Synthesize now." }],
    undefined,
    { deep: true },
  );

  const skills: SkillLevel[] = [
    { ...safeDim(grammarRes, previous), skill: "grammar" },
    { ...safeDim(vocabRes, previous), skill: "vocabulary" },
    { ...safeDim(prodRes, previous), skill: "production" },
  ];
  const overall = BANDS.has(synthesis.overall ?? "") ? synthesis.overall : previous;

  const assessment: Assessment = {
    overall,
    previous,
    confidence: Math.max(0.1, Math.min(0.95, Number(synthesis.confidence ?? 0.6)) || 0.6),
    skills,
    evidence: (synthesis.evidence ?? []).map((e) => clean(String(e)).slice(0, 180)).slice(0, 5),
    plan: (synthesis.plan ?? []).map((e) => clean(String(e)).slice(0, 180)).slice(0, 3),
    fa_note: clean(String(synthesis.fa_note ?? "")).slice(0, 300),
  };

  // Persist: per-skill levels on the learner, overall becomes the working level.
  const levelsJson: Record<string, string> = {};
  for (const s of skills) levelsJson[s.skill] = s.level;
  levelsJson.overall = overall;
  levelsJson.measuredAt = new Date().toISOString();
  await db.learner.update({
    where: { id: "me" },
    data: { level: overall === "?" ? undefined : overall, skillLevels: JSON.stringify(levelsJson) },
  }).catch(() => db.learner.upsert({
    where: { id: "me" },
    update: { level: overall === "?" ? undefined : overall, skillLevels: JSON.stringify(levelsJson) },
    create: { id: "me", level: overall, skillLevels: JSON.stringify(levelsJson) },
  }));

  ctx.emit({ label: "Setting your levels", state: "done", detail: `overall ${overall}` });
  return assessment;
}
