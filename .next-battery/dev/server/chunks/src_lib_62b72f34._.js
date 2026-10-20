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
"[project]/src/lib/mistakes.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "foldPlacementMisses",
    ()=>foldPlacementMisses,
    "noteExamAnswer",
    ()=>noteExamAnswer,
    "recordMistakes",
    ()=>recordMistakes,
    "tagLabel",
    ()=>tagLabel,
    "topMistakes",
    ()=>topMistakes
]);
// Mistake memory. Every production correction (chat, essay, speaking) carries
// a trap tag from the Farsi-interference taxonomy; this module folds those
// tags into persistent families so a recurring weakness is visible to the
// tutor, the examiner and the progress page - and so practice hunts the leak
// instead of rediscovering it every session.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mastery.ts [app-route] (ecmascript)");
;
;
// How many consecutive correct answers on weakness-targeted exam items retire
// a family. Two clean hits under exam pressure is real evidence of healing.
const CLEAN_HITS_TO_RESOLVE = 2;
const TAG_LABELS = {
    statives: "Stative verbs used in continuous forms",
    articles: "Article misuse (a/an/the)",
    countability: "Countability (advice, information, furniture)",
    plurals: "Plural formation",
    copula: "Missing or wrong copula",
    prepositions: "Prepositions (dar covers in/at/on)",
    perfect: "Present perfect vs past simple",
    question_order: "Question word order",
    adjectives: "Adjective order or agreement",
    that_omission: "Omitted that in reported clauses",
    spelling: "Spelling",
    word_choice: "Word choice",
    register: "Register (formal vs casual)",
    conditional: "Conditionals (would have + participle)",
    fluency_illusion: "Trusting fluency: mistaking ease for learning"
};
function normalizeTag(raw) {
    return String(raw ?? "").trim().toLowerCase().replace(/[^a-z_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}
function tagLabel(raw) {
    const tag = normalizeTag(raw);
    if (!tag || tag === "none") return "";
    return labelFor(tag, "recent answers");
}
function labelFor(tag, kind) {
    if (TAG_LABELS[tag]) return TAG_LABELS[tag];
    // Sound Lab contrasts (Task 43): sound_w_v, sound_th, sound_vowel_i_ee, ...
    // render as "Sound: w vs v" instead of the generic recurring-family line.
    if (tag.startsWith("sound_")) {
        const raw = tag.slice("sound_".length).replace(/_/g, " ").trim();
        if (raw === "th") return "Sound: th (tink vs think)";
        if (raw === "ng") return "Sound: final -ng drops to -n";
        if (raw === "clusters") return "Sound: final clusters reduce";
        if (raw.startsWith("vowel ")) return `Sound: vowels (${raw.slice(6)}) collapse`;
        const tokens = raw.split(/\s+/);
        if (tokens.length === 2) return `Sound: ${tokens[0]} vs ${tokens[1]}`;
        return `Sound: ${raw} contrast`;
    }
    const pretty = tag.replace(/_/g, " ");
    return `${pretty.charAt(0).toUpperCase()}${pretty.slice(1)} recurring in ${kind}`;
}
async function recordMistakes(items) {
    const grouped = new Map();
    for (const item of items){
        const tag = normalizeTag(item.tag);
        if (!tag || tag === "none" || !item.wrong?.trim() || !item.right?.trim()) continue;
        const key = `${item.kind}:${tag}`;
        const existing = grouped.get(key);
        if (!existing) grouped.set(key, {
            ...item,
            tag
        });
    }
    for (const [key, m] of grouped){
        const evidence = `${m.wrong.trim().slice(0, 140)} -> ${m.right.trim().slice(0, 140)}`;
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.upsert({
                where: {
                    id: key
                },
                create: {
                    id: key,
                    kind: m.kind,
                    tag: m.tag,
                    label: labelFor(m.tag, m.kind),
                    count: 1,
                    evidence
                },
                update: {
                    count: {
                        increment: 1
                    },
                    evidence,
                    lastSeen: new Date(),
                    // Relapse: a family the learner produced again is live again,
                    // resolved or not. The healing streak resets with it.
                    resolvedAt: null,
                    streakClean: 0
                }
            });
        } catch  {
        // Memory must never break the turn that produced the mistake.
        }
    }
}
function toView(r) {
    return {
        id: r.id,
        kind: r.kind,
        tag: r.tag,
        label: r.label,
        count: r.count,
        evidence: r.evidence,
        lastSeen: r.lastSeen.toISOString(),
        streakClean: r.streakClean,
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null
    };
}
async function topMistakes(limit = 6, activeOnly = false) {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.findMany({
        where: activeOnly ? {
            resolvedAt: null
        } : undefined,
        orderBy: [
            {
                count: "desc"
            },
            {
                lastSeen: "desc"
            }
        ],
        take: limit
    });
    return rows.map(toView);
}
async function noteExamAnswer(tag, wrong, right, correct) {
    const t = normalizeTag(tag);
    if (!t) return;
    try {
        if (correct) {
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.updateMany({
                where: {
                    tag: t
                },
                data: {
                    streakClean: {
                        increment: 1
                    }
                }
            });
            const due = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.findMany({
                where: {
                    tag: t,
                    resolvedAt: null,
                    streakClean: {
                        gte: CLEAN_HITS_TO_RESOLVE
                    }
                }
            });
            for (const f of due){
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.update({
                    where: {
                        id: f.id
                    },
                    data: {
                        resolvedAt: new Date()
                    }
                });
            }
        } else {
            // An exam miss is production evidence too: it counts, it shows, and it
            // reopens every healed family sharing the tag.
            await recordMistakes([
                {
                    kind: "exam",
                    tag: t,
                    wrong: wrong.slice(0, 140) || "(blank)",
                    right: right.slice(0, 140)
                }
            ]);
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.updateMany({
                where: {
                    tag: t,
                    id: {
                        not: `exam:${t}`
                    }
                },
                data: {
                    streakClean: 0,
                    resolvedAt: null
                }
            });
        }
    } catch  {
    // Memory must never break the grading turn that fed it.
    }
}
async function foldPlacementMisses(misses) {
    const valid = misses.map((m)=>({
            ...m,
            tag: normalizeTag(m.tag)
        })).filter((m)=>m.tag && m.tag !== "none" && m.wrong.trim() && m.right.trim());
    if (valid.length === 0) return [];
    const counts = new Map();
    const evidence = new Map();
    for (const m of valid){
        counts.set(m.tag, (counts.get(m.tag) ?? 0) + 1);
        if (!evidence.has(m.tag)) evidence.set(m.tag, m);
    }
    await recordMistakes([
        ...evidence.values()
    ].map((m)=>({
            kind: "placement",
            tag: m.tag,
            wrong: m.wrong,
            right: m.right
        })));
    // A placement miss is relapse evidence for every family sharing the tag,
    // whatever kind originally owned it - same rule an exam miss follows. It
    // also debits the mastery ledger: placement is the highest-stakes "no"
    // evidence there is.
    for (const tag of counts.keys()){
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.updateMany({
                where: {
                    tag,
                    id: {
                        not: `placement:${tag}`
                    }
                },
                data: {
                    streakClean: 0,
                    resolvedAt: null
                }
            });
        } catch  {
        // Memory must never break the result the learner is waiting for.
        }
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["noteTagOutcome"])(tag, false);
    }
    return [
        ...counts.entries()
    ].map(([tag, count])=>({
            tag,
            label: labelFor(tag, "placement"),
            count
        })).sort((a, b)=>b.count - a.count || a.tag.localeCompare(b.tag));
}
}),
];

//# sourceMappingURL=src_lib_62b72f34._.js.map