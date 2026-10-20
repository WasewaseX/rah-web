module.exports = [
"[project]/src/lib/agent/levels.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MEASURED_SKILLS",
    ()=>MEASURED_SKILLS,
    "buildAssessment",
    ()=>buildAssessment,
    "getSkillLevels",
    ()=>getSkillLevels,
    "spreadLine",
    ()=>spreadLine,
    "updateSkillLevels",
    ()=>updateSkillLevels
]);
// Per-skill CEFR bands. Grammar can be C1 while speaking is B1; the app now
// says so. One rolling mastery score per skill, one band derived from it, one
// overall band computed as the weighted mean across measured skills.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
const MEASURED_SKILLS = [
    "grammar",
    "vocabulary",
    "writing",
    "speaking",
    "reading",
    "listening"
];
function band(score) {
    if (score >= 0.85) return "C1";
    if (score >= 0.7) return "B2+";
    if (score >= 0.45) return "B2";
    if (score >= 0.25) return "B1";
    return "A2";
}
function overallBand(rows) {
    const measured = rows.filter((r)=>r.samples > 0);
    if (measured.length === 0) return "?";
    const avg = measured.reduce((s, r)=>s + r.score, 0) / measured.length;
    return band(avg);
}
async function getSkillLevels() {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].skillLevel.findMany();
    const byId = new Map(rows.map((r)=>[
            r.skill,
            r
        ]));
    return MEASURED_SKILLS.map((skill)=>{
        const r = byId.get(skill);
        return {
            skill,
            level: r?.level ?? "?",
            score: r?.score ?? 0,
            samples: r?.samples ?? 0
        };
    });
}
async function updateSkillLevels(evidence) {
    for (const ev of evidence){
        if (!/^(grammar|vocabulary|writing|speaking|reading|listening)$/.test(ev.skill)) continue;
        if (ev.samples <= 0) continue;
        const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].skillLevel.findUnique({
            where: {
                skill: ev.skill
            }
        });
        const prevScore = existing?.score ?? 0.5;
        const prevSamples = existing?.samples ?? 0;
        const total = prevSamples + ev.samples;
        const alpha = Math.max(0.2, 1 - prevSamples / (prevSamples + ev.samples + 4));
        const score = Math.min(1, Math.max(0, prevScore * (1 - alpha) + ev.score * alpha));
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].skillLevel.upsert({
            where: {
                skill: ev.skill
            },
            create: {
                skill: ev.skill,
                score,
                level: band(score),
                samples: total
            },
            update: {
                score,
                level: band(score),
                samples: total
            }
        });
    }
}
async function buildAssessment(note) {
    const skills = await getSkillLevels();
    return {
        overall: overallBand(skills),
        skills,
        note
    };
}
function spreadLine(rows) {
    const measured = rows.filter((r)=>r.samples > 0);
    if (measured.length === 0) return "No skill has been measured yet.";
    const best = [
        ...measured
    ].sort((a, b)=>b.score - a.score)[0];
    const worst = [
        ...measured
    ].sort((a, b)=>a.score - b.score)[0];
    if (best.skill === worst.skill) return `Only ${best.skill} has data so far.`;
    return `${best.skill} is your strongest band, ${worst.skill} is the drag.`;
}
}),
"[project]/src/lib/next-best.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "nextBestActions",
    ()=>nextBestActions
]);
// The next-best-action selector - the deterministic brain of the coach.
//
// The AI Director words the plan; this engine DECIDES it. Every input is
// measured, every output carries its reason, and ordering is a fixed
// priority ladder - so the learner's next move never depends on the LLM's
// mood. Actions: review (due FSRS cards), drill (statistically weak tags),
// test (hunt mistake families / close near-healed ones), teach (weakest
// measured skill band).
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mastery.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/levels.ts [app-route] (ecmascript)");
;
;
;
;
const DANGER_URGENCY = (wilson)=>Math.min(0.95, 0.6 + (0.45 - wilson) * 0.8);
async function nextBestActions() {
    const [learner, due, mastery, skills, families] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dueCount"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getMasteryView"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkillLevels"])(),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.findMany({
            where: {
                resolvedAt: null
            },
            orderBy: [
                {
                    count: "desc"
                },
                {
                    lastSeen: "desc"
                }
            ]
        })
    ]);
    const actions = [];
    // 1. Review debt: due FSRS cards. Full deck due = the day's first move.
    if (due > 0) {
        const urgency = due >= learner.dailyGoal ? 0.98 : due >= 10 ? 0.85 : 0.65;
        actions.push({
            action: "review",
            target: `${due} card${due === 1 ? "" : "s"} due`,
            reason: due >= learner.dailyGoal ? "your whole daily queue is waiting" : "the scheduler says these are fading now",
            urgency,
            command: "Open review and clear my due cards"
        });
    }
    // 2. Danger tags: Wilson bound says the weakness is REAL, not bad luck.
    //    Drill beats test here - the tag needs volume, not discovery.
    const dangerRows = mastery.tags.filter((t)=>t.status === "danger");
    for (const t of dangerRows.slice(0, 2)){
        actions.push({
            action: "drill",
            target: t.tag,
            reason: `${Math.round(t.wilson * 100)}% proven mastery across ${t.samples} attempts`,
            urgency: DANGER_URGENCY(t.wilson),
            command: `Drill me hard on ${t.tag.replace(/[_-]/g, " ")} until it sticks`
        });
    }
    // 3. Near-healed families: one clean hit from retirement. Cheapest win
    //    on the board - finishing them stops them steering every prompt.
    const nearHealed = families.filter((f)=>f.streakClean >= 1);
    if (nearHealed.length) {
        const f = nearHealed[0];
        actions.push({
            action: "test",
            target: f.tag,
            reason: `${f.streakClean === 1 ? "one" : f.streakClean} clean hit${f.streakClean === 1 ? "" : "s"} from retiring this family`,
            urgency: 0.72,
            command: `Give me a quick test on ${f.tag.replace(/[_-]/g, " ")} to close it out`
        });
    }
    // 4. Fragile tags: solid record, falling lately. Review before it lands
    //    in danger.
    for (const tag of mastery.fragile.slice(0, 1)){
        actions.push({
            action: "review",
            target: tag,
            reason: "recent form is slipping against a solid record",
            urgency: 0.6,
            command: `Review ${tag.replace(/[_-]/g, " ")} - I am slipping on it`
        });
    }
    // 5. Hot unresolved families with no clean hits yet: the examiner's
    //    top-3 weakness quota already hunts these; surface the biggest.
    const hot = families.filter((f)=>f.streakClean === 0 && f.count >= 2 && !dangerRows.some((d)=>d.tag === f.tag));
    if (hot.length) {
        const f = hot[0];
        actions.push({
            action: "test",
            target: f.tag,
            reason: `missed ${f.count}x and never once answered it clean`,
            urgency: 0.58,
            command: `Make an exam that hunts ${f.tag.replace(/[_-]/g, " ")}`
        });
    }
    // 6. Weakest measured skill band: the teach move. Only when nothing
    //    above fired - teaching follows triage.
    const measured = skills.filter((s)=>s.samples > 0).sort((a, b)=>a.score - b.score);
    if (measured.length && actions.length < 3) {
        const w = measured[0];
        actions.push({
            action: "teach",
            target: w.skill,
            reason: `weakest measured band: ${w.level} (${Math.round(w.score * 100)}%)`,
            urgency: 0.45,
            command: `Teach me something new in ${w.skill}`
        });
    }
    return actions.sort((a, b)=>b.urgency - a.urgency).slice(0, 4);
}
}),
];

//# sourceMappingURL=src_lib_45f9a83b._.js.map