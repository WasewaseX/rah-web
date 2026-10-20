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
"[project]/src/app/api/speak/analytics/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
;
const dynamic = "force-dynamic";
function parse(s) {
    try {
        return JSON.parse(s);
    } catch  {
        return null;
    }
}
function score(s, k) {
    const v = Number(s?.[k]);
    if (!Number.isFinite(v)) return 0;
    return Math.min(10, Math.max(0, Math.round(v * 10) / 10));
}
function overall(s) {
    return Math.round((s.fluency + s.range + s.accuracy + s.delivery) / 4 * 10) / 10;
}
async function GET() {
    const sessions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].speakSession.findMany({
        orderBy: {
            at: "asc"
        },
        take: 200
    });
    const rows = sessions.map((r)=>({
            at: r.at,
            prompt: String(r.prompt ?? ""),
            round: Number(r.round ?? 1),
            res: parse(r.result)
        })).filter((r)=>r.res?.scores && Number.isFinite(r.res.scores.accuracy));
    // Trend: the last 12 graded sessions, oldest first (chart-ready).
    const trend = rows.slice(-12).map((r)=>({
            at: r.at,
            round: r.round,
            prompt: r.prompt.slice(0, 80),
            fluency: score(r.res.scores, "fluency"),
            range: score(r.res.scores, "range"),
            accuracy: score(r.res.scores, "accuracy"),
            delivery: score(r.res.scores, "delivery")
        }));
    // Deltas: same prompt, round 1 -> round 2 (the immediate-retry loop, the
    // exact "immediate opportunity to try again + improvement between attempts"
    // ask). The LATEST pair per prompt wins.
    const byPrompt = new Map();
    for (const r of rows){
        const key = r.prompt.trim().slice(0, 120);
        if (!key) continue;
        const entry = byPrompt.get(key) ?? {};
        const sc = {
            fluency: score(r.res.scores, "fluency"),
            range: score(r.res.scores, "range"),
            accuracy: score(r.res.scores, "accuracy"),
            delivery: score(r.res.scores, "delivery")
        };
        if (r.round === 2) entry.r2 = sc;
        else if (r.round === 1) entry.r1 = sc;
        byPrompt.set(key, entry);
    }
    const deltas = [
        ...byPrompt.entries()
    ].filter(([, v])=>v.r1 && v.r2).map(([prompt, v])=>({
            prompt,
            r1: overall(v.r1),
            r2: overall(v.r2),
            overallDelta: Math.round((overall(v.r2) - overall(v.r1)) * 10) / 10,
            accuracyDelta: Math.round((v.r2.accuracy - v.r1.accuracy) * 10) / 10,
            fluencyDelta: Math.round((v.r2.fluency - v.r1.fluency) * 10) / 10
        })).sort((a, b)=>b.overallDelta - a.overallDelta);
    // Recurring spoken-error families (the mistake memory, speak slice only).
    const fams = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.findMany({
        where: {
            kind: "speak"
        },
        orderBy: [
            {
                count: "desc"
            },
            {
                lastSeen: "desc"
            }
        ],
        take: 12
    });
    const traps = fams.map((f)=>({
            tag: f.tag,
            label: f.label,
            count: f.count,
            evidence: f.evidence.slice(0, 200),
            cleanStreak: f.streakClean,
            resolved: Boolean(f.resolvedAt)
        }));
    const accs = rows.map((r)=>score(r.res.scores, "accuracy"));
    const totals = {
        sessions: rows.length,
        avgAccuracy: accs.length ? Math.round(accs.reduce((a, b)=>a + b, 0) / accs.length * 10) / 10 : 0,
        bestAccuracy: accs.length ? Math.max(...accs) : 0,
        retried: deltas.length,
        improved: deltas.filter((d)=>d.overallDelta > 0).length
    };
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        trend,
        deltas,
        traps,
        totals
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__544defab._.js.map