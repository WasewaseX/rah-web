module.exports = [
"[project]/src/lib/mastery.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "classifyTag",
    ()=>classifyTag,
    "getMasteryView",
    ()=>getMasteryView,
    "masteryWeakTags",
    ()=>masteryWeakTags,
    "normalizeTag",
    ()=>normalizeTag,
    "noteTagOutcome",
    ()=>noteTagOutcome
]);
// The mastery ledger - fine-grained half of the learner model.
//
// MistakeFamily answers "what does the learner keep getting wrong";
// TagMastery answers "how good are they at each trap tag, how sure are we,
// and which way is it moving". Together they are the central learner model
// we own: every graded surface feeds it, every coach surface reads it.
//
// Two statistics per tag, deliberately separate:
// - EWMA (stored): recency-weighted outcome estimate, alpha 0.35. Answers
//   "how is the learner doing lately" - a tag solved a month ago but missed
//   today reads low again.
// - Wilson lower bound (computed, never stored): a conservative success
//   rate with uncertainty folded in. 2/2 correct is NOT 100% mastery - the
//   bound says "at best 58%". This is what keeps three lucky answers from
//   retiring a weakness.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
const ALPHA = 0.35;
const Z = 1.96; // 95% Wilson interval
function normalizeTag(tag) {
    const t = String(tag ?? "").trim().toLowerCase().replace(/[^a-z_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    return t === "none" || t === "unknown" ? "" : t;
}
async function noteTagOutcome(tag, ok) {
    const t = normalizeTag(tag);
    if (!t) return;
    try {
        const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tagMastery.findUnique({
            where: {
                tag: t
            }
        });
        const prevEwma = existing?.ewma ?? 0.5;
        const ewma = prevEwma * (1 - ALPHA) + (ok ? 1 : 0) * ALPHA;
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tagMastery.upsert({
            where: {
                tag: t
            },
            create: {
                tag: t,
                ok: ok ? 1 : 0,
                no: ok ? 0 : 1,
                ewma,
                lastOk: ok ? new Date() : null,
                lastNo: ok ? null : new Date()
            },
            update: {
                ok: {
                    increment: ok ? 1 : 0
                },
                no: {
                    increment: ok ? 0 : 1
                },
                ewma,
                lastOk: ok ? new Date() : undefined,
                lastNo: ok ? undefined : new Date()
            }
        });
    } catch  {
    // The ledger must never break the surface that feeds it.
    }
}
function wilsonLower(ok, n) {
    if (n === 0) return 0;
    const p = ok / n;
    const denom = 1 + Z * Z / n;
    const centre = p + Z * Z / (2 * n);
    const spread = Z * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n));
    return Math.max(0, Math.min(1, (centre - spread) / denom));
}
function classifyTag(tag, ok, no, ewma) {
    const samples = ok + no;
    const raw = samples ? ok / samples : 0;
    const wilson = wilsonLower(ok, samples);
    // Trend: recent form (ewma) against the long-run record (raw). A tag whose
    // recent form clearly beats its average is recovering; clearly below is
    // slipping. The 0.12 gap keeps one-answer noise out of the arrow.
    const trend = samples < 2 ? "flat" : ewma - raw > 0.12 ? "rising" : raw - ewma > 0.12 ? "falling" : "flat";
    let status;
    if (samples < 3) status = "unproven";
    else if (wilson < 0.45) status = "danger";
    else if (trend === "falling" && ewma < 0.55) status = "fragile";
    else if (trend === "rising" || wilson >= 0.7) status = "rising";
    else status = "solid";
    return {
        tag,
        samples,
        ok,
        no,
        raw: Math.round(raw * 100) / 100,
        ewma: Math.round(ewma * 100) / 100,
        wilson: Math.round(wilson * 100) / 100,
        trend,
        status
    };
}
async function getMasteryView() {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tagMastery.findMany();
    const tags = rows.map((r)=>classifyTag(r.tag, r.ok, r.no, r.ewma)).sort((a, b)=>a.wilson - b.wilson || b.samples - a.samples);
    const danger = tags.filter((t)=>t.status === "danger").map((t)=>t.tag);
    const fragile = tags.filter((t)=>t.status === "fragile").map((t)=>t.tag);
    const solid = tags.filter((t)=>t.status === "rising" || t.status === "solid").map((t)=>t.tag);
    let summary = "No tag evidence yet - answer tagged exam items and the ledger fills itself.";
    if (tags.length) {
        const weakest = tags[0];
        const strongest = tags[tags.length - 1];
        const parts = [
            `${weakest.tag} is the leak (${Math.round(weakest.wilson * 100)}% proven)`
        ];
        if (strongest.tag !== weakest.tag) parts.push(`${strongest.tag} is holding (${Math.round(strongest.wilson * 100)}%)`);
        if (fragile.length) parts.push(`${fragile.join(", ")} slipping lately`);
        summary = parts.join("; ") + ".";
    }
    return {
        tags,
        danger,
        fragile,
        solid,
        summary
    };
}
async function masteryWeakTags() {
    const view = await getMasteryView();
    return [
        ...view.danger,
        ...view.fragile
    ].slice(0, 3);
}
}),
];

//# sourceMappingURL=src_lib_mastery_ts_e5e9d786._.js.map