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
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

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
"[project]/src/lib/portable.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BUNDLE_FORMAT",
    ()=>BUNDLE_FORMAT,
    "buildBundle",
    ()=>buildBundle,
    "bundleHash",
    ()=>bundleHash,
    "commitImport",
    ()=>commitImport,
    "planImport",
    ()=>planImport
]);
// P5 of the mega-update: the learner owns the state.
//
// Export/import of the ENTIRE learner state - every table, no exceptions.
// The bundle is deterministic (fixed table order, rows sorted by primary
// key, stable JSON) so a content hash identifies it exactly: the import
// route verifies the hash BEFORE touching anything and a re-import of the
// same bundle is idempotent by construction.
//
// Redaction rule inherited from the Tauri export: no secrets, ever. The DB
// holds no AI keys and none of these tables may ever gain one; the registry
// below is also the audit list for that promise.
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
;
const BUNDLE_FORMAT = "rah.v1";
// Fixed order = deterministic bundle. Dates per model mirror the schema.
const TABLES = [
    {
        model: "learner",
        dates: []
    },
    {
        model: "cardState",
        dates: []
    },
    {
        model: "reviewLog",
        dates: [
            "at"
        ]
    },
    {
        model: "placement",
        dates: [
            "updatedAt"
        ]
    },
    {
        model: "chatMsg",
        dates: [
            "at"
        ]
    },
    {
        model: "writingSub",
        dates: [
            "at"
        ]
    },
    {
        model: "speakSession",
        dates: [
            "at"
        ]
    },
    {
        model: "dailyStat",
        dates: []
    },
    {
        model: "quizItem",
        dates: [
            "at"
        ]
    },
    {
        model: "exam",
        dates: [
            "createdAt"
        ]
    },
    {
        model: "skillLevel",
        dates: [
            "updatedAt"
        ]
    },
    {
        model: "achievement",
        dates: [
            "at"
        ]
    },
    {
        model: "gameStat",
        dates: [
            "updatedAt"
        ]
    },
    {
        model: "quest",
        dates: []
    },
    {
        model: "rival",
        dates: []
    },
    {
        model: "league",
        dates: []
    },
    {
        model: "runState",
        dates: [
            "updatedAt"
        ]
    },
    {
        model: "briefing",
        dates: [
            "at"
        ]
    },
    {
        model: "mistakeFamily",
        dates: [
            "lastSeen",
            "updatedAt",
            "resolvedAt"
        ]
    },
    {
        model: "tagMastery",
        dates: [
            "lastOk",
            "lastNo",
            "updatedAt"
        ]
    }
];
function stableValue(v) {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(stableValue);
    if (v && typeof v === "object") {
        const entries = Object.entries(v).filter(([k])=>typeof k === "string").sort(([a], [b])=>a < b ? -1 : 1);
        return Object.fromEntries(entries.map(([k, x])=>[
                k,
                stableValue(x)
            ]));
    }
    return v;
}
function bundleHash(tables) {
    const canon = JSON.stringify(Object.fromEntries(Object.keys(tables).sort().map((k)=>[
            k,
            tables[k].map(stableValue)
        ])));
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["createHash"])("sha256").update(canon).digest("hex");
}
async function buildBundle() {
    const tables = {};
    const counts = {};
    for (const t of TABLES){
        const raw = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"][t.model].findMany();
        const rows = raw.map((r)=>Object.fromEntries(Object.entries(r)));
        rows.sort((a, b)=>JSON.stringify(stableValue(a)) < JSON.stringify(stableValue(b)) ? -1 : 1);
        tables[t.model] = rows;
        counts[t.model] = rows.length;
    }
    const bundle = {
        format: BUNDLE_FORMAT,
        exportedAt: new Date().toISOString(),
        tables
    };
    return {
        bundle,
        hash: bundleHash(tables),
        counts
    };
}
function planImport(input) {
    const b = input;
    if (!b || typeof b !== "object" || b.format !== BUNDLE_FORMAT || !b.tables || typeof b.tables !== "object") {
        return {
            valid: false,
            reason: "This file is not a Rah export (format mismatch). Export fresh from the app and try again.",
            counts: {}
        };
    }
    const hash = bundleHash(b.tables);
    const expected = input.hash;
    if (expected && expected !== hash) {
        return {
            valid: false,
            reason: `The file is corrupted or was edited (hash ${hash.slice(0, 12)} != declared ${String(expected).slice(0, 12)}). Import refused.`,
            counts: {}
        };
    }
    const counts = {};
    for (const t of TABLES){
        const rows = b.tables[t.model];
        if (!Array.isArray(rows)) {
            return {
                valid: false,
                reason: `The export is missing the ${t.model} table. Export fresh from the app.`,
                counts: {}
            };
        }
        counts[t.model] = rows.length;
    }
    return {
        valid: true,
        counts,
        hash
    };
}
async function commitImport(tables) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].$transaction(async (tx)=>{
        for (const t of [
            ...TABLES
        ].reverse()){
            await tx[t.model].deleteMany();
        }
        for (const t of TABLES){
            const rows = tables[t.model] ?? [];
            const coerced = rows.map((r)=>{
                const out = Object.fromEntries(Object.entries(r));
                for (const f of t.dates){
                    if (out[f] != null) out[f] = new Date(out[f]);
                }
                return out;
            });
            if (coerced.length > 0) {
                await tx[t.model].createMany({
                    data: coerced
                });
            }
        }
    });
}
}),
"[project]/src/app/api/export/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$portable$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/portable.ts [app-route] (ecmascript)");
;
;
const dynamic = "force-dynamic";
async function GET() {
    const { bundle, hash, counts } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$portable$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildBundle"])();
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ...bundle,
        hash,
        counts
    }, {
        headers: {
            "content-disposition": `attachment; filename="rah-export-${hash.slice(0, 12)}.json"`
        }
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e4df87ec._.js.map