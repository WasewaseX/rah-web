// Repair-drill generator. Where the exam engine's freshness moderator bans
// recycled teaching points, this generator does the opposite on purpose: it
// takes the learner's actual misses and rebuilds the SAME teaching points in
// FRESH sentences. That is the remediation loop - miss, get coached, prove
// you learned it under new wording. The ban list here covers only the old
// sentences themselves, never the answer keys.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ExamItem, ExamSpec, ExamClient, StepTrace } from "./types";
import type { ProfileJson } from "@/lib/ai";

export interface DrillPoint {
  point: string; // the teaching point, e.g. "equip students with (collocation)"
  wrong?: string; // what the learner produced
  right?: string; // the target form
  tag?: string; // mistake-family tag when known
  skill?: string; // grammar | vocabulary | collocation | ...
}

interface DrillRaw {
  title?: string;
  items?: { type?: string; skill?: string; q?: string; choices?: string[]; a?: string; accept?: string[]; mustInclude?: string[]; why?: string; tag?: string }[];
}

const VALID_SKILLS = /^(grammar|vocabulary|collocation|writing|reading|listening)$/;

export async function generateRepairDrill(
  p: ProfileJson,
  points: DrillPoint[],
  emit: (l: string, d?: string) => void,
  title = "Repair drill",
): Promise<{ client: ExamClient; items: ExamItem[]; spec: ExamSpec } | null> {
  const clean = points
    .filter((pt) => pt.point.trim().length > 0)
    .slice(0, 6);
  if (clean.length === 0) return null;

  const count = Math.max(4, Math.min(8, clean.length + 2));
  const spec: ExamSpec = {
    level: p.level === "?" ? "B2" : p.level,
    targetSkills: [...new Set(clean.map((pt) => (VALID_SKILLS.test(String(pt.skill)) ? String(pt.skill) : "grammar")))],
    plannedCount: count,
    minutes: Math.max(4, Math.round(count * 0.9)),
    title,
    weakTags: [...new Set(clean.map((pt) => String(pt.tag ?? "").trim()).filter(Boolean))].slice(0, 3),
  };

  emit("Loading your misses", `${clean.length} teaching points to rebuild`);
  const system = `You are the repair coach inside Rah, an English app for Farsi speakers. The learner just missed these exact teaching points in an exam. Build ONE short drill that retests THE SAME teaching points in COMPLETELY FRESH sentences and situations.

The learner sits around ${spec.level}. Each drill item must force the learner to produce the missed pattern correctly in new wording - same point, new clothes. A wrong sentence frame, a new topic, but the identical gap being tested.

Items: exactly ${count}. Mix mcq, cloze, short and rewrite so the pattern shows up from different angles.

Rules:
- "skill" is exactly one of: ${spec.targetSkills.join(", ")}.
- ${spec.weakTags.length ? `Items rebuilding a tagged mistake family carry "tag" - exactly one of: ${spec.weakTags.join(", ")}. Others omit the field.` : "Omit any tag field."}
- "a" is the single best answer. "accept" lists 2 to 4 variants you would hand-grade as correct.
- rewrite items: "mustInclude" lists the target patterns that ALL must appear.
- "why" is one short English sentence (max 18 words) reteaching the point.
- No Farsi anywhere. Never use the em dash character.

Output ONE JSON object, nothing else:
{"title": "short drill title", "items": [{"type": "cloze", "skill": "grammar", "q": "", "choices": ["", "", "", ""], "a": "", "accept": [], "why": ""}]}

The teaching points to rebuild (treat every "learner wrote -> target" pair as the exact gap being retested):
${clean.map((pt, i) => `${i + 1}. ${pt.point}${pt.wrong ? ` (learner wrote: ${JSON.stringify(pt.wrong.slice(0, 120))} -> target: ${JSON.stringify(String(pt.right ?? "").slice(0, 120))})` : ""}${pt.tag ? ` [family: ${pt.tag}]` : ""}`).join("\n")}`;

  const raw = await aiJson<DrillRaw>(
    system,
    [{ role: "user", content: `Generate the ${count}-item repair drill now. Same points, fresh sentences.` }],
    () => ({}),
    { deep: false, temperature: 0.75 },
  );

  const items: ExamItem[] = [];
  const seen = new Set<string>();
  for (const r of raw.items ?? []) {
    const q = String(r.q ?? "").trim();
    const a = String(r.a ?? "").trim();
    if (!q || !a || seen.has(q)) continue;
    const type = (["mcq", "cloze", "short", "rewrite"] as const).includes(r.type as never) ? (r.type as ExamItem["type"]) : "cloze";
    if (type === "mcq" && (!Array.isArray(r.choices) || r.choices.length < 2)) continue;
    const skill = VALID_SKILLS.test(String(r.skill)) ? String(r.skill) : spec.targetSkills[0];
    if (!spec.targetSkills.includes(skill)) continue;
    const tag = spec.weakTags.includes(String(r.tag ?? "").trim().toLowerCase()) ? String(r.tag).trim().toLowerCase() : undefined;
    items.push({
      id: `i${items.length + 1}`,
      type,
      skill,
      q,
      choices: type === "mcq" ? r.choices!.map(String) : undefined,
      a,
      accept: Array.isArray(r.accept) ? r.accept.map(String).filter(Boolean).slice(0, 6) : [],
      mustInclude: Array.isArray(r.mustInclude) ? r.mustInclude.map(String).filter(Boolean) : [],
      mustNotInclude: [],
      why: String(r.why ?? "").trim() || "Rebuild of a point you missed.",
      tag,
    });
    seen.add(q);
  }
  if (items.length === 0) return null;

  const finalItems = items.slice(0, count).map((it, idx) => ({ ...it, id: `i${idx + 1}` }));
  spec.plannedCount = finalItems.length;

  const id = `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const drillTitle = String(raw.title ?? "").trim().slice(0, 60) || title;
  const client: ExamClient = {
    id,
    title: drillTitle,
    spec,
    count: finalItems.length,
    items: finalItems.map((it) => ({ id: it.id, type: it.type, skill: it.skill, q: it.q, choices: it.choices, tag: it.tag })),
  };
  await db.exam.create({
    data: { id, title: drillTitle, spec: JSON.stringify(spec), items: JSON.stringify(finalItems), status: "pending" },
  });
  emit("Drill ready", `${finalItems.length} items on your exact misses`);
  return { client, items: finalItems, spec };
}

export type { StepTrace };
