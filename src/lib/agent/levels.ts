// Per-skill CEFR bands. Grammar can be C1 while speaking is B1; the app now
// says so. One rolling mastery score per skill, one band derived from it, one
// overall band computed as the weighted mean across measured skills.

import { db } from "@/lib/db";
import type { SkillLevelRow, AssessmentPayload } from "./types";

export const MEASURED_SKILLS = ["grammar", "vocabulary", "writing", "speaking", "reading", "listening"] as const;
export type MeasuredSkill = (typeof MEASURED_SKILLS)[number];

function band(score: number): string {
  if (score >= 0.85) return "C1";
  if (score >= 0.7) return "B2+";
  if (score >= 0.45) return "B2";
  if (score >= 0.25) return "B1";
  return "A2";
}

function overallBand(rows: SkillLevelRow[]): string {
  const measured = rows.filter((r) => r.samples > 0);
  if (measured.length === 0) return "?";
  const avg = measured.reduce((s, r) => s + r.score, 0) / measured.length;
  return band(avg);
}

export async function getSkillLevels(): Promise<SkillLevelRow[]> {
  const rows = await db.skillLevel.findMany();
  const byId = new Map(rows.map((r) => [r.skill, r]));
  return MEASURED_SKILLS.map((skill) => {
    const r = byId.get(skill);
    return {
      skill,
      level: r?.level ?? "?",
      score: r?.score ?? 0,
      samples: r?.samples ?? 0,
    };
  });
}

// Rolling update: new evidence nudges the mastery score, never nukes it.
// alpha grows with samples so early evidence moves fast, later evidence moves slow.
export async function updateSkillLevels(evidence: { skill: string; score: number; samples: number }[]) {
  for (const ev of evidence) {
    if (!/^(grammar|vocabulary|writing|speaking|reading|listening)$/.test(ev.skill)) continue;
    if (ev.samples <= 0) continue;
    const existing = await db.skillLevel.findUnique({ where: { skill: ev.skill } });
    const prevScore = existing?.score ?? 0.5;
    const prevSamples = existing?.samples ?? 0;
    const total = prevSamples + ev.samples;
    const alpha = Math.max(0.2, 1 - prevSamples / (prevSamples + ev.samples + 4));
    const score = Math.min(1, Math.max(0, prevScore * (1 - alpha) + ev.score * alpha));
    await db.skillLevel.upsert({
      where: { skill: ev.skill },
      create: { skill: ev.skill, score, level: band(score), samples: total },
      update: { score, level: band(score), samples: total },
    });
  }
}

export async function buildAssessment(note: string): Promise<AssessmentPayload> {
  const skills = await getSkillLevels();
  return { overall: overallBand(skills), skills, note };
}

// Human line describing the spread, used by the assessor skills.
export function spreadLine(rows: SkillLevelRow[]): string {
  const measured = rows.filter((r) => r.samples > 0);
  if (measured.length === 0) return "No skill has been measured yet.";
  const best = [...measured].sort((a, b) => b.score - a.score)[0];
  const worst = [...measured].sort((a, b) => a.score - b.score)[0];
  if (best.skill === worst.skill) return `Only ${best.skill} has data so far.`;
  return `${best.skill} is your strongest band, ${worst.skill} is the drag.`;
}
