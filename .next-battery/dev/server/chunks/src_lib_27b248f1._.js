module.exports = [
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
"[project]/src/lib/agent/skills-util.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "basePersona",
    ()=>basePersona,
    "coachTurn",
    ()=>coachTurn,
    "envelope",
    ()=>envelope,
    "profileBlock",
    ()=>profileBlock
]);
// Shared machinery for conversational skills. Every teaching skill composes a
// focus brief on top of the Socratic base prompt and parses the same envelope.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
;
function cleanEmDash(s) {
    return s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ",");
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
function extractTurn(raw) {
    const cleaned = cleanEmDash(raw.trim());
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fence ? fence[1] : cleaned;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1) throw new Error("no json");
    const candidate = end > start ? body.slice(start, end + 1) : body.slice(start);
    try {
        return JSON.parse(candidate);
    } catch  {
        return JSON.parse(repairJson(candidate));
    }
}
function rawFallback(raw) {
    return {
        reply: cleanEmDash(raw.trim().slice(0, 600)),
        corrections: [],
        fa_note: "",
        praised: false
    };
}
function basePersona(p) {
    return `You are Rah, the English coach inside a learning app. The learner's first language is Farsi (Persian) and they sit around ${p.level === "?" ? "B2" : p.level}, working toward C1.

## How you teach
1. Socratic drill. Make the learner produce language before you reveal anything. Answer questions with a question that makes them try first, then confirm.
2. Short turns. reply is at most 80 words and usually ends with a question or a task.
3. Retrieval beats re-reading. Push recall and production: rewrite a sentence, finish a thought, choose between two forms, use a target word. Never accept "I understand" as evidence.
4. Elaborated feedback. Every correction carries a Farsi explanation of WHY the wrong form happens for a Farsi speaker.
5. Push toward C1 markers: collocations over loose pairs, register awareness, hedging and discourse markers, precise verbs, idiomatic but natural phrasing.
6. One focus per turn. Pick the highest value mistake and drill it.

## Farsi interference traps (tag with one when it applies)
articles, countability, plurals, copula, prepositions (dar covers in/at/on), statives, perfect, question_order, adjectives, that_omission, th_sounds, w_v, clusters, ng, stress.

## Output contract
ONE JSON object, nothing else:
{"reply": "English turn, max 80 words", "corrections": [{"wrong": "their exact words", "right": "corrected", "fa": "explanation in Farsi", "trap": "one tag or none"}], "fa_note": "one short Farsi sentence about the correction, empty string if there were no corrections", "praised": false}
corrections: 0 to 3, most important first. fa_note MUST be an empty string when corrections is empty. Never use the em dash character. Never write Farsi inside the reply field, only inside fa and fa_note.`;
}
function profileBlock(p) {
    return JSON.stringify(p);
}
async function coachTurn(system, ctx, steps, opts) {
    const history = ctx.history.slice(-6).map((h)=>({
            role: h.role === "user" ? "user" : "assistant",
            content: h.role === "user" ? h.content : h.content.slice(0, 900)
        }));
    const deep = opts?.thinkingGate ? opts.thinkingGate(ctx.profile) : false;
    const out = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`${system}\n\n## Learner profile (live)\n${profileBlock(ctx.profile)}`, [
        ...history,
        {
            role: "user",
            content: ctx.text
        }
    ], rawFallback, {
        deep
    });
    const turn = {
        reply: cleanEmDash(String(out.reply ?? "")).trim(),
        corrections: Array.isArray(out.corrections) ? out.corrections.slice(0, 3) : [],
        fa_note: String(out.fa_note ?? "").trim(),
        praised: Boolean(out.praised)
    };
    // Memory feeding happens once at the agent boundary (/api/chat), so every
    // skill's corrections feed the same families without double counting.
    return turn;
}
function envelope(skill, turn, steps, extra) {
    return {
        skill,
        reply: turn.reply,
        corrections: turn.corrections,
        // No corrections means no Farsi tail: the learner complained about
        // Persian plan lines stapled onto every message. Farsi appears only
        // when there is something to explain.
        fa_note: turn.corrections.length > 0 ? turn.fa_note : "",
        steps,
        praised: turn.praised,
        ...extra
    };
}
}),
"[project]/src/lib/agent/skills-core.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Conversational teaching skills. Each is the Socratic coach with one
// obsession. Data-driven: the run() body is shared, the focus differs.
__turbopack_context__.s([
    "CORE_SKILLS",
    ()=>CORE_SKILLS
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/skills-util.ts [app-route] (ecmascript)");
;
function makeDrill(spec) {
    return {
        id: spec.id,
        name: spec.name,
        oneLiner: spec.oneLiner,
        commands: spec.commands,
        triggers: spec.triggers,
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Loaded your profile",
                detail: `level ${ctx.profile.level}, weak: ${ctx.profile.weakSkills.join(", ") || "balanced"}`
            });
            steps.push({
                label: spec.name,
                detail: "one focus this turn"
            });
            const system = `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["basePersona"])(ctx.profile)}

## This turn's obsession: ${spec.name}

${spec.focus}

Steer every turn back to this obsession without announcing it. If the learner drifts, answer once, then pull the thread back with a task.`;
            const turn = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["coachTurn"])(system, ctx, steps);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["envelope"])(spec.id, turn, steps);
        }
    };
}
const CORE_SKILLS = [
    {
        id: "chat",
        name: "Free conversation",
        oneLiner: "Socratic chat that corrects as you go",
        commands: [
            "chat",
            "talk"
        ],
        triggers: [],
        run: async (ctx)=>{
            const steps = [
                {
                    label: "Coach turn",
                    detail: "reading your last lines for the highest-value fix"
                }
            ];
            const turn = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["coachTurn"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["basePersona"])(ctx.profile), ctx, steps, {
                thinkingGate: (p)=>p.level === "C1"
            });
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["envelope"])("chat", turn, steps);
        }
    },
    makeDrill({
        id: "correct",
        name: "Deep correction",
        oneLiner: "Paste anything, get it fixed with the why",
        commands: [
            "correct",
            "fix"
        ],
        triggers: [
            /^(correct|fix|check)\b.*:/i,
            /^(correct|fix|check) this/i,
            /correct this sentence/i,
            /is this (correct|right|grammatical)/i
        ],
        focus: "The learner handed you text to fix. Correct up to 3 issues, ranked by value. For each, make them attempt the fix in their next message before confirming, unless they already attempted it."
    }),
    makeDrill({
        id: "translate",
        name: "Translation drill",
        oneLiner: "Say it in English, Farsi source welcome",
        commands: [
            "translate",
            "tr"
        ],
        triggers: [
            /how (do|would) (i|you) say/i,
            /translate/i,
            /what is .* in english/i,
            /in english\?*$/i
        ],
        focus: "The learner wants a Farsi thought in English. First make THEM attempt a version. Grade their attempt, then give the natural version plus one register note."
    }),
    makeDrill({
        id: "collocation-drill",
        name: "Collocation drill",
        oneLiner: "Verb-noun pairs that never translate",
        commands: [
            "collocation",
            "collocations"
        ],
        triggers: [
            /collocation/i,
            /word (pairs?|combinations?)/i,
            /make or do/i,
            /do or make/i
        ],
        focus: "Drill collocations that break under Farsi-to-English transfer: make/do, take/get, heavy/strong, raise/issue. Make them choose, produce, and correct. One pair family per turn."
    }),
    makeDrill({
        id: "vocab-drill",
        name: "Vocabulary workout",
        oneLiner: "Word families, register, precision",
        commands: [
            "vocab",
            "vocabulary"
        ],
        triggers: [
            /vocabular/i,
            /\bvocab\b/i,
            /(new|more) words/i,
            /word of the day/i,
            /teach me (a |an )?word/i
        ],
        focus: "Work mid-frequency and C1 vocabulary: word families, register (formal vs casual), precise verbs over generic ones (go up -> surge, climb, spike). Make them use each word in their own sentence."
    }),
    makeDrill({
        id: "phrasal-verbs",
        name: "Phrasal verbs",
        oneLiner: "put up with, run out of, cut down on",
        commands: [
            "phrasal"
        ],
        triggers: [
            /phrasal/i,
            /two[- ]word verbs?/i
        ],
        focus: "Drill phrasal verbs by register and particle logic. Make them produce sentences, not definitions. Show the formal one-word twin (put up with = tolerate) for C1 range."
    }),
    makeDrill({
        id: "idioms",
        name: "Idioms",
        oneLiner: "Sound like a person, not a textbook",
        commands: [
            "idiom",
            "idioms"
        ],
        triggers: [
            /idiom/i,
            /expressions?/i,
            /sound natural/i,
            /native speakers? say/i
        ],
        focus: "Teach idioms with register warnings (workplace-safe vs casual only). Make them use one in a sentence about their own life."
    }),
    makeDrill({
        id: "grammar-drill",
        name: "Grammar drill",
        oneLiner: "Tenses, articles, prepositions, on demand",
        commands: [
            "grammar"
        ],
        triggers: [
            /grammar/i,
            /(present|past) (perfect|simple|continuous)/i,
            /tense/i,
            /article (a|an|the)/i,
            /preposition/i
        ],
        focus: "Pick the grammar point the learner named (or the one visible in their message). Run a 3-beat cycle: concept question, production task, correction with the Farsi why."
    }),
    makeDrill({
        id: "pronunciation",
        name: "Pronunciation",
        oneLiner: "th, v/w, clusters: the Farsi six",
        commands: [
            "pronunciation",
            "pronounce"
        ],
        triggers: [
            /pronunciat/i,
            /\bth\b sounds?/i,
            /\bv\b.*\bw\b|\bw\b.*\bv\b/i,
            /accent/i,
            /how do you say .* out loud/i
        ],
        focus: "Drill the Farsi-speaker problem set: th (theta/eth), v/w merger, consonant clusters (epenthetic vowels: estudent), final ng+g, flat stress. Give minimal pairs and make them type and read aloud."
    }),
    makeDrill({
        id: "paraphrase",
        name: "Paraphrase in three registers",
        oneLiner: "One idea, casual, neutral, formal",
        commands: [
            "register",
            "paraphrase"
        ],
        triggers: [
            /paraphrase/i,
            /(formal|casual|informal) (way|version)/i,
            /three ways to say/i,
            /register/i
        ],
        focus: "Take their sentence and make them re-render it in casual, neutral, and formal registers. Grade each attempt, then show the model set."
    }),
    makeDrill({
        id: "writing-prompt",
        name: "Writing prompt",
        oneLiner: "A task matched to your band",
        commands: [
            "writing-prompt",
            "prompt me"
        ],
        triggers: [
            /(give|give me|need) .*writing (prompt|task|topic)/i,
            /what should i write about/i,
            /essay (topic|prompt)/i,
            /writing practice/i
        ],
        focus: "Give ONE writing task sized for their band (80 words at B2, 120 at C1) with a constraint that forces the weak spot into play. When they submit, grade like the writing examiner: task, organization, range, accuracy."
    }),
    {
        id: "word-of-the-day",
        name: "Word of the day",
        oneLiner: "One C1 word, used immediately",
        commands: [
            "wotd",
            "word"
        ],
        triggers: [
            /word of (the|today)/i,
            /\bwotd\b/i,
            /daily word/i
        ],
        run: async (ctx)=>{
            const steps = [
                {
                    label: "Picking from the C1 band",
                    detail: "mid-frequency, immediately usable"
                }
            ];
            const system = `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["basePersona"])(ctx.profile)}

## This turn's obsession: Word of the day

Give ONE C1-band word that is useful in work and news contexts. Format inside reply, compact:
**word** /pronunciation/ register note. One-line meaning. Two natural collocations. One Farsi-speaker trap. End by demanding a sentence from the learner using the word.
corrections stays empty this turn; fa_note empty.`;
            const turn = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["coachTurn"])(system, ctx, steps);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["envelope"])("word-of-the-day", turn, steps);
        }
    }
];
}),
"[project]/src/lib/agent/fuzzy.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "candidates",
    ()=>candidates,
    "containsPattern",
    ()=>containsPattern,
    "editDistance",
    ()=>editDistance,
    "gradeAnswer",
    ()=>gradeAnswer,
    "normalize",
    ()=>normalize,
    "similarity",
    ()=>similarity
]);
// Fuzzy answer matching. The old exam failed learners who were RIGHT but
// spelled, inflected, or worded differently from the key. This module makes
// grading generous to meaning and strict on the target pattern.
const STOP = new Set([
    "a",
    "an",
    "the",
    "to",
    "of",
    "please"
]);
function normalize(s) {
    return s.toLowerCase().replace(/[\u2019\u2018`]/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim().replace(/^(a|an|the) /, "");
}
function stem(w) {
    return w.replace(/(ings?)$/, "").replace(/(edly|ed)$/, "").replace(/(ies)$/, "y").replace(/(es)$/, "").replace(/(s)$/, "");
}
function tokenSet(s) {
    return normalize(s).split(" ").filter((w)=>w.length > 0 && !STOP.has(w));
}
function similarity(a, b) {
    const ta = tokenSet(a).map(stem);
    const tb = new Set(tokenSet(b).map(stem));
    if (ta.length === 0 || tb.size === 0) return 0;
    let hit = 0;
    for (const w of ta)if (tb.has(w)) hit++;
    return hit / Math.max(ta.length, tb.size);
}
function containsPattern(text, pattern) {
    const t = tokenSet(text).map(stem);
    const p = tokenSet(pattern).map(stem);
    if (p.length === 0) return false;
    for(let i = 0; i <= t.length - p.length; i++){
        let ok = true;
        for(let j = 0; j < p.length; j++){
            if (t[i + j] !== p[j]) {
                ok = false;
                break;
            }
        }
        if (ok) return true;
    }
    return false;
}
function editDistance(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({
        length: n + 1
    }, (_, i)=>i);
    for(let i = 1; i <= m; i++){
        const cur = [
            i
        ];
        for(let j = 1; j <= n; j++){
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[n];
}
function candidates(given) {
    return given.split(/\s*[/;|]\s*|\s+or\s+/i).map((s)=>s.trim()).filter(Boolean);
}
function gradeAnswer(inp) {
    const given = (inp.given ?? "").trim();
    if (!given) return false;
    if (inp.type === "mcq") {
        const norm = (x)=>normalize(x).replace(/\s+/g, " ");
        return norm(given) === norm(inp.a) || (inp.accept ?? []).some((v)=>norm(given) === norm(v));
    }
    if (inp.type === "rewrite") {
        const inc = inp.mustInclude ?? [];
        if (inc.length === 0) return similarity(given, inp.a) >= 0.8;
        const allIn = inc.every((p)=>containsPattern(given, p));
        const banned = (inp.mustNotInclude ?? []).some((p)=>containsPattern(given, p));
        return allIn && !banned;
    }
    // cloze / short. Every offered candidate ("biology/echology") gets its own
    // shot: offering two guesses is honest effort, not cheating.
    const keys = [
        inp.a,
        ...inp.accept ?? []
    ].map(normalize).filter((k)=>k.length > 0);
    const keyTokens = tokenSet(inp.a);
    return candidates(given).some((cand)=>{
        const g = normalize(cand);
        if (g.length === 0) return false;
        if (keys.some((k)=>g === k || similarity(g, k) >= 0.85)) return true;
        // Single-token keys: inflection slips ("rains" for "rain") and one-letter
        // typos on long words ("echology" for "ecology") both pass. One edit on a
        // 7+ letter word is a typo; on short words it is usually a different word
        // (advise/advice), so those stay strict.
        if (keyTokens.length === 1 && tokenSet(cand).length === 1) {
            const kw = keyTokens[0];
            const gw = tokenSet(cand)[0];
            if (stem(gw) === stem(kw)) return true;
            if (kw.length >= 7 && editDistance(gw, kw) <= 1) return true;
        }
        return false;
    });
}
}),
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
"[project]/src/lib/agent/exam-ai.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TRAP_TAGS",
    ()=>TRAP_TAGS,
    "arbitrateMisses",
    ()=>arbitrateMisses,
    "vetItems",
    ()=>vetItems
]);
// Hybrid grading, second stage. The mechanical fuzzy grader decides fast and
// deterministic; every item it REJECTED goes through one AI arbitration pass
// that judges meaning, not spelling. It either accepts a right answer the
// regex was too blind to see ("combine" for "blend") or writes a coaching
// note that teaches the miss instead of just announcing it. Every coached
// miss also earns a trap tag so the mistake memory can hunt it later.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
;
const TRAP_TAGS = [
    "statives",
    "articles",
    "countability",
    "plurals",
    "copula",
    "prepositions",
    "perfect",
    "question_order",
    "adjectives",
    "that_omission",
    "th_sounds",
    "w_v",
    "clusters",
    "ng",
    "stress",
    "spelling",
    "word_choice",
    "register",
    "collocation"
];
const FALLBACK = {
    accept: false,
    rule: "The target answer is different from what you wrote; study the key and the why.",
    fa: "",
    tag: "word_choice"
};
function arbSystem(misses) {
    return `You are the grading arbiter inside Rah, an English app for Farsi speakers. The mechanical grader rejected the answers below; your job is second-opinion grading plus coaching.

THE GOLDEN RULE: if a competent native speaker could naturally produce the learner's word in this blank and the sentence would keep its meaning, you MUST accept it - even when the key is the "best" word. Rejecting a natural answer is the worst failure this app can commit; the learner typed "combine" where the key was "blend" and both are perfect English. Never reject on imprecision alone.

Reject ONLY when one of these holds:
(a) the answer is grammatically wrong in this sentence (wrong form, broken agreement, unidiomatic pattern like "teach students with practical skills");
(b) the answer changes what the sentence means;
(c) the question asks for a NAME or TERM ("what do you call...", "the term for...") and the answer names a different thing;
(d) the item explicitly drills one standard collocation and the learner's pairing is NOT idiomatic English (e.g. "carbon usage" for "carbon footprint").
When you reject, the "rule" field must teach the precise point - what a native would say and why, never just "wrong".

For EACH miss decide:

1. "accept" - true or false per the rules above.
2. "rule" - ONE English sentence (max 24 words) teaching the takeaway: name the pattern or the precise word, and when useful contrast it with what they wrote. No "you are wrong" phrasing; teach instead.
3. "fa" - ONE Farsi sentence explaining the takeaway specifically for a Farsi speaker (the interference, the false friend, the register trap). No English inside the fa string except the target word itself.
4. "tag" - exactly one of: ${TRAP_TAGS.join(", ")}. Pick the tag that best names WHY this miss happens for this learner; use "word_choice" only when nothing else fits.

Output ONE JSON object, nothing else:
{"verdicts": [{"id": "the item id from the list", "accept": false, "rule": "", "fa": "", "tag": ""}]}
One verdict per miss, same order, same ids. Never use the em dash character.

The misses:
${misses.map((m)=>`id=${m.id} [${m.type}/${m.skill}] question: ${JSON.stringify(m.q)} key: ${JSON.stringify(m.a)} learner wrote: ${JSON.stringify(m.given)}`).join("\n")}`;
}
async function arbitrateMisses(misses) {
    const out = new Map();
    if (misses.length === 0) return out;
    try {
        const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(arbSystem(misses), [
            {
                role: "user",
                content: `Arbitrate all ${misses.length} misses now. Follow the accept rules strictly.`
            }
        ], ()=>({}), {
            deep: false,
            temperature: 0.2
        });
        for (const m of misses){
            const v = (raw.verdicts ?? []).find((x)=>String(x.id ?? "") === m.id);
            if (!v) {
                out.set(m.id, {
                    ...FALLBACK,
                    rule: m.why || FALLBACK.rule
                });
                continue;
            }
            const accept = v.accept === true;
            const tag = TRAP_TAGS.includes(String(v.tag ?? "")) ? String(v.tag) : "word_choice";
            out.set(m.id, {
                accept,
                rule: String(v.rule ?? "").trim() || m.why || FALLBACK.rule,
                fa: String(v.fa ?? "").trim(),
                tag
            });
        }
    } catch  {
        for (const m of misses)out.set(m.id, {
            ...FALLBACK,
            rule: m.why || FALLBACK.rule
        });
    }
    return out;
}
function vetSystem(items) {
    return `You are the answerability gate inside Rah, an English exam app. The items below were generated for a learner; they passed structural checks. Your job: make sure each one is FAIRLY ANSWERABLE - a competent learner given only the question text could produce the key (or something on its accept list) with confidence.

An item is NOT answerable (ok=false) when ANY holds:
(a) NO REAL TASK: a bare statement with nothing asked, or a "rewrite" whose instruction lives only in your imagination - the question text alone does not say what to do;
(b) AMBIGUOUS KEY: several natural, equally correct answers exist and the accept list does not cover them (open vocabulary blanks like "a distinct ___" where flavor/aroma/taste all fit; "which verb collocates" with multiple candidates; definition questions with several possible terms);
(c) TRIVIA / WORLD KNOWLEDGE: the item tests facts, terms, or general education instead of English structure, collocation, register, or meaning in context;
(d) UNFAIR MCQ: another choice is as defensible as the key, or the key cannot be chosen without guessing;
(e) BROKEN KEY: the key is grammatically wrong in its sentence, or does not fit the blank.

keepTag: items may carry a "tag" naming the mistake family they hunt (e.g. articles). keepTag=false when the item does not GENUINELY force that exact weakness - a tag slapped on an unrelated item poisons the healing loop. The item itself can still be fine (ok=true).

Output ONE JSON object, nothing else:
{"vetted": [{"id": "...", "ok": true, "keepTag": true, "reason": "max 10 words; empty when ok"}]}
One entry per item, same order, same ids. Never use the em dash character.

The items:
${items.map((it)=>`id=${it.id} [${it.type}/${it.skill}] q: ${JSON.stringify(it.q)}${it.choices ? ` choices: ${JSON.stringify(it.choices)}` : ""} key: ${JSON.stringify(it.a)} accept: ${JSON.stringify(it.accept)}${it.tag ? ` tag: ${it.tag}` : ""}`).join("\n")}`;
}
async function vetItems(items) {
    const out = new Map();
    if (items.length === 0) return out;
    try {
        const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(vetSystem(items), [
            {
                role: "user",
                content: `Vet all ${items.length} items now. Judge answerability strictly; an unfair item teaches nothing.`
            }
        ], ()=>({}), // Deep mode: the vet runs once per exam and is the last line before the
        // learner; a missed ambiguous key costs a whole item. Spend the tokens.
        {
            deep: true,
            temperature: 0.1
        });
        for (const it of items){
            const v = (raw.vetted ?? []).find((x)=>String(x.id ?? "") === it.id);
            if (!v) {
                out.set(it.id, {
                    ok: true,
                    keepTag: true,
                    reason: ""
                });
                continue;
            }
            out.set(it.id, {
                ok: v.ok !== false,
                keepTag: v.keepTag !== false,
                reason: String(v.reason ?? "").trim()
            });
        }
    } catch  {
        // The gate must never stall generation: on failure, trust the
        // deterministic layer and deliver.
        for (const it of items)out.set(it.id, {
            ok: true,
            keepTag: true,
            reason: ""
        });
    }
    return out;
}
}),
"[project]/src/lib/agent/exam-gate.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// The answerability gate - layer 1 of the exam quality architecture.
//
// ROOT CAUSE this module kills: generation was validated for SHAPE only
// (fields exist, choices present), never for ANSWERABILITY. That is how
// bare statements shipped as rewrite tasks ("Despite the storm, the flight
// departed on schedule." -> "Write the full sentence"), trivia quizzes
// shipped as English items, open blanks with five valid answers shipped
// with one key, and MCQs shipped whose key was not even among the choices.
//
// Every item passes through itemAnswerable() before it can reach a learner.
// Deterministic and free; the AI vetting layer (exam-ai.vetItems) handles
// what regex cannot see. Deterministic gates run on EVERY harvest round.
__turbopack_context__.s([
    "blankCorrection",
    ()=>blankCorrection,
    "evidenceItem",
    ()=>evidenceItem,
    "itemAnswerable",
    ()=>itemAnswerable,
    "itemFairlyAsked",
    ()=>itemFairlyAsked
]);
// Encyclopedic trivia phrasings: these test world knowledge, not English.
// "What term describes...?" / "What do you call...?" / "Which document...?"
// If the model wants to teach a word, it must put it in a sentence blank.
const TRIVIA_REF = /\bwhat (is |was |are )?(the )?(correct |proper |english )?term\b|\bwhat term\b|\bwhat do you call\b|\bwhat do we call\b|\bwhat (word|verb|noun|adjective) (is used|describes|means)\b|\bwhich (document|instrument|device|tool|equipment|machine|department|ingredient)\b|\bname the (term|instrument|device|document|technique|practice)\b|\bwhat (technique|practice|sport|style|method) (is |describes|do)\b/i;
// A rewrite task carries an explicit instruction verb; a bare statement does
// not. "Rewrite using more formal vocabulary: '...'" passes; "Despite the
// storm, the flight departed on schedule." does not.
const REWRITE_TASK = /\b(rewrite|rephrase|reword|combine|join|transform|turn (it|this|that|them) into|make (it|this|that|the|them)|put (it|this|that) into|passive|reported|conditional|start(ing)? with|begin(ning)? with|using|so that|too \.\.\. to)\b/i;
// A short item needs a blank or an explicit form task; "give the comparative",
// "the plural of", "reported speech form". Open "what/which X ... ?" quizzes
// are trivia or unanswerable-with-one-key and die here.
const SHORT_TASK = /___|\bform\b|comparative|superlative|\bplural\b|\bopposite\b|\bsynonym\b|reported|passive|\bnegative\b/i;
function norm(s) {
    return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function itemFairlyAsked(r) {
    const q = String(r.q ?? "").trim();
    if (!q) return {
        ok: false,
        reason: "empty"
    };
    const type = [
        "mcq",
        "cloze",
        "short",
        "rewrite"
    ].includes(r.type) ? r.type : "cloze";
    const hasBlank = q.includes("___");
    const hasQuestionMark = q.includes("?");
    const hasInstruction = REWRITE_TASK.test(q);
    // Trivia ban: encyclopedic term-hunting is not an English exercise.
    if (TRIVIA_REF.test(q)) return {
        ok: false,
        reason: "trivia"
    };
    // Bare statement ban: no blank, no question, no instruction verb. Whatever
    // the claimed type, the learner has no task to perform.
    if (!hasBlank && !hasQuestionMark && !hasInstruction) return {
        ok: false,
        reason: "bare statement"
    };
    if (type === "cloze" && !hasBlank) return {
        ok: false,
        reason: "cloze without a blank"
    };
    if (type === "short" && !hasBlank && !SHORT_TASK.test(q)) {
        return {
            ok: false,
            reason: "short item without a blank or a form task"
        };
    }
    // rewrite: the instruction MUST be inside q. A bare statement followed by
    // "Write the full sentence" is the exact bug class the user hit.
    if (type === "rewrite" && !hasInstruction) return {
        ok: false,
        reason: "rewrite without an instruction"
    };
    return {
        ok: true,
        reason: ""
    };
}
function itemAnswerable(r) {
    const asked = itemFairlyAsked(r);
    if (!asked.ok) return asked;
    const q = String(r.q ?? "").trim();
    const a = norm(String(r.a ?? ""));
    if (!a) return {
        ok: false,
        reason: "empty"
    };
    const type = [
        "mcq",
        "cloze",
        "short",
        "rewrite"
    ].includes(r.type) ? r.type : "cloze";
    const hasBlank = q.includes("___");
    if (type === "mcq") {
        const choices = (r.choices ?? []).map((c)=>String(c).trim());
        if (choices.length < 2) return {
            ok: false,
            reason: "mcq needs choices"
        };
        // The key must BE one of the delivered choices, exactly (normalized).
        if (!choices.some((c)=>norm(c) === a)) return {
            ok: false,
            reason: "key not among choices"
        };
        return {
            ok: true,
            reason: ""
        };
    }
    // Key leak: the answer already visible in the sentence outside the blank.
    if ((type === "cloze" || type === "short") && hasBlank) {
        const frame = norm(q.replace(/_{2,}/g, " "));
        if (frame.includes(a)) return {
            ok: false,
            reason: "key leaks into the sentence"
        };
    }
    return {
        ok: true,
        reason: ""
    };
}
function blankCorrection(evidence) {
    const [wrong, right] = evidence.split(" -> ").map((s)=>s.trim());
    if (!wrong || !right) return null;
    const wrongTokens = (wrong.match(/[A-Za-z']+/g) ?? []).map((t)=>t.toLowerCase());
    const wrongSet = new Set(wrongTokens);
    const tokens = right.match(/[A-Za-z']+/g) ?? [];
    const diffs = tokens.filter((t)=>!wrongSet.has(t.toLowerCase()));
    if (diffs.length === 0) return null;
    const correction = diffs.find((t)=>wrongTokens.some((w)=>{
            if (w === t.toLowerCase() || Math.min(w.length, t.length) < 4) return false;
            return t.toLowerCase().startsWith(w.slice(0, 4)) || w.startsWith(t.toLowerCase().slice(0, 4));
        }));
    const answer = correction ?? [
        ...diffs
    ].sort((a, b)=>b.length - a.length)[0];
    if (answer.length < 2) return null;
    const prompt = right.replace(new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), "___");
    if (!prompt.includes("___")) return null;
    return {
        prompt,
        answer
    };
}
function evidenceItem(tag, evidence) {
    const blanked = blankCorrection(evidence);
    if (!blanked) return null;
    const { prompt, answer } = blanked;
    return {
        id: `ev-${tag}-${Math.random().toString(36).slice(2, 7)}`,
        type: "cloze",
        skill: "grammar",
        q: prompt,
        a: answer,
        accept: [
            ...new Set([
                answer,
                answer.toLowerCase()
            ])
        ],
        why: "Resurfaced from your own recorded miss on this pattern.",
        tag
    };
}
}),
"[project]/src/lib/exam-cards.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EXAM_CARD_PREFIX",
    ()=>EXAM_CARD_PREFIX,
    "LISTEN_CARD_PREFIX",
    ()=>LISTEN_CARD_PREFIX,
    "deckCardForToken",
    ()=>deckCardForToken,
    "derivedExamCard",
    ()=>derivedExamCard,
    "resolveExamCardTargets",
    ()=>resolveExamCardTargets,
    "scheduleExamOutcomes",
    ()=>scheduleExamOutcomes
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/content.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fsrs.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$gate$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/exam-gate.ts [app-route] (ecmascript)");
;
;
;
;
;
const EXAM_CARD_PREFIX = "exam:";
const LISTEN_CARD_PREFIX = "listen:";
function normToken(s) {
    return s.trim().toLowerCase().replace(/[.,!?;:]+$/, "");
}
function resolveExamCardTargets(items, verdicts) {
    const merged = new Map();
    for (const it of items){
        const v = verdicts.find((x)=>x.itemId === it.id);
        if (!v) continue;
        // An unanswered item is no evidence either way - schedule nothing.
        if (!v.given.trim()) continue;
        const grade = v.correct ? 3 : 1;
        // Deterministic deck match: the item's key answer against the deck's
        // answer / en / alt fields. First match in deck order wins (stable).
        const key = normToken(it.a);
        let resolved = null;
        if (key) {
            const deckHit = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DECK"].find((c)=>normToken(c.answer) === key || normToken(c.en) === key || c.alt.some((a)=>normToken(a) === key));
            if (deckHit) resolved = {
                cardId: deckHit.id,
                grade,
                via: "deck"
            };
        }
        // Healing fallback: tagged items land in the exam:<tag> namespace.
        if (!resolved && it.tag) resolved = {
            cardId: `${EXAM_CARD_PREFIX}${it.tag}`,
            grade,
            tag: it.tag,
            via: "family"
        };
        if (!resolved) continue;
        const prev = merged.get(resolved.cardId);
        // Worst grade wins: one exam, one card, one honest outcome.
        if (!prev || resolved.grade < prev.grade) merged.set(resolved.cardId, {
            ...resolved,
            grade
        });
    }
    return [
        ...merged.values()
    ];
}
async function scheduleExamOutcomes(targets, source = "exam") {
    if (targets.length === 0) return [];
    const l = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dayIndex"])();
    const out = [];
    for (const t of targets){
        const row = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].cardState.findUnique({
            where: {
                cardId: t.cardId
            }
        });
        // Suspended cards keep their suspension - the learner opted out.
        if (row?.suspended) continue;
        const st = row ? {
            s: row.s,
            d: row.d,
            due: row.due,
            last: row.last,
            lapses: row.lapses,
            reps: row.reps,
            state: row.state,
            lastivl: row.lastivl
        } : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["defaultState"])();
        const res = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fsrs$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["review"])(st, t.grade, today, l.retention);
        const f = res.fsrs;
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].cardState.upsert({
            where: {
                cardId: t.cardId
            },
            create: {
                cardId: t.cardId,
                s: f.s,
                d: f.d,
                due: f.due,
                last: f.last,
                lapses: f.lapses,
                reps: f.reps,
                state: f.state,
                lastivl: f.lastivl,
                dir: ""
            },
            update: {
                s: f.s,
                d: f.d,
                due: f.due,
                last: f.last,
                lapses: f.lapses,
                reps: f.reps,
                state: f.state,
                lastivl: f.lastivl
            }
        });
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].reviewLog.create({
            data: {
                cardId: t.cardId,
                grade: t.grade,
                ivl: res.ivl,
                day: today,
                source
            }
        });
        out.push({
            cardId: t.cardId,
            due: res.due,
            grade: t.grade,
            via: t.via
        });
    }
    return out;
}
function deckCardForToken(token) {
    const key = normToken(token);
    if (!key) return null;
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$content$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DECK"].find((c)=>normToken(c.answer) === key || normToken(c.en) === key || c.alt.some((a)=>normToken(a) === key)) ?? null;
}
async function derivedExamCard(cardId) {
    const prefix = [
        EXAM_CARD_PREFIX,
        LISTEN_CARD_PREFIX
    ].find((p)=>cardId.startsWith(p));
    if (!prefix) return null;
    const tag = cardId.slice(prefix.length);
    if (!tag) return null;
    const family = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.findFirst({
        where: {
            tag,
            OR: [
                {
                    resolvedAt: null
                },
                {
                    resolvedAt: {
                        gt: new Date(0)
                    }
                }
            ]
        },
        orderBy: [
            {
                resolvedAt: "asc"
            },
            {
                updatedAt: "desc"
            }
        ]
    });
    if (!family) return null;
    const blanked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$gate$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["blankCorrection"])(family.evidence);
    if (!blanked) return null;
    return {
        id: cardId,
        unit: prefix === LISTEN_CARD_PREFIX ? "listen_healing" : "exam_healing",
        skill: family.kind,
        level: "trap",
        kind: "sent",
        prompt: blanked.prompt,
        answer: blanked.answer,
        alt: [
            blanked.answer.toLowerCase()
        ],
        en: blanked.prompt.replace("___", blanked.answer),
        fa: "",
        note: `${prefix === LISTEN_CARD_PREFIX ? "Listening slip" : "Healing target"}: ${family.label}. Resurfaced from your own recorded miss.`,
        traps: [],
        distractors: []
    };
}
}),
"[project]/src/lib/agent/exam.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "generateExam",
    ()=>generateExam,
    "gradeExamSubmission",
    ()=>gradeExamSubmission
]);
// Exam engine v2. Generation bakes answer keys server side; grading is fuzzy
// and generous to meaning. The announced count always equals the graded count:
// the client grades every item in the stored exam, unanswered items count as
// incorrect in the total but never inflate or deflate per-skill numbers.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$fuzzy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/fuzzy.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/levels.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mistakes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mastery.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/exam-ai.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$gate$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/exam-gate.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$exam$2d$cards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/exam-cards.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
;
function newId() {
    return `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
// Randomized topic domains: exams rotate through these so two exams never
// mine the same "office policy + party + heavy rain" cliché territory.
const DOMAINS = [
    "technology and apps",
    "health and fitness",
    "travel and airports",
    "food and cooking",
    "environment and climate",
    "work and careers",
    "education and studying",
    "sports and competition",
    "music and film",
    "science and space",
    "money and shopping",
    "city life and transport",
    "family and friendships",
    "news and media",
    "nature and animals",
    "art and design"
];
// Templates the model gravitates to when lazy. Named explicitly so the first
// sentence of every exam is not "The new policy had a significant ___ on".
const OVERUSED = [
    "The new policy had a significant ___ on",
    "Which word means to make something less severe or intense",
    "By the time we arrived at the party",
    "What verb collocates with 'heavy'",
    "If I ___ more time, I would have",
    "The company needs to ___ its operations"
];
// Recent-exam ledger: the last few exams' sentences and answer keys become a
// ban list, so "the same exam again" is structurally impossible, not hoped
// against. Banned answers rotate the teaching points too (no more alleviate /
// mitigate asked twice in a row).
async function loadFreshness() {
    const domains = [
        ...DOMAINS
    ].sort(()=>Math.random() - 0.5).slice(0, 4);
    try {
        const recent = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.findMany({
            orderBy: {
                createdAt: "desc"
            },
            take: 4,
            select: {
                items: true
            }
        });
        const past = recent.flatMap((r)=>{
            try {
                return JSON.parse(r.items);
            } catch  {
                return [];
            }
        });
        return {
            domains,
            bannedQ: [
                ...new Set(past.map((i)=>i.q.replace(/\s+/g, " ").slice(0, 90)))
            ].slice(0, 24),
            bannedA: [
                ...new Set(past.map((i)=>i.a.toLowerCase().replace(/\s+/g, " ").slice(0, 40)))
            ].slice(0, 24)
        };
    } catch  {
        return {
            domains,
            bannedQ: [],
            bannedA: []
        };
    }
}
// A question that says "according to the text" without carrying the text is a
// broken item: the learner has nothing to read. Reading items must embed their
// own mini-passage, so anything referencing a text while staying short is dead
// on arrival.
const DANGLING_TEXT_REF = /\b(according to|based on)\b[^.]{0,40}\b(text|passage|article|author|writer)\b|\bthe (text|passage|article) (says|states|mentions|suggests)\b|\bthe (author|writer) (says|states|mentions|argues)\b/i;
function examSystem(p, spec, fresh) {
    const bans = [
        fresh.bannedQ.length ? `BANNED questions (served recently; never reuse the sentence, a close paraphrase, or the same teaching point): ${fresh.bannedQ.map((q)=>JSON.stringify(q)).join("; ")}` : "",
        fresh.bannedA.length ? `BANNED answers (do not make any of these the correct answer or a distractor again): ${fresh.bannedA.join("; ")}` : "",
        `AVOID these worn-out templates entirely: ${OVERUSED.map((t)=>JSON.stringify(t)).join("; ")}`
    ].filter(Boolean).join("\n\n");
    const quota = spec.weakTags.length ? Math.min(4, Math.max(1, Math.ceil(spec.plannedCount / 3))) : 0;
    return `You are the examiner inside Rah, an English app for Farsi speakers. Build ONE exam targeted at ${spec.level} level, focused on: ${spec.targetSkills.join(", ")}.

The learner sits around ${p.level}. Recent weak spots: ${p.weakSkills.join(", ") || "general B2 range"}. Push at the edge of ${spec.level} toward C1: collocations, register, precise verbs, Farsi interference traps (articles, countability, prepositions, present perfect, question order).
${spec.weakTags.length ? `WEAKNESS QUOTA: this learner has these recurring mistake families on file: ${p.mistakes.map((m)=>`${m.tag} x${m.count}`).join(", ")}. At least ${quota} items MUST carry a "tag" field naming the family they hunt (one of: ${spec.weakTags.join(", ")}), and the item must genuinely force that exact weakness into play with a FRESH sentence - the ban lists still apply. Never invent a tag outside the list; items not built for a family simply omit the tag field.` : ""}

Exactly ${spec.plannedCount} items. Mix, in this rough share: 40% mcq, 30% cloze, 15% short, 15% rewrite. Every item tests ONE teachable point. Wrong choices for mcq must be plausible for a Farsi speaker.

ITEM TYPE CONTRACTS (an answerability gate rejects any item that breaks them; a rejected item is wasted):
- TRIVIA BAN: never ask for terms, definitions, or world knowledge ("what term describes...", "what do you call...", "which document/instrument..."). Every item must test ENGLISH itself: a grammatical form, a collocation, register, a connector, or meaning in context. To teach a word, put it in a sentence blank.
- mcq: exactly ONE choice is defensibly correct. The others must be wrong for a reason you could state (wrong form, wrong meaning, unidiomatic pairing). Never make the key the only positive/hedged/longest option. The key MUST be copied exactly from the choices array.
- cloze: q contains exactly one ___ and the blank is FORCED: grammar or a fixed collocation decides the word, so a competent learner can produce the key (or an accept variant) with confidence. Never an open style/word-choice blank with several equally good answers - if you cannot name why the alternatives fail, the item is unfair.
- short: the answer must be FORCED too: either a blank decided by grammar/collocation, or an explicit form task (comparative, plural, passive form, reported form, negative). Never a "what is X called" question and never an open definition.
- rewrite: q MUST begin with the full instruction, stated in the question text itself: what to do, and to which sentence (quoted). "Rewrite using more formal vocabulary: 'The new law really stops people from polluting rivers.'" is correct. A bare statement with no instruction is a wasted item - the learner cannot know the task.

FRESHNESS RULES (a moderator rejects recycled exams):
- Draw situations from these domains: ${fresh.domains.join(", ")}. At least half the items must come from this list.
- Every sentence pattern in the exam must be structurally different from every other. Ten cloze items are ten different shapes, not one shape repeated.
- Never test the same word or teaching point twice in one exam, even in different sentence frames.
${bans}

HARD FOCUS RULE: every item's "skill" field MUST be one of: ${spec.targetSkills.join(", ")}. Zero items outside this list, even if the item type would fit another skill. A rewrite item in a vocabulary exam is still a vocabulary item (word choice, register, word formation), never a writing item.

READING RULE: an item about a text MUST embed the full mini-text (2 to 4 short sentences) inside its "q" before the question. Never write "according to the text" without the text being right there in "q". Standalone reading items (word meaning in context) are fine without a passage.

CRITICAL answer-key rules, the grader is mechanical:
- "a" is the single best answer, lowercase unless a proper noun.
- "accept" lists every variant you would hand-grade as correct: synonyms ("heavy rain" accepts "pouring rain"), inflections ("rains", "raining" where the sentence allows), spelling variants. Give 2 to 5 accept entries for cloze and short items.
- rewrite items: "mustInclude" lists the target patterns that ALL have to appear in the learner's sentence (e.g. ["take advantage of"]), and "a" is one model answer.
- "skill" is exactly one of: grammar, vocabulary, collocation, writing, reading, listening.
${spec.weakTags.length ? `- "tag" (optional) is exactly one of: ${spec.weakTags.join(", ")} - set it only on items built to hunt that mistake family, omit it everywhere else.` : ""}
- "why" is one short English sentence teaching the point (max 18 words). No Farsi anywhere in the exam.

Output ONE JSON object, nothing else:
{"title": "short exam title in English", "items": [{"type": "mcq", "skill": "collocation", "q": "sentence with ___ or an instruction plus a quoted sentence", "choices": ["", "", "", ""], "a": "exact correct choice", "accept": [], "why": ""}]}
For cloze: q contains ___ and a is the missing string. For short: a forced form answer. For rewrite: instruction inside q, mustInclude patterns, model a.
Never use the em dash character anywhere.`;
}
async function generateExam(p, targetSkills, count, emit) {
    // Weakness quota input: mistake families carry production evidence, but the
    // mastery ledger can prove a weakness the families have not seen yet (three
    // exam misses on a tag with no family, or a slipping tag). Families first,
    // then proven danger/fragile tags - the quota cap stays 3.
    const ledgerTags = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["masteryWeakTags"])();
    const familyTags = p.mistakes.map((m)=>m.tag);
    const weakTags = [
        ...new Set([
            ...familyTags,
            ...ledgerTags
        ])
    ].slice(0, 3);
    const spec = {
        level: p.level === "?" ? "B2" : p.level,
        targetSkills: targetSkills.length ? targetSkills : [
            "collocation",
            "grammar",
            "vocabulary"
        ],
        plannedCount: Math.max(4, Math.min(20, count)),
        minutes: Math.max(5, Math.round(count * 1.1)),
        title: "",
        weakTags
    };
    emit("Calibrating difficulty", `level ${spec.level}, edge of ${spec.level} toward C1`);
    const fresh = await loadFreshness();
    emit("Rotating topics", fresh.domains.join(", "));
    const genOpts = {
        deep: true,
        temperature: 0.9
    };
    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(examSystem(p, spec, fresh), [
        {
            role: "user",
            content: `Generate the ${spec.plannedCount}-item exam now. Cover: ${spec.targetSkills.join(", ")}. Respect every BAN list and freshness rule.`
        }
    ], ()=>({}), genOpts);
    emit("Validating answer keys", "every item needs a key and a why");
    const seen = new Set();
    const items = [];
    const dropped = [];
    const harvest = (rawItems, batchStart)=>{
        let batchCount = 0;
        for (const r of rawItems ?? []){
            const q = String(r.q ?? "").trim();
            const a = String(r.a ?? "").trim();
            if (!q || !a || seen.has(q)) continue;
            const type = [
                "mcq",
                "cloze",
                "short",
                "rewrite"
            ].includes(r.type) ? r.type : "cloze";
            if (type === "mcq" && (!Array.isArray(r.choices) || r.choices.length < 2)) continue;
            const skillRaw = /^(grammar|vocabulary|collocation|writing|reading|listening)$/.test(String(r.skill)) ? String(r.skill) : "vocabulary";
            // Collocation is vocabulary in narrower clothes: when the learner asked
            // for vocabulary only, a collocation item honors the promise (the level
            // engine already folds collocation into the vocabulary band), so relabel
            // instead of dropping it. That is how "4 vocab questions" stays 4.
            const skill = skillRaw === "collocation" && spec.targetSkills.includes("vocabulary") ? "vocabulary" : skillRaw;
            // Focus guard: an item tagged outside the requested focus would break the
            // promise the exam card makes ("mixed: ..." / "focus: ..."), so drop it.
            if (!spec.targetSkills.includes(skill)) continue;
            // Broken-item guard: no question may reference a text it fails to carry.
            if (DANGLING_TEXT_REF.test(q) && q.length < 220) continue;
            // ANSWERABILITY GATE (layer 1, deterministic): bare statements, trivia,
            // cloze without a forced blank, rewrite without an instruction, MCQ keys
            // not among the choices, leaked keys - all dead before the learner sees
            // them. This is the structural fix for the "random statement" bug class.
            const gate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$gate$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["itemAnswerable"])({
                type,
                q,
                a,
                choices: type === "mcq" ? r.choices : undefined
            });
            if (!gate.ok) {
                dropped.push(`[${gate.reason}] ${q.slice(0, 70)}`);
                continue;
            }
            // Weakness tags are validated against the exam's family list so the
            // model can never invent a tag and poison the healing loop.
            const weakTag = spec.weakTags.includes(String(r.tag ?? "").trim().toLowerCase()) ? String(r.tag).trim().toLowerCase() : undefined;
            batchCount += 1;
            items.push({
                id: `i${batchStart + batchCount}`,
                type,
                skill,
                q,
                choices: type === "mcq" ? r.choices.map(String) : undefined,
                a,
                accept: Array.isArray(r.accept) ? r.accept.map(String).filter(Boolean).slice(0, 6) : [],
                mustInclude: Array.isArray(r.mustInclude) ? r.mustInclude.map(String).filter(Boolean) : [],
                mustNotInclude: Array.isArray(r.mustNotInclude) ? r.mustNotInclude.map(String).filter(Boolean) : [],
                why: String(r.why ?? "").trim() || "Target pattern practice.",
                tag: weakTag
            });
            seen.add(q);
        }
        return batchCount;
    };
    harvest(raw.items, 0);
    // If focus filtering or the gate left the exam short, top up with up to two
    // more generation rounds locked to the requested skills, instead of shipping
    // off-focus or unanswerable items or shrinking the announced count.
    for(let round = 0; round < 2 && items.length < spec.plannedCount; round++){
        emit("Topping up", "keeping every item inside your requested focus");
        const avoid = [
            ...items.map((i)=>i.q.slice(0, 60)),
            ...fresh.bannedQ.slice(0, 10)
        ];
        const need = spec.plannedCount - items.length;
        const raw2 = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(examSystem(p, spec, fresh), [
            {
                role: "user",
                content: `Generate exactly ${need} more items now. The "skill" field of every item MUST be one of: ${spec.targetSkills.join(", ")}. Do not repeat or paraphrase any of these questions: ${JSON.stringify(avoid)}. Output the same JSON object shape with only the new items.`
            }
        ], ()=>({}), genOpts);
        harvest(raw2.items, items.length);
    }
    // ANSWERABILITY GATE (layer 2, AI): the arbiter judges what regex cannot -
    // ambiguous keys, unfair MCQs, items whose key does not fit - and audits
    // weakness tags for integrity (a tag on an item that does not force that
    // trap poisons the healing loop, so the tag is stripped, not the item).
    const vetInPlace = (pool, label)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["vetItems"])(pool.map((it)=>({
                id: it.id,
                type: it.type,
                skill: it.skill,
                q: it.q,
                choices: it.choices,
                a: it.a,
                accept: it.accept ?? [],
                tag: it.tag
            }))).then((vet)=>{
            for (const it of [
                ...pool
            ]){
                const v = vet.get(it.id);
                if (v && !v.ok) {
                    dropped.push(`[${label}: ${v.reason}] ${it.q.slice(0, 70)}`);
                    items.splice(items.indexOf(it), 1);
                } else if (v && !v.keepTag) {
                    it.tag = undefined;
                }
            }
        });
    if (items.length > 0) {
        emit("Answerability gate", "every item must be fairly answerable");
        await vetInPlace(items, "ai");
    }
    // If the gate dropped items, keep topping up (each round gated AND vetted)
    // until the count promise is met or the retry budget is spent. The count
    // the coach announces is the count the learner can actually sit.
    let gateRounds = 0;
    while(items.length < spec.plannedCount && gateRounds < 3){
        gateRounds++;
        emit("Topping up", `replacing what the gate rejected (round ${gateRounds})`);
        const avoid = [
            ...items.map((i)=>i.q.slice(0, 60)),
            ...fresh.bannedQ.slice(0, 10)
        ];
        const need = spec.plannedCount - items.length;
        const raw3 = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(examSystem(p, spec, fresh), [
            {
                role: "user",
                content: `Generate exactly ${need} more items now. The "skill" field of every item MUST be one of: ${spec.targetSkills.join(", ")}. Do not repeat or paraphrase any of these questions: ${JSON.stringify(avoid)}. Output the same JSON object shape with only the new items.`
            }
        ], ()=>({}), genOpts);
        const before = items.length;
        harvest(raw3.items, items.length);
        const freshItems = items.slice(before);
        if (freshItems.length > 0) await vetInPlace(freshItems, `ai-r${gateRounds}`);
    }
    // QUOTA ENFORCEMENT (deterministic): the weakness quota is a PROMISE, not a
    // hope. Two failure modes above are invisible to the learner but fatal to
    // the healing loop: the model ignores the quota, or the AI vet strips every
    // tag. Tag honesty is therefore evaluated ONCE at the END - first we force
    // a tag-locked generation round for any hunted tag with zero surviving
    // items, and if the model STILL ships none, we build the hunting item
    // directly from the family's own evidence: the recorded wrong -> right
    // pair IS a forced cloze, and re-serving the exact miss is precisely what
    // the healing loop wants. spec.weakTags keeps the full hunted list until
    // then so harvest's tag validation still accepts quota items.
    const hunted = spec.weakTags.slice();
    const missing = hunted.filter((t)=>!items.some((it)=>it.tag === t));
    if (missing.length > 0) {
        emit("Forcing the weakness quota", `no surviving item hunts: ${missing.join(", ")}`);
        const avoid2 = [
            ...items.map((i)=>i.q.slice(0, 60)),
            ...fresh.bannedQ.slice(0, 10)
        ];
        const raw4 = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(examSystem(p, spec, fresh), [
            {
                role: "user",
                content: `CRITICAL OVERRIDE: this round has ONE job. Generate ${missing.length * 2} items and EVERY single one MUST have its "tag" field set to exactly one of: ${missing.join(", ")}. An item without a "tag" field from that list is a wasted generation and will be discarded. The item must genuinely force that exact weakness into play with a FRESH sentence. Do not repeat or paraphrase: ${JSON.stringify(avoid2)}. Output the same JSON object shape with only the new items.`
            }
        ], ()=>({}), genOpts);
        harvest(raw4.items, items.length);
        const freshItems = items.filter((it)=>it.tag && missing.includes(it.tag));
        if (freshItems.length > 0) await vetInPlace(freshItems, "quota");
    }
    // Last-resort enforcement: build evidence items from the families
    // themselves. Deterministic, free, and always honest - the tag is in the
    // item's DNA because the item IS the family's recorded miss.
    const stillMissing = hunted.filter((t)=>!items.some((it)=>it.tag === t));
    if (stillMissing.length > 0) {
        const families = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].mistakeFamily.findMany({
            where: {
                tag: {
                    in: stillMissing
                },
                resolvedAt: null
            }
        });
        for (const tag of stillMissing){
            const fam = families.find((f)=>f.tag === tag);
            const item = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$gate$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["evidenceItem"])(tag, fam?.evidence ?? "");
            if (item) {
                items.push(item);
                emit("Evidence item", `built from your own recorded miss on ${tag}`);
            }
        }
    }
    // Tag honesty, evaluated once after enforcement: the exam card announces
    // "hunting: ..." from spec.weakTags. A family whose items all failed the
    // audit (and had no usable evidence) must not be announced.
    spec.weakTags = hunted.filter((t)=>items.some((it)=>it.tag === t));
    if (dropped.length > 0) {
        emit("Gate report", `${dropped.length} item(s) rejected before delivery`);
    }
    // Guarantee the announced count: top up from the pool by trimming or
    // padding with near-level review items. The count the coach announces IS
    // the count graded, always. Quota items sort first so the slice can never
    // amputate the family hunting it promised.
    const ordered = [
        ...items.filter((it)=>it.tag),
        ...items.filter((it)=>!it.tag)
    ];
    const finalItems = ordered.slice(0, spec.plannedCount).map((it, idx)=>({
            ...it,
            id: `i${idx + 1}`
        }));
    spec.plannedCount = finalItems.length;
    spec.minutes = Math.max(4, Math.round(finalItems.length * 1.1));
    const id = newId();
    const title = String(raw.title ?? "").trim().slice(0, 60) || `${spec.level} checkpoint`;
    const client = {
        id,
        title,
        spec,
        count: finalItems.length,
        items: finalItems.map((it)=>({
                id: it.id,
                type: it.type,
                skill: it.skill,
                q: it.q,
                choices: it.choices,
                tag: it.tag
            }))
    };
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.create({
        data: {
            id,
            title,
            spec: JSON.stringify(spec),
            items: JSON.stringify(finalItems),
            status: "pending"
        }
    });
    emit("Exam ready", `${finalItems.length} items, about ${spec.minutes} minutes`);
    return {
        client,
        items: finalItems,
        spec
    };
}
async function gradeExamSubmission(examId, answers) {
    const row = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.findUnique({
        where: {
            id: examId
        }
    });
    if (!row) return null;
    const items = JSON.parse(row.items);
    const spec = JSON.parse(row.spec);
    const verdicts = items.map((it)=>{
        const given = String(answers[it.id] ?? "").trim();
        const correct = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$fuzzy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["gradeAnswer"])({
            given,
            type: it.type,
            a: it.a,
            accept: it.accept,
            mustInclude: it.mustInclude,
            mustNotInclude: it.mustNotInclude,
            choices: it.choices
        });
        return {
            itemId: it.id,
            given,
            correct,
            key: it.a,
            why: it.why,
            skill: it.skill
        };
    });
    // Hybrid grading, stage 2: every mechanical miss goes to the AI arbiter,
    // which accepts meaning-equal answers the regex was blind to ("combine" for
    // "blend") and writes a coaching note (rule + Farsi takeaway) for real
    // misses. Then stats are computed from the FINAL verdicts, so the learner
    // is never punished for the regex's blindness.
    const misses = items.filter((it)=>{
        const v = verdicts.find((x)=>x.itemId === it.id);
        return v && !v.correct && v.given.length > 0;
    }).map((it)=>{
        const v = verdicts.find((x)=>x.itemId === it.id);
        return {
            id: it.id,
            type: it.type,
            skill: it.skill,
            q: it.q,
            a: it.a,
            given: v.given,
            why: it.why
        };
    });
    const arb = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2d$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["arbitrateMisses"])(misses);
    for (const [id, v] of arb){
        const verdict = verdicts.find((x)=>x.itemId === id);
        if (!verdict) continue;
        if (v.accept) {
            verdict.correct = true;
            verdict.acceptedAI = true;
        } else {
            verdict.coach = {
                rule: v.rule,
                fa: v.fa
            };
        }
    }
    // Healing loop: every weakness-targeted item reports its outcome back to the
    // mistake memory - item tag first, arbiter's trap tag as the fallback so an
    // untagged miss still lands in a family. Correct answers (including
    // arbiter-accepted ones) extend the clean streak toward retirement; misses
    // count as relapse evidence and reopen the family. The same outcome feeds
    // the mastery ledger - BOTH sides of it, so "45% on articles, rising"
    // becomes computable instead of guessed.
    await Promise.allSettled(items.map((it)=>{
        const v = verdicts.find((x)=>x.itemId === it.id);
        const tag = it.tag ?? arb.get(it.id)?.tag;
        if (!tag) return Promise.resolve();
        return Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["noteExamAnswer"])(tag, v.given, it.a, v.correct),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["noteTagOutcome"])(tag, v.correct)
        ]);
    }));
    const total = items.length;
    const answered = verdicts.filter((v)=>v.given.length > 0).length;
    const correct = verdicts.filter((v)=>v.correct).length;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;
    // P1 exam->FSRS unification: final verdicts land on the FSRS schedule.
    // Deck-matched items reschedule their real card (bomb pulls it due today,
    // pass extends it); tagged items without a deck match land in the
    // exam:<tag> healing namespace and resurface in the review queue as
    // evidence-derived cloze cards. Nothing resolves -> nothing schedules;
    // the learner is never charged an outcome the exam did not actually earn.
    let scheduled = [];
    try {
        const targets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$exam$2d$cards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveExamCardTargets"])(items, verdicts);
        scheduled = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$exam$2d$cards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["scheduleExamOutcomes"])(targets);
    } catch  {
        // Scheduling must never break grading - the exam result stands on its own.
        scheduled = [];
    }
    const bySkillMap = new Map();
    for (const v of verdicts){
        const agg = bySkillMap.get(v.skill) ?? {
            correct: 0,
            total: 0
        };
        agg.total += 1;
        if (v.correct) agg.correct += 1;
        bySkillMap.set(v.skill, agg);
    }
    const bySkill = [
        ...bySkillMap.entries()
    ].map(([skill, a])=>({
            skill,
            ...a
        })).sort((a, b)=>b.total - a.total);
    const weakest = [
        ...bySkill
    ].filter((s)=>s.correct / s.total < 0.6)[0];
    const headline = pct >= 85 ? `Strong pass: ${correct}/${total}. This band is C1 territory; keep the pressure on.` : pct >= 60 ? `Solid: ${correct}/${total}. ${weakest ? `Your leak is ${weakest.skill}; that is where the next session goes.` : "Consistent B2 performance."}` : `${correct}/${total}. The gap is specific, not general: ${weakest ? `${weakest.skill} broke first. Drill it before the next exam.` : "the fundamentals need another pass."}`;
    const result = {
        total,
        answered,
        correct,
        pct,
        bySkill,
        verdicts,
        headline,
        scheduled
    };
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.update({
        where: {
            id: examId
        },
        data: {
            status: "graded",
            result: JSON.stringify(result)
        }
    });
    // Feed the per-skill level engine with the exam outcome.
    await updateSkillLevelsFromExam(bySkill);
    return result;
}
async function updateSkillLevelsFromExam(bySkill) {
    const map = {
        collocation: "vocabulary",
        writing: "writing",
        reading: "reading",
        listening: "listening",
        grammar: "grammar",
        vocabulary: "vocabulary"
    };
    const filtered = bySkill.filter((s)=>map[s.skill]).map((s)=>({
            skill: map[s.skill],
            score: s.total ? s.correct / s.total : 0,
            samples: s.total
        }));
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateSkillLevels"])(filtered);
}
}),
"[project]/src/lib/agent/drill.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "generateRepairDrill",
    ()=>generateRepairDrill
]);
// Repair-drill generator. Where the exam engine's freshness moderator bans
// recycled teaching points, this generator does the opposite on purpose: it
// takes the learner's actual misses and rebuilds the SAME teaching points in
// FRESH sentences. That is the remediation loop - miss, get coached, prove
// you learned it under new wording. The ban list here covers only the old
// sentences themselves, never the answer keys.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
;
;
const VALID_SKILLS = /^(grammar|vocabulary|collocation|writing|reading|listening)$/;
async function generateRepairDrill(p, points, emit, title = "Repair drill") {
    const clean = points.filter((pt)=>pt.point.trim().length > 0).slice(0, 6);
    if (clean.length === 0) return null;
    const count = Math.max(4, Math.min(8, clean.length + 2));
    const spec = {
        level: p.level === "?" ? "B2" : p.level,
        targetSkills: [
            ...new Set(clean.map((pt)=>VALID_SKILLS.test(String(pt.skill)) ? String(pt.skill) : "grammar"))
        ],
        plannedCount: count,
        minutes: Math.max(4, Math.round(count * 0.9)),
        title,
        weakTags: [
            ...new Set(clean.map((pt)=>String(pt.tag ?? "").trim()).filter(Boolean))
        ].slice(0, 3)
    };
    emit("Loading your misses", `${clean.length} teaching points to rebuild`);
    const system = `You are the repair coach inside Rah, an English app for Farsi speakers. The learner just missed these exact teaching points in an exam. Build ONE short drill that retests THE SAME teaching points in COMPLETELY FRESH sentences and situations.

The learner sits around ${spec.level}. Each drill item must force the learner to produce the missed pattern correctly in new wording - same point, new clothes. A wrong sentence frame, a new topic, but the identical gap being tested.

Items: exactly ${count}. Mix mcq, cloze, short and rewrite so the pattern shows up from different angles.

Rules:
- "skill" is exactly one of: ${spec.targetSkills.join(", ")}.
- ${spec.weakTags.length ? `Items rebuilding a tagged mistake family carry "tag" - exactly one of: ${spec.weakTags.join(", ")}. Others omit the field.` : "Omit any tag field."}
- "a" is the single best answer. "accept" lists 2 to 4 variants you would hand-grade as correct.
- rewrite items: "mustInclude" lists the target patterns that ALL must appear.
- "why" is one short English sentence (max 18 words) reteaching the point.
- No Farsi anywhere. Never use the em dash character.

Output ONE JSON object, nothing else:
{"title": "short drill title", "items": [{"type": "cloze", "skill": "grammar", "q": "", "choices": ["", "", "", ""], "a": "", "accept": [], "why": ""}]}

The teaching points to rebuild (treat every "learner wrote -> target" pair as the exact gap being retested):
${clean.map((pt, i)=>`${i + 1}. ${pt.point}${pt.wrong ? ` (learner wrote: ${JSON.stringify(pt.wrong.slice(0, 120))} -> target: ${JSON.stringify(String(pt.right ?? "").slice(0, 120))})` : ""}${pt.tag ? ` [family: ${pt.tag}]` : ""}`).join("\n")}`;
    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(system, [
        {
            role: "user",
            content: `Generate the ${count}-item repair drill now. Same points, fresh sentences.`
        }
    ], ()=>({}), {
        deep: false,
        temperature: 0.75
    });
    const items = [];
    const seen = new Set();
    for (const r of raw.items ?? []){
        const q = String(r.q ?? "").trim();
        const a = String(r.a ?? "").trim();
        if (!q || !a || seen.has(q)) continue;
        const type = [
            "mcq",
            "cloze",
            "short",
            "rewrite"
        ].includes(r.type) ? r.type : "cloze";
        if (type === "mcq" && (!Array.isArray(r.choices) || r.choices.length < 2)) continue;
        const skill = VALID_SKILLS.test(String(r.skill)) ? String(r.skill) : spec.targetSkills[0];
        if (!spec.targetSkills.includes(skill)) continue;
        const tag = spec.weakTags.includes(String(r.tag ?? "").trim().toLowerCase()) ? String(r.tag).trim().toLowerCase() : undefined;
        items.push({
            id: `i${items.length + 1}`,
            type,
            skill,
            q,
            choices: type === "mcq" ? r.choices.map(String) : undefined,
            a,
            accept: Array.isArray(r.accept) ? r.accept.map(String).filter(Boolean).slice(0, 6) : [],
            mustInclude: Array.isArray(r.mustInclude) ? r.mustInclude.map(String).filter(Boolean) : [],
            mustNotInclude: [],
            why: String(r.why ?? "").trim() || "Rebuild of a point you missed.",
            tag
        });
        seen.add(q);
    }
    if (items.length === 0) return null;
    const finalItems = items.slice(0, count).map((it, idx)=>({
            ...it,
            id: `i${idx + 1}`
        }));
    spec.plannedCount = finalItems.length;
    const id = `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const drillTitle = String(raw.title ?? "").trim().slice(0, 60) || title;
    const client = {
        id,
        title: drillTitle,
        spec,
        count: finalItems.length,
        items: finalItems.map((it)=>({
                id: it.id,
                type: it.type,
                skill: it.skill,
                q: it.q,
                choices: it.choices,
                tag: it.tag
            }))
    };
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.create({
        data: {
            id,
            title: drillTitle,
            spec: JSON.stringify(spec),
            items: JSON.stringify(finalItems),
            status: "pending"
        }
    });
    emit("Drill ready", `${finalItems.length} items on your exact misses`);
    return {
        client,
        items: finalItems,
        spec
    };
}
}),
"[project]/src/lib/agent/mode-flow.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearMode",
    ()=>clearMode,
    "runModeFlow",
    ()=>runModeFlow,
    "startDaily",
    ()=>startDaily
]);
// Conversation modes. Four flows live on top of the skill registry:
// roleplay (scenario partner), debate (scored argumentation), socratic
// (guide-don't-tell tutoring) and daily (one challenge item awaiting its
// answer). A mode persists on the Learner row, so it survives page reloads,
// and every mode has clean exits that return the learner to the coach with
// feedback instead of leaving them stranded.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$fuzzy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/fuzzy.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mistakes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mastery.ts [app-route] (ecmascript)");
;
;
;
;
;
;
const EXIT = /^(end|stop|exit|quit|finish)( (the )?(scene|debate|mode|roleplay|challenge|this))?$/i;
const SKIP = /^(skip|pass|reveal|show the answer|i give up|give up)$/i;
async function clearMode(modeNote) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            mode: "coach",
            modeData: ""
        }
    });
    if (modeNote) console.log(`[mode] cleared: ${modeNote}`);
}
const MODE_SKILL = {
    roleplay: "roleplay",
    debate: "debate",
    socratic: "socratic",
    daily: "daily-challenge"
};
function envelope(skill, reply, steps, corrections = []) {
    return {
        skill,
        reply,
        corrections,
        fa_note: "",
        steps
    };
}
async function runModeFlow(text, history, p, emit) {
    const learner = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLearner"])();
    const mode = learner.mode;
    if (!mode || mode === "coach") return null;
    let data = {};
    try {
        data = JSON.parse(learner.modeData || "{}");
    } catch  {
        data = {};
    }
    const steps = [
        {
            label: `Mode: ${mode}`,
            detail: "persistent conversation state"
        }
    ];
    // Universal exits - every mode wraps up gracefully, never strands.
    if (EXIT.test(text.trim()) || /^(socratic )?off$/i.test(text.trim()) || text.trim().toLowerCase() === "/end") {
        emit("Leaving mode", mode);
        await clearMode(mode);
        const wrap = await wrapUp(mode, data, p);
        return envelope(MODE_SKILL[mode] ?? "chat", wrap, [
            ...steps,
            {
                label: "Mode closed",
                detail: "back to the coach"
            }
        ]);
    }
    if (mode === "daily") {
        return dailyTurn(text, data, p, steps, emit);
    }
    if (mode === "roleplay") {
        return roleplayTurn(text, data, p, steps, history, emit);
    }
    if (mode === "debate") {
        return debateTurn(text, data, p, steps, history, emit);
    }
    if (mode === "socratic") {
        return socraticTurn(text, data, p, steps, history, emit);
    }
    return null;
}
async function wrapUp(mode, data, p) {
    if (mode === "daily" && data.item) {
        return `The answer was "${data.item.a}". ${data.item.why ?? ""} Back in coach mode: tell me what to practice, or ask for "generate an exam".`;
    }
    if (mode === "roleplay") {
        return sceneReport(data, p);
    }
    try {
        const out = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are Rah, an English coach for a Farsi speaker around ${p.level}. A ${mode} session just ended${mode === "debate" ? ` on the topic: ${data.topic ?? "the debate"}` : mode === "roleplay" ? ` (scenario: ${data.scene ?? "the scene"})` : ""}. Write the wrap-up: 2 short English sentences on what the learner did well and ONE specific thing to work on next time. No questions, no JSON, no Farsi.`, [
            {
                role: "user",
                content: "end of session"
            }
        ], ()=>({}), {
            deep: false,
            temperature: 0.5
        });
        const reply = String(out.reply ?? "").trim();
        return reply ? `${reply} Back in coach mode.` : "Session closed. Back in coach mode: what is next?";
    } catch  {
        return "Session closed. Back in coach mode: what is next?";
    }
}
// DUOLINGO MAX RE - Video Call/Roleplay ends with "conversation feedback and
// transcripts" (their published product material). Our scene report is the
// honest version: turn count and the trap tally come from the persisted
// ModeData - what the partner ACTUALLY corrected, turn by turn - and the AI
// adds nothing. Zero invented stats; deterministic focus ranking.
function sceneReport(data, p) {
    const turns = data.turns ?? 0;
    const traps = Object.entries(data.traps ?? {}).sort((a, b)=>b[1] - a[1]);
    const totalCorrections = traps.reduce((a, [, n])=>a + n, 0);
    if (turns === 0) {
        return "Scene closed without a single turn - we barely started. Back in coach mode: say \"roleplay\" with a scenario and give it a real run this time.";
    }
    const lines = [];
    lines.push(`SCENE REPORT - ${data.scene ?? "casual conversation"}`);
    lines.push(`Turns in the scene: ${turns}. Corrections issued: ${totalCorrections} (${(totalCorrections / turns).toFixed(1)}/turn).`);
    if (traps.length > 0) {
        const top = traps.slice(0, 3);
        const focus = top.map(([tag, n])=>{
            const ex = data.examples?.[tag];
            return `${tag} (${n}x)${ex ? `: "${ex.wrong}" -> "${ex.right}"` : ""}`;
        }).join("; ");
        lines.push(`Recurring traps: ${focus}.`);
        lines.push(`Next scene should pressure-test: ${top[0][0]} - it cost you the most.`);
    } else {
        lines.push(`Zero corrections across ${turns} turns at ${p.level} - the scene was too easy. Next one goes harder or gets a register constraint.`);
    }
    lines.push("Back in coach mode: ask for another roleplay, or \"generate an exam\" to drill the trap above.");
    return lines.join("\n");
}
async function modeTurn(system, text, history, deep) {
    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(system, [
        ...history.slice(-10),
        {
            role: "user",
            content: text
        }
    ], ()=>({}), {
        deep
    });
    return {
        reply: String(raw.reply ?? "").trim(),
        corrections: (Array.isArray(raw.corrections) ? raw.corrections.slice(0, 3) : []).map((c)=>({
                wrong: String(c.wrong ?? ""),
                right: String(c.right ?? ""),
                fa: String(c.fa ?? ""),
                trap: String(c.trap ?? "none")
            }))
    };
}
async function roleplayTurn(text, data, p, steps, history, emit) {
    emit("In the scene", data.scene ?? "");
    const system = `You are the roleplay partner inside Rah for a Farsi speaker around ${p.level}. Stay fully in character.

SCENE: ${data.scene ?? "casual conversation"}
YOUR ROLE: ${data.partner ?? "conversation partner"}
THE LEARNER'S GOAL: ${data.goal ?? "communicate naturally in English"}

Rules:
- reply: stay in character, 1 to 3 sentences, push the scene forward with a question or complication. Natural spoken register.
- corrections: up to 2 per turn for real production errors, each with a Farsi "fa" explanation and a "trap" tag (statives, articles, countability, plurals, copula, prepositions, perfect, question_order, adjectives, that_omission, word_choice, register).
- Do not break character to teach. The corrections array is the teaching; the reply stays in the scene.
- No Farsi in the reply field. Never use the em dash character.`;
    const turn = await modeTurn(system, text, history, false);
    // Scene accounting: persist turns + trap tally so the exit report is real.
    const traps = {
        ...data.traps ?? {}
    };
    const examples = {
        ...data.examples ?? {}
    };
    for (const c of turn.corrections ?? []){
        if (!c.wrong) continue;
        traps[c.trap] = (traps[c.trap] ?? 0) + 1;
        examples[c.trap] = {
            wrong: c.wrong.slice(0, 60),
            right: c.right.slice(0, 60)
        };
    }
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            modeData: JSON.stringify({
                ...data,
                turns: (data.turns ?? 0) + 1,
                traps,
                examples
            })
        }
    });
    return envelope("roleplay", turn.reply || "...", steps, turn.corrections);
}
async function debateTurn(text, data, p, steps, history, emit) {
    const round = (data.round ?? 1) + (history.length % 2 === 0 ? 1 : 0);
    emit("Round", `${data.round ?? 1}: ${data.topic ?? ""}`);
    const system = `You are the debate opponent inside Rah for a Farsi speaker around ${p.level}.

TOPIC: ${data.topic ?? "a controversial everyday question"}
YOUR POSITION (argue it firmly): ${data.side ?? "the opposite of the learner"}

Rules:
- reply: 2 to 4 sentences. Rebut their last argument directly, add ONE new point for your side, and end pressing them to answer your strongest challenge. Sharp but respectful register.
- corrections: up to 2 real language errors from their message, each with Farsi "fa" and a "trap" tag.
- After round 3 the debate auto-ends with a scored verdict; until then never score, just argue.
- No Farsi in reply. Never use the em dash character.`;
    const turn = await modeTurn(system, text, history, false);
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            modeData: JSON.stringify({
                ...data,
                round
            })
        }
    });
    if (round >= 3) {
        emit("Final round done", "scoring");
        const verdict = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are the debate judge inside Rah (English coach for a Farsi speaker around ${p.level}). The 3-round debate on "${data.topic ?? "the topic"}" just ended. Write the verdict: their strongest moment, their weakest argument, 2 language upgrades they should steal, each in one short sentence. English only, no questions, no JSON.`, [
            {
                role: "user",
                content: "verdict now"
            }
        ], ()=>({}), {
            deep: false,
            temperature: 0.4
        });
        await clearMode("debate finished");
        return envelope("debate", `${turn.reply || "..."}\n\nFINAL VERDICT: ${String(verdict.reply ?? "").trim()}\n\n(Back in coach mode.)`, [
            ...steps,
            {
                label: "Verdict"
            }
        ], turn.corrections);
    }
    return envelope("debate", turn.reply || "...", steps, turn.corrections);
}
async function socraticTurn(text, data, p, steps, history, emit) {
    emit("Socratic turn", "no answers, only questions");
    const system = `You are Rah in SOCRATIC MODE for a Farsi speaker around ${p.level}: ${data.goal ?? "guide them to discover the rule themselves"}.

Hard rules:
- reply: NEVER state the target rule or give the corrected form directly. Respond only with guiding questions, minimal pairs, or a sentence for them to try. Max 60 words.
- If they produce language, ask the question that makes THEM spot the problem ("which article would a native drop here?").
- If they are stuck after two attempts, give the smallest possible hint: one example, no explanation.
- corrections: still correct real errors (max 2) with Farsi "fa" and a "trap" tag - the correction card is allowed to reveal; your spoken turn is not.
- No Farsi in reply. Never use the em dash character.`;
    const turn = await modeTurn(system, text, history, false);
    return envelope("socratic", turn.reply || "...", steps, turn.corrections);
}
async function dailyTurn(text, data, p, steps, emit) {
    const item = data.item;
    if (!item) {
        await clearMode("daily without item");
        return envelope("daily-challenge", "The challenge got lost. Back in coach mode: ask for today's challenge again.", steps);
    }
    if (SKIP.test(text.trim())) {
        emit("Revealing", "skipped");
        await clearMode("skipped");
        return envelope("daily-challenge", `The answer was "${item.a}". ${item.why ?? ""} It stays in the mistake memory and will come back in a future exam. Back in coach mode.`, steps);
    }
    emit("Grading your answer", item.tag ? `hunting: ${item.tag}` : "");
    const correct = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$fuzzy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["gradeAnswer"])({
        given: text,
        type: item.type ?? "short",
        a: item.a,
        accept: item.accept,
        choices: item.choices
    });
    if (item.tag) {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["noteExamAnswer"])(item.tag, text, item.a, correct);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mastery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["noteTagOutcome"])(item.tag, correct);
    }
    await clearMode(correct ? "daily beaten" : "daily missed");
    return envelope("daily-challenge", correct ? `Correct - "${item.a}" is exactly it. ${item.why ?? ""} Clean hit logged${item.tag ? ` against your ${item.tag} family` : ""}. Back in coach mode: tomorrow brings a fresh one.` : `Not this time: the answer is "${item.a}". ${item.why ?? ""} Logged${item.tag ? ` under your ${item.tag} family` : ""} - future exams will hunt it until you beat it twice. Back in coach mode.`, steps);
}
async function startDaily(p, emit) {
    const steps = [
        {
            label: "Building today's challenge",
            detail: "from your live weak spots"
        }
    ];
    const topTag = p.mistakes[0]?.tag ?? "";
    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are the challenge builder inside Rah for a Farsi speaker around ${p.level}. Build exactly ONE hard but fair item that tests ${topTag ? `the "${topTag}" weakness (Farsi interference)` : `their weakest skill: ${p.weakSkills.join("/")}`}.
Shape: cloze (q contains ___), or short answer, or mcq with 4 choices. The answer must be objectively checkable.
Output ONE JSON object: {"q": "", "choices": ["", "", "", ""], "a": "", "accept": [], "why": "one English sentence, max 18 words", "skill": "grammar"}
No Farsi. Never use the em dash character.`, [
        {
            role: "user",
            content: "build today's single challenge now"
        }
    ], ()=>({}), {
        deep: false,
        temperature: 0.8
    });
    const q = String(raw.q ?? "").trim();
    const a = String(raw.a ?? "").trim();
    if (!q || !a) return envelope("daily-challenge", "Could not build today's challenge - ask again in a minute.", steps);
    const item = {
        q,
        choices: Array.isArray(raw.choices) && raw.choices.length >= 2 ? raw.choices.map(String) : undefined,
        a,
        accept: Array.isArray(raw.accept) ? raw.accept.map(String).filter(Boolean) : [],
        why: String(raw.why ?? "").trim(),
        skill: String(raw.skill ?? "grammar"),
        type: Array.isArray(raw.choices) && raw.choices.length >= 2 ? "mcq" : "short",
        tag: topTag || undefined
    };
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
        where: {
            id: "me"
        },
        data: {
            mode: "daily",
            modeData: JSON.stringify({
                item,
                startedAt: Date.now()
            })
        }
    });
    emit("Challenge live", item.tag ? `hunting: ${item.tag}` : item.skill);
    const choices = item.choices ? `\n${item.choices.map((c, i)=>`   ${String.fromCharCode(97 + i)}) ${c}`).join("\n")}` : "";
    return envelope("daily-challenge", `Today's challenge${item.tag ? ` (hunting your "${item.tag}" weak spot)` : ""}:\n\n${q}${choices}\n\nReply with your answer${item.choices ? " (a, b, c or d, or type it)" : ""}, "skip" to reveal, or "end" to bail. It grades instantly and feeds the mistake memory.`, steps);
}
}),
"[project]/src/lib/agent/theme.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Theme plugin: the coach can repaint the app by emitting token overrides.
// Everything is validated server side and mapped to CSS variables on :root.
__turbopack_context__.s([
    "PRESETS",
    ()=>PRESETS,
    "THEME_VARS",
    ()=>THEME_VARS,
    "isHex",
    ()=>isHex,
    "parseThemeRequest",
    ()=>parseThemeRequest,
    "presetById",
    ()=>presetById,
    "sanitizeTokens",
    ()=>sanitizeTokens
]);
const THEME_VARS = {
    primary: "--rah-primary",
    primaryDeep: "--rah-primary-deep",
    bg: "--rah-bg",
    surface: "--rah-surface",
    accent: "--rah-accent"
};
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function isHex(s) {
    return HEX.test(s);
}
const PRESETS = [
    {
        id: "midnight",
        name: "Midnight (default)",
        tokens: {
            primary: "#4e8cff",
            primaryDeep: "#2650a3",
            bg: "#10131a",
            surface: "#1a1f2b",
            accent: "#4cc9f0"
        }
    },
    {
        id: "ocean",
        name: "Ocean",
        tokens: {
            primary: "#38bdf8",
            primaryDeep: "#0369a1",
            bg: "#0b1220",
            surface: "#111c30",
            accent: "#7dd3fc"
        }
    },
    {
        id: "forest",
        name: "Forest",
        tokens: {
            primary: "#34d399",
            primaryDeep: "#047857",
            bg: "#0d1512",
            surface: "#14201b",
            accent: "#6ee7b7"
        }
    },
    {
        id: "sunset",
        name: "Sunset",
        tokens: {
            primary: "#fb923c",
            primaryDeep: "#c2410c",
            bg: "#171114",
            surface: "#211820",
            accent: "#fdba74"
        }
    },
    {
        id: "violet",
        name: "Violet",
        tokens: {
            primary: "#a78bfa",
            primaryDeep: "#6d28d9",
            bg: "#120f1c",
            surface: "#1b1628",
            accent: "#c4b5fd"
        }
    },
    {
        id: "rose",
        name: "Rose",
        tokens: {
            primary: "#fb7185",
            primaryDeep: "#be123c",
            bg: "#171014",
            surface: "#211821",
            accent: "#fda4af"
        }
    }
];
function presetById(id) {
    return PRESETS.find((p)=>p.id === id.toLowerCase().trim());
}
function sanitizeTokens(raw) {
    if (!raw || typeof raw !== "object") return null;
    const src = raw;
    const out = {};
    let any = false;
    for (const k of [
        "primary",
        "primaryDeep",
        "bg",
        "surface",
        "accent"
    ]){
        const v = src[k];
        if (typeof v === "string" && isHex(v.trim())) {
            out[k] = v.trim().toLowerCase();
            any = true;
        }
    }
    return any ? out : null;
}
function parseThemeRequest(text) {
    const t = text.toLowerCase();
    const hexes = text.match(/#[0-9a-fA-F]{6}\b/g);
    if (hexes && hexes.length > 0) {
        const [primary, primaryDeep, bg, surface, accent] = hexes;
        return {
            tokens: {
                primary,
                primaryDeep,
                bg,
                surface,
                accent
            }
        };
    }
    const preset = presetById(t);
    if (preset) return {
        preset: preset.id
    };
    if (/\b(ocean|sea|blue cyan|cyan)\b/.test(t)) return {
        preset: "ocean"
    };
    if (/\b(forest|green|emerald|nature)\b/.test(t)) return {
        preset: "forest"
    };
    if (/\b(sunset|orange|warm|amber)\b/.test(t)) return {
        preset: "sunset"
    };
    if (/\b(violet|purple|lavender)\b/.test(t)) return {
        preset: "violet"
    };
    if (/\b(rose|pink|red)\b/.test(t)) return {
        preset: "rose"
    };
    if (/\b(midnight|default|reset|original|normal)\b/.test(t)) return {
        preset: "midnight"
    };
    return {};
}
}),
"[project]/src/lib/agent/skills-power.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POWER_SKILLS",
    ()=>POWER_SKILLS
]);
// Power skills: exams, assessment, deep analysis, plans, and the app-control
// plugins (theme, navigation, focus, settings). These are the capabilities the
// learner asked for by name.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/exam.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$drill$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/drill.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$mode$2d$flow$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/mode-flow.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/levels.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$theme$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/theme.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mistakes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/skills-util.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
;
const TAG_TO_SKILL = {
    statives: "grammar",
    articles: "grammar",
    countability: "grammar",
    plurals: "grammar",
    copula: "grammar",
    prepositions: "grammar",
    perfect: "grammar",
    question_order: "grammar",
    adjectives: "grammar",
    that_omission: "grammar",
    word_choice: "vocabulary",
    register: "vocabulary",
    collocation: "vocabulary",
    spelling: "vocabulary"
};
// Farsi-phonology minimal pairs, curated (no AI needed, instant, reliable):
// the interference points Persian speakers actually hit.
const MINIMAL_PAIRS = [
    {
        tag: "th_sounds",
        pairs: [
            [
                "think",
                "sink"
            ],
            [
                "three",
                "tree"
            ],
            [
                "bath",
                "bass"
            ],
            [
                "they",
                "day"
            ],
            [
                "breathe",
                "breeze"
            ]
        ],
        tip: "Persian has no dental fricatives: /th/ collapses to s, t, z or d. Put the tongue tip BETWEEN the teeth and blow - no vibration for 'think', vibration for 'they'.",
        fa: "در فارسی صدای th وجود ندارد؛ زبان را بین دندان‌ها بگذار و هوا بده: think نه sink، they نه day."
    },
    {
        tag: "w_v",
        pairs: [
            [
                "west",
                "vest"
            ],
            [
                "wine",
                "vine"
            ],
            [
                "wow",
                "vow"
            ],
            [
                "worse",
                "verse"
            ],
            [
                "wheel",
                "veal"
            ]
        ],
        tip: "Persian has /v/ but no true /w/. Round the lips tightly and let the air pass with NO teeth contact for 'west' - teeth on lip is 'vest'.",
        fa: "برای w لب‌ها را گرد کن و با دندان لمس نده: west نه vest. v با دندان روی لب ساخته می‌شود."
    },
    {
        tag: "clusters",
        pairs: [
            [
                "student",
                "estudent"
            ],
            [
                "street",
                "estreet"
            ],
            [
                "sport",
                "esport"
            ],
            [
                "school",
                "eschool"
            ],
            [
                "special",
                "especial"
            ]
        ],
        tip: "Farsi inserts a vowel before st-, sp-, sc- clusters (epenthesis). Start straight into the cluster: 's-t' with no vowel before the s.",
        fa: "فارسی قبل از خوشه‌های st و sp یک مصوت اضافه می‌کند: student نه estudent. مستقیم با s شروع کن."
    },
    {
        tag: "ng",
        pairs: [
            [
                "sing",
                "sin"
            ],
            [
                "long",
                "lawn"
            ],
            [
                "thing",
                "thin"
            ],
            [
                "singer",
                "sinner"
            ]
        ],
        tip: "Final -ng is one nasal sound /ŋ/, not /n/ plus a g. Hold the back of the tongue up; the g in 'singer' is silent in careful speech.",
        fa: "پایان کلمات -ng یک صدای بینی است، نه n و g جدا: sing نه sing+گ."
    },
    {
        tag: "stress",
        pairs: [
            [
                "PHOtograph",
                "phoTOgrapher"
            ],
            [
                "PREsent (noun)",
                "preSENT (verb)"
            ],
            [
                "REcord (noun)",
                "reCORD (verb)"
            ],
            [
                "HOspital",
                "hospital"
            ]
        ],
        tip: "Farsi is syllable-timed, so English stress contrast flattens. Exaggerate the loud syllable: one peaks, the others shrink.",
        fa: "تمایز تکیه (stress) در انگلیسی قوی است؛ هجای پرتکیه را بلندتر و کشیده‌تر بگو، بقیه را کوتاه کن."
    }
];
const VIEW_WORDS = {
    home: /\bhome\b|dashboard/i,
    review: /\breview\b|\bsrs\b|\bflashcards?\b/i,
    chat: /\bcoach\b|\bchat\b/i,
    write: /\bwrit(e|ing)\b/i,
    speak: /\bspeak(ing)?\b|\bspeaking\b/i,
    listen: /\blisten(ing)?\b/i,
    read: /\bread(ing)?\b/i,
    placement: /\bplacement\b|\bplace(ment)? test\b/i,
    progress: /\bprogress\b|\bstats?\b|\bstatistics\b/i
};
const POWER_SKILLS = [
    {
        id: "remediate",
        name: "Repair loop",
        oneLiner: "Rebuilds your actual exam misses as a fresh drill until they are beaten",
        commands: [
            "remediate",
            "repair"
        ],
        triggers: [
            /\b(practice|redo|retry|retest|drill) (my )?(misses|wrong( ones?)?|mistakes?|fails?)\b/i,
            /\brepair (drill|my (misses|mistakes))\b/i,
            /\bhelp me (overcome|beat|fix) (my )?(misses|mistakes?|weak\w*)\b/i,
            /\bwont ever let it happen\b/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Collecting your misses",
                detail: "last graded exams"
            });
            const graded = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.findMany({
                where: {
                    status: "graded"
                },
                orderBy: {
                    createdAt: "desc"
                },
                take: 3
            });
            const points = [];
            for (const row of graded){
                let items = [];
                let result = {};
                try {
                    items = JSON.parse(row.items);
                    result = JSON.parse(row.result ?? "{}");
                } catch  {
                    continue;
                }
                for (const v of result.verdicts ?? []){
                    if (v.correct || !v.given) continue;
                    const it = items.find((x)=>x.id === v.itemId);
                    if (!it) continue;
                    points.push({
                        point: `${it.why} (question: ${it.q.slice(0, 100)})`,
                        wrong: v.given,
                        right: it.a,
                        tag: it.tag,
                        skill: it.skill
                    });
                }
            }
            if (points.length === 0) {
                return {
                    skill: "remediate",
                    reply: "Clean sheet: your recent exams have no misses to repair. Ask for a fresh exam ('generate an exam') and I will hunt your mistake families inside it instead.",
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            const drill = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$drill$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateRepairDrill"])(ctx.profile, points.slice(0, 6), (l, d)=>steps.push({
                    label: l,
                    detail: d
                }), "Repair drill: your misses");
            if (!drill) {
                return {
                    skill: "remediate",
                    reply: "I could not build the drill that time - say 'practice my misses' once more.",
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            return {
                skill: "remediate",
                reply: `${points.length} miss(es) found. This drill retests the EXACT same teaching points in fresh sentences - prove the lesson landed and the families behind them move toward retirement. Submit when done.`,
                corrections: [],
                fa_note: "",
                steps,
                exam: drill.client
            };
        }
    },
    {
        id: "repair-drill",
        name: "Weak-spot drill",
        oneLiner: "Five fresh items on one named weak spot, right now",
        commands: [
            "drill"
        ],
        triggers: [
            /^\/drill\b/i,
            /\bdrill (my )?(statives?|articles?|prepositions?|countability|copula|perfect|question order|adjectives?|word choice|register|collocations?|spelling|weak\w*|spot|famil\w*|mistake)\b/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const families = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["topMistakes"])(6, true);
            const lower = ctx.text.toLowerCase();
            const named = families.filter((f)=>lower.includes(f.tag.replace(/_/g, " ")) || lower.includes(f.tag));
            let points;
            if (named.length > 0) {
                points = named.map((f)=>({
                        point: f.label,
                        wrong: f.evidence.split(" -> ")[0],
                        right: f.evidence.split(" -> ")[1] ?? "",
                        tag: f.tag,
                        skill: TAG_TO_SKILL[f.tag] ?? "grammar"
                    }));
                steps.push({
                    label: "Aiming at your families",
                    detail: named.map((f)=>f.tag).join(", ")
                });
            } else {
                const topic = ctx.text.replace(/^\/?drill\s*/i, "").replace(/\b(my|a|the|some|spot|weakness|weak)\b/gi, " ").replace(/\s+/g, " ").trim() || "your weakest skill";
                points = [
                    {
                        point: `Focused practice: ${topic}`,
                        skill: TAG_TO_SKILL[topic.replace(/ /g, "_")] ?? "grammar"
                    }
                ];
                steps.push({
                    label: "Building the drill",
                    detail: topic
                });
            }
            const drill = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$drill$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateRepairDrill"])(ctx.profile, points, (l, d)=>steps.push({
                    label: l,
                    detail: d
                }), "Weak-spot drill");
            if (!drill) {
                return {
                    skill: "repair-drill",
                    reply: "Drill build failed that time - run /drill once more.",
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            return {
                skill: "repair-drill",
                reply: "Fresh drill, same target. Name the weak spot next time ('drill prepositions') or say 'practice my misses' to retest your actual exam errors. Submit when done.",
                corrections: [],
                fa_note: "",
                steps,
                exam: drill.client
            };
        }
    },
    {
        id: "roleplay",
        name: "Roleplay",
        oneLiner: "Live scenario practice: interviews, airports, doctors - in character",
        commands: [
            "roleplay",
            "scene"
        ],
        triggers: [
            /\brole[- ]?play\b/i,
            /\bscene\b.{0,40}\b(interview|airport|doctor|restaurant|hotel|shop|meeting|order)\b/i,
            /simulate (a|an)/i,
            /practice (talking|speaking) (with|to|in) (a|an|the)/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const t = ctx.text.toLowerCase();
            let scene = "A casual conversation with a new English-speaking colleague";
            let partner = "the colleague";
            let goal = "Keep the conversation natural for five exchanges";
            if (t.includes("interview") || t.includes("job")) {
                scene = "A job interview for a position you really want";
                partner = "the hiring manager";
                goal = "Present yourself, answer the hard questions, and land a second interview";
            } else if (t.includes("airport") || t.includes("flight") || t.includes("check-in")) {
                scene = "An airport check-in counter where your connecting flight is delayed";
                partner = "the check-in agent";
                goal = "Sort out the rebooking and get something for the inconvenience";
            } else if (t.includes("doctor") || t.includes("sick") || t.includes("clinic")) {
                scene = "A doctor's appointment; you have felt unwell for a week";
                partner = "the doctor";
                goal = "Describe symptoms precisely and understand the advice";
            } else if (t.includes("restaurant") || t.includes("order") || t.includes("food")) {
                scene = "A restaurant where the wrong dish just arrived";
                partner = "the waiter";
                goal = "Fix the order politely and order dessert after";
            } else if (t.includes("hotel") || t.includes("room")) {
                scene = "A hotel reception; your room is not what you booked";
                partner = "the receptionist";
                goal = "Get the room fixed or an upgrade, without losing your temper";
            } else if (t.includes("meeting") || t.includes("present") || t.includes("work")) {
                scene = "A work meeting where you must present an idea to skeptical colleagues";
                partner = "a skeptical colleague";
                goal = "Defend the idea with reasons and handle pushback";
            } else if (ctx.text.replace(/\b(roleplay|scene|simulate|a|an|the|practice)\b/gi, " ").trim().length > 8) {
                scene = ctx.text.replace(/^.*\b(roleplay|scene|simulate)\b:?\s*/i, "").trim() || scene;
                partner = "your scene partner";
                goal = "Stay in the scene and communicate naturally";
            }
            steps.push({
                label: "Scene set",
                detail: scene
            });
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
                where: {
                    id: "me"
                },
                data: {
                    mode: "roleplay",
                    modeData: JSON.stringify({
                        scene,
                        partner,
                        goal,
                        startedAt: Date.now()
                    })
                }
            });
            const open = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are ${partner} in this roleplay for a Farsi speaker around ${ctx.profile.level}: ${scene}. Their goal: ${goal}.
Open the scene IN CHARACTER: 1 to 3 sentences that put the learner on the spot in a natural way and end with something they must respond to. English only, spoken register. No JSON, no Farsi, no em dash.`, [
                {
                    role: "user",
                    content: "open the scene"
                }
            ], ()=>({}), {
                deep: false,
                temperature: 0.7
            });
            const firstLine = String(open.reply ?? "").trim() || "So, let's begin - tell me why you are here.";
            return {
                skill: "roleplay",
                reply: `Scene: ${scene}\nYour goal: ${goal}\n\n${firstLine}\n\n(I stay in character; real errors get corrected on the cards under my replies. Say "end scene" any time to get feedback and return to coach mode.)`,
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "socratic",
        name: "Socratic mode",
        oneLiner: "I refuse to hand you the answer; my questions drag it out of you",
        commands: [
            "socratic"
        ],
        triggers: [
            /\bsocratic\b/i,
            /guide me (to|through)/i,
            /dont tell me (the )?answer/i,
            /make me (think|figure it out)/i,
            /let me discover/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const families = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["topMistakes"])(3, true);
            const goal = ctx.text.replace(/\bsocratic( mode)?\b/gi, " ").replace(/\b(guide me|on|about|for)\b/gi, " ").trim() || families[0]?.label || "their most common grammar slip";
            steps.push({
                label: "Socratic mode on",
                detail: goal
            });
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
                where: {
                    id: "me"
                },
                data: {
                    mode: "socratic",
                    modeData: JSON.stringify({
                        goal,
                        startedAt: Date.now()
                    })
                }
            });
            const open = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are Rah in SOCRATIC MODE for a Farsi speaker around ${ctx.profile.level}. Target: ${goal}.
Open with ONE short guiding question or minimal pair that makes them produce the target form themselves. Max 30 words. No explanation, no rule, no answer. English only, no em dash.`, [
                {
                    role: "user",
                    content: "begin"
                }
            ], ()=>({}), {
                deep: false,
                temperature: 0.6
            });
            return {
                skill: "socratic",
                reply: `${String(open.reply ?? "").trim() || "Try this sentence for me: 'Yesterday I ___ (go) to the gym.' Which form fits, and why not the others?"}\n\n(Socratic mode is on: I guide with questions, never hand you the rule. Correction cards still reveal when you err. "end" returns to normal coaching.)`,
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "explain",
        name: "Explain",
        oneLiner: "The one skill where I break Socratic silence and just teach the rule",
        commands: [
            "explain"
        ],
        triggers: [
            /\bexplain\b/i,
            /what('s| is) the difference between/i,
            /when (do|should) (i|you) use\b/i,
            /how (do|does) (present perfect|past simple|a\/an|the) work/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const topic = ctx.text.replace(/^\/?explain\s*/i, "").replace(/what('s| is) the difference between/i, "").trim() || ctx.text;
            steps.push({
                label: "Preparing the lesson",
                detail: topic.slice(0, 60)
            });
            const out = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are the linguist inside Rah, teaching a Farsi speaker around ${ctx.profile.level} who explicitly ASKED for the rule (this is the one mode where lecturing is allowed).
Topic: ${topic}

reply: the clearest possible explanation, max 130 words. Include: the rule in one line, 2 contrasting examples (wrong vs right), and the Farsi-interference angle if there is one.
fa: one or two Farsi sentences summarizing the interference or the takeaway.
check: 2 tiny check questions (with answers hidden in your reply's last line as "Quick check: 1) ... 2) ...").
Output ONE JSON object: {"reply": "", "fa": "", "check": ["", ""]}
No em dash anywhere.`, [
                {
                    role: "user",
                    content: ctx.text
                }
            ], ()=>({}), {
                deep: false,
                temperature: 0.5
            });
            const reply = String(out.reply ?? "").trim();
            const check = Array.isArray(out.check) ? out.check.filter(Boolean).slice(0, 2) : [];
            return {
                skill: "explain",
                reply: `${reply}${check.length ? `\n\nQuick check: ${check.join(" ")}` : ""}`,
                corrections: [],
                fa_note: String(out.fa ?? "").trim(),
                steps
            };
        }
    },
    {
        id: "debate",
        name: "Debate",
        oneLiner: "Three scored rounds: I take the other side and push back hard",
        commands: [
            "debate"
        ],
        triggers: [
            /\bdebate\b/i,
            /argue (with|against) me/i,
            /convince me/i,
            /play devil'?s advocate/i
        ],
        run: async (ctx)=>{
            const steps = [];
            let topic = ctx.text.replace(/^\/?debate\s*(about|on|over)?\s*/i, "").trim();
            if (topic.length < 6 || /^(with|against) me$/i.test(topic)) {
                const pool = [
                    "Remote work is better than office work",
                    "Social media does more harm than good",
                    "Exams measure nothing real",
                    "Learning grammar rules beats learning phrases",
                    "Cities are better than small towns for raising kids"
                ];
                topic = pool[Math.floor(Math.random() * pool.length)];
            }
            steps.push({
                label: "Motion set",
                detail: topic
            });
            const side = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`Debate topic: "${topic}". A Farsi-speaking learner around ${ctx.profile.level} will argue; YOU must take the opposing side. State your side in max 8 words. Output ONE JSON object: {"side": ""}`, [
                {
                    role: "user",
                    content: "pick your side"
                }
            ], ()=>({}), {
                deep: false,
                temperature: 0.6
            });
            const mySide = String(side.side ?? "").trim() || "the opposite position";
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
                where: {
                    id: "me"
                },
                data: {
                    mode: "debate",
                    modeData: JSON.stringify({
                        topic,
                        side: mySide,
                        round: 0,
                        startedAt: Date.now()
                    })
                }
            });
            const open = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are the debate opponent in Rah for a learner around ${ctx.profile.level}. Topic: "${topic}". Your side: ${mySide}.
Open the debate: 2 or 3 sentences with your strongest opening argument, ending with a direct challenge at them. English only, sharp register, no em dash.`, [
                {
                    role: "user",
                    content: "open the debate"
                }
            ], ()=>({}), {
                deep: false,
                temperature: 0.7
            });
            return {
                skill: "debate",
                reply: `Motion: ${topic}\nMy side: ${mySide}\n\n${String(open.reply ?? "").trim()}\n\n(3 rounds, then a scored verdict on argument and language. Real errors get corrected on cards. Say "end debate" any time.)`,
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "daily-challenge",
        name: "Daily challenge",
        oneLiner: "One hard item, built from your weakest spot today, graded on the spot",
        commands: [
            "daily",
            "challenge"
        ],
        triggers: [
            /daily challenge/i,
            /\bchallenge me\b/i,
            /daily (quest|puzzle)/i,
            /todays? challenge/i
        ],
        run: async (ctx)=>{
            const steps = [];
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$mode$2d$flow$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["startDaily"])(ctx.profile, (l, d)=>steps.push({
                    label: l,
                    detail: d
                }));
        }
    },
    {
        id: "coach-report",
        name: "Coach report",
        oneLiner: "Your week in hard numbers, with one focus for next week",
        commands: [
            "week",
            "report-card"
        ],
        triggers: [
            /(weekly|coach) report/i,
            /how (was|did) my week/i,
            /report card/i,
            /week in (numbers|review)/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Crunching your data",
                detail: "7 days, bands, exams, memory"
            });
            const since = Date.now() / 1000;
            const days = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].dailyStat.findMany({
                where: {
                    day: {
                        gte: Math.floor(since / 86400) - 7
                    }
                }
            });
            const reviews = days.reduce((a, d)=>a + d.reviews, 0);
            const xp = days.reduce((a, d)=>a + d.xp, 0);
            const correct = days.reduce((a, d)=>a + d.correct, 0);
            const bands = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkillLevels"])();
            const mistakes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["topMistakes"])(50);
            const active = mistakes.filter((m)=>!m.resolvedAt);
            const healed = mistakes.filter((m)=>m.resolvedAt);
            const exams = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.findMany({
                where: {
                    status: "graded"
                },
                orderBy: {
                    createdAt: "desc"
                },
                take: 5
            });
            const pcts = exams.map((e)=>{
                try {
                    return JSON.parse(e.result ?? "{}").pct ?? 0;
                } catch  {
                    return 0;
                }
            });
            const trend = pcts.length >= 2 ? pcts[0] >= pcts[pcts.length - 1] ? "trending up" : "slipping" : "not enough exams yet";
            const worstBand = [
                ...bands
            ].sort((a, b)=>a.score - b.score)[0];
            const focus = active[0]?.label ?? worstBand ? `${worstBand ? `${worstBand.skill} (${worstBand.level})` : "consistency"}` : "consistency";
            const lines = [
                `Last 7 days: ${reviews} reviews, ${correct} correct, ${xp} XP, ${days.length} active day(s), streak ${ctx.profile.streak}.`,
                bands.length ? `Bands: ${bands.map((b)=>`${b.skill} ${b.level}`).join(", ")}.` : "No measured bands yet - run /assess.",
                pcts.length ? `Recent exams: ${pcts.join("%, ")}% (${trend}).` : "No graded exams yet.",
                `Mistake memory: ${active.length} active famil${active.length === 1 ? "y" : "ies"}, ${healed.length} healed.`,
                `Next-week focus: ${active[0] ? `${active[0].label} - the exams already hunt it; two clean hits retire it.` : `${focus}.`}`
            ];
            return {
                skill: "coach-report",
                reply: lines.join("\n"),
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "minimal-pairs",
        name: "Pronunciation lab",
        oneLiner: "Minimal pairs for the exact sounds Persian speakers collapse",
        commands: [
            "pairs"
        ],
        triggers: [
            /\bminimal pairs?\b/i,
            /pronunciation (lab|drill|pairs)/i,
            /\bth sounds?\b/i,
            /(practice|train|fix) my (th|w|v|pronunciation)/i,
            /i (cant|can't|cannot) (say|pronounce) (th|w)\b/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const t = ctx.text.toLowerCase();
            const pick = MINIMAL_PAIRS.filter((b)=>t.includes(b.tag.replace(/_/g, " ")) || t.includes(b.tag));
            const chosen = pick.length ? pick : [
                MINIMAL_PAIRS[Math.floor(Math.random() * MINIMAL_PAIRS.length)]
            ];
            steps.push({
                label: "Pronunciation lab",
                detail: chosen.map((b)=>b.tag).join(", ")
            });
            const lines = chosen.flatMap((b, i)=>[
                    `${i + 1}. ${b.tag.replace(/_/g, " ")}:`,
                    ...b.pairs.map(([a, c])=>`   - ${a}  vs  ${c}`),
                    `   Tip: ${b.tip}`
                ]);
            return {
                skill: "minimal-pairs",
                reply: `Say each pair aloud 3 times, exaggerating the contrast, then take them into the Speaking view and let the grader hear them.\n\n${lines.join("\n")}\n\nWant a specific sound next? Ask for "th sounds", "w vs v", "clusters", "ng" or "stress".`,
                corrections: [],
                fa_note: chosen.map((b)=>b.fa).join(" "),
                steps
            };
        }
    },
    {
        id: "summarize",
        name: "Summary check",
        oneLiner: "Scores your summary of any text for fidelity and language",
        commands: [
            "summarize"
        ],
        triggers: [
            /^(check|grade|review) my (summary|summaries)/i,
            /\bmy summary\b/i,
            /^(here('s| is) )?my summary/i,
            /summar(ize|ise) check/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const text = ctx.text.replace(/^(check|grade|review) my (summary|summaries)[:,-]?\s*/i, "").trim();
            if (text.length < 20) {
                return {
                    skill: "summarize",
                    reply: "Paste the summary (and, if you can, the original text after 'original:'). I score how faithfully it captures the source and how clean the English is - misses feed the mistake memory like everything else.",
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            const original = text.match(/\boriginal:\s*([\s\S]+)/i)?.[1]?.trim() ?? "";
            const summary = original ? text.slice(0, text.toLowerCase().indexOf("original:")).trim() : text;
            steps.push({
                label: "Reading your summary",
                detail: `${summary.split(/\s+/).length} words${original ? ", original provided" : ""}`
            });
            const out = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are the summary examiner inside Rah for a Farsi speaker around ${ctx.profile.level}.
${original ? `ORIGINAL TEXT:\n${original.slice(0, 1200)}\n\n` : "No original provided - judge language quality and coherence only.\n"}LEARNER'S SUMMARY:\n${summary.slice(0, 1200)}

reply: max 110 words. ${original ? "How faithful is the summary (anything missed, anything distorted), then language verdict. " : "Language and coherence verdict. "}End with ONE concrete upgrade to try.
corrections: up to 3 real errors, each {"wrong", "right", "fa" (Farsi why), "trap" (one of: statives, articles, countability, plurals, copula, prepositions, perfect, question_order, adjectives, that_omission, word_choice, register)}.
Output ONE JSON object, no em dash.`, [
                {
                    role: "user",
                    content: text.slice(0, 2000)
                }
            ], ()=>({}), {
                deep: false,
                temperature: 0.4
            });
            return {
                skill: "summarize",
                reply: String(out.reply ?? "").trim() || "Tell me more about the summary and I will grade it properly.",
                corrections: (Array.isArray(out.corrections) ? out.corrections : []).slice(0, 3).map((c)=>({
                        wrong: String(c.wrong ?? ""),
                        right: String(c.right ?? ""),
                        fa: String(c.fa ?? ""),
                        trap: String(c.trap ?? "word_choice")
                    })),
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "exit-mode",
        name: "End mode",
        oneLiner: "Leave roleplay, debate, socratic or the daily challenge",
        commands: [
            "end",
            "exit",
            "stop"
        ],
        triggers: [],
        run: async (ctx)=>{
            const steps = [];
            const learner = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.findUnique({
                where: {
                    id: "me"
                }
            });
            if (learner && learner.mode !== "coach") {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$mode$2d$flow$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["clearMode"])("slash exit");
                return {
                    skill: "exit-mode",
                    reply: "Mode closed. Back in coach mode - what next?",
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            return {
                skill: "exit-mode",
                reply: "No active mode right now. Start one: /roleplay, /debate, /socratic or /daily.",
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "generate-exam",
        name: "Exam builder",
        oneLiner: "A full checkpoint exam, graded with mercy for synonyms",
        commands: [
            "exam",
            "test",
            "quiz-full"
        ],
        triggers: [
            /\b(exam|test|checkpoint|mock)\b/i,
            /generate (an? )?(exam|test)/i,
            /test (me|myself)/i,
            /quiz me/i,
            /assess.*exam/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Reading your profile",
                detail: `level ${ctx.profile.level}, leaks: ${ctx.profile.weakSkills.join(", ") || "none flagged"}`
            });
            const countMatch = ctx.text.match(/(\d{1,2})\s*(questions?|items?|q\b)/i) ?? ctx.args.match(/(\d{1,2})/);
            const count = countMatch ? parseInt(countMatch[1], 10) : 10;
            // Skill words, tolerant of spelling ("grammer" is a real user spelling)
            // and of NEGATION: "vocab only no grammar" must exclude grammar, not
            // include it just because the word appeared. Negated mentions are
            // stripped before matching and collected into an exclusion set.
            const SKILL_WORD = /\b(?:collocation|gram\w*|vocab\w*|writing|reading|listening|phrasal)/gi;
            const NEGATION = /\b(?:anything\s+but|no|not|without|zero|except(?:\s+for)?|other\s+than|aside\s+from|excluding)\s+(?:(?:about|on|for|of|the|a|any)\s+)?(?:collocation|gram\w*|vocab\w*|writing|reading|listening|phrasal)\w*/gi;
            const normalizeSkill = (s)=>s.toLowerCase().replace(/vocab\w*/, "vocabulary").replace(/gram\w*/, "grammar").replace(/phrasal/, "vocabulary");
            const excluded = new Set();
            for (const m of ctx.text.matchAll(NEGATION)){
                const hit = m[0].match(SKILL_WORD);
                if (hit) excluded.add(normalizeSkill(hit[0]));
            }
            const positiveText = ctx.text.replace(NEGATION, " ");
            const skillMatch = [
                ...positiveText.matchAll(SKILL_WORD)
            ].map((m)=>m[0]);
            const targetSkills = (skillMatch.length ? [
                ...new Set(skillMatch.map(normalizeSkill))
            ] : [
                "collocation",
                "grammar",
                "vocabulary"
            ]).filter((s)=>!excluded.has(s));
            const { client, spec } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateExam"])(ctx.profile, targetSkills, count, (l, d)=>steps.push({
                    label: l,
                    detail: d
                }));
            return {
                skill: "generate-exam",
                reply: `${client.title}: ${client.count} questions, about ${spec.minutes} minutes. Answer everything you can; blank answers count against the total, and near-miss wordings still score. Submit when done and I will break it down by skill.`,
                corrections: [],
                fa_note: "",
                steps,
                exam: client
            };
        }
    },
    {
        id: "assess-level",
        name: "Level probe",
        oneLiner: "Quick probe that updates grammar, vocab and reading bands",
        commands: [
            "assess",
            "probe",
            "level"
        ],
        triggers: [
            /\bassess\b/i,
            /(what|whats|what is) my level/i,
            /my (english )?level\?*$/i,
            /level check/i,
            /recheck my level/i,
            /how (good|bad) is my english/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Designing the probe",
                detail: "grammar, vocabulary, reading, 8 items"
            });
            const { client, spec } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$exam$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateExam"])(ctx.profile, [
                "grammar",
                "vocabulary",
                "reading"
            ], 8, (l, d)=>steps.push({
                    label: l,
                    detail: d
                }));
            return {
                skill: "assess-level",
                reply: `Short probe: ${client.count} items, about ${spec.minutes} minutes. It measures grammar, vocabulary and reading separately, then updates the band for each. No filler, no practice round: start when ready.`,
                corrections: [],
                fa_note: "",
                steps,
                exam: client
            };
        }
    },
    {
        id: "mistakes",
        name: "Mistake memory",
        oneLiner: "Your recurring mistakes, counted, with live evidence",
        commands: [
            "mistakes"
        ],
        triggers: [
            /\b(recurring )?mistakes?\b/i,
            /what do i keep (getting )?wrong/i,
            /\bmy (weak|leak\w*) (points|spots|families)\b/i,
            /\berror (families|patterns)\b/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Mining corrections",
                detail: "chat turns, essays, speaking rounds"
            });
            const families = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mistakes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["topMistakes"])(8);
            if (families.length === 0) {
                return {
                    skill: "mistakes",
                    reply: "No recurring mistakes on file yet. The memory builds itself as I correct your chat messages, essays and speaking rounds, so keep producing: within a few sessions the persistent patterns surface here with counts and evidence.",
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            const active = families.filter((f)=>!f.resolvedAt);
            const healed = families.filter((f)=>f.resolvedAt);
            const lines = active.map((f, i)=>`${i + 1}. ${f.label} - seen ${f.count}x in your ${f.kind}${f.streakClean > 0 ? ` (${f.streakClean}/2 clean hits in exams)` : ""}. Latest: "${f.evidence}"`);
            const healedLines = healed.map((f)=>`- ${f.label} - fixed, retired after 2 clean exam hits`);
            const top = active[0] ?? families[0];
            const loop = active.length ? `\n\nThis is the memory the tutor and the examiner both aim with. Exams now build items that hunt these exact weak spots; answer two of them correctly and I retire the family for good. Say "focus on ${top.tag}" to drill the worst one, or "generate a 6 question grammar only exam" to test it under pressure.` : `\n\nEvery active family is healed right now: two clean exam hits each retired them. They reopen automatically if the mistake shows up in your English again.`;
            return {
                skill: "mistakes",
                reply: `${active.length ? `Your leaks, most persistent first:\n${lines.join("\n")}` : ""}${healed.length ? `\n${active.length ? "\n" : ""}Healed and retired:\n${healedLines.join("\n")}` : ""}${loop}`,
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "deep-analysis",
        name: "Deep analysis",
        oneLiner: "30 seconds of real work over your whole history",
        commands: [
            "deep",
            "analyze",
            "analyse"
        ],
        triggers: [
            /deep\s*(analysis|analyse|analyze)/i,
            /analy[sz]e my (english|level|progress|weakness)/i,
            /(thorough|full|complete) analysis/i,
            /how am i doing( really| actually)?/i
        ],
        run: async (ctx)=>{
            const t0 = Date.now();
            const steps = [];
            // The user asked for a coach that visibly works ~30 seconds on analysis,
            // not a 7-second token stream. Every pass below does real work; the
            // minimum window at the end guarantees the promised depth of attention.
            const MIN_ANALYSIS_MS = 25000;
            // 1. Evidence gathering: everything the app has measured.
            steps.push({
                label: "Collecting evidence",
                detail: "reviews, lapses, writing, speaking, chats"
            });
            const [reviewCount, lapseRows, writes, speaks, corrections, quizItems, levels] = await Promise.all([
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].reviewLog.count(),
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].reviewLog.findMany({
                    where: {
                        grade: 1
                    },
                    orderBy: {
                        id: "desc"
                    },
                    take: 20
                }),
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].writingSub.findMany({
                    orderBy: {
                        id: "desc"
                    },
                    take: 3
                }),
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].speakSession.findMany({
                    orderBy: {
                        id: "desc"
                    },
                    take: 3
                }),
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].chatMsg.findMany({
                    where: {
                        role: "coach"
                    },
                    orderBy: {
                        id: "desc"
                    },
                    take: 25
                }),
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].quizItem.count(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkillLevels"])()
            ]);
            const trapCards = lapseRows.length;
            steps.push({
                label: "Evidence in hand",
                detail: `${reviewCount} reviews, ${trapCards} recent lapses, ${writes.length} essays, ${speaks.length} speaking runs, ${corrections.length} coach turns`
            });
            const parseCorrections = (c)=>{
                try {
                    const p = JSON.parse(c.content);
                    return (p.corrections ?? []).map((x)=>`${x.wrong} -> ${x.right} (${x.trap})`);
                } catch  {
                    return [];
                }
            };
            // 2. Domain pass A: production errors from chat and reviews.
            steps.push({
                label: "Pass 1: spoken and typed errors",
                detail: "chat corrections, review lapses, extended reasoning"
            });
            const prodEvidence = JSON.stringify({
                profile: ctx.profile,
                recentLapses: lapseRows.map((r)=>r.cardId),
                recentCorrections: corrections.flatMap(parseCorrections).slice(0, 15)
            });
            const prod = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are the diagnostic engine inside Rah, an English app for Farsi speakers. Mine these PRODUCTION errors (chat corrections, review lapses). Find repeating error families and cite one concrete example per family. Output ONE JSON object: {"patterns": ["max 5 concrete findings"]}. No em dashes.`, [
                {
                    role: "user",
                    content: prodEvidence.slice(0, 5000)
                }
            ], ()=>({
                    patterns: []
                }), {
                deep: true
            });
            // 3. Domain pass B: composed language from essays and speaking.
            steps.push({
                label: "Pass 2: essays and speaking",
                detail: "range, cohesion, Farsi transfer at text level"
            });
            const compEvidence = JSON.stringify({
                writingSamples: writes.map((w)=>w.text.slice(0, 400)),
                speakingTranscripts: speaks.map((s)=>s.transcript.slice(0, 400)),
                measuredLevels: levels.filter((l)=>l.samples > 0)
            });
            const comp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are the diagnostic engine inside Rah. Mine these COMPOSED texts (essays, speaking transcripts) from a Farsi speaker. Judge range, cohesion, register, and Farsi transfer at TEXT level; ignore ASR noise in transcripts. Cite one concrete example per finding. Output ONE JSON object: {"patterns": ["max 5 concrete findings"]}. No em dashes.`, [
                {
                    role: "user",
                    content: compEvidence.slice(0, 5000)
                }
            ], ()=>({
                    patterns: []
                }), {
                deep: true
            });
            const patterns = [
                ...prod.patterns,
                ...comp.patterns
            ].slice(0, 8);
            steps.push({
                label: "Patterns mined",
                detail: `${patterns.length} findings across both domains`
            });
            // 4. Synthesis: bands, priorities, plan.
            steps.push({
                label: "Pass 3: synthesis",
                detail: "bands, priorities, seven-day plan"
            });
            const synth = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are Rah's head coach. Using ONLY these mined patterns and measured levels, write the learner's state of the union. bands: estimate mastery 0..1 ONLY for skills the evidence actually touches; omit any skill you have no evidence for; NEVER output 0 for an untouched skill. priorities: max 3, ordered. plan: exactly 5 day-steps, each one actionable line with a number in it.
Output ONE JSON object: {"summary": "max 70 words, direct, second person", "bands": [{"skill": "grammar", "score": 0.0}], "priorities": ["..."], "plan": ["Day 1: ...", ...]}. No em dashes. No Farsi.`, [
                {
                    role: "user",
                    content: `Patterns: ${JSON.stringify(patterns)}\nMeasured levels: ${JSON.stringify(levels.filter((l)=>l.samples > 0))}\nLearner profile: ${JSON.stringify(ctx.profile)}`
                }
            ], ()=>({
                    summary: "Analysis complete.",
                    bands: [],
                    priorities: [],
                    plan: []
                }), {
                deep: true
            });
            steps.push({
                label: "Pass 4: verification",
                detail: "checking the plan against the evidence"
            });
            const check = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are Rah's quality gate. Given the coach's plan and the mined patterns, reject any plan line that is not backed by a pattern or a measured weakness, tighten vague lines, and keep exactly 5. Same for priorities (max 3). Output ONE JSON object: {"plan": ["Day 1: ...", ...], "priorities": ["..."]}. No em dashes. No Farsi.`, [
                {
                    role: "user",
                    content: `Patterns: ${JSON.stringify(patterns)}\nPlan: ${JSON.stringify(synth.plan)}\nPriorities: ${JSON.stringify(synth.priorities)}`
                }
            ], ()=>({
                    plan: synth.plan,
                    priorities: synth.priorities
                }), {
                deep: true
            });
            steps.push({
                label: "Pass 5: the coaching note",
                detail: "what would move each band fastest"
            });
            const note = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`You are Rah's head coach writing a 3-sentence personal note to a Farsi speaker after a deep review. Reference their strongest and weakest band by name and name the ONE habit that would move the weakest fastest. Output ONE JSON object: {"note": "max 60 words, direct, warm, second person"}. No em dashes. No Farsi.`, [
                {
                    role: "user",
                    content: `Patterns: ${JSON.stringify(patterns)}\nMeasured: ${JSON.stringify(levels.filter((l)=>l.samples > 0))}\nSynthesis: ${synth.summary}`
                }
            ], ()=>({
                    note: ""
                }), {
                deep: true
            });
            // Only skills the synthesis actually scored move the bands: a 0 for an
            // untouched skill must never drag a measured band down.
            const evidenceBands = synth.bands.filter((b)=>b.score > 0.02);
            steps.push({
                label: "Updating your bands",
                detail: `${evidenceBands.length} skills touched`
            });
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateSkillLevels"])(evidenceBands.map((b)=>({
                    skill: b.skill,
                    score: Math.min(1, Math.max(0, b.score)),
                    samples: 4
                })));
            const assessment = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildAssessment"])(note.note || (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["spreadLine"])(levels));
            steps.push({
                label: "Compiling report",
                detail: "assembling bands, priorities, plan"
            });
            // Minimum working window: multi-pass depth the learner can feel. Real
            // work happens above; this only guarantees the promised attention span.
            const elapsed = Date.now() - t0;
            if (elapsed < MIN_ANALYSIS_MS) {
                await new Promise((r)=>setTimeout(r, MIN_ANALYSIS_MS - elapsed));
            }
            steps.push({
                label: "Done",
                detail: `${Math.round((Date.now() - t0) / 1000)}s of analysis`
            });
            const planLines = check.plan.slice(0, 5).map((p, i)=>`${i + 1}. ${p}`).join("\n");
            const prioLines = check.priorities.slice(0, 3).map((p, i)=>`${i + 1}. ${p}`).join("\n");
            return {
                skill: "deep-analysis",
                reply: `${synth.summary}\n\nPriorities:\n${prioLines}\n\nSeven-day plan:\n${planLines}`.slice(0, 1400),
                corrections: [],
                fa_note: "",
                steps,
                assessment
            };
        }
    },
    {
        id: "skill-report",
        name: "Skill report",
        oneLiner: "Per-skill bands: grammar vs vocab vs the rest",
        commands: [
            "report",
            "bands"
        ],
        triggers: [
            /(skill|progress) report/i,
            /\bbands?\b/i,
            /my (strong|weak) (skill|spot)/i,
            /skill levels/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Reading measured bands",
                detail: "grammar, vocabulary, writing, speaking, reading, listening"
            });
            const levels = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkillLevels"])();
            const assessment = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildAssessment"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$levels$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["spreadLine"])(levels));
            const measured = levels.filter((l)=>l.samples > 0);
            const lines = measured.length ? measured.map((l)=>`- ${l.skill}: ${l.level} (${Math.round(l.score * 100)}% mastery)`).join("\n") : "Nothing measured yet. Run /assess for the quick probe or /deep for the full analysis.";
            steps.push({
                label: "Report ready",
                detail: `${measured.length} skills measured`
            });
            return {
                skill: "skill-report",
                reply: measured.length ? `Overall band: ${assessment.overall}.\n${lines}\n\n${assessment.note}` : `Overall band: not yet measurable.\n${lines}`,
                corrections: [],
                fa_note: "",
                steps,
                assessment
            };
        }
    },
    {
        id: "study-plan",
        name: "Study plan",
        oneLiner: "Five days, aimed at your leaks",
        commands: [
            "plan"
        ],
        triggers: [
            /study plan/i,
            /(daily|weekly|7[- ]day|five[- ]day) plan/i,
            /what should i (do|study|practice)( tomorrow| next| today)/i,
            /plan for (this|next) week/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Weighing your leaks",
                detail: `weak: ${ctx.profile.weakSkills.join(", ") || "balanced"}`
            });
            const out = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(`${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$util$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["basePersona"])(ctx.profile)}

You are building a five-day plan, one line per day, each line a concrete task with a number in it (items, minutes, words). Aim every day at the learner's weak skills and traps. Output ONE JSON object: {"plan": ["Day 1: ...", ...]} with exactly 5 entries. No em dashes. No Farsi.`, [
                {
                    role: "user",
                    content: `Build the plan. Profile: ${JSON.stringify(ctx.profile)}`
                }
            ], ()=>({
                    plan: []
                }));
            steps.push({
                label: "Plan ready",
                detail: `${out.plan.length} days`
            });
            const plan = out.plan.length ? out.plan.map((p, i)=>`${i + 1}. ${p}`).join("\n") : "Review 10 due cards, write 80 words about your day, and ask me for a collocation drill.";
            return {
                skill: "study-plan",
                reply: `Five days, aimed at your leaks:\n${plan}`.slice(0, 1000),
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "exam-history",
        name: "Exam history",
        oneLiner: "Past exams and scores",
        commands: [
            "history"
        ],
        triggers: [
            /(exam|test) (history|results?|scores?)/i,
            /past (exams|tests)/i,
            /how did i do on (the|my) (last|previous)/i
        ],
        run: async (ctx)=>{
            const steps = [];
            steps.push({
                label: "Loading graded exams",
                detail: "newest first"
            });
            const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].exam.findMany({
                orderBy: {
                    createdAt: "desc"
                },
                take: 5
            });
            const graded = rows.filter((r)=>r.status === "graded" && r.result);
            steps.push({
                label: "Found",
                detail: `${graded.length} graded of ${rows.length}`
            });
            const lines = graded.map((r)=>{
                const res = JSON.parse(r.result);
                return `- ${r.title}: ${res.correct}/${res.total} (${res.pct}%)`;
            });
            const pending = rows.filter((r)=>r.status === "pending");
            return {
                skill: "exam-history",
                reply: graded.length ? `Last exams:\n${lines.join("\n")}${pending.length ? `\n\nOne exam is still open: ${pending[0].title}. Say "open my exam" and I will bring it back.` : ""}` : pending.length ? `No graded exams yet, but "${pending[0].title}" is still open. Finish and submit it.` : "No exams on record yet. Say the word and I will build one.",
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "theme-control",
        name: "Theme plugin",
        oneLiner: "Repaint the app on command",
        commands: [
            "theme",
            "color",
            "color-scheme"
        ],
        triggers: [
            /\btheme\b/i,
            /colou?r (scheme|of the app|palette)/i,
            /change (the )?colou?rs?/i,
            /(make|turn) (it|the app) (blue|green|dark|purple|orange|pink|red|violet)/i,
            /dark mode/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const req = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$theme$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseThemeRequest"])(ctx.args || ctx.text);
            if (req.preset || req.tokens) {
                const preset = req.preset ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$theme$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["presetById"])(req.preset) : undefined;
                const tokens = req.tokens ?? preset.tokens;
                steps.push({
                    label: "Applying theme plugin",
                    detail: preset ? preset.name : "custom tokens"
                });
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
                    where: {
                        id: "me"
                    },
                    data: {
                        theme: JSON.stringify(tokens)
                    }
                });
                return {
                    skill: "theme-control",
                    reply: preset ? `Repainted: ${preset.name}. The whole app shifts now, and it stays after reload. Say "theme midnight" to go back.` : "Custom tokens applied. Every surface and accent you gave me is live, and it stays after reload.",
                    corrections: [],
                    fa_note: "",
                    steps,
                    actions: [
                        {
                            type: "theme",
                            tokens,
                            preset: req.preset
                        }
                    ]
                };
            }
            steps.push({
                label: "Theme plugin",
                detail: "listing presets"
            });
            return {
                skill: "theme-control",
                reply: `I can repaint the whole app. Presets: ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$theme$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PRESETS"].map((p)=>p.id).join(", ")}. Or hand me hex codes. Try: /theme ocean`,
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "navigate",
        name: "Navigation plugin",
        oneLiner: "Opens any view for you",
        commands: [
            "go",
            "open"
        ],
        triggers: [
            /^(take|send) me to/i,
            /^(open|go to|show) (the )?(home|review|coach|chat|writ(e|ing)|speak(ing)?|listen(ing)?|read(ing)?|placement|progress)\b/i,
            /navigate to/i
        ],
        run: async (ctx)=>{
            const steps = [];
            for (const [view, re] of Object.entries(VIEW_WORDS)){
                if (re.test(ctx.text)) {
                    steps.push({
                        label: "Navigation plugin",
                        detail: `opening ${view}`
                    });
                    return {
                        skill: "navigate",
                        reply: view === "review" ? `Opening Review. ${ctx.profile.due} cards are waiting.` : `Opening ${view}.`,
                        corrections: [],
                        fa_note: "",
                        steps,
                        actions: [
                            {
                                type: "navigate",
                                view
                            }
                        ]
                    };
                }
            }
            return {
                skill: "navigate",
                reply: "Which view? home, review, write, speak, listen, read, placement, progress. Name it and I will take you there.",
                corrections: [],
                fa_note: "",
                steps
            };
        }
    },
    {
        id: "focus-skill",
        name: "Focus plugin",
        oneLiner: "Points the whole app at one skill",
        commands: [
            "focus"
        ],
        triggers: [
            /^focus on/i,
            /set (my )?focus/i,
            /(work on|practice) (my )?(collocation|grammar|vocabular\w*|writing|speaking|listening|reading|pronunciation)/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const m = ctx.text.match(/(collocation|grammar|vocabular\w*|writing|speaking|listening|reading|pronunciation)/i);
            if (!m) {
                return {
                    skill: "focus-skill",
                    reply: "Focus can be: collocation, grammar, vocabulary, writing, speaking, listening, reading, pronunciation. Name one.",
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            const skill = m[1].toLowerCase().replace(/vocabular.*/, "vocabulary");
            steps.push({
                label: "Focus plugin",
                detail: `aiming everything at ${skill}`
            });
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
                where: {
                    id: "me"
                },
                data: {
                    focusSkill: skill
                }
            });
            return {
                skill: "focus-skill",
                reply: `Done. Everything now aims at ${skill}: reviews surface it, my drills pull toward it, exams weight it. Say "focus off" anytime.`,
                corrections: [],
                fa_note: "",
                steps,
                actions: [
                    {
                        type: "focus",
                        skill
                    }
                ]
            };
        }
    },
    {
        id: "settings",
        name: "Settings plugin",
        oneLiner: "Daily goal and new-card pace",
        commands: [
            "set"
        ],
        triggers: [
            /set (my )?(daily )?goal/i,
            /(\d+) (new )?cards (a|per) day/i,
            /change (my )?daily goal/i
        ],
        run: async (ctx)=>{
            const steps = [];
            const goal = ctx.text.match(/goal (to |of )?(\d{1,3})/i);
            const cards = ctx.text.match(/(\d{1,2}) (new )?cards (a|per) day/i);
            if (goal) {
                const v = Math.max(5, Math.min(200, parseInt(goal[2], 10)));
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
                    where: {
                        id: "me"
                    },
                    data: {
                        dailyGoal: v
                    }
                });
                steps.push({
                    label: "Settings plugin",
                    detail: `daily goal ${v}`
                });
                return {
                    skill: "settings",
                    reply: `Daily goal: ${v}. The ring on Home now counts to it.`,
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            if (cards) {
                const v = Math.max(3, Math.min(50, parseInt(cards[1], 10)));
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].learner.update({
                    where: {
                        id: "me"
                    },
                    data: {
                        newPerDay: v
                    }
                });
                steps.push({
                    label: "Settings plugin",
                    detail: `${v} new cards per day`
                });
                return {
                    skill: "settings",
                    reply: `${v} new cards per day. The queue refills at that pace from now on.`,
                    corrections: [],
                    fa_note: "",
                    steps
                };
            }
            return {
                skill: "settings",
                reply: "I can set your daily goal ('set goal 40') or the new-card pace ('15 cards a day').",
                corrections: [],
                fa_note: "",
                steps
            };
        }
    }
];
}),
"[project]/src/lib/agent/registry.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// The revived registry. 22 live skills; the planner routes into this table.
__turbopack_context__.s([
    "REGISTRY",
    ()=>REGISTRY,
    "commandMap",
    ()=>commandMap,
    "getSkill",
    ()=>getSkill,
    "hasSkill",
    ()=>hasSkill,
    "skillCatalog",
    ()=>skillCatalog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$core$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/skills-core.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$power$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/skills-power.ts [app-route] (ecmascript)");
;
;
const REGISTRY = [
    ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$power$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["POWER_SKILLS"],
    ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$skills$2d$core$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CORE_SKILLS"]
];
function getSkill(id) {
    return REGISTRY.find((s)=>s.id === id);
}
function hasSkill(id) {
    return REGISTRY.some((s)=>s.id === id);
}
function skillCatalog() {
    return REGISTRY.map((s)=>`- ${s.id}: ${s.name} (${s.oneLiner})`).join("\n");
}
function commandMap() {
    const m = new Map();
    for (const s of REGISTRY)for (const c of s.commands)m.set(c, s);
    return m;
}
}),
"[project]/src/lib/agent/planner.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseSlash",
    ()=>parseSlash,
    "routeByCommand",
    ()=>routeByCommand,
    "routeByPlanner",
    ()=>routeByPlanner,
    "routeByTrigger",
    ()=>routeByTrigger
]);
// Routing: slash commands first (deterministic), trigger table second, and
// only when both miss does the LLM planner pick a skill. The planner sees the
// catalog and returns an id; anything invalid falls back to chat.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ai.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/registry.ts [app-route] (ecmascript)");
;
;
function parseSlash(text) {
    const m = text.match(/^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]+))?$/i);
    if (!m) return null;
    return {
        cmd: m[1].toLowerCase(),
        args: (m[2] ?? "").trim()
    };
}
function routeByCommand(cmd, args) {
    const def = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["commandMap"])().get(cmd);
    return def ? {
        def,
        args,
        via: "slash"
    } : null;
}
function routeByTrigger(text) {
    const t = text.toLowerCase();
    for (const def of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGISTRY"]){
        for (const re of def.triggers){
            if (re.test(t)) {
                // Trigger captures the remainder as args when the skill wants them.
                return {
                    def,
                    args: text,
                    via: "trigger"
                };
            }
        }
    }
    return null;
}
const PLANNER_SYSTEM = `You route messages inside an English-learning app. Pick the ONE best skill id for the message.

Skills:
${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["skillCatalog"])()}

Rules: "chat" is the default for conversation, questions, and anything no other skill covers. Prefer a specific skill when the message clearly asks for its capability. Output ONE JSON object, nothing else: {"skill": "id", "args": "anything the skill should know, or empty string"}. No em dashes.`;
async function routeByPlanner(text, history) {
    try {
        const out = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ai$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["aiJson"])(PLANNER_SYSTEM, [
            ...history.slice(-4).map((h)=>({
                    role: h.role === "user" ? "user" : "assistant",
                    content: h.content.slice(0, 300)
                })),
            {
                role: "user",
                content: text
            }
        ], ()=>({}));
        const id = String(out.skill ?? "").trim();
        const def = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkill"])(id);
        if (def) return {
            def,
            args: String(out.args ?? ""),
            via: "planner"
        };
    } catch  {
    // planner offline: chat always answers
    }
    return {
        def: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkill"])("chat"),
        args: "",
        via: "planner"
    };
}
}),
"[project]/src/lib/agent/verify.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// The verifier. Every envelope passes through here before the learner sees
// it. It kills the failure modes the learner actually hit: Farsi leaking into
// English lines, AI-sign phrases, refusal text where an exam should be, and
// count drift between announced and graded items.
__turbopack_context__.s([
    "verifyEnvelope",
    ()=>verifyEnvelope
]);
const PERSIAN = /[\u0600-\u06FF\u0750-\u077F]/;
const BANNED = [
    [
        /as an ai\b[^.]*\.?/gi,
        ""
    ],
    [
        /as a language model[^.]*\.?/gi,
        ""
    ],
    [
        /i(?:'m| am) (?:an|just a) (?:ai|language model|bot)[^.]*\.?/gi,
        ""
    ],
    [
        /i (?:cannot|can't|can not) (?:create|generate|make|build|produce) (?:exams?|tests?|quizzes?)[^.]*\.?/gi,
        ""
    ],
    [
        /i (?:cannot|can't|can not) (?:do|make) that[^.]*\.?/gi,
        ""
    ],
    [
        /i(?:'m| am) sorry,? (?:but )?i (?:cannot|can't)[^.]*\.?/gi,
        ""
    ],
    [
        /certainly!?|of course!?/gi,
        ""
    ]
];
function sanitizeReply(s) {
    let out = s;
    for (const [re, sub] of BANNED)out = out.replace(re, sub);
    // Farsi inside the English field is a hard failure: split it out.
    if (PERSIAN.test(out)) {
        out = out.split(/(?<=[.!?\u061F])\s+/).filter((seg)=>!PERSIAN.test(seg)).join(" ");
    }
    return out.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function verifyEnvelope(env) {
    const out = {
        ...env
    };
    // Reply: English only, no AI-sign leakage, sane length.
    out.reply = sanitizeReply(String(out.reply ?? ""));
    if (out.reply.length > 1600) out.reply = out.reply.slice(0, 1570).replace(/\s\S*$/, "") + " ...";
    // Farsi tail only when corrections exist (or the skill legitimately explains).
    const explainers = new Set([
        "correct",
        "translate",
        "chat",
        "explain",
        "minimal-pairs",
        "coach-report",
        "summarize",
        "daily-challenge",
        "socratic",
        "roleplay",
        "debate"
    ]);
    if ((out.corrections?.length ?? 0) === 0 && !explainers.has(out.skill)) out.fa_note = "";
    // Exam consistency: announced count IS graded count, always.
    if (out.exam) out.exam.count = out.exam.items.length;
    // Steps: never empty, so the agent trace is always visible.
    if (!out.steps || out.steps.length === 0) out.steps = [
        {
            label: "Coach turn"
        }
    ];
    // Never hand back a bare envelope.
    if (!out.reply) out.reply = "Say that again? I lost the thread for a second.";
    return out;
}
}),
"[project]/src/lib/agent/run.ts [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// The agent loop. Route -> skill -> verify. One entry point: runCoach().
// The coach is never unreachable: every failure path still returns an
// envelope, and every envelope the learner sees has passed verification.
__turbopack_context__.s([
    "runCoach",
    ()=>runCoach
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$planner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/planner.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/registry.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$verify$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/verify.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$mode$2d$flow$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/mode-flow.ts [app-route] (ecmascript)");
;
;
;
;
;
;
function helpEnvelope() {
    const lines = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGISTRY"].map((s)=>`${s.commands.map((c)=>`/${c}`).join(" ")} ${s.name.toLowerCase()}: ${s.oneLiner}`);
    return {
        skill: "chat",
        reply: `Every skill, live right now:\n${lines.join("\n")}\n\nSlash commands route instantly. Plain English works too: I hear what you need and pick.`,
        corrections: [],
        fa_note: "",
        steps: [
            {
                label: "Skills directory",
                detail: `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGISTRY"].length} skills live`
            }
        ]
    };
}
function errorEnvelope(msg) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$verify$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifyEnvelope"])({
        skill: "chat",
        reply: msg,
        corrections: [],
        fa_note: "",
        steps: [
            {
                label: "Recovering",
                detail: "the turn failed; you still get an answer"
            }
        ]
    });
}
async function runCoach(text, history, profile) {
    const p = profile ?? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildProfile"])();
    const steps = [];
    const emit = (label, detail)=>steps.push(detail ? {
            label,
            detail
        } : {
            label
        });
    const slash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$planner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseSlash"])(text);
    if (slash) {
        if (slash.cmd === "skills" || slash.cmd === "help" || slash.cmd === "commands") {
            emit("Skills directory", `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGISTRY"].length} skills live`);
            return {
                ...helpEnvelope(),
                steps
            };
        }
        const routed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$planner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["routeByCommand"])(slash.cmd, slash.args);
        if (routed) {
            emit("Slash command", `/${routed.def.commands[0]} -> ${routed.def.name}`);
            const ctx = {
                text: slash.args || text,
                args: slash.args,
                profile: p,
                history,
                emit
            };
            try {
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$verify$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifyEnvelope"])(await routed.def.run(ctx));
            } catch (e) {
                return errorEnvelope(`That skill hit a snag (${e.message}). Try once more; the route is already warm.`);
            }
        }
        emit("Unknown command", `/${slash.cmd}`);
        return {
            ...helpEnvelope(),
            reply: `No skill answers to /${slash.cmd}. Here is what does:\n${helpEnvelope().reply}`,
            steps
        };
    }
    // Deterministic triggers first: zero latency, zero misroutes.
    // But an active conversation mode (roleplay, debate, socratic, daily)
    // IS the turn: it intercepts before skill routing and exits cleanly on
    // "end". Slash commands still win, so /skills works mid-scene.
    const modeTurn = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$mode$2d$flow$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runModeFlow"])(text, history, p, emit).catch(()=>null);
    if (modeTurn) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$verify$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifyEnvelope"])(modeTurn);
    const triggered = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$planner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["routeByTrigger"])(text);
    const decision = triggered ?? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$planner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["routeByPlanner"])(text, history);
    if (decision.via === "planner") emit("Planner", `picked ${decision.def.name}`);
    else emit("Routed", decision.def.name);
    const ctx = {
        text,
        args: decision.args,
        profile: p,
        history,
        emit
    };
    try {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$verify$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifyEnvelope"])(await decision.def.run(ctx));
    } catch (e) {
        return errorEnvelope(`The ${decision.def.name.toLowerCase()} stalled (${e.message}). One more try usually lands it.`);
    }
}
}),
"[project]/src/lib/agent/run.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "REGISTRY",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGISTRY"],
    "getSkill",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkill"],
    "runCoach",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$run$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["runCoach"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$run$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/agent/run.ts [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent/registry.ts [app-route] (ecmascript)");
}),
];

//# sourceMappingURL=src_lib_27b248f1._.js.map