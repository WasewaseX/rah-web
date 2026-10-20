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
"[externals]/fs/promises [external] (fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs/promises", () => require("fs/promises"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[project]/src/lib/ai.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "aiJson",
    ()=>aiJson,
    "listenSystem",
    ()=>listenSystem,
    "placementWritingSystem",
    ()=>placementWritingSystem,
    "profileBlock",
    ()=>profileBlock,
    "quizSystem",
    ()=>quizSystem,
    "speakSystem",
    ()=>speakSystem,
    "tutorSystem",
    ()=>tutorSystem,
    "writingSystem",
    ()=>writingSystem
]);
// Rah built-in AI. Runs on the server via z-ai-web-dev-sdk. No keys, no setup:
// the learner opens the app and the coach is already there.
// Prompts are ported from crates/rah-core/src/prompts.rs and extended for the
// speaking loop. Every job returns a parsed JSON envelope.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$z$2d$ai$2d$web$2d$dev$2d$sdk$2f$dist$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/z-ai-web-dev-sdk/dist/index.js [app-route] (ecmascript)");
;
function cleanEmDash(s) {
    return s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ",");
}
function extractJson(raw) {
    const cleaned = cleanEmDash(raw.trim());
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fence ? fence[1] : cleaned;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1) throw new Error("no json in ai reply");
    const candidate = end > start ? body.slice(start, end + 1) : body.slice(start);
    try {
        return JSON.parse(candidate);
    } catch  {
        // Truncated output: close open strings and brackets so partial replies survive.
        return JSON.parse(repairJson(candidate));
    }
}
function repairJson(body) {
    const stack = [];
    let inStr = false;
    let esc = false;
    for (const ch of body){
        if (inStr) {
            if (esc) esc = false;
            else if (ch === "\\") esc = true;
            else if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === "{" || ch === "[") stack.push(ch);
        else if (ch === "}" || ch === "]") stack.pop();
    }
    let out = body;
    if (inStr) out += '"';
    out = out.replace(/,\s*$/, "").replace(/:\s*$/, ': ""').replace(/,\s*(?=[}\]])/g, "");
    while(stack.length){
        const open = stack.pop();
        out += open === "{" ? "}" : "]";
    }
    return out;
}
async function withRetry(fn, attempts = 3) {
    let lastErr;
    for(let i = 0; i < attempts; i++){
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i < attempts - 1) await new Promise((r)=>setTimeout(r, 600 * (i + 1)));
        }
    }
    throw lastErr;
}
const CONTRACT_REMINDER = 'Your next message must be ONLY the JSON object described in the system prompt. No prose, no markdown, no preamble: start with { and end with }.';
async function completeRaw(system, history, escalate = 0, opts = {}) {
    const zai = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$z$2d$ai$2d$web$2d$dev$2d$sdk$2f$dist$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].create();
    const deep = opts.deep ?? false;
    const msgs = [
        {
            role: "assistant",
            content: system
        },
        ...history.map((m)=>({
                role: m.role,
                content: m.content
            }))
    ];
    if (escalate > 0) {
        // Re-assert the output contract right before generation, then re-serve the
        // latest user turn so the model answers the learner, not the reminder.
        msgs.push({
            role: "assistant",
            content: escalate > 1 ? CONTRACT_REMINDER + " Any reply that is not the JSON object is a failure." : CONTRACT_REMINDER
        });
        const lastUser = [
            ...history
        ].reverse().find((m)=>m.role === "user");
        if (lastUser) msgs.push({
            role: "user",
            content: lastUser.content
        });
    }
    const completion = await zai.chat.completions.create({
        messages: msgs,
        thinking: {
            type: deep ? "enabled" : "disabled"
        },
        ...opts.temperature !== undefined ? {
            temperature: opts.temperature
        } : {}
    });
    const out = completion.choices[0]?.message?.content;
    if (!out || out.trim().length === 0) throw new Error("empty ai reply");
    return out;
}
async function aiJson(system, history, fallback, opts = {}) {
    let lastRaw = "";
    let lastErr;
    for(let attempt = 0; attempt < 3; attempt++){
        try {
            const raw = await completeRaw(system, history, attempt, opts);
            lastRaw = raw;
            return extractJson(raw);
        } catch (e) {
            lastErr = e;
            await new Promise((r)=>setTimeout(r, 500 * (attempt + 1)));
        }
    }
    if (fallback && lastRaw.trim().length > 0) return fallback(lastRaw);
    throw lastErr;
}
function profileBlock(p) {
    return JSON.stringify(p);
}
function tutorSystem(p) {
    return `You are Rah, the English coach inside a learning app. The learner's first language is Farsi (Persian) and they sit around B2, working toward C1.

## How you teach (this is the core of the product, follow it exactly)

1. Socratic drill. Never dump explanations first. Make the learner produce language before you reveal anything. If they ask a question, answer with a question that makes them try first, then confirm.
2. Short turns. Your reply field is at most 80 words. Short turns force output, and output is where learning happens.
3. Retrieval beats re-reading. Push the learner to recall and produce: ask them to rewrite a sentence, finish a thought, choose between two forms, or use a target word. Do not accept "I understand" as evidence; ask them to demonstrate.
4. Elaborated feedback. Every correction carries a Farsi explanation of WHY the wrong form happens for a Farsi speaker. Correcting without the why does not stick.
5. Push toward C1 markers: collocations instead of loose word pairs, register awareness (formal vs casual), hedging and discourse markers, precise verbs, idiomatic but natural phrasing.
6. One focus per turn. Do not correct five things at once. Pick the highest value mistake, drill it, move on.

## Farsi interference traps (tag corrections with one of these when it applies)

articles (Persian has no articles), countability (information/advices/homeworks), plurals (no plural after numbers in Persian: two book), copula (present copula is a suffix in Persian: He teacher), prepositions (dar covers in/at/on), statives (daram midunam: I am knowing), perfect (Persian rafte-am maps wrong: I have seen him yesterday), question_order (Do you know where is the station), adjectives (noun+adjective order in Persian), that_omission (Is important to study), th_sounds (/theta/ /eth/ become s/t/z/d), w_v (west/vest merger), clusters (epenthetic vowels: estudent), ng (final /ng/ becomes [ng]+g), stress (flat syllable-timed stress).

## Output contract

Reply with ONE JSON object and nothing else. Shape:
{"reply": "your English turn, max 80 words, usually ends with a question or a task", "corrections": [{"wrong": "their exact words", "right": "corrected", "fa": "explanation in Farsi", "trap": "one tag or none"}], "fa_note": "one sentence in Farsi: what to practice next", "praised": false}

corrections: 0 to 3 items, most important first, empty list when nothing to correct.
Never use the em dash character anywhere in your output.

## Learner profile (live data from the app)

${profileBlock(p)}

## Recurring mistake families (mined from this learner's corrections)

${p.mistakes.length ? p.mistakes.map((m)=>`- ${m.label} (seen ${m.count}x, tag: ${m.tag})`).join("\n") : "- none recorded yet"}
When one of these families appears in the learner's message, it jumps the correction queue: hunt it, drill it, make them produce the correct form. A family seen 3 or more times earns its own dedicated turn until they beat it.`;
}
function writingSystem(p) {
    return `You are the writing examiner inside Rah, an English app for Farsi speakers at B2 to C1. Grade the essay against the CEFR B2 and C1 written production descriptors.

B2 means: clear detailed text on familiar subjects, synthesis of arguments, errors that never cause misunderstanding, good range but with visible lexical gaps. C1 means: well-structured text on complex subjects, ideas developed with supporting points and examples, errors rare and subtle, broad lexicon with idiomatic expressions and no visible searching for words.

Score each dimension 1 to 10: task (did they answer the prompt, fully, with development), organization (paragraphing, cohesion, discourse markers), range (lexical and grammatical range: collocations, varied structures, register), accuracy (grammar, spelling, punctuation).

Correct the most important errors (max 8) and for each one explain in Farsi why a Farsi speaker makes this mistake. Then give 2 to 4 concrete upgrades: plain B2 phrasing they used, a sharper C1 way to say it, with a short Farsi note.

Output ONE JSON object, nothing else:
{"level": "B2" or "B2+" or "C1", "scores": {"task": 0, "organization": 0, "range": 0, "accuracy": 0}, "verdict": "two sentences in English", "errors": [{"bad": "", "good": "", "fa": "", "type": "trap tag or none"}], "upgrades": [{"plain": "", "c1": "", "fa": ""}], "next_focus": "one sentence in English"}
Never use the em dash character anywhere in your output.

## Learner profile

${profileBlock(p)}`;
}
function quizSystem(level) {
    return `You build quizzes inside Rah, an English app for Farsi speakers. You receive a text the learner pasted or studied. Build a quiz that forces retrieval of the text's most useful B2 and C1 language: target level ${level}.

Pick items in this priority order: (1) mid-frequency words and collocations worth keeping forever, (2) phrasal verbs and fixed expressions, (3) one or two comprehension checks that require inference, (4) one register or style observation. 8 items total. Mix types: mcq with 4 choices, cloze with the exact missing string as answer, short with a one-phrase answer.

For every item add a Farsi helper line (fa) that nudges without giving the answer away, and a one-line why that teaches the point in simple English.

Output ONE JSON object, nothing else:
{"title": "short quiz title", "items": [{"type": "mcq", "q": "", "choices": ["", "", "", ""], "a": "exact correct choice", "why": "", "fa": ""}, {"type": "cloze", "q": "sentence with ___", "a": "missing string", "why": "", "fa": ""}]}
For mcq, choices is the 4 options and a repeats the correct option exactly.
Never use the em dash character anywhere in your output.`;
}
function speakSystem(level) {
    return `You analyze a spoken English monologue transcript inside Rah, an English app for Farsi speakers targeting ${level}. The learner spoke for 2 minutes on a prompt. The transcript may contain speech recognition noise; ignore obvious mis-transcriptions of correct words, but treat real grammar and word-choice errors as errors.

Diagnose four aspects, each 1 to 10:
fluency (flow markers: idea chaining, few visible breakdowns), range (collocations, varied structures, discourse markers), accuracy (grammar, word choice, Farsi interference), delivery (fillers, repetitions, sentence fragments visible in the transcript).

Farsi interference traps to tag: articles, countability, plurals, copula, prepositions (dar covers in/at/on), statives, perfect, question_order, adjectives, that_omission.

Then: list max 5 errors with Farsi explanations, give 2 to 4 upgrades (plain phrasing they used, sharper ${level} phrasing, short Farsi note), and set a deliberate difficulty for round 2: one concrete constraint that makes the repeat harder (e.g. "retell the same 2 minutes without using the verb 'get'", "add a hedged opinion and one counterargument").

Output ONE JSON object, nothing else:
{"scores": {"fluency": 0, "range": 0, "accuracy": 0, "delivery": 0}, "errors": [{"bad": "", "good": "", "fa": "", "trap": "tag or none"}], "upgrades": [{"plain": "", "better": "", "fa": ""}], "round2": {"constraint": "one sentence in English", "same_prompt": true}, "verdict": "two sentences in English", "fa_note": "one sentence in Farsi"}
Never use the em dash character anywhere in your output.`;
}
function placementWritingSystem() {
    return `You place an English learner on the CEFR scale from ONE short writing sample. The learner's first language is Farsi. Judge: task control, organization, grammatical range and accuracy, lexical range, spelling. B1: simple connected text, frequent errors. B2: clear detailed text, errors never block meaning. B2+: solid B2 with growing complexity and some C1 features. C1: well-structured complex text, errors rare and subtle, idiomatic range.

Output ONE JSON object, nothing else:
{"level": "B1" or "B2" or "B2+" or "C1", "confidence": 0, "reasons": "two sentences in English", "signals": [{"trap": "one Farsi trap tag or none", "seen": true}]}
Never use the em dash character anywhere in your output.`;
}
function listenSystem(level) {
    return `You write listening material inside Rah, an English app for Farsi speakers targeting ${level}. Produce ONE natural spoken-mono monologue (as if a person is talking, with hesitations kept minimal, contractions used) on the requested topic. The user message carries a DIFFICULTY ENVELOPE - obey its word-count band, sentence-length band, and idiom density exactly; the envelope wins over any default. Then 4 comprehension questions: two literal, two inferential, each mcq with 4 choices.

Output ONE JSON object, nothing else:
{"title": "short title", "text": "the monologue", "questions": [{"q": "", "choices": ["", "", "", ""], "a": "exact correct choice", "why": "one line in English"}]}
Never use the em dash character anywhere in your output.`;
}
}),
"[project]/src/content/deck.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"version\":1,\"cards\":[{\"id\":\"col001\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The board will ___ a decision on Friday.\",\"answer\":\"make\",\"alt\":[],\"en\":\"make a decision\",\"fa\":\"تصمیم گرفتن\",\"note\":\"make + decision. Never 'do a decision'.\",\"traps\":[],\"distractors\":[\"do\",\"take\"]},{\"id\":\"col002\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Founders must ___ a risk to grow.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take a risk\",\"fa\":\"ریسک کردن\",\"note\":\"take a risk, take risks\",\"traps\":[],\"distractors\":[\"make\",\"do\"]},{\"id\":\"col003\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Please ___ attention to the deadline.\",\"answer\":\"pay\",\"alt\":[],\"en\":\"pay attention\",\"fa\":\"توجه کردن\",\"note\":\"pay attention to something\",\"traps\":[],\"distractors\":[\"give\",\"put\"]},{\"id\":\"col004\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Our team ___ research on battery life.\",\"answer\":\"does\",\"alt\":[],\"en\":\"do research\",\"fa\":\"تحقیق کردن\",\"note\":\"do research (never 'make research')\",\"traps\":[],\"distractors\":[\"makes\",\"takes\"]},{\"id\":\"col005\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"You have ___ progress this month.\",\"answer\":\"made\",\"alt\":[],\"en\":\"make progress\",\"fa\":\"پیشرفت کردن\",\"note\":\"make progress\",\"traps\":[],\"distractors\":[\"taken\",\"done\"]},{\"id\":\"col006\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"A manager should ___ responsibility for mistakes.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take responsibility\",\"fa\":\"مسئولیت پذیرفتن\",\"note\":\"take responsibility for something\",\"traps\":[],\"distractors\":[\"make\",\"give\"]},{\"id\":\"col007\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"We shipped on time and ___ the deadline.\",\"answer\":\"met\",\"alt\":[],\"en\":\"meet a deadline\",\"fa\":\"ضرب‌الاجل را رعایت کردن\",\"note\":\"meet a deadline (past: met)\",\"traps\":[],\"distractors\":[\"took\",\"caught\"]},{\"id\":\"col008\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She always ___ her promises.\",\"answer\":\"keeps\",\"alt\":[],\"en\":\"keep a promise\",\"fa\":\"به قول عمل کردن\",\"note\":\"keep a promise\",\"traps\":[],\"distractors\":[\"makes\",\"does\"]},{\"id\":\"col009\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"It is hard to ___ a habit overnight.\",\"answer\":\"break\",\"alt\":[],\"en\":\"break a habit\",\"fa\":\"ترک عادت کردن\",\"note\":\"break a habit\",\"traps\":[],\"distractors\":[\"cut\",\"destroy\"]},{\"id\":\"col010\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The final will ___ place on Sunday.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take place\",\"fa\":\"برگزار شدن\",\"note\":\"take place = happen\",\"traps\":[],\"distractors\":[\"make\",\"hold\"]},{\"id\":\"col011\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Small teams ___ a big role in open source.\",\"answer\":\"play\",\"alt\":[],\"en\":\"play a role\",\"fa\":\"نقش داشتن\",\"note\":\"play a role in something\",\"traps\":[],\"distractors\":[\"make\",\"take\"]},{\"id\":\"col012\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"If you ___ an effort, your writing improves fast.\",\"answer\":\"make\",\"alt\":[],\"en\":\"make an effort\",\"fa\":\"تلاش کردن\",\"note\":\"make an effort\",\"traps\":[],\"distractors\":[\"do\",\"take\"]},{\"id\":\"col013\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Two hundred students ___ part in the contest.\",\"answer\":\"took\",\"alt\":[],\"en\":\"take part\",\"fa\":\"شرکت کردن\",\"note\":\"take part in\",\"traps\":[],\"distractors\":[\"made\",\"gave\"]},{\"id\":\"col014\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"After the data came in, we ___ to a conclusion.\",\"answer\":\"came\",\"alt\":[],\"en\":\"come to a conclusion\",\"fa\":\"به نتیجه رسیدن\",\"note\":\"come to / reach a conclusion\",\"traps\":[],\"distractors\":[\"went\",\"arrived\"]},{\"id\":\"col015\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The report ___ a question about safety.\",\"answer\":\"raises\",\"alt\":[],\"en\":\"raise a question\",\"fa\":\"سؤالی مطرح کردن\",\"note\":\"raise a question\",\"traps\":[],\"distractors\":[\"gives\",\"asks out\"]},{\"id\":\"col016\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Both sides finally ___ an agreement.\",\"answer\":\"reached\",\"alt\":[],\"en\":\"reach an agreement\",\"fa\":\"به توافق رسیدن\",\"note\":\"reach an agreement\",\"traps\":[],\"distractors\":[\"got\",\"took\"]},{\"id\":\"col017\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I have an ___ with the dentist at five.\",\"answer\":\"appointment\",\"alt\":[],\"en\":\"make an appointment\",\"fa\":\"وقت گرفتن\",\"note\":\"make an appointment with\",\"traps\":[],\"distractors\":[\"rendezvous\",\"arrangement\"]},{\"id\":\"col018\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Smoking does ___ to your lungs.\",\"answer\":\"harm\",\"alt\":[],\"en\":\"do harm\",\"fa\":\"آسیب رساندن\",\"note\":\"do harm (never 'make harm')\",\"traps\":[],\"distractors\":[\"damage word: hurts\",\"make\"]},{\"id\":\"col019\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"He ___ money by repairing bikes.\",\"answer\":\"makes\",\"alt\":[],\"en\":\"make money\",\"fa\":\"پول درآوردن\",\"note\":\"make money\",\"traps\":[],\"distractors\":[\"does\",\"takes\"]},{\"id\":\"col020\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Let's ___ a break before the next module.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take a break\",\"fa\":\"استراحت کردن\",\"note\":\"take a break\",\"traps\":[],\"distractors\":[\"make\",\"have on\"]},{\"id\":\"col021\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"It is easy to ___ friends at a new job.\",\"answer\":\"make\",\"alt\":[],\"en\":\"make friends\",\"fa\":\"دوست پیدا کردن\",\"note\":\"make friends with someone\",\"traps\":[],\"distractors\":[\"do\",\"get\"]},{\"id\":\"col022\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"We should ___ in touch after the course.\",\"answer\":\"keep\",\"alt\":[],\"en\":\"keep in touch\",\"fa\":\"در تماس بودن\",\"note\":\"keep in touch with someone\",\"traps\":[],\"distractors\":[\"stay touch\",\"hold\"]},{\"id\":\"col023\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I lost ___ of time while reading.\",\"answer\":\"track\",\"alt\":[],\"en\":\"lose track of time\",\"fa\":\"حس زمان را از دست دادن\",\"note\":\"lose track of\",\"traps\":[],\"distractors\":[\"line\",\"watch\"]},{\"id\":\"col024\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Your explanation doesn't ___ sense.\",\"answer\":\"make\",\"alt\":[],\"en\":\"make sense\",\"fa\":\"منطقی بودن\",\"note\":\"make sense; questions: does it make sense?\",\"traps\":[],\"distractors\":[\"do\",\"have\"]},{\"id\":\"col025\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"This change will ___ a difference to air quality.\",\"answer\":\"make\",\"alt\":[],\"en\":\"make a difference\",\"fa\":\"تأثیر گذاشتن\",\"note\":\"make a difference\",\"traps\":[],\"distractors\":[\"do\",\"give\"]},{\"id\":\"col026\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Engineers must ___ these costs into account.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take into account\",\"fa\":\"در نظر گرفتن\",\"note\":\"take something into account\",\"traps\":[],\"distractors\":[\"make\",\"put\"]},{\"id\":\"col027\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"___ the truth, she was nervous.\",\"answer\":\"Telling\",\"alt\":[],\"en\":\"tell the truth\",\"fa\":\"راستش را بخواهی\",\"note\":\"tell the truth / to tell you the truth\",\"traps\":[],\"distractors\":[\"Saying\",\"Speaking\"]},{\"id\":\"col028\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Could you ___ me a favor?\",\"answer\":\"do\",\"alt\":[],\"en\":\"do someone a favor\",\"fa\":\"لطفی کردن\",\"note\":\"do someone a favor\",\"traps\":[],\"distractors\":[\"make\",\"give\"]},{\"id\":\"col029\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Please ___ care of the invoices today.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take care of\",\"fa\":\"رسیدگی کردن\",\"note\":\"take care of something\",\"traps\":[],\"distractors\":[\"make\",\"hold\"]},{\"id\":\"col030\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The new chip will ___ the lead in speed.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take the lead\",\"fa\":\"پیشتاز شدن\",\"note\":\"take the lead in\",\"traps\":[],\"distractors\":[\"make\",\"get over\"]},{\"id\":\"col031\",\"unit\":\"colloc_core\",\"skill\":\"collocation\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Wages failed to ___ pace with rent.\",\"answer\":\"keep\",\"alt\":[],\"en\":\"keep pace with\",\"fa\":\"هم‌قدم بودن با\",\"note\":\"keep pace with something\",\"traps\":[],\"distractors\":[\"make pace\",\"catch\"]},{\"id\":\"col032\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Two years of patience finally ___ fruit.\",\"answer\":\"bore\",\"alt\":[],\"en\":\"bear fruit\",\"fa\":\"ثمر دادن، نتیجه دادن\",\"note\":\"bear fruit (past: bore)\",\"traps\":[],\"distractors\":[\"made\",\"gave\"]},{\"id\":\"col033\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The minister ___ under pressure to resign.\",\"answer\":\"came\",\"alt\":[],\"en\":\"come under pressure\",\"fa\":\"تحت فشار قرار گرفتن\",\"note\":\"come under pressure to do something\",\"traps\":[],\"distractors\":[\"took\",\"felt on\"]},{\"id\":\"col034\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The protest movement is ___ momentum.\",\"answer\":\"gaining\",\"alt\":[],\"en\":\"gain momentum\",\"fa\":\"شتاب گرفتن\",\"note\":\"gain/lose momentum\",\"traps\":[],\"distractors\":[\"taking\",\"doing\"]},{\"id\":\"col035\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The design fails to ___ the second criterion.\",\"answer\":\"meet\",\"alt\":[],\"en\":\"meet a criterion\",\"fa\":\"معیار را برآورده کردن\",\"note\":\"meet criteria/standards\",\"traps\":[],\"distractors\":[\"reach\",\"fill\"]},{\"id\":\"col036\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Rising costs ___ a challenge to exporters.\",\"answer\":\"pose\",\"alt\":[],\"en\":\"pose a challenge\",\"fa\":\"چالشی ایجاد کردن\",\"note\":\"pose a challenge/threat/question\",\"traps\":[],\"distractors\":[\"make\",\"raise up\"]},{\"id\":\"col037\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The campaign ___ awareness about water use.\",\"answer\":\"raised\",\"alt\":[],\"en\":\"raise awareness\",\"fa\":\"آگاهی‌بخشی کردن\",\"note\":\"raise awareness of something\",\"traps\":[],\"distractors\":[\"gave\",\"lifted\"]},{\"id\":\"col038\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Her lecture ___ light on an obscure dispute.\",\"answer\":\"shed\",\"alt\":[],\"en\":\"shed light on\",\"fa\":\"روشن کردن یک موضوع\",\"note\":\"shed light on (past: shed)\",\"traps\":[],\"distractors\":[\"lit\",\"threw on\"]},{\"id\":\"col039\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"A mediator can ___ the gap between the sides.\",\"answer\":\"bridge\",\"alt\":[],\"en\":\"bridge the gap\",\"fa\":\"شکاف را پر کردن\",\"note\":\"bridge/narrow the gap\",\"traps\":[],\"distractors\":[\"fill over\",\"tie\"]},{\"id\":\"col040\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The bank moved to ___ inflation.\",\"answer\":\"curb\",\"alt\":[],\"en\":\"curb inflation\",\"fa\":\"مهار تورم\",\"note\":\"curb = restrain\",\"traps\":[],\"distractors\":[\"cut down\",\"stopper\"]},{\"id\":\"col041\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"She ___ the opportunity to study abroad.\",\"answer\":\"seized\",\"alt\":[],\"en\":\"seize the opportunity\",\"fa\":\"از فرصت استفاده کردن\",\"note\":\"seize an opportunity\",\"traps\":[],\"distractors\":[\"caught\",\"grabbed on\"]},{\"id\":\"col042\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Chairmen ___ influence through the board.\",\"answer\":\"wield\",\"alt\":[],\"en\":\"wield influence\",\"fa\":\"نفوذ اعمال کردن\",\"note\":\"wield influence/power\",\"traps\":[],\"distractors\":[\"carry on\",\"swing\"]},{\"id\":\"col043\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Analysts ___ doubts about the forecast.\",\"answer\":\"harbor\",\"alt\":[],\"en\":\"harbor doubts\",\"fa\":\"تردید در دل داشتن\",\"note\":\"harbor doubts/reservations\",\"traps\":[],\"distractors\":[\"keep in\",\"feed\"]},{\"id\":\"col044\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The delay ___ additional costs.\",\"answer\":\"incurred\",\"alt\":[],\"en\":\"incur costs\",\"fa\":\"هزینه‌ای تحمیل کردن\",\"note\":\"incur costs/losses (past: incurred)\",\"traps\":[],\"distractors\":[\"charged\",\"brought in\"]},{\"id\":\"col045\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The state may ___ a tax on sugary drinks.\",\"answer\":\"levy\",\"alt\":[],\"en\":\"levy a tax\",\"fa\":\"مالیات وضع کردن\",\"note\":\"levy a tax on\",\"traps\":[],\"distractors\":[\"put\",\"raise on\"]},{\"id\":\"col046\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Hedging can ___ losses in volatile markets.\",\"answer\":\"offset\",\"alt\":[],\"en\":\"offset losses\",\"fa\":\"جبران زیان\",\"note\":\"offset something with/by\",\"traps\":[],\"distractors\":[\"outweigh\",\"repair\"]},{\"id\":\"col047\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The teaser was designed to ___ interest.\",\"answer\":\"pique\",\"alt\":[],\"en\":\"pique interest\",\"fa\":\"کنجکاوی برانگیختن\",\"note\":\"pique interest/curiosity\",\"traps\":[],\"distractors\":[\"pick\",\"rise\"]},{\"id\":\"col048\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The methodology will not ___ scrutiny.\",\"answer\":\"stand\",\"alt\":[],\"en\":\"stand scrutiny\",\"fa\":\"زیر ذره‌بین دوام آوردن\",\"note\":\"stand/bear scrutiny\",\"traps\":[],\"distractors\":[\"carry\",\"hold up on\"]},{\"id\":\"col049\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Patient investors ___ the benefits later.\",\"answer\":\"reaped\",\"alt\":[],\"en\":\"reap benefits\",\"fa\":\"برداشت کردن از نتایج\",\"note\":\"reap rewards/benefits\",\"traps\":[],\"distractors\":[\"cut\",\"collected up\"]},{\"id\":\"col050\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Years of drought are ___ their toll on farms.\",\"answer\":\"taking\",\"alt\":[],\"en\":\"take its toll on\",\"fa\":\"تلفات و آسیب وارد کردن\",\"note\":\"take its toll on something\",\"traps\":[],\"distractors\":[\"making\",\"paying\"]},{\"id\":\"col051\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The candidate ___ support from rural voters.\",\"answer\":\"garnered\",\"alt\":[],\"en\":\"garner support\",\"fa\":\"حمایت جلب کردن\",\"note\":\"garner support/attention\",\"traps\":[],\"distractors\":[\"garnished\",\"collected in\"]},{\"id\":\"col052\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The survey ___ a strong response from users.\",\"answer\":\"elicited\",\"alt\":[],\"en\":\"elicit a response\",\"fa\":\"واکنش برانگیختن\",\"note\":\"elicit a response/reply\",\"traps\":[],\"distractors\":[\"illicited\",\"asked out\"]},{\"id\":\"col053\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Mentors ___ knowledge as well as skills.\",\"answer\":\"impart\",\"alt\":[],\"en\":\"impart knowledge\",\"fa\":\"دانش منتقل کردن\",\"note\":\"impart knowledge/wisdom to\",\"traps\":[],\"distractors\":[\"import\",\"give away\"]},{\"id\":\"col054\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Whether to rebrand remains a ___ point.\",\"answer\":\"moot\",\"alt\":[],\"en\":\"a moot point\",\"fa\":\"موضوع بحث‌برانگیز و بی‌نتیجه\",\"note\":\"a moot point = debatable\",\"traps\":[],\"distractors\":[\"mute\",\"closed\"]},{\"id\":\"col055\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Telemedicine is a ___ alternative for villages.\",\"answer\":\"viable\",\"alt\":[],\"en\":\"a viable alternative\",\"fa\":\"جانشین عملی و شدنی\",\"note\":\"viable alternative/option\",\"traps\":[],\"distractors\":[\"variable\",\"able\"]},{\"id\":\"col056\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The deal had the minister's ___ approval.\",\"answer\":\"tacit\",\"alt\":[],\"en\":\"tacit approval\",\"fa\":\"رضایت ضمنی\",\"note\":\"tacit = understood without words\",\"traps\":[],\"distractors\":[\"tactic\",\"silent word: mute\"]},{\"id\":\"col057\",\"unit\":\"colloc_c1\",\"skill\":\"collocation\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Safety is a matter of ___ importance.\",\"answer\":\"utmost\",\"alt\":[],\"en\":\"utmost importance\",\"fa\":\"اهمیت حداکثری\",\"note\":\"of the utmost importance\",\"traps\":[],\"distractors\":[\"uttermist\",\"highest word: most\"]},{\"id\":\"phr058\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The lab will ___ out the tests next week.\",\"answer\":\"carry\",\"alt\":[],\"en\":\"carry out\",\"fa\":\"انجام دادن\",\"note\":\"carry out research/tests/a plan\",\"traps\":[],\"distractors\":[\"bring\",\"hold\"]},{\"id\":\"phr059\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"They ___ off the launch until March.\",\"answer\":\"put\",\"alt\":[],\"en\":\"put off\",\"fa\":\"به تعویق انداختن\",\"note\":\"put off = postpone\",\"traps\":[],\"distractors\":[\"took\",\"left\"]},{\"id\":\"phr060\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"My laptop ___ down twice this week.\",\"answer\":\"broke\",\"alt\":[],\"en\":\"break down\",\"fa\":\"از کار افتادن\",\"note\":\"break down = stop working\",\"traps\":[],\"distractors\":[\"fell\",\"went\"]},{\"id\":\"phr061\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She ___ up a small studio in Tehran.\",\"answer\":\"set\",\"alt\":[],\"en\":\"set up\",\"fa\":\"راه‌اندازی کردن\",\"note\":\"set up a business/system\",\"traps\":[],\"distractors\":[\"stood\",\"built in\"]},{\"id\":\"phr062\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I had to ___ down their offer.\",\"answer\":\"turn\",\"alt\":[],\"en\":\"turn down\",\"fa\":\"رد کردن\",\"note\":\"turn down an offer\",\"traps\":[],\"distractors\":[\"cut\",\"put\"]},{\"id\":\"phr063\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"We need to ___ up with a better name.\",\"answer\":\"come\",\"alt\":[],\"en\":\"come up with\",\"fa\":\"به ایده‌ای رسیدن\",\"note\":\"come up with an idea\",\"traps\":[],\"distractors\":[\"get\",\"bring\"]},{\"id\":\"phr064\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The auditors will ___ into the missing funds.\",\"answer\":\"look\",\"alt\":[],\"en\":\"look into\",\"fa\":\"رسیدگی کردن\",\"note\":\"look into a matter\",\"traps\":[],\"distractors\":[\"search\",\"see\"]},{\"id\":\"phr065\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"He ___ out two flaws in the design.\",\"answer\":\"pointed\",\"alt\":[],\"en\":\"point out\",\"fa\":\"اشاره کردن، گوشزد کردن\",\"note\":\"point out a problem\",\"traps\":[],\"distractors\":[\"showed up\",\"said\"]},{\"id\":\"phr066\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The new policy ___ about real change.\",\"answer\":\"brought\",\"alt\":[],\"en\":\"bring about\",\"fa\":\"به وجود آوردن\",\"note\":\"bring about a change\",\"traps\":[],\"distractors\":[\"carried\",\"came\"]},{\"id\":\"phr067\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Don't ___ up; the syntax is almost right.\",\"answer\":\"give\",\"alt\":[],\"en\":\"give up\",\"fa\":\"تسلیم شدن\",\"note\":\"give up doing something\",\"traps\":[],\"distractors\":[\"leave\",\"put\"]},{\"id\":\"phr068\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I can't ___ out why the test fails.\",\"answer\":\"figure\",\"alt\":[],\"en\":\"figure out\",\"fa\":\"سر در آوردن\",\"note\":\"figure out a puzzle/why\",\"traps\":[],\"distractors\":[\"work on\",\"solve out\"]},{\"id\":\"phr069\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I ___ into an old classmate at the bazaar.\",\"answer\":\"ran\",\"alt\":[],\"en\":\"run into\",\"fa\":\"به‌طور تصادفی دیدن\",\"note\":\"run into someone\",\"traps\":[],\"distractors\":[\"bumped on\",\"met with\"]},{\"id\":\"phr070\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"It is hard to ___ up with the news cycle.\",\"answer\":\"keep\",\"alt\":[],\"en\":\"keep up with\",\"fa\":\"هم‌قدم ماندن با\",\"note\":\"keep up with something\",\"traps\":[],\"distractors\":[\"catch on\",\"follow up\"]},{\"id\":\"phr071\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Try to ___ down on sugar this month.\",\"answer\":\"cut\",\"alt\":[],\"en\":\"cut down on\",\"fa\":\"کاهش دادن\",\"note\":\"cut down on something\",\"traps\":[],\"distractors\":[\"lower\",\"drop off\"]},{\"id\":\"phr072\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I ___ across an old letter in the drawer.\",\"answer\":\"came\",\"alt\":[],\"en\":\"come across\",\"fa\":\"به‌طور تصادفی پیدا کردن\",\"note\":\"come across something\",\"traps\":[],\"distractors\":[\"found over\",\"met\"]},{\"id\":\"phr073\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Who will ___ with angry customers?\",\"answer\":\"deal\",\"alt\":[],\"en\":\"deal with\",\"fa\":\"رسیدگی کردن به\",\"note\":\"deal with a problem/person\",\"traps\":[],\"distractors\":[\"do up\",\"treat with\"]},{\"id\":\"phr074\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"He ___ up teaching and went into finance.\",\"answer\":\"gave\",\"alt\":[],\"en\":\"give up\",\"fa\":\"رها کردن\",\"note\":\"give up a career\",\"traps\":[],\"distractors\":[\"left from\",\"dropped off\"]},{\"id\":\"phr075\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"We ___ up paying more than we planned.\",\"answer\":\"ended\",\"alt\":[],\"en\":\"end up\",\"fa\":\"در نهایت به جایی رسیدن\",\"note\":\"end up doing something\",\"traps\":[],\"distractors\":[\"finished to\",\"closed\"]},{\"id\":\"phr076\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The deal ___ through at the last minute.\",\"answer\":\"fell\",\"alt\":[],\"en\":\"fall through\",\"fa\":\"خوانده نشدن، شکست خوردن\",\"note\":\"fall through = fail\",\"traps\":[],\"distractors\":[\"dropped\",\"broke\"]},{\"id\":\"phr077\",\"unit\":\"phrasal\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Do you ___ along with your coworkers?\",\"answer\":\"get\",\"alt\":[],\"en\":\"get along with\",\"fa\":\"کنار آمدن با\",\"note\":\"get along/on with someone\",\"traps\":[],\"distractors\":[\"go along to\",\"walk\"]},{\"id\":\"phr078\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Please ___ in your assignment by Thursday.\",\"answer\":\"hand\",\"alt\":[],\"en\":\"hand in\",\"fa\":\"تحویل دادن\",\"note\":\"hand in work\",\"traps\":[],\"distractors\":[\"give in to\",\"deliver\"]},{\"id\":\"phr079\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"___ on a moment, I am almost done.\",\"answer\":\"Hold\",\"alt\":[],\"en\":\"hold on\",\"fa\":\"صبر کردن\",\"note\":\"hold on = wait\",\"traps\":[],\"distractors\":[\"Stay\",\"Keep\"]},{\"id\":\"phr080\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"I ___ forward to seeing the final cut.\",\"answer\":\"look\",\"alt\":[],\"en\":\"look forward to\",\"fa\":\"بی‌صبرانه منتظر بودن\",\"note\":\"look forward to + ing\",\"traps\":[],\"distractors\":[\"wait forward\",\"hope\"]},{\"id\":\"phr081\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The kids ___ up an excuse about traffic.\",\"answer\":\"made\",\"alt\":[],\"en\":\"make up\",\"fa\":\"داستان‌سرایی کردن، جعل کردن\",\"note\":\"make up an excuse/story\",\"traps\":[],\"distractors\":[\"invented out\",\"built\"]},{\"id\":\"phr082\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Do not ___ up such a rare offer.\",\"answer\":\"pass\",\"alt\":[],\"en\":\"pass up\",\"fa\":\"از دست دادن یک فرصت\",\"note\":\"pass up an opportunity\",\"traps\":[],\"distractors\":[\"throw\",\"miss down\"]},{\"id\":\"phr083\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"She ___ off the presentation despite nerves.\",\"answer\":\"pulled\",\"alt\":[],\"en\":\"pull off\",\"fa\":\"با موفقیت انجام دادن کار سختی\",\"note\":\"pull off something difficult\",\"traps\":[],\"distractors\":[\"carried off to\",\"managed to\"]},{\"id\":\"phr084\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"I will not ___ up with rude reviews.\",\"answer\":\"put\",\"alt\":[],\"en\":\"put up with\",\"fa\":\"تحمل کردن\",\"note\":\"put up with something\",\"traps\":[],\"distractors\":[\"tolerate up\",\"stand with\"]},{\"id\":\"phr085\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The police ___ out sabotage early on.\",\"answer\":\"ruled\",\"alt\":[],\"en\":\"rule out\",\"fa\":\"مسترد کردن، کنار گذاشتن\",\"note\":\"rule out a possibility\",\"traps\":[],\"distractors\":[\"excluded out\",\"denied\"]},{\"id\":\"phr086\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"We ___ out of printer paper again.\",\"answer\":\"ran\",\"alt\":[],\"en\":\"run out of\",\"fa\":\"تمام شدن موجودی\",\"note\":\"run out of something\",\"traps\":[],\"distractors\":[\"finished from\",\"ended\"]},{\"id\":\"phr087\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Let's ___ out the schedule for Friday.\",\"answer\":\"sort\",\"alt\":[],\"en\":\"sort out\",\"fa\":\"مرتب و حل کردن\",\"note\":\"sort out a problem\",\"traps\":[],\"distractors\":[\"solve out\",\"arrange up\"]},{\"id\":\"phr088\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The logo ___ for quality in this market.\",\"answer\":\"stands\",\"alt\":[],\"en\":\"stand for\",\"fa\":\"نماد بودن، به معنای بودن\",\"note\":\"stand for something\",\"traps\":[],\"distractors\":[\"means for\",\"signs\"]},{\"id\":\"phr089\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Her deputy will ___ over while she is away.\",\"answer\":\"take\",\"alt\":[],\"en\":\"take over\",\"fa\":\"جای کسی را گرفتن\",\"note\":\"take over a role/company\",\"traps\":[],\"distractors\":[\"get over\",\"hold\"]},{\"id\":\"phr090\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Do not ___ away the receipts; we need them.\",\"answer\":\"throw\",\"alt\":[],\"en\":\"throw away\",\"fa\":\"دور انداختن\",\"note\":\"throw away\",\"traps\":[],\"distractors\":[\"put out\",\"give off\"]},{\"id\":\"phr091\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"We should ___ out the beta with a small group.\",\"answer\":\"try\",\"alt\":[],\"en\":\"try out\",\"fa\":\"امتحان کردن\",\"note\":\"try out a product\",\"traps\":[],\"distractors\":[\"test on\",\"prove\"]},{\"id\":\"phr092\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"He ___ up late to the interview.\",\"answer\":\"turned\",\"alt\":[],\"en\":\"turn up\",\"fa\":\"سر رسیدن، حاضر شدن\",\"note\":\"turn up = appear\",\"traps\":[],\"distractors\":[\"showed in\",\"came over\"]},{\"id\":\"phr093\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Cheap cables ___ out within months.\",\"answer\":\"wear\",\"alt\":[],\"en\":\"wear out\",\"fa\":\"از پا افتادن، فرسوده شدن\",\"note\":\"wear out\",\"traps\":[],\"distractors\":[\"tear off\",\"use over\"]},{\"id\":\"phr094\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The numbers ___ out; we can ship Friday.\",\"answer\":\"work\",\"alt\":[],\"en\":\"work out\",\"fa\":\"درست از آب درآمدن\",\"note\":\"work out = resolve/succeed\",\"traps\":[],\"distractors\":[\"count up\",\"come to\"]},{\"id\":\"phr095\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Always ___ up the database before updates.\",\"answer\":\"back\",\"alt\":[],\"en\":\"back up\",\"fa\":\"نسخه پشتیبان گرفتن\",\"note\":\"back up files\",\"traps\":[],\"distractors\":[\"support\",\"copy under\"]},{\"id\":\"phr096\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"I need to ___ up on my French before June.\",\"answer\":\"brush\",\"alt\":[],\"en\":\"brush up on\",\"fa\":\"تمرین دوباره کردن\",\"note\":\"brush up on a skill\",\"traps\":[],\"distractors\":[\"polish\",\"refresh on\"]},{\"id\":\"phr097\",\"unit\":\"phrasal_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Stay late and ___ up with the backlog.\",\"answer\":\"catch\",\"alt\":[],\"en\":\"catch up with\",\"fa\":\"عقب‌ماندگی را جبران کردن\",\"note\":\"catch up with/on\",\"traps\":[],\"distractors\":[\"chase\",\"reach\"]},{\"id\":\"awl098\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"A close ___ of the data reveals a flaw.\",\"answer\":\"analysis\",\"alt\":[],\"en\":\"analysis\",\"fa\":\"تحلیل\",\"note\":\"analysis (n), analyse (v)\",\"traps\":[],\"distractors\":[\"analyze\",\"analyses\"]},{\"id\":\"awl099\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Her ___ to the problem is refreshingly simple.\",\"answer\":\"approach\",\"alt\":[],\"en\":\"approach\",\"fa\":\"رویکرد\",\"note\":\"approach to something\",\"traps\":[],\"distractors\":[\"method to\",\"way of treat\"]},{\"id\":\"awl100\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"We must ___ the risks before launch.\",\"answer\":\"assess\",\"alt\":[],\"en\":\"assess\",\"fa\":\"ارزیابی کردن\",\"note\":\"assess a situation\",\"traps\":[],\"distractors\":[\"judge for\",\"estimate\"]},{\"id\":\"awl101\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"___ that the server is down, what then?\",\"answer\":\"Assuming\",\"alt\":[],\"en\":\"assume\",\"fa\":\"فرض کردن\",\"note\":\"assuming (that) = if we suppose\",\"traps\":[],\"distractors\":[\"Supposing in\",\"Taking\"]},{\"id\":\"awl102\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Only the ___ can declare war here.\",\"answer\":\"authority\",\"alt\":[],\"en\":\"authority\",\"fa\":\"مرجع قدرت\",\"note\":\"the authorities\",\"traps\":[],\"distractors\":[\"government word: author\",\"author\"]},{\"id\":\"awl103\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The archive is freely ___ to students.\",\"answer\":\"available\",\"alt\":[],\"en\":\"available\",\"fa\":\"در دسترس\",\"note\":\"available to someone\",\"traps\":[],\"distractors\":[\"accessible for\",\"handy\"]},{\"id\":\"awl104\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Regular sleep has clear health ___ .\",\"answer\":\"benefits\",\"alt\":[],\"en\":\"benefit\",\"fa\":\"منفعت\",\"note\":\"benefit from something\",\"traps\":[],\"distractors\":[\"profits in\",\"goods\"]},{\"id\":\"awl105\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The course builds on three core ___ .\",\"answer\":\"concepts\",\"alt\":[],\"en\":\"concept\",\"fa\":\"مفهوم\",\"note\":\"a concept of/behind\",\"traps\":[],\"distractors\":[\"concepts word: ideas only\",\"conception\"]},{\"id\":\"awl106\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The committee ___ of nine members.\",\"answer\":\"consists\",\"alt\":[],\"en\":\"consist of\",\"fa\":\"تشکیل شدن از\",\"note\":\"consist of (no passive)\",\"traps\":[],\"distractors\":[\"composes of\",\"contains of\"]},{\"id\":\"awl107\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Words change meaning depending on ___ .\",\"answer\":\"context\",\"alt\":[],\"en\":\"context\",\"fa\":\"بافت و زمینه\",\"note\":\"in the context of\",\"traps\":[],\"distractors\":[\"texture\",\"contest\"]},{\"id\":\"awl108\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The trial will ___ over six months.\",\"answer\":\"run\",\"alt\":[],\"en\":\"run over a period\",\"fa\":\"در طول بودن\",\"note\":\"over a period of six months\",\"traps\":[],\"distractors\":[\"during\",\"within of\"]},{\"id\":\"awl109\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The state will ___ the new rules next year.\",\"answer\":\"implement\",\"alt\":[],\"en\":\"implement\",\"fa\":\"اجرا کردن\",\"note\":\"implement a policy\",\"traps\":[],\"distractors\":[\"inplement\",\"realize\"]},{\"id\":\"awl110\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Scientists ___ a link between sleep and memory.\",\"answer\":\"identify\",\"alt\":[],\"en\":\"identify\",\"fa\":\"شناسایی کردن\",\"note\":\"identify a link/cause\",\"traps\":[],\"distractors\":[\"prove up\",\"detect on\"]},{\"id\":\"awl111\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The survey ___ widespread dissatisfaction.\",\"answer\":\"indicates\",\"alt\":[],\"en\":\"indicate\",\"fa\":\"نشان دادن\",\"note\":\"indicate that\",\"traps\":[],\"distractors\":[\"signals out\",\"points\"]},{\"id\":\"awl112\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Two factors ___ in the price surge.\",\"answer\":\"involved\",\"alt\":[],\"en\":\"be involved in\",\"fa\":\"درگیر بودن در\",\"note\":\"be involved in something\",\"traps\":[],\"distractors\":[\"included to\",\"concerned of\"]},{\"id\":\"awl113\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Access to clean water is a human ___ .\",\"answer\":\"issue\",\"alt\":[],\"en\":\"issue\",\"fa\":\"مسئله مهم\",\"note\":\"a key/pressing issue\",\"traps\":[],\"distractors\":[\"topic paper\",\"output\"]},{\"id\":\"awl114\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The law requires ___ consent from parents.\",\"answer\":\"explicit\",\"alt\":[],\"en\":\"explicit\",\"fa\":\"صریح\",\"note\":\"explicit consent\",\"traps\":[],\"distractors\":[\"expressive\",\"implicit\"]},{\"id\":\"awl115\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Cost is a major ___ in the decision.\",\"answer\":\"factor\",\"alt\":[],\"en\":\"factor\",\"fa\":\"عامل\",\"note\":\"a factor in something\",\"traps\":[],\"distractors\":[\"fact\",\"agent\"]},{\"id\":\"awl116\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Their estimate ___ the real cost by half.\",\"answer\":\"understates\",\"alt\":[],\"en\":\"understate\",\"fa\":\"کم‌نمایی کردن\",\"note\":\"understate/overstate\",\"traps\":[],\"distractors\":[\"lowerstates\",\"misstate\"]},{\"id\":\"awl117\",\"unit\":\"awl\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"There is ___ evidence for the claim.\",\"answer\":\"little\",\"alt\":[],\"en\":\"little evidence\",\"fa\":\"اندک شواهدی\",\"note\":\"little + uncountable\",\"traps\":[],\"distractors\":[\"few\",\"a few of\"]},{\"id\":\"awl118\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The word ___ two related meanings in law.\",\"answer\":\"carries\",\"alt\":[],\"en\":\"carry a meaning\",\"fa\":\"معنایی را حمل کردن\",\"note\":\"carry a meaning/connotation\",\"traps\":[],\"distractors\":[\"holds in\",\"takes\"]},{\"id\":\"awl119\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The finding has been widely ___ in the field.\",\"answer\":\"cited\",\"alt\":[],\"en\":\"cite\",\"fa\":\"استناد کردن\",\"note\":\"cite a source\",\"traps\":[],\"distractors\":[\"sited\",\"quoted in\"]},{\"id\":\"awl120\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The data ___ the earlier hypothesis.\",\"answer\":\"contradicts\",\"alt\":[],\"en\":\"contradict\",\"fa\":\"نقض کردن\",\"note\":\"contradict a claim\",\"traps\":[],\"distractors\":[\"contrast to\",\"deny of\"]},{\"id\":\"awl121\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Oil revenues ___ the entire budget.\",\"answer\":\"dominate\",\"alt\":[],\"en\":\"dominate\",\"fa\":\"چیره بودن بر\",\"note\":\"dominate a market\",\"traps\":[],\"distractors\":[\"rule over to\",\"master\"]},{\"id\":\"awl122\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The rule no longer ___ to freelancers.\",\"answer\":\"applies\",\"alt\":[],\"en\":\"apply to\",\"fa\":\"شامل شدن، مصداق داشتن\",\"note\":\"apply to someone\",\"traps\":[],\"distractors\":[\"fit to\",\"belong\"]},{\"id\":\"awl123\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The two effects are hard to ___ .\",\"answer\":\"isolate\",\"alt\":[],\"en\":\"isolate\",\"fa\":\"جدا کردن\",\"note\":\"isolate a variable\",\"traps\":[],\"distractors\":[\"island\",\"seclude\"]},{\"id\":\"awl124\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The theorem was later ___ by another team.\",\"answer\":\"verified\",\"alt\":[],\"en\":\"verify\",\"fa\":\"راستی‌آزمایی کردن\",\"note\":\"verify a result\",\"traps\":[],\"distractors\":[\"verity\",\"confirmed in\"]},{\"id\":\"awl125\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"A ___ of studies supports the method.\",\"answer\":\"body\",\"alt\":[],\"en\":\"a body of evidence\",\"fa\":\"پیکره‌ای از شواهد\",\"note\":\"a body of work/evidence\",\"traps\":[],\"distractors\":[\"bunch\",\"collection of a\"]},{\"id\":\"awl126\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The sample was ___ small to be conclusive.\",\"answer\":\"too\",\"alt\":[],\"en\":\"too small to\",\"fa\":\"برای نتیجه‌گیری خیلی کوچک\",\"note\":\"too + adj + to\",\"traps\":[],\"distractors\":[\"so\",\"very to\"]},{\"id\":\"awl127\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The curve ___ sharply after 2010.\",\"answer\":\"steepens\",\"alt\":[],\"en\":\"steepen\",\"fa\":\"تندتر شدن\",\"note\":\"a steep rise\",\"traps\":[],\"distractors\":[\"stiffens\",\"sharps\"]},{\"id\":\"awl128\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The drug is ___ administered twice daily.\",\"answer\":\"typically\",\"alt\":[],\"en\":\"typically\",\"fa\":\"به‌طور معمول\",\"note\":\"typically = usually\",\"traps\":[],\"distractors\":[\"typical\",\"type\"]},{\"id\":\"awl129\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The effect size was ___ significant.\",\"answer\":\"marginally\",\"alt\":[],\"en\":\"marginally\",\"fa\":\"در حد مرز، اندک\",\"note\":\"marginally significant\",\"traps\":[],\"distractors\":[\"marginal\",\"margin\"]},{\"id\":\"awl130\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The author ___ a bolder interpretation.\",\"answer\":\"adopts\",\"alt\":[],\"en\":\"adopt\",\"fa\":\"پذیرفتن یک رویکرد\",\"note\":\"adopt an approach\",\"traps\":[],\"distractors\":[\"adapt\",\"accept in\"]},{\"id\":\"awl131\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Critics ___ the methodology as flawed.\",\"answer\":\"characterize\",\"alt\":[],\"en\":\"characterize as\",\"fa\":\"توصیف کردن به عنوان\",\"note\":\"characterize something as\",\"traps\":[],\"distractors\":[\"character\",\"qualify of\"]},{\"id\":\"awl132\",\"unit\":\"awl_c1\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The two datasets are directly ___ .\",\"answer\":\"comparable\",\"alt\":[],\"en\":\"comparable\",\"fa\":\"مقایسه‌پذیر\",\"note\":\"comparable with/to\",\"traps\":[],\"distractors\":[\"comparative\",\"compatible\"]},{\"id\":\"grm133\",\"unit\":\"grm_articles\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"We watched ___ film about the Silk Road.\",\"answer\":\"a\",\"alt\":[],\"en\":\"a film\",\"fa\":\"یک فیلم (نامعین)\",\"note\":\"First mention takes a/an.\",\"traps\":[\"articles\"],\"distractors\":[\"the\",\"one of\"]},{\"id\":\"grm134\",\"unit\":\"grm_articles\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She is ___ engineer at a telecom firm.\",\"answer\":\"an\",\"alt\":[],\"en\":\"an engineer\",\"fa\":\"مهندس (قبل از حرف صدادار an)\",\"note\":\"an before vowel sounds.\",\"traps\":[\"articles\"],\"distractors\":[\"a\",\"the\"]},{\"id\":\"grm135\",\"unit\":\"grm_articles\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"___ moon looked enormous last night.\",\"answer\":\"The\",\"alt\":[],\"en\":\"the moon\",\"fa\":\"ماه (یگانه: the)\",\"note\":\"Unique things take the.\",\"traps\":[\"articles\"],\"distractors\":[\"A\",\"One\"]},{\"id\":\"grm136\",\"unit\":\"grm_articles\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I saw ___ movie yesterday; it was dull.\",\"answer\":\"the\",\"alt\":[],\"en\":\"the movie\",\"fa\":\"فیلم را دیدم (معین)\",\"note\":\"Persian has no articles: second mention takes the.\",\"traps\":[\"articles\"],\"distractors\":[\"a\",\"one\"]},{\"id\":\"grm137\",\"unit\":\"grm_articles\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"They praised ___ honesty of the report.\",\"answer\":\"the\",\"alt\":[],\"en\":\"the honesty of the report\",\"fa\":\"صداقتِ گزارش (با حرف تعریف)\",\"note\":\"A specific abstract noun takes the definite article.\",\"traps\":[\"articles\"],\"distractors\":[\"A\",\"An\"]},{\"id\":\"grm138\",\"unit\":\"grm_articles\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She visited ___ prison where her brother worked.\",\"answer\":\"the\",\"alt\":[],\"en\":\"the prison where her brother worked\",\"fa\":\"آن زندانِ مشخص (با حرف تعریف)\",\"note\":\"the prison = the specific building; to prison = as a prisoner.\",\"traps\":[\"articles\"],\"distractors\":[\"a\",\"an\"]},{\"id\":\"grm139\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She gave me a useful piece of ___ .\",\"answer\":\"advice\",\"alt\":[],\"en\":\"advice\",\"fa\":\"توصیه (شمارش‌ناپذیر)\",\"note\":\"advice is uncountable: a piece of advice.\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"advices\",\"advise\"]},{\"id\":\"grm140\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"How much ___ do you get per week?\",\"answer\":\"homework\",\"alt\":[],\"en\":\"homework\",\"fa\":\"تکلیف (شمارش‌ناپذیر)\",\"note\":\"homework is uncountable.\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"homeworks\",\"a homework\"]},{\"id\":\"grm141\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The article contains several sharp ___ .\",\"answer\":\"criticisms\",\"alt\":[],\"en\":\"criticism\",\"fa\":\"نقد (جمع بی‌قاعده معنایی)\",\"note\":\"criticism uncountable; criticisms = specific critiques.\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"criticism s\",\"critiques s\"]},{\"id\":\"grm142\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"How ___ books did you read last year?\",\"answer\":\"many\",\"alt\":[],\"en\":\"many\",\"fa\":\"چند (برای قابل‌شمارش)\",\"note\":\"many + countable; much + uncountable.\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"much\",\"lot\"]},{\"id\":\"grm143\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"___ students failed than last term.\",\"answer\":\"Fewer\",\"alt\":[],\"en\":\"fewer\",\"fa\":\"کمتر (قابل‌شمارش)\",\"note\":\"fewer for countable, less for uncountable.\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"Less\",\"Few of\"]},{\"id\":\"grm144\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I bought two ___ for the trip.\",\"answer\":\"books\",\"alt\":[],\"en\":\"books\",\"fa\":\"کتاب (بعد از عدد جمع می‌آید)\",\"note\":\"English marks plural after numbers; Persian does not: do ketab.\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"book\",\"bookes\"]},{\"id\":\"grm145\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Ten ___ ago we had no smartphones.\",\"answer\":\"years\",\"alt\":[],\"en\":\"years\",\"fa\":\"سال (جمع بعد از عدد)\",\"note\":\"ten years ago\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"year\",\"yaers\"]},{\"id\":\"grm146\",\"unit\":\"grm_count\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The news ___ better than expected.\",\"answer\":\"was\",\"alt\":[],\"en\":\"was\",\"fa\":\"خبر بود (مفرد)\",\"note\":\"news is singular in English.\",\"traps\":[\"countability\",\"plurals\"],\"distractors\":[\"were\",\"is being\"]},{\"id\":\"grm147\",\"unit\":\"grm_copula\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"He ___ a teacher at a girls' school.\",\"answer\":\"is\",\"alt\":[],\"en\":\"is\",\"fa\":\"است (فعل بودن حال)\",\"note\":\"Persian attaches the copula as a suffix (-e); English needs is/are.\",\"traps\":[\"copula\",\"statives\"],\"distractors\":[\"nothing\",\"be\"]},{\"id\":\"grm148\",\"unit\":\"grm_copula\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"This book ___ interesting so far.\",\"answer\":\"is\",\"alt\":[],\"en\":\"is\",\"fa\":\"است\",\"note\":\"English needs an explicit verb in present.\",\"traps\":[\"copula\",\"statives\"],\"distractors\":[\"being\",\"looks as\"]},{\"id\":\"grm149\",\"unit\":\"grm_copula\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I ___ the answer right now.\",\"answer\":\"know\",\"alt\":[],\"en\":\"know\",\"fa\":\"می‌دانم (حال ساده)\",\"note\":\"Stative verbs resist -ing: I know, not I am knowing.\",\"traps\":[\"copula\",\"statives\"],\"distractors\":[\"am knowing\",\"do know to\"]},{\"id\":\"grm150\",\"unit\":\"grm_copula\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She ___ her coffee at the moment.\",\"answer\":\"enjoys\",\"alt\":[],\"en\":\"enjoy\",\"fa\":\"لذت می‌برد\",\"note\":\"Enjoy is not stative: she is enjoying is fine. Careful set.\",\"traps\":[\"copula\",\"statives\"],\"distractors\":[\"is enjoying her\",\"enjoy\"]},{\"id\":\"grm151\",\"unit\":\"grm_copula\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"They ___ to leave early today.\",\"answer\":\"want\",\"alt\":[],\"en\":\"want\",\"fa\":\"می‌خواهند\",\"note\":\"want is stative: I want, never I am wanting.\",\"traps\":[\"copula\",\"statives\"],\"distractors\":[\"are wanting\",\"do want to\"]},{\"id\":\"grm152\",\"unit\":\"grm_copula\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"This sauce ___ garlic.\",\"answer\":\"tastes of\",\"alt\":[],\"en\":\"taste of\",\"fa\":\"طعم چیزی را دادن\",\"note\":\"taste of = has the flavor (stative use).\",\"traps\":[\"copula\",\"statives\"],\"distractors\":[\"is tasting of\",\"tastes like of\"]},{\"id\":\"grm153\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The meeting is ___ Monday morning.\",\"answer\":\"on\",\"alt\":[],\"en\":\"on Monday\",\"fa\":\"روی/در روزها: on\",\"note\":\"English uses on for days; Persian 'dar' covers all.\",\"traps\":[\"prepositions\"],\"distractors\":[\"in\",\"at\"]},{\"id\":\"grm154\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I stayed ___ home and studied.\",\"answer\":\"at\",\"alt\":[],\"en\":\"at home\",\"fa\":\"در خانه: at\",\"note\":\"at home is the fixed phrase.\",\"traps\":[\"prepositions\"],\"distractors\":[\"in\",\"on\"]},{\"id\":\"grm155\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She is married ___ an architect.\",\"answer\":\"to\",\"alt\":[],\"en\":\"married to\",\"fa\":\"متأهل با: married to\",\"note\":\"married to someone (never 'married with').\",\"traps\":[\"prepositions\"],\"distractors\":[\"with\",\"by\"]},{\"id\":\"grm156\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Success depends ___ consistent practice.\",\"answer\":\"on\",\"alt\":[],\"en\":\"depend on\",\"fa\":\"بستگی داشتن به\",\"note\":\"depend on someone/something.\",\"traps\":[\"prepositions\"],\"distractors\":[\"of\",\"from\"]},{\"id\":\"grm157\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"We arrived ___ the airport at dawn.\",\"answer\":\"at\",\"alt\":[],\"en\":\"arrive at\",\"fa\":\"رسیدن به (مکان)\",\"note\":\"arrive at a point, arrive in a city.\",\"traps\":[\"prepositions\"],\"distractors\":[\"in\",\"to\"]},{\"id\":\"grm158\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"He is good ___ explaining hard ideas.\",\"answer\":\"at\",\"alt\":[],\"en\":\"good at\",\"fa\":\"خوب بودن در\",\"note\":\"good at something/doing.\",\"traps\":[\"prepositions\"],\"distractors\":[\"in\",\"on\"]},{\"id\":\"grm159\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The office is ___ the third floor.\",\"answer\":\"on\",\"alt\":[],\"en\":\"on the floor\",\"fa\":\"در طبقه: on\",\"note\":\"on the third floor.\",\"traps\":[\"prepositions\"],\"distractors\":[\"in\",\"at\"]},{\"id\":\"grm160\",\"unit\":\"grm_prep\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I will travel ___ Friday morning.\",\"answer\":\"on\",\"alt\":[],\"en\":\"on Friday\",\"fa\":\"روز جمعه: on\",\"note\":\"on Friday morning.\",\"traps\":[\"prepositions\"],\"distractors\":[\"in\",\"at\"]},{\"id\":\"grm161\",\"unit\":\"grm_tense\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I ___ him at the conference yesterday.\",\"answer\":\"saw\",\"alt\":[],\"en\":\"saw\",\"fa\":\"دیدم (گذشته ساده)\",\"note\":\"Finished time words (yesterday) take simple past; Persian rafte-am misleads.\",\"traps\":[\"perfect\"],\"distractors\":[\"have seen\",\"had seen\"]},{\"id\":\"grm162\",\"unit\":\"grm_tense\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I ___ here since Monday.\",\"answer\":\"have been\",\"alt\":[],\"en\":\"have been\",\"fa\":\"هستم (از دوشنبه تا حالا)\",\"note\":\"since + present perfect; Persian uses present: az doshanbe hastam.\",\"traps\":[\"perfect\"],\"distractors\":[\"am\",\"was\"]},{\"id\":\"grm163\",\"unit\":\"grm_tense\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She ___ her keys; she cannot get in.\",\"answer\":\"has lost\",\"alt\":[],\"en\":\"has lost\",\"fa\":\"گم کرده (نتیجه حال حاضر)\",\"note\":\"Present perfect for present result.\",\"traps\":[\"perfect\"],\"distractors\":[\"lost\",\"had lost\"]},{\"id\":\"grm164\",\"unit\":\"grm_tense\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"When ___ you buy that jacket?\",\"answer\":\"did\",\"alt\":[],\"en\":\"did you buy\",\"fa\":\"کی خریدی؟\",\"note\":\"Questions about finished time use did.\",\"traps\":[\"perfect\"],\"distractors\":[\"have\",\"were\"]},{\"id\":\"grm165\",\"unit\":\"grm_tense\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"This is the best film I ___ this year.\",\"answer\":\"have seen\",\"alt\":[],\"en\":\"have seen\",\"fa\":\"دیده‌ام (تا حالا)\",\"note\":\"Superlative + ever/this year takes present perfect.\",\"traps\":[\"perfect\"],\"distractors\":[\"saw\",\"had seen\"]},{\"id\":\"grm166\",\"unit\":\"grm_tense\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"By the time we arrived, the talk ___ .\",\"answer\":\"had ended\",\"alt\":[],\"en\":\"had ended\",\"fa\":\"تمام شده بود (گذشته پیشین)\",\"note\":\"Earlier past takes past perfect.\",\"traps\":[\"perfect\"],\"distractors\":[\"has ended\",\"ended already\"]},{\"id\":\"grm167\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"Do you know where the station ___ ?\",\"answer\":\"is\",\"alt\":[],\"en\":\"where the station is\",\"fa\":\"کجاست (ترتیب غیرمستقیم)\",\"note\":\"Embedded questions drop do/does and keep subject+verb order.\",\"traps\":[\"question_order\"],\"distractors\":[\"is the station\",\"does the station is\"]},{\"id\":\"grm168\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"I wonder where she ___ last night.\",\"answer\":\"went\",\"alt\":[],\"en\":\"where she went\",\"fa\":\"کجا رفت\",\"note\":\"No aux in embedded questions.\",\"traps\":[\"question_order\"],\"distractors\":[\"did go\",\"did she go\"]},{\"id\":\"grm169\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"He asked me where I ___ .\",\"answer\":\"lived\",\"alt\":[],\"en\":\"where I lived\",\"fa\":\"کجا زندگی می‌کردم\",\"note\":\"Persian 'ke' is not English 'that' here.\",\"traps\":[\"question_order\"],\"distractors\":[\"do live\",\"that I lived\"]},{\"id\":\"grm170\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"___ is important to review daily.\",\"answer\":\"It\",\"alt\":[],\"en\":\"It is important\",\"fa\":\"این مهم است\",\"note\":\"English needs a dummy subject; Persian drops it.\",\"traps\":[\"that_omission\"],\"distractors\":[\"That\",\"This is\"]},{\"id\":\"grm171\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"It was an ___ film about memory.\",\"answer\":\"interesting\",\"alt\":[],\"en\":\"an interesting film\",\"fa\":\"فیلم جالبی\",\"note\":\"Adjective precedes the noun; Persian puts it after.\",\"traps\":[\"adjectives\"],\"distractors\":[\"film interesting\",\"interested\"]},{\"id\":\"grm172\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"She wore a ___ jacket to the interview.\",\"answer\":\"beautiful leather\",\"alt\":[],\"en\":\"a beautiful leather jacket\",\"fa\":\"کت چرمی زیبا\",\"note\":\"Opinion before material: beautiful leather.\",\"traps\":[\"adjectives\"],\"distractors\":[\"leather beautiful\",\"leathered beautiful\"]},{\"id\":\"grm173\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"The engineer ___ designed the bridge won a prize.\",\"answer\":\"who\",\"alt\":[],\"en\":\"who\",\"fa\":\"که (فاعل)\",\"note\":\"who for people as subject; which for things.\",\"traps\":[],\"distractors\":[\"which\",\"whom\"]},{\"id\":\"grm174\",\"unit\":\"grm_struct\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"cloze\",\"prompt\":\"A ___ of birds settled on the wire.\",\"answer\":\"flock\",\"alt\":[],\"en\":\"a flock of birds\",\"fa\":\"دسته‌ای از پرندگان\",\"note\":\"Collective: a flock of birds.\",\"traps\":[],\"distractors\":[\"group bird\",\"herd\"]},{\"id\":\"reg175\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"In formal reports, ___ obtain is preferred to get.\",\"answer\":\"formal\",\"alt\":[],\"en\":\"obtain (formal)\",\"fa\":\"به دست آوردن (رسمی)\",\"note\":\"get is fine in speech; obtain in writing.\",\"traps\":[],\"distractors\":[\"slang\",\"casual\"]},{\"id\":\"reg176\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The committee will ___ the findings next week.\",\"answer\":\"consider\",\"alt\":[],\"en\":\"consider\",\"fa\":\"بررسی و مد نظر قرار دادن\",\"note\":\"think about → consider in writing.\",\"traps\":[],\"distractors\":[\"think over on\",\"ponder of\"]},{\"id\":\"reg177\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"We must ___ the data before publishing.\",\"answer\":\"verify\",\"alt\":[],\"en\":\"verify\",\"fa\":\"راستی‌آزمایی کردن\",\"note\":\"check → verify in formal register.\",\"traps\":[],\"distractors\":[\"check out\",\"vet out\"]},{\"id\":\"reg178\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The contract was ___ by both parties.\",\"answer\":\"terminated\",\"alt\":[],\"en\":\"terminated\",\"fa\":\"فسخ شد\",\"note\":\"end → terminate in legal register.\",\"traps\":[],\"distractors\":[\"terminated up\",\"ended off\"]},{\"id\":\"reg179\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"___ the figures rose, morale fell.\",\"answer\":\"Whereas\",\"alt\":[],\"en\":\"whereas\",\"fa\":\"در حالی که (مقایسه رسمی)\",\"note\":\"whereas links contrast in writing.\",\"traps\":[],\"distractors\":[\"While that\",\"Where as\"]},{\"id\":\"reg180\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The results were ___; no action is needed.\",\"answer\":\"inconclusive\",\"alt\":[],\"en\":\"inconclusive\",\"fa\":\"بی‌نتیجه\",\"note\":\"in- + conclusive.\",\"traps\":[],\"distractors\":[\"unconclusive\",\"nonconclusive\"]},{\"id\":\"reg181\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"___ the delay, the shipment arrived intact.\",\"answer\":\"Despite\",\"alt\":[],\"en\":\"despite\",\"fa\":\"علی‌رغم (بدون of)\",\"note\":\"despite + noun (no of); in spite of + noun.\",\"traps\":[],\"distractors\":[\"Despite of\",\"Although\"]},{\"id\":\"reg182\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The drug is safe, ___ expensive to produce.\",\"answer\":\"albeit\",\"alt\":[],\"en\":\"albeit\",\"fa\":\"هرچند (ادبی)\",\"note\":\"albeit = although, formal single word.\",\"traps\":[],\"distractors\":[\"allbeit\",\"through\"]},{\"id\":\"reg183\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Costs fell, ___ boosting quarterly profit.\",\"answer\":\"thereby\",\"alt\":[],\"en\":\"thereby\",\"fa\":\"بدین ترتیب (رسمی)\",\"note\":\"thereby + ing shows result.\",\"traps\":[],\"distractors\":[\"there for\",\"hence of\"]},{\"id\":\"reg184\",\"unit\":\"register\",\"skill\":\"grammar\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"___ , the two studies agree on the basics.\",\"answer\":\"On balance\",\"alt\":[],\"en\":\"on balance\",\"fa\":\"در مجموع\",\"note\":\"on balance = after weighing everything.\",\"traps\":[],\"distractors\":[\"In balance\",\"At balance\"]},{\"id\":\"wb185\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The ___ of the bridge took three years.\",\"answer\":\"construction\",\"alt\":[],\"en\":\"construction\",\"fa\":\"ساخت\",\"note\":\"construct (v) → construction (n).\",\"traps\":[],\"distractors\":[\"constructing word\",\"construct\"]},{\"id\":\"wb186\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Their ___ was visible after the first win.\",\"answer\":\"confidence\",\"alt\":[],\"en\":\"confidence\",\"fa\":\"اطمینان\",\"note\":\"confident (adj) → confidence (n).\",\"traps\":[],\"distractors\":[\"confidency\",\"confide\"]},{\"id\":\"wb187\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The plan died from pure ___ .\",\"answer\":\"neglect\",\"alt\":[],\"en\":\"neglect\",\"fa\":\"بی‌مهری و رها شدن\",\"note\":\"neglect (n and v).\",\"traps\":[],\"distractors\":[\"neglection\",\"neglectment\"]},{\"id\":\"wb188\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"He answered with surprising ___ .\",\"answer\":\"honesty\",\"alt\":[],\"en\":\"honesty\",\"fa\":\"صداقت\",\"note\":\"honest → honesty.\",\"traps\":[],\"distractors\":[\"honestness\",\"honestation\"]},{\"id\":\"wb189\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"There is strong ___ for the new policy.\",\"answer\":\"opposition\",\"alt\":[],\"en\":\"opposition\",\"fa\":\"مخالفت\",\"note\":\"oppose → opposition.\",\"traps\":[],\"distractors\":[\"opposal\",\"opposing\"]},{\"id\":\"wb190\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"They measured the ___ of the canyon.\",\"answer\":\"depth\",\"alt\":[],\"en\":\"depth\",\"fa\":\"عمق\",\"note\":\"deep → depth; long → length; wide → width.\",\"traps\":[],\"distractors\":[\"deepness\",\"deepth\"]},{\"id\":\"wb191\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The ___ of the law took decades.\",\"answer\":\"enforcement\",\"alt\":[],\"en\":\"enforcement\",\"fa\":\"اجرای قانون\",\"note\":\"enforce → enforcement.\",\"traps\":[],\"distractors\":[\"enforcing word\",\"enforcity\"]},{\"id\":\"wb192\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"It is ___ to park across two spaces.\",\"answer\":\"illegal\",\"alt\":[],\"en\":\"illegal\",\"fa\":\"غیرقانونی\",\"note\":\"il- before l: illegal.\",\"traps\":[],\"distractors\":[\"unlegal\",\"dislegal\"]},{\"id\":\"wb193\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"Her excuse was completely ___ .\",\"answer\":\"implausible\",\"alt\":[],\"en\":\"implausible\",\"fa\":\"باورنکردنی\",\"note\":\"im- before p: implausible.\",\"traps\":[],\"distractors\":[\"unplausible\",\"displausible\"]},{\"id\":\"wb194\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The survey found growing ___ with the app.\",\"answer\":\"dissatisfaction\",\"alt\":[],\"en\":\"dissatisfaction\",\"fa\":\"نارضایتی\",\"note\":\"dis- + satisfaction.\",\"traps\":[],\"distractors\":[\"unsatisfaction\",\"missatisfaction\"]},{\"id\":\"wb195\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"The two accounts are ___ inconsistent.\",\"answer\":\"mutually\",\"alt\":[],\"en\":\"mutually\",\"fa\":\"به‌طور متقابل\",\"note\":\"mutual → mutually.\",\"traps\":[],\"distractors\":[\"mutuality\",\"mutual\"]},{\"id\":\"wb196\",\"unit\":\"wordbuild\",\"skill\":\"vocabulary\",\"level\":\"C1\",\"kind\":\"cloze\",\"prompt\":\"___ speaking, the second draft is stronger.\",\"answer\":\"Broadly\",\"alt\":[],\"en\":\"broadly speaking\",\"fa\":\"در مجموع، کلی‌گفته\",\"note\":\"broadly speaking = in general.\",\"traps\":[],\"distractors\":[\"Broad\",\"Broady\"]},{\"id\":\"ef197\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"to achieve\",\"fa\":\"به دست آوردن، محقق کردن\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef198\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"reliable\",\"fa\":\"قابل اعتماد\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef199\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"to postpone\",\"fa\":\"به تعویق انداختن\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef200\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"a deadline\",\"fa\":\"ضرب‌الاجل\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef201\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"to afford\",\"fa\":\"از پس هزینه‌ای برآمدن\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef202\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"an advantage\",\"fa\":\"مزیت\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef203\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"to improve\",\"fa\":\"بهبود بخشیدن\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef204\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"surprising\",\"fa\":\"شگفت‌انگیز\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef205\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"necessary\",\"fa\":\"ضروری\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef206\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"to suggest\",\"fa\":\"پیشنهاد دادن، نشان دادن\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef207\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"eventually\",\"fa\":\"سرانجام\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"ef208\",\"unit\":\"ef_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"ef\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"careless\",\"fa\":\"بی‌دقت، سهل‌انگار\",\"note\":\"recall the Farsi meaning, then check\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae209\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"discuss\",\"fa\":\"بحث کردن درباره\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae210\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"available\",\"fa\":\"در دسترس\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae211\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"calm\",\"fa\":\"خونسرد، آرام\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae212\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"experience\",\"fa\":\"تجربه\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae213\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"opportunity\",\"fa\":\"فرصت\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae214\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"responsible\",\"fa\":\"مسئولیت‌پذیر\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae215\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"improvement\",\"fa\":\"بهبود\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"fae216\",\"unit\":\"fae_core\",\"skill\":\"vocabulary\",\"level\":\"B2\",\"kind\":\"fae\",\"prompt\":\"\",\"answer\":\"\",\"alt\":[],\"en\":\"difficult\",\"fa\":\"دشوار، سخت\",\"note\":\"produce the English word\",\"traps\":[],\"distractors\":[]},{\"id\":\"sent217\",\"unit\":\"sent_core\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"sent\",\"prompt\":\"Type the full sentence: 'I / see / that movie / twice' (present perfect)\",\"answer\":\"I have seen that movie twice.\",\"alt\":[],\"en\":\"I have seen that movie twice.\",\"fa\":\"آن فیلم را دوبار دیده‌ام.\",\"note\":\"Present perfect with twice.\",\"traps\":[\"I seen that movie twice.\",\"I have saw that movie twice.\"],\"distractors\":[]},{\"id\":\"sent218\",\"unit\":\"sent_core\",\"skill\":\"grammar\",\"level\":\"B2\",\"kind\":\"sent\",\"prompt\":\"Type the full sentence: 'Do you know / where / is / the exit?' (embedded)\",\"answer\":\"Do you know where the exit is?\",\"alt\":[],\"en\":\"Do you know where the exit is?\",\"fa\":\"می‌دانی خروجی کجاست؟\",\"note\":\"Embedded question word order.\",\"traps\":[\"Do you know where is the exit?\",\"Do you know where is exit?\"],\"distractors\":[]}]}"));}),
"[project]/src/content/placement.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v({"items":[{"id":"g1","sec":"grammar","rung":"B1","q":"___ is important to sleep well before an exam.","choices":["There","It","This","That"],"a":"It","trap":"that_omission"},{"id":"g2","sec":"grammar","rung":"B2","q":"She has lived here ___ 2019.","choices":["for","since","from","in"],"a":"since","trap":"perfect"},{"id":"g3","sec":"grammar","rung":"B2","q":"I ___ what you mean.","choices":["am seeing","see","am see","seeing"],"a":"see","trap":"statives"},{"id":"g4","sec":"grammar","rung":"B2+","q":"Do you know ___?","choices":["where the station is","where is the station","where is station","the station is where"],"a":"where the station is","trap":"question_order"},{"id":"g5","sec":"grammar","rung":"B2+","q":"He arrived ___ Monday morning.","choices":["on","in","at","to"],"a":"on","trap":"prepositions"},{"id":"g6","sec":"grammar","rung":"C1","q":"Had I known about the deadline, I ___ differently.","choices":["will act","would have acted","had acted","would act"],"a":"would have acted","trap":"conditional"},{"id":"g7","sec":"grammar","rung":"C1","q":"It was the first time she ___ such a candid review.","choices":["has received","received","had received","was receiving"],"a":"had received","trap":"perfect"},{"id":"v1","sec":"vocab","rung":"B1","q":"The medicine had a strong ___ on her appetite.","choices":["affect","effect","affection","effective"],"a":"effect","trap":"word_choice"},{"id":"v2","sec":"vocab","rung":"B2","q":"The report ___ light on the real cause of the outage.","choices":["gave","put","shed","threw"],"a":"shed","trap":"word_choice"},{"id":"v3","sec":"vocab","rung":"B2","q":"The two witnesses' accounts ___ each other completely.","choices":["contradict","deny","oppose","refuse"],"a":"contradict","trap":"word_choice"},{"id":"v4","sec":"vocab","rung":"B2+","q":"The committee remains ___ to the idea of extra funding.","choices":["adverse","averse","reversed","averse to be"],"a":"averse","trap":"word_choice"},{"id":"v5","sec":"vocab","rung":"B2+","q":"She answered every question with remarkable ___.","choices":["fluently","fluent","fluidity","fluency"],"a":"fluency","trap":"word_choice"},{"id":"v6","sec":"vocab","rung":"C1","q":"The two accounts of the accident are impossible to ___.","choices":["collide","reconcile","reconciliate","coordinate"],"a":"reconcile","trap":"word_choice"},{"id":"v7","sec":"vocab","rung":"C1","q":"His calm tone was a deliberate ___ to keep things short.","choices":["device","devise","devising","devised"],"a":"device","trap":"word_choice"},{"id":"c1","sec":"collocation","rung":"B1","q":"I need to ___ a decision soon.","choices":["do","make","take","have"],"a":"make","trap":"word_choice"},{"id":"c2","sec":"collocation","rung":"B2","q":"We must ___ these risks into account.","choices":["make","take","bring","hold"],"a":"take","trap":"word_choice"},{"id":"c3","sec":"collocation","rung":"B2","q":"The director ___ pressure on the team to ship early.","choices":["made","gave","put","took"],"a":"put","trap":"word_choice"},{"id":"c4","sec":"collocation","rung":"B2+","q":"Her argument doesn't ___ water.","choices":["carry","keep","fill","hold"],"a":"hold","trap":"word_choice"},{"id":"c5","sec":"collocation","rung":"B2+","q":"The two sides finally ___ an agreement.","choices":["struck","hit","beat","built"],"a":"struck","trap":"word_choice"},{"id":"c6","sec":"collocation","rung":"C1","q":"The speech was carefully ___ to avoid controversy.","choices":["said","worded","spoken","told"],"a":"worded","trap":"word_choice"},{"id":"c7","sec":"collocation","rung":"C1","q":"He ___ short of calling the report a lie.","choices":["stopped","paused","avoided","refused"],"a":"stopped","trap":"word_choice"},{"id":"r1","sec":"reading","rung":"B2","q":"Most learners review new words on the same day they meet them, then wonder why the words vanish by Friday. Studies of memory keep pointing the same way: recall that happens after a night of sleep, when the trace has partly faded, leaves a far stronger mark than recall that happens while the page is still open.\n\nWhy does spaced review beat same-day review?","choices":["Because the memory trace has partly faded, so recall has to work harder","Because words studied at night are easier to read the next day","Because sleep makes the material feel more familiar on the page","Because reviewing later takes less time than reviewing immediately"],"a":"Because the memory trace has partly faded, so recall has to work harder","trap":"fluency_illusion"},{"id":"r2","sec":"reading","rung":"B2+","q":"Psychologist Robert Bjork argues that some obstacles during practice are 'desirable difficulties': they slow down visible progress while quietly strengthening what stays in memory. A practice session that feels smooth can therefore be producing less learning than a session that feels like a struggle.\n\nWhat does the phrase 'desirable difficulties' suggest?","choices":["Teachers should remove obstacles so practice feels smooth","Difficult materials are always more effective than easy ones","Struggle during practice can strengthen long-term retention","Progress that feels slow is a sign of poor practice methods"],"a":"Struggle during practice can strengthen long-term retention","trap":"fluency_illusion"},{"id":"r3","sec":"reading","rung":"C1","q":"Readers often mistake the ease of rereading a chapter for evidence that they know it. The pages feel familiar, the argument arrives without effort, and a test the next morning reveals how little survived. Familiarity, researchers warn, is a poor proxy for knowledge.\n\nThe passage implies that learners who feel fluent while rereading ___.","choices":["have stored the chapter durably in long-term memory","often mistake familiarity for genuine knowledge","should switch to harder chapters immediately after","benefit most from reviewing the same chapter again"],"a":"often mistake familiarity for genuine knowledge","trap":"fluency_illusion"},{"id":"r4","sec":"reading","rung":"C1","q":"A study team compared three revision schedules across a term. Learners who reviewed a topic the day it was taught rated their confidence highest, yet scored lowest on the delayed final. The group whose reviews began only when material started to slip performed best, despite reporting the most effort during practice.\n\nWhich sentence best captures the study's conclusion?","choices":["Review works best while the material still feels fresh","Confidence during revision predicts final performance","Effortful practice is a symptom of a poor study schedule","Review pays off most when it starts at the edge of forgetting"],"a":"Review pays off most when it starts at the edge of forgetting","trap":"fluency_illusion"}]});}),
"[project]/src/content/readings.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"version\":1,\"readings\":[{\"id\":\"rd1\",\"title\":\"The Testing Effect\",\"level\":\"B2\",\"minutes\":4,\"text\":\"Imagine two students. One rereads a chapter until it feels familiar. The other closes the book and tries to recall everything she can. A week later, the second student remembers far more. Psychologists call this the testing effect, and it has survived a century of attempts to prove it wrong. The reason is effort. When your brain has to reconstruct a memory, the connections behind it grow stronger. Rereading, by contrast, only makes the text feel comfortable, and comfort is a poor signal of learning. Teachers who quiz students at the start of class, with no grades attached, often see exam scores rise. The quiz is not measurement. It is the lesson itself. If you want a language to stick, do not reread your notes: close them, and pull the words out of your head.\",\"glossary\":[{\"w\":\"recall\",\"fa\":\"به یاد آوردن\"},{\"w\":\"reconstruct\",\"fa\":\"بازسازی کردن\"},{\"w\":\"by contrast\",\"fa\":\"در مقابل\"},{\"w\":\"signal\",\"fa\":\"نشانه\"},{\"w\":\"attached\",\"fa\":\"پیوسته، وابسته\"},{\"w\":\"stick\",\"fa\":\"در ذهن ماندن\"}],\"questions\":[{\"q\":\"What does the text say about rereading?\",\"choices\":[\"It builds strong memories\",\"It creates a feeling of comfort that can hide weak learning\",\"It works only for languages\",\"It is the fastest way to memorize\"],\"a\":1},{\"q\":\"Why do ungraded quizzes help?\",\"choices\":[\"They reduce exam stress\",\"They replace homework\",\"The act of retrieval strengthens memory\",\"They give teachers more data\"],\"a\":2},{\"q\":\"The word it in 'it has survived' refers to\",\"choices\":[\"a century\",\"the testing effect\",\"a chapter\",\"a student\"],\"a\":1},{\"q\":\"What advice does the writer give?\",\"choices\":[\"Study with notes open\",\"Test yourself before rereading\",\"Avoid comfort entirely\",\"Reread twice, then test\"],\"a\":1}]},{\"id\":\"rd2\",\"title\":\"An Email About a Delay\",\"level\":\"B2\",\"minutes\":3,\"text\":\"Subject: Delivery update for order 8421. Dear Ms. Rahimi, I am writing to let you know that the sensor modules for your order are running three days behind schedule. The supplier traced the delay to a shortage of a single component, and rather than ship a partial batch, we chose to hold everything until the full set clears quality control. I realize this is inconvenient, and I take full responsibility for not flagging the risk earlier. As a gesture, we will cover the express shipping on your next order. The revised delivery date is Thursday the 14th, and I will personally confirm the dispatch on Wednesday. If the new date causes problems on your side, please call me directly and we will work out an alternative. Kind regards, D. Karimi, Logistics Lead.\",\"glossary\":[{\"w\":\"running behind schedule\",\"fa\":\"عقب‌تر از برنامه بودن\"},{\"w\":\"shortage\",\"fa\":\"کمبود\"},{\"w\":\"batch\",\"fa\":\"بچه، گروه محموله\"},{\"w\":\"flagging\",\"fa\":\"گوشزد کردن، علامت دادن\"},{\"w\":\"as a gesture\",\"fa\":\"به‌عنوان ابراز حسن نیت\"},{\"w\":\"dispatch\",\"fa\":\"ارسال محموله\"}],\"questions\":[{\"q\":\"Why was the whole order held back?\",\"choices\":[\"The factory closed\",\"To ship it complete rather than in parts\",\"The customer changed the address\",\"Express shipping was unavailable\"],\"a\":1},{\"q\":\"What does the writer offer?\",\"choices\":[\"A refund\",\"Free products\",\"Paid shipping on the next order\",\"A discount code\"],\"a\":2},{\"q\":\"'I take full responsibility' is an example of\",\"choices\":[\"blaming the supplier\",\"accepting accountability\",\"making an excuse\",\"offering a discount\"],\"a\":1},{\"q\":\"When will dispatch be confirmed?\",\"choices\":[\"Thursday the 14th\",\"Wednesday\",\"Immediately\",\"Next month\"],\"a\":1}]},{\"id\":\"rd3\",\"title\":\"Habits and the Brain\",\"level\":\"B2\",\"minutes\":4,\"text\":\"Habits are the brain's way of saving effort. When a behavior repeats in the same setting, control over it slowly shifts from conscious decision to automatic routine, which frees attention for harder problems. This shift happens in a region deep below the cortex, and it explains why you can drive home while planning dinner. The catch is that the mechanism cannot tell a useful habit from a harmful one; it simply automates whatever repeats. That is why the environment matters more than willpower. People who want to read more rarely succeed by trying harder at bedtime. They succeed when a book sits on the pillow and the phone charges in another room. Design the setting first, and the behavior tends to follow. Breaking a habit, meanwhile, rarely means deleting it. The old loop remains, ready to fire, and the practical goal is to build a stronger loop that fires sooner.\",\"glossary\":[{\"w\":\"conscious\",\"fa\":\"هوشیارانه، خودآگاه\"},{\"w\":\"cortex\",\"fa\":\"قشر مغز\"},{\"w\":\"willpower\",\"fa\":\"اراده\"},{\"w\":\"tend to\",\"fa\":\"تمایل داشتن به\"},{\"w\":\"loop\",\"fa\":\"چرخه\"},{\"w\":\"fire\",\"fa\":\"فعال شدن\"}],\"questions\":[{\"q\":\"Why does the brain build habits?\",\"choices\":[\"To make behavior harder\",\"To save conscious effort\",\"To store memories\",\"To reward repetition\"],\"a\":1},{\"q\":\"What matters more than willpower, according to the text?\",\"choices\":[\"Motivation quotes\",\"The physical environment\",\"Sleep quality\",\"Peer pressure\"],\"a\":1},{\"q\":\"'The catch' introduces\",\"choices\":[\"a benefit\",\"a drawback\",\"an example\",\"a question\"],\"a\":1},{\"q\":\"Breaking a habit, the text argues, means\",\"choices\":[\"erasing the old loop\",\"weakening a stronger new loop into place\",\"avoiding all routines\",\"relying on willpower\"],\"a\":1}]},{\"id\":\"rd4\",\"title\":\"The Quiet Engineering of Cities\",\"level\":\"C1\",\"minutes\":5,\"text\":\"The most consequential infrastructure in a city is the kind residents never see. Beneath the asphalt runs a nervous system of mains, sensors and control loops that decides, minute by minute, how water pressure distributes itself across a hillside district. For most of the twentieth century this system was engineered for redundancy: any single failure had to leave the network functional, and the price was chronic inefficiency. The current generation of utility managers argues that telemetry changes the calculation. Continuous pressure data, fed into predictive models, allows operators to intervene before a pipe bursts rather than after, and to throttle pumps in response to demand that was previously invisible. Critics counter that instrumentation without institutional competence merely documents failures more precisely. The evidence so far is partial, but the direction is clear: the value has shifted from building robust systems to operating adaptive ones, and the cities that internalize this distinction will spend conspicuously less on emergency repairs than those that do not.\",\"glossary\":[{\"w\":\"consequential\",\"fa\":\"پرمایه، مهم و اثرگذار\"},{\"w\":\"redundancy\",\"fa\":\"افزونگی برای اطمینان\"},{\"w\":\"chronic\",\"fa\":\"مزمن\"},{\"w\":\"telemetry\",\"fa\":\"سنجش از راه دور\"},{\"w\":\"throttle\",\"fa\":\"تنظیم و کاهش دادن\"},{\"w\":\"internalize\",\"fa\":\"درونی کردن، درون‌سازی کردن\"},{\"w\":\"conspicuously\",\"fa\":\"به‌شکل چشمگیر\"}],\"questions\":[{\"q\":\"What trade-off did twentieth century designs accept?\",\"choices\":[\"Lower pressure for lower cost\",\"Inefficiency in exchange for resilience\",\"Manual control for accuracy\",\"Cheaper pipes for shorter lives\"],\"a\":1},{\"q\":\"What do critics argue about telemetry?\",\"choices\":[\"It is too expensive\",\"It documents failure better than it prevents it\",\"It invades privacy\",\"It requires replacing all pipes\"],\"a\":1},{\"q\":\"'The direction is clear' suggests the author believes\",\"choices\":[\"the evidence is complete\",\"the trend favors adaptive operation\",\"critics will be proven right\",\"cities will abandon telemetry\"],\"a\":1},{\"q\":\"The phrase 'nervous system' is an example of\",\"choices\":[\"hyperbole\",\"metaphor\",\"irony\",\"euphemism\"],\"a\":1}]},{\"id\":\"rd5\",\"title\":\"Why Bilinguals Hesitate\",\"level\":\"C1\",\"minutes\":5,\"text\":\"For decades, bilingual speakers were said to enjoy amental workout from constantly inhibiting one of their languages. Recent repainting of the evidence has softened that claim considerably, yet something genuinely interesting remains in the hesitation data. When a bilingual names an object, both languages offer candidates, and the competition between them is measurable in milliseconds. What interests researchers is not the delay itself but its distribution: hesitation clusters at precisely the points where the two languages diverge in structure, not merely in vocabulary. This supports a view of bilingual memory as deeply intertwined rather than stored in parallel warehouses. It also suggests why immersion matters. The brain calibrates the competition to context; learners who consistently operate in one setting develop a faster suppression of the irrelevant lexicon. The pedagogical implication is uncomfortable for curricula built on isolated word lists: language lives in situations, and the situation is what the memory actually encodes.\",\"glossary\":[{\"w\":\"inhibiting\",\"fa\":\"مهار کردن\"},{\"w\":\"repainting of the evidence\",\"fa\":\"بازخوانی شواهد (استعاره)\"},{\"w\":\"diverge\",\"fa\":\"واگرا شدن\"},{\"w\":\"intertwined\",\"fa\":\"در هم تنیده\"},{\"w\":\"calibrates\",\"fa\":\"کالیبره می‌کند، تنظیم می‌کند\"},{\"w\":\"lexicon\",\"fa\":\"واژگان\"},{\"w\":\"encodes\",\"fa\":\"کدگذاری می‌کند\"}],\"questions\":[{\"q\":\"What has happened to the 'bilingual advantage' claim?\",\"choices\":[\"It has been proven fully\",\"It has been softened by re-examined evidence\",\"It applies only to children\",\"It was never studied\"],\"a\":1},{\"q\":\"Where does hesitation cluster?\",\"choices\":[\"At random points\",\"Where languages differ in structure\",\"At the start of sentences\",\"Only among novice learners\"],\"a\":1},{\"q\":\"The 'parallel warehouses' phrase describes a view the author\",\"choices\":[\"endorses\",\"argues against\",\"quotes approvingly\",\"proved experimentally\"],\"a\":1},{\"q\":\"What pedagogical implication does the author draw?\",\"choices\":[\"Word lists should be longer\",\"Context drives what memory encodes\",\"Immersion is unnecessary\",\"Hesitation should be trained away\"],\"a\":1}]},{\"id\":\"rd6\",\"title\":\"The Economics of Attention\",\"level\":\"C1\",\"minutes\":5,\"text\":\"Every free product on the internet runs on the same quiet transaction: the user pays with attention, and attention is resold to advertisers. What makes this economy unusual is not the exchange itself, which the broadcasting industry perfected decades ago, but the precision with which attention can now be measured, auctioned and packaged. An impression once purchased the possibility of a glance; the modern equivalent buys a probabilistic claim on a second of gaze, priced in milliseconds. Defenders of the model point out that it funds an astonishing quantity of services that users would otherwise ration. Skeptics reply that the externalities are no smaller than those of any extractive industry: fractured focus, engineered outrage, and a public sphere calibrated for arousal rather than deliberation. Regulation is arriving, unevenly. The deeper question is whether attention, once financialized, can be de-financialized at the level of individual habit, or whether users will need structural help to reclaim the hours they already lent away.\",\"glossary\":[{\"w\":\"resold\",\"fa\":\"بازفروشی شده\"},{\"w\":\"auctioned\",\"fa\":\"حراج شده\"},{\"w\":\"probabilistic\",\"fa\":\"احتمالاتی\"},{\"w\":\"externalities\",\"fa\":\"پیامدهای بیرونی\"},{\"w\":\"extractive\",\"fa\":\"استخراجی، خلاص‌کننده\"},{\"w\":\"deliberation\",\"fa\":\"سنجیدگی، تعقل\"},{\"w\":\"financialized\",\"fa\":\"مالی‌سازی شده\"}],\"questions\":[{\"q\":\"What is genuinely new in this economy?\",\"choices\":[\"Selling attention to advertisers\",\"The precision of measuring and pricing attention\",\"Free products\",\"Advertising itself\"],\"a\":1},{\"q\":\"Skeptics compare attention extraction to\",\"choices\":[\"broadcasting\",\"an extractive industry\",\"gambling\",\"banking\"],\"a\":1},{\"q\":\"The final question concerns whether\",\"choices\":[\"regulation will arrive\",\"users can reclaim attention through habit alone\",\"advertisers will leave\",\"platforms will charge fees\"],\"a\":1},{\"q\":\"The tone of the passage is best described as\",\"choices\":[\"openly hostile\",\"measured and analytical\",\"promotional\",\"satirical\"],\"a\":1}]}]}"));}),
"[project]/src/lib/content.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DECK",
    ()=>DECK,
    "PLACEMENT_ITEMS",
    ()=>PLACEMENT_ITEMS,
    "READINGS",
    ()=>READINGS,
    "SKILLS",
    ()=>SKILLS,
    "cardById",
    ()=>cardById,
    "deckStats",
    ()=>deckStats
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$content$2f$deck$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/content/deck.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$content$2f$placement$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/content/placement.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$content$2f$readings$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/content/readings.json (json)");
;
;
;
const DECK = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$content$2f$deck$2e$json__$28$json$29$__["default"].cards;
const PLACEMENT_ITEMS = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$content$2f$placement$2e$json__$28$json$29$__["default"].items;
const READINGS = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$content$2f$readings$2e$json__$28$json$29$__["default"].readings;
const cardById = (id)=>DECK.find((c)=>c.id === id);
const SKILLS = [
    "vocabulary",
    "collocation",
    "grammar"
];
function deckStats() {
    const byLevel = {};
    const byUnit = {};
    for (const c of DECK){
        byLevel[c.level] = (byLevel[c.level] ?? 0) + 1;
        byUnit[c.unit] = (byUnit[c.unit] ?? 0) + 1;
    }
    return {
        total: DECK.length,
        byLevel,
        byUnit
    };
}
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
"[project]/src/lib/server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildProfile",
    ()=>buildProfile,
    "bumpDaily",
    ()=>bumpDaily,
    "diagnose",
    ()=>diagnose,
    "dueCount",
    ()=>dueCount,
    "getLearner",
    ()=>getLearner,
    "queueCounts",
    ()=>queueCounts,
    "touchStreak",
    ()=>touchStreak
]);
// Shared server-side helpers: learner state, streak, live profile, diagnosis.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/content.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fsrs.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mistakes.ts [app-route] (ecmascript)");
;
;
;
;
async function getLearner() {
    let l = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.findUnique({
        where: {
            id: "me"
        }
    });
    if (!l) l = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.create({
        data: {
            id: "me"
        }
    });
    return l;
}
async function bumpDaily(field, inc = 1) {
    const day = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.upsert({
        where: {
            day
        },
        create: {
            day,
            [field]: inc
        },
        update: {
            [field]: {
                increment: inc
            }
        }
    });
}
async function touchStreak() {
    const l = await getLearner();
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    if (l.lastActiveDay === today) return l;
    const gap = today - l.lastActiveDay;
    let streak;
    let freezes = l.freezes;
    let froze = false;
    if (l.lastActiveDay < 0) streak = 1;
    else if (gap === 1) streak = l.streak + 1;
    else if (gap === 2 && freezes > 0) {
        freezes -= 1;
        froze = true;
        streak = l.streak + 1;
    } else streak = 1;
    const cap = l.perks.includes("freeze_cap") ? 3 : 2; // Deep Freezer talent widens the bank
    if (streak > 0 && streak % 7 === 0 && !froze) freezes = Math.min(cap, freezes + 1);
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            streak,
            lastActiveDay: today,
            freezes
        }
    });
}
async function queueCounts() {
    const l = await getLearner();
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const all = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].cardState.findMany();
    const due = all.filter((s)=>!s.suspended && s.state !== "new" && s.due <= today).length;
    const introducedToday = all.filter((s)=>s.last === today && s.reps === 1).length;
    const known = all.filter((s)=>s.state !== "new").length;
    const newLeft = Math.max(0, Math.min(l.newPerDay - introducedToday, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DECK"].length - known));
    const future = all.filter((s)=>!s.suspended && s.state !== "new" && s.due > today).map((s)=>s.due);
    return {
        due,
        newLeft,
        reviewedToday: introducedToday,
        newPerDay: l.newPerDay,
        seen: all.length,
        unseen: Math.max(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DECK"].length - all.length),
        nextDue: future.length ? Math.min(...future) : null,
        dueTomorrow: future.filter((d)=>d <= today + 1).length,
        due3days: future.filter((d)=>d <= today + 3).length
    };
}
async function dueCount() {
    const c = await queueCounts();
    // The badge promises what one round actually delivers (capped like the queue).
    return c.due + c.newLeft;
}
async function buildProfile() {
    const l = await getLearner();
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const due = await dueCount();
    // Recent trap tags from the last graded lapses drive AI focus.
    const recent = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].reviewLog.findMany({
        where: {
            grade: 1
        },
        orderBy: {
            id: "desc"
        },
        take: 12
    });
    const traps = [];
    for (const r of recent){
        const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cardById"])(r.cardId);
        if (c) {
            for (const t of c.traps)if (!traps.includes(t)) traps.push(t);
        }
    }
    // Weakest skills by lapse ratio over cards with reps.
    const states = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].cardState.findMany({
        where: {
            reps: {
                gt: 3
            }
        }
    });
    const agg = {};
    for (const st of states){
        const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cardById"])(st.cardId);
        if (!c) continue;
        agg[c.skill] ??= {
            ok: 0,
            lapse: 0
        };
        if (st.lapses > 0) agg[c.skill].lapse += st.lapses;
        agg[c.skill].ok += Math.max(1, st.reps - st.lapses);
    }
    const weakSkills = Object.entries(agg).map(([skill, a])=>({
            skill,
            rate: a.lapse / (a.lapse + a.ok)
        })).sort((a, b)=>b.rate - a.rate).filter((x)=>x.rate > 0.15).slice(0, 2).map((x)=>x.skill);
    // Persistent mistake families: production corrections across chat, essays
    // and speaking, keyed by trap tag. These drive what the tutor hunts and what
    // exams prioritize - memory instead of rediscovery. Resolved families are
    // excluded (activeOnly): healing must silence the steering, that is the
    // learner-visible reward for getting past a weakness.
    let mistakes = [];
    let mistakesHealed = 0;
    try {
        const all = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["topMistakes"])(50);
        mistakes = all.filter((m)=>!m.resolvedAt).slice(0, 5).map((m)=>({
                tag: m.tag,
                count: m.count,
                label: m.label
            }));
        mistakesHealed = all.filter((m)=>m.resolvedAt).length;
    } catch  {
    // Fresh database or table not yet migrated: the profile works without it.
    }
    return {
        level: l.level === "?" ? "B2" : l.level,
        streak: l.streak,
        focus: l.focusSkill,
        due,
        recentTraps: traps.slice(0, 4),
        weakSkills: weakSkills.length ? weakSkills : [
            "collocation"
        ],
        mistakes,
        mistakesHealed
    };
}
async function diagnose() {
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const states = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].cardState.findMany();
    const bySkill = {};
    for (const st of states){
        const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cardById"])(st.cardId);
        if (!c) continue;
        bySkill[c.skill] ??= {
            due: 0,
            lapses: 0,
            reps: 0,
            young: 0
        };
        if (st.state !== "new" && st.due <= today) bySkill[c.skill].due += 1;
        bySkill[c.skill].lapses += st.lapses;
        bySkill[c.skill].reps += st.reps;
        if (st.s < 3 && st.state === "review") bySkill[c.skill].young += 1;
    }
    const rows = Object.entries(bySkill).map(([skill, a])=>({
            skill,
            lapseRate: a.reps ? a.lapses / a.reps : 0,
            due: a.due,
            young: a.young,
            reps: a.reps
        })).sort((a, b)=>b.lapseRate - a.lapseRate);
    const l = await getLearner();
    const advice = [];
    const worst = rows[0];
    if (worst && worst.reps >= 5 && worst.lapseRate > 0.2) {
        advice.push(`${worst.skill} is your leakiest skill: ${Math.round(worst.lapseRate * 100)}% of reviews lapse. Drill it in Chat and ask Rah to build 5 fresh cards on it.`);
    }
    if (l.placementPhase !== "done") {
        advice.push("No measured level yet. The placement takes about 10 minutes and tunes every schedule.");
    }
    if (dueCountSafe(states, today) === 0 && rows.length > 0) {
        advice.push("Queue is clear. Feed Rah a text you actually read this week and turn it into cards.");
    }
    return {
        bySkill: rows,
        advice
    };
}
function dueCountSafe(states, today) {
    return states.filter((s)=>s.state !== "new" && s.due <= today).length;
}
}),
"[project]/src/lib/shop.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GEMS",
    ()=>GEMS,
    "SHOP_ITEMS",
    ()=>SHOP_ITEMS,
    "awardGems",
    ()=>awardGems,
    "boostActive",
    ()=>boostActive,
    "buyItem",
    ()=>buyItem,
    "shopView",
    ()=>shopView
]);
// Gems economy + Shop - the Duolingo reverse-engineering slice.
// Gems are the soft currency: earned from level-ups (30), finished quests (10),
// and weekly league payouts; spent on streak freezes and XP boosts.
// Boost math lives in awardXp (the single XP faucet) so every surface doubles
// honestly; purchases live here so the ledger stays in one place.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fsrs.ts [app-route] (ecmascript)");
;
;
const GEMS = {
    levelUp: 30,
    questDone: 10,
    leagueFinish: 25,
    goalHit: 5
};
const SHOP_ITEMS = [
    {
        key: "streak_freeze",
        title: "Streak Freeze",
        desc: "Banks one freeze. A missed day consumes it instead of breaking your chain (cap 2, 3 with the Deep Freezer talent).",
        cost: 100
    },
    {
        key: "xp_boost",
        title: "XP Boost x2",
        desc: "Every XP payout doubles until the end of tomorrow. Stacks after momentum heat and talents.",
        cost: 150
    }
];
async function awardGems(amount) {
    const inc = Math.max(0, Math.min(500, Math.round(amount)));
    const l = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.upsert({
        where: {
            id: "me"
        },
        create: {
            id: "me",
            gems: inc
        },
        update: {
            gems: {
                increment: inc
            }
        }
    });
    return l.gems;
}
function boostActive(boostUntil) {
    return boostUntil >= (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
}
async function buyItem(key) {
    const item = SHOP_ITEMS.find((i)=>i.key === key);
    if (!item) return {
        ok: false,
        error: "No such item in the shop."
    };
    const l = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.findUnique({
        where: {
            id: "me"
        }
    });
    if (!l) return {
        ok: false,
        error: "Learner not initialized."
    };
    if (l.gems < item.cost) {
        return {
            ok: false,
            error: `Not enough gems: need ${item.cost}, you have ${l.gems}.`
        };
    }
    if (key === "streak_freeze") {
        const cap = l.perks.includes("freeze_cap") ? 3 : 2;
        if (l.freezes >= cap) {
            return {
                ok: false,
                error: `Freeze bank is full (${l.freezes}/${cap}).`
            };
        }
        const updated = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
            where: {
                id: "me"
            },
            data: {
                gems: {
                    decrement: item.cost
                },
                freezes: {
                    increment: 1
                }
            }
        });
        return {
            ok: true,
            gems: updated.gems,
            title: item.title,
            desc: `Banked. Freezes: ${updated.freezes}/${cap}.`
        };
    }
    if (key === "xp_boost") {
        const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
        if (boostActive(l.boostUntil)) {
            return {
                ok: false,
                error: "A boost is already running - let it finish first."
            };
        }
        const updated = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
            where: {
                id: "me"
            },
            data: {
                gems: {
                    decrement: item.cost
                },
                boostUntil: today + 1
            }
        });
        return {
            ok: true,
            gems: updated.gems,
            title: item.title,
            desc: "2x XP live until the end of tomorrow."
        };
    }
    return {
        ok: false,
        error: "Item exists but has no purchase handler - that is a bug."
    };
}
function shopView(gems, freezes, boostUntil) {
    return {
        gems,
        boostActive: boostActive(boostUntil),
        items: SHOP_ITEMS.map((i)=>({
                ...i,
                affordable: gems >= i.cost
            })),
        freezes
    };
}
}),
"[project]/src/lib/arcade.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ACHIEVEMENTS",
    ()=>ACHIEVEMENTS,
    "DIVISIONS",
    ()=>DIVISIONS,
    "HEAT_TIERS",
    ()=>HEAT_TIERS,
    "PERKS",
    ()=>PERKS,
    "QUEST_TEMPLATES",
    ()=>QUEST_TEMPLATES,
    "awardXp",
    ()=>awardXp,
    "bumpStat",
    ()=>bumpStat,
    "buyPerk",
    ()=>buyPerk,
    "ensureQuests",
    ()=>ensureQuests,
    "evaluateAchievements",
    ()=>evaluateAchievements,
    "getChain",
    ()=>getChain,
    "getGameView",
    ()=>getGameView,
    "getLeagueView",
    ()=>getLeagueView,
    "getPerksView",
    ()=>getPerksView,
    "getRivalView",
    ()=>getRivalView,
    "hasPerk",
    ()=>hasPerk,
    "heatOf",
    ()=>heatOf,
    "learnerPerks",
    ()=>learnerPerks,
    "levelFromXp",
    ()=>levelFromXp,
    "levelName",
    ()=>levelName,
    "levelView",
    ()=>levelView,
    "progressQuest",
    ()=>progressQuest,
    "registerHit",
    ()=>registerHit,
    "registerMiss",
    ()=>registerMiss,
    "xpToReach",
    ()=>xpToReach
]);
// The arcade engine: lifetime XP, levels, achievements, daily quests,
// GameStat records, the rubber-band rival and the streak forge. Every hook
// the app already had (review grades, exam grades, essays, monologues, chat
// turns, placement) now flows through here, so one currency and one ladder
// connect all surfaces. Deterministic everywhere: no cron, no background jobs.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fsrs.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mistakes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$shop$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/shop.ts [app-route] (ecmascript)");
;
;
;
;
;
const HEAT_TIERS = [
    {
        min: 0,
        mult: 1,
        label: "cold"
    },
    {
        min: 5,
        mult: 1.05,
        label: "warming"
    },
    {
        min: 10,
        mult: 1.1,
        label: "warm"
    },
    {
        min: 15,
        mult: 1.2,
        label: "hot"
    },
    {
        min: 25,
        mult: 1.3,
        label: "blazing"
    }
];
function heatOf(chain) {
    let t = HEAT_TIERS[0];
    for (const tier of HEAT_TIERS)if (chain >= tier.min) t = tier;
    return {
        min: t.min,
        mult: t.mult,
        label: t.label
    };
}
async function freshChain(l) {
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    return l.chainDay === today ? l.chain : 0;
}
async function getChain() {
    const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    const chain = await freshChain(l);
    const heat = heatOf(chain);
    return {
        chain,
        ...heat
    };
}
async function registerHit() {
    const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const base = await freshChain(l);
    const chain = base + 1;
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            chain,
            chainDay: today
        }
    });
    await bumpStat("chain:best", chain);
    const heat = heatOf(chain);
    await progressQuest("heat_15", chain);
    return {
        chain,
        ...heat
    };
}
async function registerMiss() {
    const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const base = await freshChain(l);
    if (base === 0) return;
    const shielded = hasPerk(l.perks, "chain_shield");
    if (shielded) {
        const key = `shield:${today}`;
        const used = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key
            }
        });
        if (!used) {
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.create({
                data: {
                    key,
                    best: 1,
                    plays: 0
                }
            });
            return; // shield ate the miss; chain keeps running
        }
    }
    const chain = Math.floor(base / 2);
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            chain,
            chainDay: today
        }
    });
}
const PERKS = [
    {
        key: "xp_review",
        branch: "reading",
        tier: 1,
        title: "Fast Reader",
        desc: "+15% XP from every review grade."
    },
    {
        key: "chain_shield",
        branch: "vocabulary",
        tier: 2,
        title: "Chain Shield",
        desc: "The first miss each day no longer halves your momentum chain."
    },
    {
        key: "duel_time",
        branch: "writing",
        tier: 1,
        title: "Cool Head",
        desc: "+10 seconds on every Rival Duel timer."
    },
    {
        key: "dungeon_heart",
        branch: "listening",
        tier: 2,
        title: "Iron Lungs",
        desc: "Enter the Daily Dungeon with 4 hearts instead of 3."
    },
    {
        key: "freeze_cap",
        branch: "speaking",
        tier: 3,
        title: "Deep Freezer",
        desc: "Streak freeze bank grows to 3 (from 2)."
    },
    {
        key: "quest_boost",
        branch: "grammar",
        tier: 2,
        title: "Overachiever",
        desc: "Quest payouts pay +15% XP."
    }
];
function hasPerk(perksJson, key) {
    if (!perksJson) return false;
    try {
        return JSON.parse(perksJson).includes(key);
    } catch  {
        return false;
    }
}
async function learnerPerks() {
    const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    if (!l.perks) return [];
    try {
        return JSON.parse(l.perks);
    } catch  {
        return [];
    }
}
async function getPerksView() {
    const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    // Retroactive catch-up: the tree arrives when the learner is already deep
    // in the ladder, so their earned SP is granted once on first open.
    const init = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
        where: {
            key: "talents:init"
        }
    });
    let sp = l.sp;
    let leveled = false;
    if (!init) {
        const level = levelFromXp(l.xp);
        sp += Math.max(0, level - 1);
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
            where: {
                id: "me"
            },
            data: {
                sp
            }
        });
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.create({
            data: {
                key: "talents:init",
                best: level,
                plays: 0
            }
        });
        leveled = true;
    }
    const skills = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].skillLevel.findMany();
    return {
        sp,
        owned: learnerPerksFrom(l.perks),
        perks: PERKS,
        skills: skills.map((s)=>({
                skill: s.skill,
                score: s.score
            })),
        leveled
    };
}
function learnerPerksFrom(json) {
    if (!json) return [];
    try {
        return JSON.parse(json);
    } catch  {
        return [];
    }
}
async function buyPerk(key) {
    const def = PERKS.find((p)=>p.key === key);
    if (!def) return {
        ok: false,
        error: "Unknown perk",
        sp: 0,
        owned: []
    };
    const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    const owned = learnerPerksFrom(l.perks);
    if (owned.includes(key)) return {
        ok: false,
        error: "Already unlocked",
        sp: l.sp,
        owned
    };
    // Tier N needs N-1 perks owned anywhere: every branch holds a single perk,
    // so the gate counts global progress, not same-branch purchases.
    if (owned.length < def.tier - 1) return {
        ok: false,
        error: `Unlock ${def.tier - 1} perk${def.tier - 1 === 1 ? "" : "s"} first`,
        sp: l.sp,
        owned
    };
    if (l.sp < def.tier) return {
        ok: false,
        error: `Needs ${def.tier} SP (you have ${l.sp})`,
        sp: l.sp,
        owned
    };
    const sp = l.sp - def.tier;
    const perks = JSON.stringify([
        ...owned,
        key
    ]);
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            sp,
            perks
        }
    });
    return {
        ok: true,
        sp,
        owned: [
            ...owned,
            key
        ]
    };
}
function xpToReach(level) {
    if (level <= 1) return 0;
    return Math.round(50 * Math.pow(level - 1, 1.45));
}
function levelFromXp(xp) {
    let lvl = 1;
    while(lvl < 40 && xp >= xpToReach(lvl + 1))lvl++;
    return lvl;
}
const LEVEL_NAMES = [
    "Rookie",
    "Apprentice",
    "Wordsmith",
    "Sharpshooter",
    "Gladiator",
    "Duelist",
    "Sage",
    "Mythic",
    "Legend"
];
function levelName(level) {
    return LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((level - 1) / 5))];
}
function levelView(xp) {
    const level = levelFromXp(xp);
    const base = xpToReach(level);
    const nextAt = level >= 40 ? null : xpToReach(level + 1);
    const span = nextAt === null ? 1 : nextAt - base;
    const into = xp - base;
    return {
        level,
        name: levelName(level),
        xp,
        intoLevel: into,
        levelSpan: span,
        nextAt,
        pct: nextAt === null ? 100 : Math.min(100, Math.round(into / span * 100))
    };
}
const ACHIEVEMENTS = [
    {
        key: "first_words",
        title: "First Words",
        desc: "Grade your very first review.",
        icon: "Sparkles"
    },
    {
        key: "century",
        title: "Century",
        desc: "100 lifetime reviews.",
        icon: "Hash"
    },
    {
        key: "millennium",
        title: "Millennium",
        desc: "1000 lifetime reviews.",
        icon: "Hash"
    },
    {
        key: "week_warrior",
        title: "Week Warrior",
        desc: "Hold a 7-day streak.",
        icon: "Flame"
    },
    {
        key: "month_monk",
        title: "Month Monk",
        desc: "Hold a 30-day streak.",
        icon: "Flame"
    },
    {
        key: "speed_demon",
        title: "Speed Demon",
        desc: "Score 300+ in a Speed Round.",
        icon: "Zap"
    },
    {
        key: "combo_10",
        title: "Tenfold",
        desc: "Hit a 10x combo in a Speed Round.",
        icon: "Zap"
    },
    {
        key: "boss_slayer",
        title: "Boss Slayer",
        desc: "Defeat The Examiner.",
        icon: "Swords"
    },
    {
        key: "boss_flawless",
        title: "Untouchable",
        desc: "Defeat The Examiner without losing a heart.",
        icon: "ShieldCheck"
    },
    {
        key: "quest_master",
        title: "Quest Master",
        desc: "Clear all three quests in one day.",
        icon: "Target"
    },
    {
        key: "essayist",
        title: "Essayist",
        desc: "Five graded essays.",
        icon: "PenLine"
    },
    {
        key: "orator",
        title: "Orator",
        desc: "Five diagnosed monologues.",
        icon: "Mic"
    },
    {
        key: "healer",
        title: "Healer",
        desc: "Heal your first mistake family.",
        icon: "HeartPulse"
    },
    {
        key: "healer_5",
        title: "Wound Closer",
        desc: "Heal five mistake families.",
        icon: "HeartPulse"
    },
    {
        key: "rival_slayer",
        title: "Rival Slayer",
        desc: "Out-gain your rival for a full week.",
        icon: "Trophy"
    },
    {
        key: "level_10",
        title: "Double Digits",
        desc: "Reach level 10.",
        icon: "Star"
    },
    {
        key: "level_20",
        title: "Gladiator",
        desc: "Reach level 20.",
        icon: "Star"
    },
    {
        key: "chain_25",
        title: "Blaze",
        desc: "Hold a 25-answer momentum chain.",
        icon: "Flame"
    },
    {
        key: "league_gold",
        title: "Promoted",
        desc: "Win promotion in a League season.",
        icon: "Medal"
    },
    {
        key: "dungeon_perfect",
        title: "Dungeon Master",
        desc: "Clear the Daily Dungeon without losing a heart.",
        icon: "Castle"
    },
    {
        key: "duel_win",
        title: "Duelist",
        desc: "Beat your rival in a Duel.",
        icon: "Swords"
    },
    {
        key: "gauntlet_25",
        title: "Deathless",
        desc: "Survive 25 Gauntlet items in one run.",
        icon: "Skull"
    },
    {
        key: "flow_5",
        title: "In the Zone",
        desc: "Finish Focus Flows 5 days in a row.",
        icon: "Timer"
    },
    {
        key: "anthology",
        title: "Anthology",
        desc: "Bank three graded essays in the Portfolio.",
        icon: "Library"
    }
];
async function achCtx() {
    const [reviews, writes, speaks, learner, speedBest, speedCombo, bossWins, bossFlaw, doneToday, rival, chainBest, leagueProm, dungeonBest, dungeonPerfect, duelWins, gauntletBest, flowStreak] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].reviewLog.count(),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].writingSub.count(),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].speakSession.count(),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.findUnique({
            where: {
                id: "me"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "speed:best"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "speed:combo"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "boss:wins"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "boss:flawless"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].quest.count({
            where: {
                day: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])(),
                done: true
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].rival.findUnique({
            where: {
                id: "me"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "chain:best"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "league:promotions"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "dungeon:best"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "dungeon:perfect"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "duel:wins"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "gauntlet:best"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
            where: {
                key: "flow:streak"
            }
        })
    ]);
    const fams = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["topMistakes"])(200).catch(()=>[]);
    return {
        reviews,
        writes,
        speaks,
        healed: fams.filter((f)=>f.resolvedAt).length,
        level: levelFromXp(learner?.xp ?? 0),
        streak: learner?.streak ?? 0,
        speedBest: speedBest?.best ?? 0,
        speedCombo: speedCombo?.best ?? 0,
        bossWins: bossWins?.best ?? 0,
        bossFlawless: bossFlaw?.best ?? 0,
        questsDoneToday: doneToday,
        rivalWins: rival?.wins ?? 0,
        chainBest: chainBest?.best ?? 0,
        leaguePromotions: leagueProm?.best ?? 0,
        dungeonBest: dungeonBest?.best ?? 0,
        dungeonPerfect: dungeonPerfect?.best ?? 0,
        duelWins: duelWins?.best ?? 0,
        gauntletBest: gauntletBest?.best ?? 0,
        flowStreak: flowStreak?.best ?? 0
    };
}
function ctxUnlocks(c) {
    const out = [];
    if (c.reviews >= 1) out.push("first_words");
    if (c.reviews >= 100) out.push("century");
    if (c.reviews >= 1000) out.push("millennium");
    if (c.streak >= 7) out.push("week_warrior");
    if (c.streak >= 30) out.push("month_monk");
    if (c.speedBest >= 300) out.push("speed_demon");
    if (c.speedCombo >= 10) out.push("combo_10");
    if (c.bossWins >= 1) out.push("boss_slayer");
    if (c.bossFlawless >= 1) out.push("boss_flawless");
    if (c.questsDoneToday >= 3) out.push("quest_master");
    if (c.writes >= 5) out.push("essayist");
    if (c.speaks >= 5) out.push("orator");
    if (c.healed >= 1) out.push("healer");
    if (c.healed >= 5) out.push("healer_5");
    if (c.rivalWins >= 1) out.push("rival_slayer");
    if (c.level >= 10) out.push("level_10");
    if (c.level >= 20) out.push("level_20");
    if (c.chainBest >= 25) out.push("chain_25");
    if (c.leaguePromotions >= 1) out.push("league_gold");
    if (c.dungeonPerfect >= 1) out.push("dungeon_perfect");
    if (c.duelWins >= 1) out.push("duel_win");
    if (c.gauntletBest >= 25) out.push("gauntlet_25");
    if (c.flowStreak >= 5) out.push("flow_5");
    if (c.writes >= 3) out.push("anthology");
    return out;
}
async function evaluateAchievements() {
    const ctx = await achCtx();
    const should = new Set(ctxUnlocks(ctx));
    const have = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].achievement.findMany({
        where: {
            key: {
                in: [
                    ...should
                ]
            }
        }
    });
    const haveKeys = new Set(have.map((a)=>a.key));
    const fresh = [
        ...should
    ].filter((k)=>!haveKeys.has(k));
    if (fresh.length === 0) return [];
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].achievement.createMany({
        data: fresh.map((key)=>({
                key
            }))
    });
    return fresh.map((key)=>{
        const d = ACHIEVEMENTS.find((a)=>a.key === key);
        return {
            key,
            title: d.title,
            desc: d.desc,
            icon: d.icon
        };
    });
}
async function awardXp(amount, opts) {
    const chainInfo = opts?.chainHit ? await registerHit() : await getChain();
    let mult = chainInfo.mult;
    const l0 = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    if (opts?.perkXp === "review" && hasPerk(l0.perks, "xp_review")) mult *= 1.15;
    if (opts?.perkXp === "quest" && hasPerk(l0.perks, "quest_boost")) mult *= 1.15;
    // Shop XP boost (Duolingo RE): 2x every payout while active. Stacks after heat + talents.
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$shop$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["boostActive"])(l0.boostUntil)) mult *= 2;
    const base = Math.max(0, Math.min(500, Math.round(amount)));
    const amt = Math.min(500, Math.round(base * mult));
    const l = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.upsert({
        where: {
            id: "me"
        },
        create: {
            id: "me",
            xp: amt
        },
        update: {
            xp: {
                increment: amt
            }
        }
    });
    // Level-ups bank talent points for the tree (1 SP per level gained) and mint gems (Duolingo RE).
    const before = levelFromXp(l.xp - amt);
    const view = levelView(l.xp);
    if (view.level > before) {
        const gained = view.level - before;
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
            where: {
                id: "me"
            },
            data: {
                sp: {
                    increment: gained
                },
                gems: {
                    increment: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$shop$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GEMS"].levelUp * gained
                }
            }
        });
    }
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bumpDaily"])("xp", amt);
    const unlocked = await evaluateAchievements();
    return {
        total: l.xp,
        base,
        mult: Math.round(mult * 100) / 100,
        chain: chainInfo.chain,
        level: view.level,
        levelName: view.name,
        leveledUp: view.level > before,
        unlocked
    };
}
const QUEST_TEMPLATES = [
    {
        key: "reviews_20",
        title: "Clear 20 reviews",
        fa: "۲۰ مرور را تمام کن",
        target: 20,
        xp: 60,
        kind: "sum"
    },
    {
        key: "reviews_35",
        title: "Clear 35 reviews",
        fa: "۳۵ مرور را تمام کن",
        target: 35,
        xp: 95,
        kind: "sum"
    },
    {
        key: "correct_15",
        title: "15 good recalls",
        fa: "۱۵ یادآوری درست",
        target: 15,
        xp: 70,
        kind: "sum"
    },
    {
        key: "chat_10",
        title: "10 turns with the coach",
        fa: "۱۰ نوبت با مربی",
        target: 10,
        xp: 50,
        kind: "sum"
    },
    {
        key: "write_1",
        title: "Grade one essay",
        fa: "یک بنویس و بگیر نمره",
        target: 1,
        xp: 60,
        kind: "sum"
    },
    {
        key: "speak_1",
        title: "One speaking monologue",
        fa: "یک مونولوگ بگو",
        target: 1,
        xp: 60,
        kind: "sum"
    },
    {
        key: "exam_1",
        title: "Take a coach exam",
        fa: "یک امتحان بده",
        target: 1,
        xp: 80,
        kind: "sum"
    },
    {
        key: "speed_play",
        title: "Finish a Speed Round",
        fa: "یک دور سرعتی بازی کن",
        target: 1,
        xp: 40,
        kind: "sum"
    },
    {
        key: "speed_combo_8",
        title: "Reach an 8x combo",
        fa: "کمبو ۸ برسانی",
        target: 8,
        xp: 80,
        kind: "max"
    },
    {
        key: "boss_phase",
        title: "Survive 2 boss phases",
        fa: "۲ فاز رئیس زنده بمان",
        target: 2,
        xp: 60,
        kind: "max"
    },
    {
        key: "boss_win",
        title: "Slay The Examiner",
        fa: "امتحان‌دهنده را بکش",
        target: 1,
        xp: 120,
        kind: "sum"
    },
    {
        key: "arena_5",
        title: "5 Voice Arena reps",
        fa: "۵ تمرین میکروفونی",
        target: 5,
        xp: 70,
        kind: "sum"
    },
    {
        key: "heat_15",
        title: "Reach a 15-chain",
        fa: "زنجیره ۱۵ بساز",
        target: 15,
        xp: 90,
        kind: "max"
    },
    {
        key: "dungeon_1",
        title: "Clear the Daily Dungeon",
        fa: "سیاهچال امروز را بزن",
        target: 1,
        xp: 80,
        kind: "sum"
    },
    {
        key: "duel_1",
        title: "Win a Rival Duel",
        fa: "یک دوئل را ببر",
        target: 1,
        xp: 80,
        kind: "sum"
    },
    {
        key: "gauntlet_10",
        title: "Survive 10 Gauntlet items",
        fa: "۱۰ آیتم گانتلت زنده بمان",
        target: 10,
        xp: 90,
        kind: "max"
    },
    {
        key: "flow_1",
        title: "Finish a Focus Flow",
        fa: "یک جریان تمرکز تمام کن",
        target: 1,
        xp: 70,
        kind: "sum"
    }
];
async function ensureQuests() {
    const day = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].quest.count({
        where: {
            day
        }
    });
    if (existing > 0) return;
    let famTags = [];
    try {
        famTags = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["topMistakes"])(10)).filter((f)=>!f.resolvedAt).map((f)=>f.tag);
    } catch  {
    // fresh db
    }
    const pick = seededPick(QUEST_TEMPLATES.map((t)=>t.key), 3, day);
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].quest.createMany({
        data: pick.map((key, i)=>{
            const t = QUEST_TEMPLATES.find((q)=>q.key === key);
            return {
                id: `${day}:${key}`,
                day,
                key,
                title: t.title,
                fa: t.fa,
                target: t.target,
                xp: t.xp,
                progress: 0,
                done: false,
                ...i === -1 ? {} : {}
            };
        })
    });
    void famTags; // biasing hook reserved: templates already cover every surface
}
function seededPick(arr, n, seed) {
    const a = [
        ...arr
    ];
    let s = seed * 2654435761 % 4294967296;
    const rnd = ()=>{
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    };
    for(let i = a.length - 1; i > 0; i--){
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [
            a[j],
            a[i]
        ];
    }
    return a.slice(0, n);
}
async function progressQuest(key, amount) {
    const day = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const q = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].quest.findUnique({
        where: {
            id: `${day}:${key}`
        }
    });
    if (!q || q.done) return;
    const t = QUEST_TEMPLATES.find((x)=>x.key === key);
    const progress = t?.kind === "max" ? Math.max(q.progress, amount) : q.progress + amount;
    if (progress >= q.target) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].quest.update({
            where: {
                id: q.id
            },
            data: {
                progress: q.target,
                done: true
            }
        });
        await awardXp(q.xp, {
            perkXp: "quest"
        });
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$shop$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["awardGems"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$shop$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GEMS"].questDone).catch(()=>undefined);
        await evaluateAchievements();
    } else {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].quest.update({
            where: {
                id: q.id
            },
            data: {
                progress
            }
        });
    }
}
const DIVISIONS = [
    "Wood",
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Rahiator"
];
const LEAGUE_SIZE = 8; // you + 7 ghosts
const PROMOTE_PLACES = 3; // top 3 climb
const DEMOTE_PLACES = 3; // bottom 3 drop
function ghostXp(week, slot, dailyTarget, dayOfWeek) {
    // Deterministic ghost accumulation, slot 0..6, mirrors the rival's rubber
    // band so every league feels alive but beatable.
    let sum = 0;
    for(let d = 0; d <= dayOfWeek; d++){
        const jitter = 0.55 + seededUnit(week * 977 + slot * 61 + d) * 0.95;
        sum += Math.round(dailyTarget * jitter);
    }
    return sum;
}
async function getLeagueView() {
    const day = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const wk = weekOf(day);
    const dayOfWeek = day - wk * 7;
    const recent = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.findMany({
        where: {
            day: {
                gte: day - 7,
                lt: day
            }
        }
    });
    const avg = recent.reduce((s, r)=>s + r.xp, 0) / 7;
    const dailyTarget = Math.max(70, Math.round(avg * 0.8));
    let row = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].league.findUnique({
        where: {
            id: "me"
        }
    });
    if (!row) {
        const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
        const lvl = levelFromXp(l.xp);
        const startDivision = lvl >= 25 ? 3 : lvl >= 15 ? 2 : lvl >= 8 ? 1 : 0;
        row = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].league.create({
            data: {
                id: "me",
                weekKey: wk,
                division: startDivision
            }
        });
    }
    if (row.weekKey !== wk) {
        // Settle last week: compute final place, apply promotion/demotion.
        const settled = row;
        const lastDow = 6;
        const thisWkDays = Array.from({
            length: 7
        }, (_, i)=>settled.weekKey * 7 + i);
        const youRows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.findMany({
            where: {
                day: {
                    in: thisWkDays
                }
            }
        });
        const youXp = youRows.reduce((s, r)=>s + r.xp, 0);
        const lastAvg = Math.max(70, Math.round(avg * 0.8));
        const ghosts = Array.from({
            length: LEAGUE_SIZE - 1
        }, (_, i)=>ghostXp(settled.weekKey, i, lastAvg, lastDow));
        const place = 1 + ghosts.filter((g)=>g > youXp).length;
        const promoted = place <= PROMOTE_PLACES && settled.division < DIVISIONS.length - 1;
        const demoted = place > LEAGUE_SIZE - DEMOTE_PLACES && settled.division > 0;
        const division = Math.max(0, Math.min(DIVISIONS.length - 1, settled.division + (promoted ? 1 : demoted ? -1 : 0)));
        const history = JSON.parse(settled.history || "[]");
        history.push({
            week: settled.weekKey,
            division: settled.division,
            place,
            promoted,
            demoted
        });
        if (promoted) {
            const prev = (await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
                where: {
                    key: "league:promotions"
                }
            }))?.best ?? 0;
            await bumpStat("league:promotions", prev + 1);
            await awardXp(150);
        }
        row = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].league.update({
            where: {
                id: "me"
            },
            data: {
                weekKey: wk,
                division,
                history: JSON.stringify(history.slice(-12))
            }
        });
    }
    const thisWkDays = Array.from({
        length: 7
    }, (_, i)=>wk * 7 + i);
    const youRows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.findMany({
        where: {
            day: {
                in: thisWkDays
            }
        }
    });
    const youXp = youRows.reduce((s, r)=>s + r.xp, 0);
    const standings = [
        {
            name: "You",
            xp: youXp,
            you: true
        },
        ...Array.from({
            length: LEAGUE_SIZE - 1
        }, (_, i)=>({
                name: RIVAL_NAMES[(wk * 13 + i * 5) % RIVAL_NAMES.length],
                xp: ghostXp(wk, i, dailyTarget, dayOfWeek),
                you: false
            }))
    ].sort((a, b)=>b.xp - a.xp);
    const place = 1 + standings.findIndex((s)=>s.you);
    const promoteCut = standings[PROMOTE_PLACES - 1]?.xp ?? 0;
    const demoteCut = standings[LEAGUE_SIZE - DEMOTE_PLACES]?.xp ?? 0;
    return {
        division: row.division,
        divisionName: DIVISIONS[row.division],
        standings,
        place,
        daysLeft: 6 - dayOfWeek,
        promoteCut,
        demoteCut,
        history: JSON.parse(row.history || "[]")
    };
}
async function bumpStat(key, best) {
    const row = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findUnique({
        where: {
            key
        }
    });
    if (!row) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.create({
            data: {
                key,
                best: best ?? 0,
                plays: key.includes(":") && !best ? 1 : 0
            }
        });
        if (best !== undefined) return {
            best,
            isNew: best > 0
        };
        return {
            best: 0,
            isNew: false
        };
    }
    if (best !== undefined && best > row.best) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.update({
            where: {
                key
            },
            data: {
                best,
                plays: {
                    increment: 1
                }
            }
        });
        return {
            best,
            isNew: true
        };
    }
    if (best === undefined) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.update({
            where: {
                key
            },
            data: {
                plays: {
                    increment: 1
                }
            }
        });
    }
    return {
        best: row.best,
        isNew: false
    };
}
// ---------- Rival ----------
const RIVAL_NAMES = [
    "Vahid the Verbose",
    "Sahar Silver-tongue",
    "Arman Atrox",
    "Parham the Pitiless",
    "Neda Nine-lives",
    "Kian Kill-switch",
    "Roya Razor-tongue",
    "Behnam Blackout"
];
const RIVAL_TAUNTS = [
    "I graded three essays before breakfast. Did you?",
    "My streak is architectural at this point.",
    "The Examiner and I play cards on Sundays. You weren't invited.",
    "I review at 5 a.m. Because standards.",
    "Your XP graph looks like a flatline, friend.",
    "Catch up. I will wait. Briefly."
];
function weekOf(day) {
    return Math.floor(day / 7);
}
function seededUnit(day) {
    // Deterministic 0..1 jitter per calendar day.
    let s = day * 2654435761 % 4294967296;
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
}
async function getRivalView() {
    const day = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const wk = weekOf(day);
    let rival = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].rival.findUnique({
        where: {
            id: "me"
        }
    });
    if (!rival) {
        const seedName = RIVAL_NAMES[seededUnit(wk) === 0 ? 0 : Math.floor(seededUnit(wk + 7) * RIVAL_NAMES.length)];
        rival = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].rival.create({
            data: {
                id: "me",
                name: seedName,
                weekKey: wk,
                taunt: RIVAL_TAUNTS[Math.floor(seededUnit(wk + 3) * RIVAL_TAUNTS.length)]
            }
        });
    }
    // Trailing 7-day learner XP average (yesterday backwards).
    const recent = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.findMany({
        where: {
            day: {
                gte: day - 7,
                lt: day
            }
        }
    });
    const weekSum = recent.reduce((s, r)=>s + r.xp, 0);
    const avg = weekSum / 7;
    const dailyTarget = Math.max(70, Math.round(avg * 0.8));
    if (rival.weekKey !== wk) {
        // Rollover: settle last week's race, then reset.
        const lastWk = weekOf(day - 1);
        const lastWkDays = Array.from({
            length: 7
        }, (_, i)=>lastWk * 7 + i);
        const youLast = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.findMany({
            where: {
                day: {
                    in: lastWkDays
                }
            }
        });
        const youXp = youLast.reduce((s, r)=>s + r.xp, 0);
        const wins = rival.wins + (youXp >= rival.weekXp ? 1 : 0);
        const losses = rival.losses + (youXp < rival.weekXp ? 1 : 0);
        rival = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].rival.update({
            where: {
                id: "me"
            },
            data: {
                lastWeekXp: rival.weekXp,
                weekXp: 0,
                weekKey: wk,
                wins,
                losses,
                name: RIVAL_NAMES[Math.floor(seededUnit(wk + 11) * RIVAL_NAMES.length)],
                taunt: RIVAL_TAUNTS[Math.floor(seededUnit(wk + 5) * RIVAL_TAUNTS.length)]
            }
        });
    }
    // Bring the rival's week up to its deterministic schedule for today.
    const dayOfWeek = day - wk * 7; // 0..6
    let expected = 0;
    for(let d = 0; d <= dayOfWeek; d++){
        const jitter = 0.75 + seededUnit(wk * 7 + d) * 0.55;
        expected += Math.round(dailyTarget * jitter);
    }
    if (rival.weekXp < expected) {
        rival = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].rival.update({
            where: {
                id: "me"
            },
            data: {
                weekXp: expected
            }
        });
    }
    const thisWkDays = Array.from({
        length: 7
    }, (_, i)=>wk * 7 + i);
    const youThis = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.findMany({
        where: {
            day: {
                in: thisWkDays
            }
        }
    });
    const youWeek = youThis.reduce((s, r)=>s + r.xp, 0);
    return {
        name: rival.name,
        weekXp: rival.weekXp,
        you: youWeek,
        lastWeekYou: 0,
        lastWeekRival: rival.lastWeekXp,
        wins: rival.wins,
        losses: rival.losses,
        taunt: rival.taunt,
        dailyTarget
    };
}
async function getGameView() {
    const l = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.findUnique({
        where: {
            id: "me"
        }
    });
    const xp = l?.xp ?? 0;
    const [ach, stats] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].achievement.findMany({
            orderBy: {
                at: "desc"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].gameStat.findMany()
    ]);
    const cutoff = new Date(Date.now() - 90_000);
    const recent = ach.filter((a)=>a.at >= cutoff).map((a)=>{
        const d = ACHIEVEMENTS.find((x)=>x.key === a.key);
        return d ? {
            key: a.key,
            title: d.title,
            desc: d.desc,
            icon: d.icon
        } : null;
    }).filter((x)=>x !== null);
    return {
        level: levelView(xp),
        unlocked: ach.map((a)=>a.key),
        all: ACHIEVEMENTS,
        recent,
        stats: stats.map((s)=>({
                key: s.key,
                best: s.best,
                plays: s.plays
            })),
        freezes: l?.freezes ?? 0
    };
}
}),
"[project]/src/lib/ladder.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// P3 of the mega-update: the content ladder.
//
// Before this module the placement level steered exam difficulty and the
// daily quiz, but Listen wrote the same monologue for a B1 and a C1 learner
// (the level string was interpolated, nothing else changed), Speak graded a
// B1 learner with C1 strictness, Read showed its six texts in fixed order,
// and the dungeon climbed the same staircase for everyone. One shared,
// deterministic envelope now sits under every generator: the learner's band
// decides how hard the material is BEFORE the AI gets any say - the engine
// decides, the AI words it.
//
// Pure and synchronous on purpose: every claim here is unit-testable with no
// db and no provider. "?" (unplaced) maps to B2 - the app's standing default.
__turbopack_context__.s([
    "ladderBrief",
    ()=>ladderBrief,
    "ladderFor",
    ()=>ladderFor,
    "orderReadings",
    ()=>orderReadings
]);
const LADDERS = {
    A2: {
        band: "A2",
        monologueWords: [
            110,
            150
        ],
        sentenceWords: [
            8,
            12
        ],
        idiomDensity: "plain",
        ttsRate: 0.82,
        speakStrictness: "gentle",
        quizLevels: [
            "A2",
            "B1"
        ],
        readOrder: "short-first"
    },
    B1: {
        band: "B1",
        monologueWords: [
            140,
            190
        ],
        sentenceWords: [
            10,
            16
        ],
        idiomDensity: "plain",
        ttsRate: 0.86,
        speakStrictness: "gentle",
        quizLevels: [
            "A2",
            "B1",
            "B2"
        ],
        readOrder: "short-first"
    },
    B2: {
        band: "B2",
        monologueWords: [
            160,
            220
        ],
        sentenceWords: [
            12,
            20
        ],
        idiomDensity: "moderate",
        ttsRate: 0.92,
        speakStrictness: "standard",
        quizLevels: [
            "B1",
            "B2",
            "C1"
        ],
        readOrder: "balanced"
    },
    C1: {
        band: "C1",
        monologueWords: [
            220,
            280
        ],
        sentenceWords: [
            16,
            28
        ],
        idiomDensity: "rich",
        ttsRate: 0.98,
        speakStrictness: "strict",
        quizLevels: [
            "B2",
            "C1"
        ],
        readOrder: "long-first"
    }
};
function ladderFor(level) {
    const key = String(level ?? "?").toUpperCase();
    return LADDERS[[
        "A2",
        "B1",
        "B2",
        "C1"
    ].includes(key) ? key : "B2"];
}
function ladderBrief(l, what) {
    const [lo, hi] = l.monologueWords;
    const [slo, shi] = l.sentenceWords;
    if (what === "listen") {
        return `Difficulty envelope (obey exactly): CEFR band ${l.band}. Monologue ${lo} to ${hi} words. Sentences ${slo} to ${shi} words. Idiom density: ${l.idiomDensity} (${l.band === "C1" ? "idiomatic and register-precise" : l.band === "B2" ? "some common idioms, mostly neutral phrasing" : "plain, high-frequency phrasing only"}). Word choice must stay inside ${l.band} material.`;
    }
    if (what === "speak") {
        if (l.speakStrictness === "gentle") {
            return `Grading envelope: ${l.band} learner, GENTLE bar. Judge intelligibility first: an error only counts when it blocks meaning. Upgrades push toward solid B1 phrasing, not fancy vocabulary. Farsi-interference traps still count.`;
        }
        if (l.speakStrictness === "strict") {
            return `Grading envelope: ${l.band} speaker, STRICT bar. Register, collocation precision and hedging all count; upgrades should reach for C1 phrasing (precise verbs, nominalizations, discourse markers).`;
        }
        return `Grading envelope: ${l.band} speaker, STANDARD bar. Grammar and word choice count normally; upgrades push toward ${l.band} phrasing with one step up.`;
    }
    return `Quiz envelope: draw material from bands ${l.quizLevels.join(", ")}. Trap density ${l.idiomDensity}.`;
}
// Read ordering: the learner's band first, then adjacent bands, ties broken
// by the band's reading order preference (short-first climbs, long-first
// dives). Deterministic: same input, same order.
const BAND_ORDER = {
    A2: [
        "A2",
        "B1",
        "B2",
        "C1"
    ],
    B1: [
        "B1",
        "A2",
        "B2",
        "C1"
    ],
    B2: [
        "B2",
        "B1",
        "C1",
        "A2"
    ],
    C1: [
        "C1",
        "B2",
        "B1",
        "A2"
    ]
};
function orderReadings(readings, band) {
    const pref = BAND_ORDER[band];
    const rank = (r)=>{
        const i = pref.indexOf(String(r.level).toUpperCase());
        return i === -1 ? pref.length : i;
    };
    const longFirst = ladderFor(band).readOrder === "long-first";
    const byMinutes = (a, b)=>longFirst ? b.minutes - a.minutes : a.minutes - b.minutes;
    return [
        ...readings
    ].sort((a, b)=>rank(a) - rank(b) || byMinutes(a, b));
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
"[project]/src/app/api/speak/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST,
    "SPEAK_PROMPTS",
    ()=>SPEAK_PROMPTS,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$arcade$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/arcade.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mistakes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ladder$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ladder.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rate$2d$limit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rate-limit.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
const dynamic = "force-dynamic";
const SPEAK_PROMPTS = [
    "Talk for 2 minutes: a habit you changed and what actually happened.",
    "Talk for 2 minutes: convince me your favorite tool is worth the hype.",
    "Talk for 2 minutes: describe a place you keep going back to, and why it works on you.",
    "Talk for 2 minutes: explain something from your field to a smart 12 year old.",
    "Talk for 2 minutes: a time you were completely wrong about someone."
];
async function GET() {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].speakSession.findMany({
        orderBy: {
            id: "desc"
        },
        take: 8
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        prompts: SPEAK_PROMPTS,
        recent: rows.map((r)=>({
                id: r.id,
                prompt: r.prompt,
                round: r.round,
                result: safeParse(r.result),
                at: r.at
            }))
    });
}
async function POST(req) {
    // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
    const rl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rate$2d$limit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiRateLimit"])(req);
    if (!rl.ok) return rl.response;
    const { prompt, transcript, round } = await req.json();
    const t = String(transcript ?? "").trim();
    if (t.length < 30) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "The transcript is too short. Speak for at least 30 seconds."
    }, {
        status: 400
    });
    const profile = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildProfile"])();
    // P3: the ladder sets the grading bar - a B1 learner is judged on
    // intelligibility, a C1 speaker on register and collocation precision.
    const lad = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ladder$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ladderFor"])(profile.level);
    let result;
    try {
        result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["speakSystem"])(profile.level)}\n\n${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ladder$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ladderBrief"])(lad, "speak")}`, [
            {
                role: "user",
                content: `Prompt: ${prompt}\nRound: ${round ?? 1}\nTranscript:\n${t.slice(0, 5000)}`
            }
        ]);
    } catch (e) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: `Coach is unreachable: ${e.message}`
        }, {
            status: 502
        });
    }
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].speakSession.create({
        data: {
            prompt: String(prompt ?? ""),
            transcript: t.slice(0, 5000),
            round: Number(round ?? 1),
            result: JSON.stringify(result)
        }
    });
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bumpDaily"])("spoken");
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$arcade$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["awardXp"])(20, {
        chainHit: true
    });
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["touchStreak"])();
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$arcade$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["progressQuest"])("speak_1", 1);
    // Mistake memory: spoken errors feed persistent families by their trap tag.
    if (Array.isArray(result.errors) && result.errors.length > 0) {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["recordMistakes"])(result.errors.map((e)=>({
                kind: "speak",
                tag: String(e.trap ?? "none"),
                wrong: String(e.bad ?? ""),
                right: String(e.good ?? "")
            })));
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
}
function safeParse(s) {
    try {
        return JSON.parse(s);
    } catch  {
        return null;
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__6b956b36._.js.map