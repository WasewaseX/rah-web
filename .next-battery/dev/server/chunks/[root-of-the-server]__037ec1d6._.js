module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: [
        'query'
    ]
});
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = db;
}),
"[project]/src/lib/fsrs.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// FSRS-5 scheduler, ported from crates/rah-core/src/fsrs.rs and verified by
// scripts/test-fsrs-parity.ts against the reference implementation
// (ts-fsrs v4.6.1, the exact version these formulas follow):
//   - recall/forget stability take the PRE-REVIEW difficulty (ts-fsrs feeds
//     the old D into (11 - D); the updated D only becomes the card's state);
//   - post-lapse stability is clamp(preS, S_MIN, S_forget) - the long-term
//     scheduler rule; the app schedules by day, never in minutes.
// Grades: 1=Again 2=Hard 3=Good 4=Easy.
__turbopack_context__.s([
    "DECAY",
    ()=>DECAY,
    "FACTOR",
    ()=>FACTOR,
    "MAX_IVL",
    ()=>MAX_IVL,
    "S_MAX",
    ()=>S_MAX,
    "S_MIN",
    ()=>S_MIN,
    "W",
    ()=>W,
    "cardR",
    ()=>cardR,
    "d0",
    ()=>d0,
    "dayIndex",
    ()=>dayIndex,
    "defaultState",
    ()=>defaultState,
    "fmtIvl",
    ()=>fmtIvl,
    "intervalFor",
    ()=>intervalFor,
    "lapseStability",
    ()=>lapseStability,
    "nextDifficulty",
    ()=>nextDifficulty,
    "preview",
    ()=>preview,
    "recallStability",
    ()=>recallStability,
    "retrievability",
    ()=>retrievability,
    "review",
    ()=>review,
    "s0",
    ()=>s0,
    "sameDayStability",
    ()=>sameDayStability
]);
const W = [
    0.40255,
    1.18385,
    3.173,
    15.69105,
    7.1949,
    0.5345,
    1.4604,
    0.0046,
    1.54575,
    0.1192,
    1.01925,
    1.9395,
    0.11,
    0.29605,
    2.2698,
    0.2315,
    2.9898,
    0.51655,
    0.6621
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const S_MIN = 0.1;
const S_MAX = 36500.0;
const MAX_IVL = 36500;
function defaultState() {
    return {
        s: 0,
        d: 0,
        due: 0,
        last: -1,
        lapses: 0,
        reps: 0,
        state: "new",
        lastivl: 0
    };
}
const clamp = (v, lo, hi)=>Math.min(hi, Math.max(lo, v));
function s0(grade) {
    const i = clamp(grade, 1, 4) - 1;
    const v = W[i];
    return v < S_MIN ? S_MIN : v;
}
function d0(grade) {
    const i = clamp(grade, 1, 4);
    const v = W[4] - Math.exp(W[5] * (i - 1)) + 1.0;
    return clamp(v, 1.0, 10.0);
}
function retrievability(tDays, s) {
    const t = tDays < 0 ? 0 : tDays;
    return Math.pow(1.0 + FACTOR * t / s, DECAY);
}
function intervalFor(s, retention) {
    const ivl = s / FACTOR * (Math.pow(retention, 1.0 / DECAY) - 1.0);
    return Math.floor(ivl + 0.5) < 1 ? 1 : Math.min(MAX_IVL, Math.floor(ivl + 0.5));
}
function nextDifficulty(d, grade) {
    const dd = -W[6] * (grade - 3.0);
    const damped = d + dd * (10.0 - d) / 9.0;
    const target = d0(4);
    const reverted = W[7] * target + (1.0 - W[7]) * damped;
    return clamp(reverted, 1.0, 10.0);
}
function recallStability(s, d, r, grade) {
    const hard = grade === 2 ? W[15] : 1.0;
    const easy = grade === 4 ? W[16] : 1.0;
    const term = Math.exp(W[8]) * (11.0 - d) * Math.pow(s, -W[9]) * Math.expm1(W[10] * (1.0 - r)) * hard * easy;
    return clamp(s * (1.0 + term), S_MIN, S_MAX);
}
function lapseStability(s, d, r) {
    const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1.0, W[13]) - 1.0) * Math.exp(W[14] * (1.0 - r));
    // Reference (ts-fsrs v4.6.1 long-term scheduler, class B.next_ds):
    //   stability_after_again = clamp(preStability, S_MIN, forgetStability)
    // The forgotten card cannot come back MORE stable than it was.
    return Math.min(Math.max(s, S_MIN), sf);
}
function sameDayStability(s, grade) {
    return clamp(s * Math.exp(W[17] * (grade - 3.0 + W[18])), S_MIN, S_MAX);
}
// Reference interval ordering (ts-fsrs v4.6.1 scheduler next_interval):
// Again <= Hard <= Good <= Easy with a minimum one-day gap between neighbors.
function orderConstrain(base) {
    const out = [
        base[0]
    ];
    for(let i = 1; i < 4; i++)out[i] = Math.max(base[i], out[i - 1] + 1);
    return out;
}
function review(state, grade, day, retention) {
    const g = clamp(Math.round(grade), 1, 4);
    const fs = {
        ...state,
        reps: state.reps + 1,
        last: day
    };
    const isNew = state.state === "new" || state.s <= 0.0 || state.d <= 0.0;
    if (isNew) {
        const ns = s0(g);
        const nd = d0(g);
        // Reference (class B.newState): all four grade intervals are computed,
        // then order-constrained - a new Hard never schedules shorter than a
        // new Again plus one day, and so on up the ladder.
        const chain = orderConstrain([
            1,
            2,
            3,
            4
        ].map((i)=>intervalFor(s0(i), retention)));
        const ivl = chain[g - 1];
        fs.s = ns;
        fs.d = nd;
        fs.due = day + ivl;
        fs.state = "review";
        fs.lastivl = ivl;
        if (g === 1) fs.lapses += 1;
        return {
            fsrs: fs,
            ivl,
            due: fs.due
        };
    }
    const t = day - state.last;
    const nd = nextDifficulty(state.d, g);
    if (t < 1) {
        // Same-day re-reviews only occur in the post-Again learning ladder
        // (a graded card leaves today's queue otherwise). Reference: ts-fsrs
        // short-term scheduler, learningState transitions.
        const ns = sameDayStability(state.s, g);
        fs.s = ns;
        fs.d = nd;
        fs.state = "review";
        if (g === 1 || g === 2) {
            // Again (+5 min) / Hard (+10 min) stay in today's relearning queue;
            // in day-granular form that is due = today, interval 0.
            if (g === 1) fs.lapses += 1;
            fs.due = day;
            fs.lastivl = 0;
            return {
                fsrs: fs,
                ivl: 0,
                due: day
            };
        }
        // Good exits the ladder; Easy must clear a Good-graded card by a day.
        const ivl = g === 4 ? Math.max(intervalFor(ns, retention), intervalFor(sameDayStability(state.s, 3), retention) + 1) : intervalFor(ns, retention);
        fs.due = day + ivl;
        fs.lastivl = ivl;
        return {
            fsrs: fs,
            ivl,
            due: fs.due
        };
    }
    const r = retrievability(t, state.s);
    // Reference semantics: the stability formulas consume the PRE-review
    // difficulty (state.d), not the just-updated one (nd). All four candidate
    // stabilities are computed, their intervals order-constrained, and the
    // graded one is kept - exactly like the reference scheduler.
    const sAgain = lapseStability(state.s, state.d, r);
    const sHard = recallStability(state.s, state.d, r, 2);
    const sGood = recallStability(state.s, state.d, r, 3);
    const sEasy = recallStability(state.s, state.d, r, 4);
    const ns = g === 1 ? sAgain : g === 2 ? sHard : g === 3 ? sGood : sEasy;
    const chain = orderConstrain([
        sAgain,
        sHard,
        sGood,
        sEasy
    ].map((s)=>intervalFor(s, retention)));
    const ivl = chain[g - 1];
    fs.s = ns;
    fs.d = nd;
    fs.due = day + ivl;
    fs.state = "review";
    fs.lastivl = ivl;
    return {
        fsrs: fs,
        ivl,
        due: fs.due
    };
}
function preview(state, day, retention) {
    const out = [
        0,
        0,
        0,
        0
    ];
    for(let i = 0; i < 4; i++)out[i] = review(state, i + 1, day, retention).ivl;
    return out;
}
function cardR(state, day) {
    if (state.state === "new" || state.last < 0 || state.s <= 0.0) return 0.0;
    const t = Math.max(0, day - state.last);
    return retrievability(t, state.s);
}
function dayIndex(now = Date.now()) {
    return Math.floor(now / 86400000);
}
function fmtIvl(ivl) {
    if (ivl <= 0) return "today";
    if (ivl === 1) return "1d";
    if (ivl < 30) return `${ivl}d`;
    if (ivl < 360) return `${Math.round(ivl / 30 * 10) / 10}mo`;
    return `${Math.round(ivl / 360 * 10) / 10}y`;
}
}),
"[project]/src/app/api/progress/outcomes/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fsrs.ts [app-route] (ecmascript)");
;
;
;
const dynamic = "force-dynamic";
// OUTCOMES (the 7.4/10 review's lowest score: "proven learning effectiveness
// 4.5/10"). Engineering test pass-rates do not measure learning - but the
// engine already earns the real numbers on every retrieval. This route is the
// deterministic read that surfaces them honestly: first-attempt retention from
// ReviewLog, interval growth (FSRS stability proxy) over time, mature-memory
// share, and mistake-family extinction. No AI, no vibes - SQL and math.
const median = (xs)=>{
    if (xs.length === 0) return 0;
    const s = [
        ...xs
    ].sort((a, b)=>a - b);
    const mid = s.length >> 1;
    const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    return Math.round(m * 10) / 10;
};
async function GET() {
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const window = 30;
    // 1) First-attempt retention: share of retrievals graded Good/Easy per day.
    const logs = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].reviewLog.findMany({
        where: {
            day: {
                gte: today - window
            }
        },
        select: {
            day: true,
            grade: true
        }
    });
    const byDay = new Map();
    for (const l of logs){
        const e = byDay.get(l.day) ?? {
            total: 0,
            good: 0
        };
        e.total += 1;
        if (l.grade >= 3) e.good += 1;
        byDay.set(l.day, e);
    }
    const retention = [
        ...byDay.entries()
    ].sort((a, b)=>a[0] - b[0]).map(([day, v])=>({
            day,
            reviews: v.total,
            goodRate: Math.round(v.good / v.total * 1000) / 10
        }));
    // 2) Stability proxy: median scheduled interval of retrievals per day -
    // rising intervals mean FSRS trusts the memory more (stability growth).
    const ivlLogs = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].reviewLog.findMany({
        where: {
            day: {
                gte: today - window
            }
        },
        select: {
            day: true,
            ivl: true
        }
    });
    const ivlByDay = new Map();
    for (const l of ivlLogs){
        let arr = ivlByDay.get(l.day);
        if (!arr) {
            arr = [];
            ivlByDay.set(l.day, arr);
        }
        arr.push(l.ivl);
    }
    const stability = [
        ...ivlByDay.entries()
    ].sort((a, b)=>a[0] - b[0]).map(([day, ivls])=>({
            day,
            medianIvl: median(ivls)
        }));
    // 3) Mature memory: how much of the started deck has crossed s >= 21d.
    const states = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].cardState.findMany();
    const started = states.filter((s)=>s.state !== "new");
    const mature = started.filter((s)=>s.s >= 21);
    const memory = {
        started: started.length,
        mature: mature.length,
        matureShare: started.length ? Math.round(mature.length / started.length * 1000) / 10 : 0,
        medianStability: median(started.map((s)=>s.s)),
        lapsingCards: started.filter((s)=>s.lapses > 0).length
    };
    // 4) Mistake-family extinction: how many persistent error families the
    // healing loop has retired (2 clean exam hits) vs still active.
    const fams = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.findMany({
        select: {
            kind: true,
            resolvedAt: true,
            count: true
        }
    });
    const families = {
        total: fams.length,
        active: fams.filter((f)=>!f.resolvedAt).length,
        resolved: fams.filter((f)=>f.resolvedAt).length,
        retirementRate: fams.length ? Math.round(fams.filter((f)=>f.resolvedAt).length / fams.length * 1000) / 10 : 0,
        byKind: fams.reduce((acc, f)=>{
            acc[f.kind] ??= {
                total: 0,
                resolved: 0
            };
            acc[f.kind].total += 1;
            if (f.resolvedAt) acc[f.kind].resolved += 1;
            return acc;
        }, {})
    };
    // 5) Recent-window summary the UI can quote verbatim.
    const recent = retention.slice(-7);
    const overallGoodRate = retention.length ? Math.round(retention.reduce((a, r)=>a + r.goodRate, 0) / retention.length * 10) / 10 : 0;
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        retention,
        stability,
        memory,
        families,
        summary: {
            days: retention.length,
            overallGoodRate,
            last7GoodRate: recent.length ? Math.round(recent.reduce((a, r)=>a + r.goodRate, 0) / recent.length * 10) / 10 : 0,
            ivlTrend: stability.length >= 2 ? Math.round((stability[stability.length - 1].medianIvl - stability[0].medianIvl) * 10) / 10 : 0
        }
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__037ec1d6._.js.map