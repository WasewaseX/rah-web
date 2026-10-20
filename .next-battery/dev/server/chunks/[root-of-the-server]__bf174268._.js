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
"[project]/src/lib/languagetool.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// LanguageTool integration - the rule-based, non-generative baseline that
// grounds the writing coach. Reverse-engineered from the LanguageTool public
// API (api.languagetool.org/v2/check, the same service powering
// languagetool.org): POST text, get back offset-accurate matches with rule
// ids, categories and replacement candidates.
//
// Architecture role (per the English Learning Engine brief):
//   rule engine FIRST (deterministic, free, explainable)
//     -> LLM SECOND (confirms, explains, teaches)
// Errors (grammar/spelling/punctuation/confused words) are separated from
// style (wordiness/redundancy/informal register): errors feed the mistake
// memory; style never contaminates it.
__turbopack_context__.s([
    "findingsBlock",
    ()=>findingsBlock,
    "mergeRuleErrors",
    ()=>mergeRuleErrors,
    "screenText",
    ()=>screenText,
    "severityFor",
    ()=>severityFor,
    "trapTagFor",
    ()=>trapTagFor
]);
// Categories that are real ERRORS (wrong English), not taste.
const ERROR_CATEGORIES = new Set([
    "typos",
    "grammar",
    "punctuation",
    "confused_words",
    "casing",
    "semantics",
    "misc",
    "grammar_mechanics",
    "redistribution"
]);
// Style/taste categories: surfaced as notes, never as mistakes.
const STYLE_CATEGORIES = new Set([
    "style",
    "redundancy",
    "wordiness",
    "colloquialisms",
    "informalisms",
    "plain_english",
    "gender_neutral",
    "typographical",
    "creativity"
]);
function trapTagFor(ruleId, category) {
    const r = ruleId.toLowerCase();
    const c = category.toLowerCase();
    if (c === "typos" || r.includes("spell") || r.includes("typo")) return "spelling";
    if (r.includes("preposition") || r.includes("in_on_at") || r.includes("prep_")) return "prepositions";
    if (r.includes("article") || r.includes("determiner") || r.includes("missing_det")) return "articles";
    if (r.includes("plural") || r.includes("countable") || r.includes("uncountable") || r.includes("noun_inf") || r.includes("singular")) return "countability";
    if (r.includes("agreement") || r.includes("concord") || r.includes("third_person") || r.includes("subject_verb")) return "statives";
    if (r.includes("perfect") || r.includes("have_been") || r.includes("present_perfect")) return "perfect";
    if (r.includes("passive") || r.includes("active")) return "copula";
    if (r.includes("comparative") || r.includes("superlative") || r.includes("adjective")) return "adjectives";
    if (r.includes("question") || r.includes("auxiliary_missing") || r.includes("inversion")) return "question_order";
    if (r.includes("confus")) return "word_choice";
    if (r.includes("collocation")) return "collocation";
    if (r.includes("register") || r.includes("formal") || r.includes("informal") || r.includes("slang")) return "register";
    return "word_choice";
}
function severityFor(category, ruleId) {
    const c = category.toLowerCase();
    if (ERROR_CATEGORIES.has(c)) return "error";
    if (STYLE_CATEGORIES.has(c)) return "style";
    // Unknown categories: spelling-shaped rule ids are errors, the rest style.
    const rid = ruleId.toLowerCase();
    if (rid.includes("typo") || rid.includes("spell")) return "error";
    return "style";
}
const ENDPOINT = "https://api.languagetool.org/v2/check";
const TIMEOUT_MS = 10000;
const MIN_SPACING_MS = 2500; // public API politeness: ~20 req/min per IP
const RETRY_BACKOFF_MS = 6000; // burst-throttle recovery
let lastCallAt = 0;
function normalize(text, json) {
    const errors = [];
    const style = [];
    for (const m of json.matches ?? []){
        const offset = Number(m.offset ?? m.context?.offset ?? 0);
        const length = Number(m.length ?? m.context?.length ?? 0);
        if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) continue;
        const excerpt = text.slice(offset, offset + length);
        if (!excerpt.trim()) continue;
        const category = String(m.rule?.category?.id ?? "").toUpperCase();
        const ruleId = String(m.rule?.id ?? "");
        const severity = severityFor(category, ruleId);
        const finding = {
            offset,
            length,
            excerpt,
            message: String(m.message ?? m.shortMessage ?? "").trim(),
            ruleId,
            ruleDesc: String(m.rule?.description ?? "").trim(),
            category,
            severity,
            replacements: (m.replacements ?? []).map((r)=>String(r.value ?? "")).filter(Boolean).slice(0, 4),
            trapTag: trapTagFor(ruleId, category)
        };
        if (severity === "error") errors.push(finding);
        else style.push(finding);
    }
    return {
        engine: "languagetool",
        checkedChars: text.length,
        errors,
        style
    };
}
async function callLt(text) {
    // Space out calls; the public endpoint rate-limits anonymous traffic and a
    // 429 would only teach callers to fear the fast path.
    const wait = lastCallAt + MIN_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((res)=>setTimeout(res, wait));
    lastCallAt = Date.now();
    const body = new URLSearchParams({
        text: text.slice(0, 6000),
        language: "en-US",
        level: "picky"
    });
    for(let attempt = 0; attempt < 2; attempt++){
        const ctl = new AbortController();
        const timer = setTimeout(()=>ctl.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: body.toString(),
                signal: ctl.signal
            });
            if (res.status === 429 && attempt === 0) {
                await new Promise((res2)=>setTimeout(res2, RETRY_BACKOFF_MS));
                continue;
            }
            if (!res.ok) return null;
            const json = await res.json();
            return normalize(text, json);
        } catch  {
            if (attempt === 1) return null;
        } finally{
            clearTimeout(timer);
        }
    }
    return null;
}
async function screenText(text) {
    const trimmed = String(text ?? "").trim();
    if (trimmed.length < 20) return null;
    return callLt(trimmed);
}
// ---------------------------------------------------------------------------
// Merge: fold rule-engine ERRORS the LLM missed back into the graded result.
// Overlap-aware (an excerpt already covered by an LLM error is skipped), and
// capped so a noisy screen cannot flood the learner's error list.
// ---------------------------------------------------------------------------
function overlaps(a, b) {
    const na = a.toLowerCase().replace(/\s+/g, " ").trim();
    const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
}
function mergeRuleErrors(existing, report, cap = 6) {
    const merged = [
        ...existing
    ];
    if (!report) return {
        merged,
        added: 0
    };
    let added = 0;
    for (const f of report.errors){
        if (added >= cap) break;
        if (f.replacements.length && f.replacements.some((r)=>overlaps(r, f.excerpt))) continue; // no-op suggestion
        const covered = merged.some((e)=>overlaps(e.bad, f.excerpt));
        if (covered) continue;
        merged.push({
            bad: f.excerpt,
            good: f.replacements[0] ?? "",
            fa: "",
            type: f.trapTag
        });
        added += 1;
    }
    return {
        merged,
        added
    };
}
function findingsBlock(report) {
    if (!report || report.errors.length === 0 && report.style.length === 0) {
        return "RULE ENGINE: no rule-based findings.";
    }
    const line = (f)=>`- [${f.severity}] "${f.excerpt}" (${f.ruleId}): ${f.message}${f.replacements.length ? ` suggestions: ${f.replacements.map((r)=>JSON.stringify(r)).join(", ")}` : ""}`;
    const errs = report.errors.slice(0, 12).map(line).join("\n");
    const sty = report.style.slice(0, 6).map(line).join("\n");
    return [
        `RULE ENGINE FINDINGS (LanguageTool, deterministic - candidates, not gospel):`,
        errs || "(none)",
        sty ? `STYLE NOTES (not errors; mention only in upgrades):\n${sty}` : "",
        "Confirm real errors into your errors list with better explanations; discard false positives silently; never duplicate a finding the rule engine already reported unless you can add real teaching value."
    ].filter(Boolean).join("\n");
}
}),
"[project]/src/lib/rate-limit.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "aiRateLimit",
    ()=>aiRateLimit,
    "clientIp",
    ()=>clientIp
]);
// Shared abuse limiter for AI/speech endpoints (audit P1-6).
//
// In-memory sliding window, keyed by user id when signed in and by IP
// otherwise (single-node deployment - the same honesty rules as the auth
// IP throttle; a restart clears it). Generous for real learning use, brutal
// for scripted abuse: AI routes cost real money per call.
//
// Usage in a route:
//   const rl = await aiRateLimit(req, user?.id);
//   if (!rl.ok) return rl.response; // 429 + Retry-After + honest message
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_MIN_USER = 40; // signed-in: 40 AI calls/min - nobody learns faster than that
const MAX_PER_MIN_IP = 15; // anonymous: tighter
function hit(key, max) {
    const now = Date.now();
    const hits = (buckets.get(key) ?? []).filter((t)=>now - t < WINDOW_MS);
    if (hits.length >= max) {
        const retryAfter = Math.ceil((WINDOW_MS - (now - hits[0])) / 1000);
        buckets.set(key, hits); // keep pruning state even when refusing
        return {
            ok: false,
            retryAfter: Math.max(1, retryAfter)
        };
    }
    hits.push(now);
    buckets.set(key, hits);
    if (buckets.size > 10_000) {
        for (const [k, v] of buckets){
            if (v.every((t)=>now - t >= WINDOW_MS)) buckets.delete(k);
        }
    }
    return {
        ok: true,
        retryAfter: 0
    };
}
function aiRateLimit(req, userId) {
    const ip = clientIp(req);
    // Loopback / direct local access is EXEMPT: the dev toolchain (battery, E2E)
    // shares 127.0.0.1 and would lock itself out; production traffic arrives
    // through a proxy that sets x-forwarded-for to the real client IP. The
    // deployment lock (Task 48) bounds the blast radius of direct-access abuse.
    if (!userId && (ip === "loopback" || ip.startsWith("127.") || ip === "::1" || ip.startsWith("::ffff:127."))) {
        return {
            ok: true
        };
    }
    const max = userId ? MAX_PER_MIN_USER : MAX_PER_MIN_IP;
    const key = userId ? `u:${userId}` : `ip:${ip}`;
    const r = hit(key, max);
    if (r.ok) return {
        ok: true
    };
    return {
        ok: false,
        response: new Response(JSON.stringify({
            error: `Too many AI requests - slow down a little and try again in ${r.retryAfter}s.`
        }), {
            status: 429,
            headers: {
                "content-type": "application/json",
                "retry-after": String(r.retryAfter)
            }
        })
    };
}
function clientIp(req) {
    const xff = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    return xff || req.headers.get("x-real-ip") || "loopback";
}
}),
"[project]/src/app/api/grammar-check/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic
]);
// Standalone rule-engine endpoint: deterministic LanguageTool screening with
// the error/style split. Used by any surface that wants a non-generative
// grammar opinion (chat coaching, writing pre-flight, future teachers).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$languagetool$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/languagetool.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rate$2d$limit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rate-limit.ts [app-route] (ecmascript)");
;
;
;
const dynamic = "force-dynamic";
async function POST(req) {
    // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
    const rl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rate$2d$limit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiRateLimit"])(req);
    if (!rl.ok) return rl.response;
    const { text } = await req.json().catch(()=>({
            text: ""
        }));
    const body = String(text ?? "").trim();
    if (body.length < 20) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Give me at least 20 characters of English to check."
        }, {
            status: 400
        });
    }
    const report = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$languagetool$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["screenText"])(body);
    if (!report) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Rule engine unreachable; try again shortly."
        }, {
            status: 503
        });
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        engine: report.engine,
        errors: report.errors.map((f)=>({
                excerpt: f.excerpt,
                message: f.message,
                ruleId: f.ruleId,
                category: f.category,
                severity: f.severity,
                replacements: f.replacements,
                trapTag: f.trapTag
            })),
        style: report.style.map((f)=>({
                excerpt: f.excerpt,
                message: f.message,
                ruleId: f.ruleId,
                category: f.category,
                severity: f.severity,
                replacements: f.replacements
            })),
        summary: `${report.errors.length} error(s), ${report.style.length} style note(s)`
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__bf174268._.js.map