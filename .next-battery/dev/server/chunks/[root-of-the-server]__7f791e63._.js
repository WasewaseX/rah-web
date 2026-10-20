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
"[project]/src/lib/auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EMBED_COOKIE",
    ()=>EMBED_COOKIE,
    "SESSION_COOKIE",
    ()=>SESSION_COOKIE,
    "callerWantsEmbedFallback",
    ()=>callerWantsEmbedFallback,
    "destroySession",
    ()=>destroySession,
    "exchangeGoogleCode",
    ()=>exchangeGoogleCode,
    "getSessionUser",
    ()=>getSessionUser,
    "getSessionUserWithRequest",
    ()=>getSessionUserWithRequest,
    "googleAuthUrl",
    ()=>googleAuthUrl,
    "googleConfigured",
    ()=>googleConfigured,
    "hashCode",
    ()=>hashCode,
    "hashToken",
    ()=>hashToken,
    "ipRateLimited",
    ()=>ipRateLimited,
    "issueLoginCode",
    ()=>issueLoginCode,
    "newCode",
    ()=>newCode,
    "normalizeEmail",
    ()=>normalizeEmail,
    "registrationLocked",
    ()=>registrationLocked,
    "resolveToken",
    ()=>resolveToken,
    "sessionCookieOptions",
    ()=>sessionCookieOptions,
    "upsertGoogleUser",
    ()=>upsertGoogleUser,
    "validEmail",
    ()=>validEmail,
    "verifyLoginCode",
    ()=>verifyLoginCode
]);
// Auth core: email-code login, sessions, cookie handling.
// Flow: POST /api/auth/request-code {email} -> 6-digit code emailed (10 min TTL, single use,
// rate limited) -> POST /api/auth/verify {email, code} -> User row (created on first login)
// + Session row + httpOnly cookie. getSessionUser(req) resolves the cookie for every route.
// Gmail: the same code flow covers gmail addresses; Google OAuth is optional extras in
// /api/auth/google/* (active only when GOOGLE_CLIENT_ID/SECRET are configured).
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
;
;
const SESSION_COOKIE = "rah_session";
const EMBED_COOKIE = "rah_session_embed";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CODES_PER_WINDOW = 5;
const CODE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_IP_WINDOW = 10; // per-IP throttle on top of per-email
const MAX_CODE_ATTEMPTS = 5; // failed guesses before a code self-invalidates
function hashCode(code) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["createHash"])("sha256").update(String(code)).digest("hex");
}
// In-memory per-IP throttle for code issuance (single-node deployment; codes
// are also per-email limited in the DB). Best-effort: a restart clears it.
// Loopback IPs are EXEMPT: in dev/everything-local all traffic shares 127.0.0.1
// and the limit would lock out the battery and E2E runs; abuse protection on
// localhost is meaningless anyway. Production proxies pass real client IPs.
const ipCodeRequests = new Map();
function ipRateLimited(ip, max = MAX_CODES_PER_IP_WINDOW, windowMs = CODE_WINDOW_MS) {
    if (!ip || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.")) return false;
    const now = Date.now();
    const hits = (ipCodeRequests.get(ip) ?? []).filter((t)=>now - t < windowMs);
    hits.push(now);
    ipCodeRequests.set(ip, hits);
    if (ipCodeRequests.size > 5000) {
        // opportunistic GC so the map cannot grow unbounded
        for (const [k, v] of ipCodeRequests){
            if (v.every((t)=>now - t >= windowMs)) ipCodeRequests.delete(k);
        }
    }
    return hits.length > max;
}
function normalizeEmail(email) {
    return String(email ?? "").trim().toLowerCase();
}
function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}
function newCode() {
    return String((0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["randomInt"])(0, 1_000_000)).padStart(6, "0");
}
async function issueLoginCode(rawEmail, ip = "") {
    const email = normalizeEmail(rawEmail);
    if (!validEmail(email)) return {
        ok: false,
        error: "That does not look like an email address."
    };
    // Rate limit: 5 codes per email per 15 minutes (DB), 10 per IP per 15 minutes
    // (memory). Honest limits, no lockout games.
    const windowStart = new Date(Date.now() - CODE_WINDOW_MS);
    const recent = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].loginCode.count({
        where: {
            email,
            createdAt: {
                gte: windowStart
            }
        }
    });
    if (recent >= MAX_CODES_PER_WINDOW) {
        return {
            ok: false,
            error: "Too many codes requested. Wait a few minutes and try again."
        };
    }
    if (ipRateLimited(ip)) {
        return {
            ok: false,
            error: "Too many codes requested from this network. Wait a few minutes."
        };
    }
    // Resend invalidates: any earlier unused code for this email is dead the
    // moment a fresh one is issued.
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].loginCode.updateMany({
        where: {
            email,
            usedAt: null
        },
        data: {
            usedAt: new Date()
        }
    });
    const code = newCode();
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].loginCode.create({
        data: {
            email,
            code: hashCode(code),
            expiresAt: new Date(Date.now() + CODE_TTL_MS)
        }
    });
    return {
        ok: true,
        code
    };
}
async function registrationLocked() {
    if (process.env.RAH_OPEN_REGISTRATION === "1") return false;
    const users = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].user.count();
    return users >= 1;
}
async function verifyLoginCode(rawEmail, rawCode) {
    const email = normalizeEmail(rawEmail);
    const code = String(rawCode ?? "").trim();
    if (!email || !/^\d{6}$/.test(code)) return {
        ok: false,
        error: "Enter the 6-digit code from your email."
    };
    // The newest unused, unexpired code for this email is the only valid one
    // (resend invalidates older rows). We look it up first so failed guesses
    // can be counted against it.
    const row = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].loginCode.findFirst({
        where: {
            email,
            usedAt: null,
            expiresAt: {
                gte: new Date()
            }
        },
        orderBy: {
            id: "desc"
        }
    });
    if (!row) return {
        ok: false,
        error: "That code is wrong, used, or expired. Request a fresh one."
    };
    if (row.code !== hashCode(code)) {
        // Wrong guess: count it. MAX_CODE_ATTEMPTS strikes and the code dies, so
        // the 1,000,000-combination space cannot be walked inside 10 minutes.
        const attempts = row.attempts + 1;
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].loginCode.update({
            where: {
                id: row.id
            },
            data: {
                attempts,
                usedAt: attempts >= MAX_CODE_ATTEMPTS ? new Date() : null
            }
        });
        return {
            ok: false,
            error: "That code is wrong, used, or expired. Request a fresh one."
        };
    }
    // ATOMIC single-use consume: updateMany guards on usedAt: null, so two
    // racing verifies cannot both win - exactly one gets count === 1.
    const consumed = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].loginCode.updateMany({
        where: {
            id: row.id,
            usedAt: null
        },
        data: {
            usedAt: new Date()
        }
    });
    if (consumed.count !== 1) {
        return {
            ok: false,
            error: "That code is wrong, used, or expired. Request a fresh one."
        };
    }
    let user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].user.findUnique({
        where: {
            email
        }
    });
    const isNew = !user;
    if (!user) {
        // Deployment lock: once one account exists, no second one may register
        // (the learner state is a singleton). Existing accounts re-logging in are
        // unaffected - the gate only fires on FIRST registration.
        if (await registrationLocked()) {
            return {
                ok: false,
                error: "This Rah deployment is private and already claimed. New sign-ups are disabled by the owner."
            };
        }
        user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].user.create({
            data: {
                email,
                name: email.split("@")[0],
                provider: "email"
            }
        });
    }
    const token = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["randomBytes"])(32).toString("hex");
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].session.create({
        data: {
            token: hashToken(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS)
        }
    });
    return {
        ok: true,
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            provider: user.provider,
            isNew
        }
    };
}
function hashToken(token) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["createHash"])("sha256").update(token).digest("hex");
}
async function getSessionUser() {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const token = jar.get(SESSION_COOKIE)?.value;
    return resolveToken(token);
}
async function getSessionUserWithRequest(req) {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const cookieToken = jar.get(SESSION_COOKIE)?.value;
    if (cookieToken) {
        const fromCookie = await resolveToken(cookieToken);
        if (fromCookie) return fromCookie;
    }
    const wantsEmbed = req.headers.get("x-rah-embed") === "1";
    if (wantsEmbed) {
        const embedToken = jar.get(EMBED_COOKIE)?.value;
        if (embedToken) {
            const fromEmbed = await resolveToken(embedToken);
            if (fromEmbed) return fromEmbed;
        }
    }
    const headerToken = req.headers.get("x-rah-token");
    return resolveToken(headerToken);
}
async function resolveToken(token) {
    if (!token) return null;
    const session = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].session.findUnique({
        where: {
            token: hashToken(token)
        },
        include: {
            user: true
        }
    });
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].session.delete({
            where: {
                id: session.id
            }
        }).catch(()=>undefined);
        return null;
    }
    return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        provider: session.user.provider
    };
}
function sessionCookieOptions(embed = false) {
    return embed ? {
        httpOnly: true,
        sameSite: "none",
        secure: true,
        partitioned: true,
        path: "/",
        maxAge: SESSION_TTL_MS / 1000
    } : {
        httpOnly: true,
        sameSite: "lax",
        secure: ("TURBOPACK compile-time value", "development") === "production",
        path: "/",
        maxAge: SESSION_TTL_MS / 1000
    };
}
function callerWantsEmbedFallback(req) {
    return req.headers.get("x-rah-embed") === "1";
}
async function destroySession(token) {
    if (!token) return;
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].session.deleteMany({
        where: {
            token: hashToken(token)
        }
    }).catch(()=>undefined);
}
function googleConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
function googleAuthUrl(origin, state) {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        redirect_uri: `${origin}/api/auth/google/callback`,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account"
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
async function exchangeGoogleCode(code, origin) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID ?? "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            redirect_uri: `${origin}/api/auth/google/callback`,
            grant_type: "authorization_code"
        })
    });
    if (!res.ok) return null;
    const tokens = await res.json();
    if (!tokens.access_token) return null;
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: {
            authorization: `Bearer ${tokens.access_token}`
        }
    });
    if (!info.ok) return null;
    const profile = await info.json();
    if (!profile.email) return null;
    return {
        email: profile.email,
        name: profile.name ?? profile.email.split("@")[0]
    };
}
async function upsertGoogleUser(profile) {
    const email = normalizeEmail(profile.email);
    let user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].user.findUnique({
        where: {
            email
        }
    });
    if (!user) {
        // Same deployment lock as the email-code path (single-user enforcement).
        if (await registrationLocked()) {
            throw new Error("This Rah deployment is private and already claimed. New sign-ups are disabled by the owner.");
        }
        user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].user.create({
            data: {
                email,
                name: profile.name,
                provider: "google"
            }
        });
    }
    return {
        id: user.id,
        email: user.email,
        name: user.name
    };
}
}),
"[externals]/node:events [external] (node:events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:events", () => require("node:events"));

module.exports = mod;
}),
"[externals]/node:net [external] (node:net, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:net", () => require("node:net"));

module.exports = mod;
}),
"[externals]/node:url [external] (node:url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:url", () => require("node:url"));

module.exports = mod;
}),
"[externals]/node:util [external] (node:util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:util", () => require("node:util"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:http [external] (node:http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:http", () => require("node:http"));

module.exports = mod;
}),
"[externals]/node:https [external] (node:https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:https", () => require("node:https"));

module.exports = mod;
}),
"[externals]/node:zlib [external] (node:zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:zlib", () => require("node:zlib"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/node:dns [external] (node:dns, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:dns", () => require("node:dns"));

module.exports = mod;
}),
"[externals]/node:os [external] (node:os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:os", () => require("node:os"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:tls [external] (node:tls, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:tls", () => require("node:tls"));

module.exports = mod;
}),
"[externals]/node:child_process [external] (node:child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:child_process", () => require("node:child_process"));

module.exports = mod;
}),
"[project]/src/lib/mailer.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isGmailAddress",
    ()=>isGmailAddress,
    "sendLoginCode",
    ()=>sendLoginCode,
    "smtpConfigured",
    ()=>smtpConfigured
]);
// Email delivery for login codes. Two modes:
//  - SMTP configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS + optional SMTP_FROM): real email via nodemailer.
//  - Otherwise DEV delivery: the code is logged and surfaced in the API response so the
//    app is fully usable with zero setup. The response marks it clearly as dev delivery.
// Gmail addresses work in both modes: the code flow does not care about the provider,
// and OAuth (Google) is a separate, optional path in /api/auth/google/start.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$nodemailer$2f$dist$2f$esm$2f$nodemailer$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/nodemailer/dist/esm/nodemailer.js [app-route] (ecmascript)");
;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM ?? smtpUser ?? "rah@localhost";
let transporter = null;
function getTransport() {
    if (!smtpHost) return null;
    if (!transporter) {
        transporter = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$nodemailer$2f$dist$2f$esm$2f$nodemailer$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: smtpUser && smtpPass ? {
                user: smtpUser,
                pass: smtpPass
            } : undefined
        });
    }
    return transporter;
}
function smtpConfigured() {
    return Boolean(smtpHost);
}
function isGmailAddress(email) {
    return /@(gmail\.com|googlemail\.com)$/i.test(email.trim());
}
const CODE_MAIL_STYLES = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0d1119;padding:32px;border-radius:16px;color:#f2f5fa;max-width:480px">
    <div style="font-size:22px;font-weight:900;letter-spacing:-0.02em;margin-bottom:6px">Rah</div>
    <div style="font-size:13px;color:#8b96a9;margin-bottom:20px">Your sign-in code. It expires in 10 minutes and works once.</div>
    <div style="font-size:40px;font-weight:900;letter-spacing:0.3em;background:#16233e;border:1px solid #2a3a5c;border-radius:12px;padding:18px 24px;text-align:center;color:#9dc0ff">{{CODE}}</div>
    <div style="font-size:12px;color:#5d6879;margin-top:20px">If you did not request this, ignore this email. Never share this code.</div>
  </div>`;
async function sendLoginCode(email, code) {
    const t = getTransport();
    const html = CODE_MAIL_STYLES.replace("{{CODE}}", code);
    if (!t) {
        // Dev delivery: no SMTP in this deployment. Log it loudly, return it so the
        // login screen can show it in a "dev inbox" strip. Never in production SMTP mode.
        console.log(`[mailer] DEV login code for ${email}: ${code}`);
        return {
            delivered: false,
            devCode: code,
            via: "dev"
        };
    }
    await t.sendMail({
        from: smtpFrom,
        to: email,
        subject: `Rah sign-in code: ${code}`,
        text: `Your Rah sign-in code is ${code}. It expires in 10 minutes and works once.`,
        html
    });
    return {
        delivered: true,
        via: "smtp"
    };
}
}),
"[project]/src/app/api/auth/request-code/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mailer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mailer.ts [app-route] (ecmascript)");
;
;
;
const dynamic = "force-dynamic";
async function POST(req) {
    const { email } = await req.json().catch(()=>({
            email: ""
        }));
    // Per-IP throttle on top of the per-email DB limit (proxy-aware best effort).
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "");
    const issued = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["issueLoginCode"])(String(email ?? ""), ip);
    if (!issued.ok) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: issued.error
    }, {
        status: 400
    });
    // The plaintext code came back from issueLoginCode's memory; the DB only
    // ever saw its sha256 hash. Mail it immediately and let it go.
    const mail = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mailer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sendLoginCode"])(String(email).trim().toLowerCase(), issued.code);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: true,
        email: String(email).trim().toLowerCase(),
        via: mail.via,
        smtpConfigured: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mailer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["smtpConfigured"])(),
        // Dev delivery only (no SMTP configured AND not production): the code is
        // returned so the login screen can show it in the clearly-marked dev
        // inbox. With SMTP set, or in production, this stays undefined.
        devCode: mail.devCode && ("TURBOPACK compile-time value", "development") !== "production" ? mail.devCode : undefined
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__7f791e63._.js.map