// The next-best-action selector - the deterministic brain of the coach.
//
// The AI Director words the plan; this engine DECIDES it. Every input is
// measured, every output carries its reason, and ordering is a fixed
// priority ladder - so the learner's next move never depends on the LLM's
// mood. Actions: review (due FSRS cards), drill (statistically weak tags),
// test (hunt mistake families / close near-healed ones), teach (weakest
// measured skill band), unlock (closest curriculum gate).

import { db } from "@/lib/db";
import { dueCount, getLearner } from "@/lib/server";
import { contentUserId } from "@/lib/scope";
import { getMasteryView, type TagMasteryRow } from "@/lib/mastery";
import { getSkillLevels } from "@/lib/agent/levels";
import { computeCurriculum } from "@/lib/curriculum";

export type NextActionKind = "review" | "drill" | "test" | "teach" | "unlock";

export interface NextAction {
  action: NextActionKind;
  target: string;
  reason: string;
  urgency: number; // 0..1, descending order in the output
  command: string; // what to tell the coach to do it
}

const DANGER_URGENCY = (wilson: number) => Math.min(0.95, 0.6 + (0.45 - wilson) * 0.8);

export async function nextBestActions(): Promise<NextAction[]> {
  const u = await contentUserId().catch(() => "me");
  const [learner, due, mastery, skills, families] = await Promise.all([
    getLearner(),
    dueCount(),
    getMasteryView(),
    getSkillLevels(),
    db.mistakeFamily.findMany({ where: { userId: u, resolvedAt: null }, orderBy: [{ count: "desc" }, { lastSeen: "desc" }] }),
  ]);

  const actions: NextAction[] = [];

  // 1. Review debt: due FSRS cards. Full deck due = the day's first move.
  if (due > 0) {
    const urgency = due >= learner.dailyGoal ? 0.98 : due >= 10 ? 0.85 : 0.65;
    actions.push({
      action: "review",
      target: `${due} card${due === 1 ? "" : "s"} due`,
      reason: due >= learner.dailyGoal ? "your whole daily queue is waiting" : "the scheduler says these are fading now",
      urgency,
      command: "Open review and clear my due cards",
    });
  }

  // 2. Danger tags: Wilson bound says the weakness is REAL, not bad luck.
  //    Drill beats test here - the tag needs volume, not discovery.
  const dangerRows: TagMasteryRow[] = mastery.tags.filter((t) => t.status === "danger");
  for (const t of dangerRows.slice(0, 2)) {
    actions.push({
      action: "drill",
      target: t.tag,
      reason: `${Math.round(t.wilson * 100)}% proven mastery across ${t.samples} attempts`,
      urgency: DANGER_URGENCY(t.wilson),
      command: `Drill me hard on ${t.tag.replace(/[_-]/g, " ")} until it sticks`,
    });
  }

  // 3. Near-healed families: one clean hit from retirement. Cheapest win
  //    on the board - finishing them stops them steering every prompt.
  const nearHealed = families.filter((f) => f.streakClean >= 1);
  if (nearHealed.length) {
    const f = nearHealed[0];
    actions.push({
      action: "test",
      target: f.tag,
      reason: `${f.streakClean === 1 ? "one" : f.streakClean} clean hit${f.streakClean === 1 ? "" : "s"} from retiring this family`,
      urgency: 0.72,
      command: `Give me a quick test on ${f.tag.replace(/[_-]/g, " ")} to close it out`,
    });
  }

  // 4. Fragile tags: solid record, falling lately. Review before it lands
  //    in danger.
  for (const tag of mastery.fragile.slice(0, 1)) {
    actions.push({
      action: "review",
      target: tag,
      reason: "recent form is slipping against a solid record",
      urgency: 0.6,
      command: `Review ${tag.replace(/[_-]/g, " ")} - I am slipping on it`,
    });
  }

  // 5. Hot unresolved families with no clean hits yet: the examiner's
  //    top-3 weakness quota already hunts these; surface the biggest.
  const hot = families.filter((f) => f.streakClean === 0 && f.count >= 2 && !dangerRows.some((d) => d.tag === f.tag));
  if (hot.length) {
    const f = hot[0];
    actions.push({
      action: "test",
      target: f.tag,
      reason: `missed ${f.count}x and never once answered it clean`,
      urgency: 0.58,
      command: `Make an exam that hunts ${f.tag.replace(/[_-]/g, " ")}`,
    });
  }

  // 6. Weakest measured skill band: the teach move. Only when nothing
  //    above fired - teaching follows triage.
  const measured = skills.filter((s) => s.samples > 0).sort((a, b) => a.score - b.score);
  if (measured.length && actions.length < 3) {
    const w = measured[0];
    actions.push({
      action: "teach",
      target: w.skill,
      reason: `weakest measured band: ${w.level} (${Math.round(w.score * 100)}%)`,
      urgency: 0.45,
      command: `Teach me something new in ${w.skill}`,
    });
  }

  // 7. Curriculum frontier (feature #2): the closest unproven gate on the
  //    B2->B2+->C1 map. Pure evidence math - same Wilson-bound ledger the
  //    Progress page shows. Lowest urgency: the map guides when triage is
  //    quiet, never overrides debt or danger.
  if (actions.length < 4) {
    const curriculum = computeCurriculum(
      mastery.tags.map((t) => ({ tag: t.tag, ok: t.ok, no: t.no, ewma: t.ewma })),
      skills.map((s) => ({ skill: s.skill, score: s.score, samples: s.samples })),
    );
    const frontier = curriculum.summary.frontier;
    if (frontier) {
      const unmet = frontier.evidence.find((e) => !e.proven);
      actions.push({
        action: "unlock",
        target: frontier.node.title,
        reason: unmet ? `closest gate on your curriculum map: ${unmet.detail}` : `closest gate on your curriculum map: ${frontier.node.blurb}`,
        urgency: 0.4,
        command: `Help me work toward ${frontier.node.title}`,
      });
    }
  }

  return actions.sort((a, b) => b.urgency - a.urgency).slice(0, 4);
}
