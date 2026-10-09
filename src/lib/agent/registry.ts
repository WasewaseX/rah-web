// The revived registry. 22 live skills; the planner routes into this table.

import type { SkillDef, SkillId } from "./types";
import { CORE_SKILLS } from "./skills-core";
import { POWER_SKILLS } from "./skills-power";

export const REGISTRY: SkillDef[] = [...POWER_SKILLS, ...CORE_SKILLS];

export function getSkill(id: string): SkillDef | undefined {
  return REGISTRY.find((s) => s.id === id);
}

export function hasSkill(id: string): id is SkillId {
  return REGISTRY.some((s) => s.id === id);
}

export function skillCatalog(): string {
  return REGISTRY.map((s) => `- ${s.id}: ${s.name} (${s.oneLiner})`).join("\n");
}

export function commandMap(): Map<string, SkillDef> {
  const m = new Map<string, SkillDef>();
  for (const s of REGISTRY) for (const c of s.commands) m.set(c, s);
  return m;
}
