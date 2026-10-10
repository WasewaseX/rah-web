// Drill engine: short interactive practice sets with instant feedback.
// The LLM writes the items; a static fallback bank guarantees a drill always
// exists even when the model misbehaves. Answers ship with the payload so the
// client grades locally (instant, zero latency) and reports the outcome back.

import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import type { Drill, DrillItem } from "./types";
import { fuzzyMatch } from "./grading";

export const DRILL_SIZE = 6;

const TOPIC_BRIEFS: Record<string, string> = {
  auto: "Target the learner's weakest spot from their profile (weakSkills and recentTraps). Name it in the title.",
  vocab: "Mid-frequency B2/C1 words worth keeping forever (avoid rare jargon). Focus on precise verb and adjective choices, plus 2 items on word formation.",
  collocation: "Verb+noun and adj+noun collocations (make a decision, heavy traffic, meet a deadline). At least 4 cloze items where the learner types the partnering word. No phrasal verbs in this set.",
  synonym: "Near-synonym pairs with a real nuance difference (say/tell, big/significant, lose/miss, historic/historical). Every item must force the nuance, not dictionary definitions.",
  idiom: "5 genuinely useful C1 idioms (natural, current, not archaic) + 1 item reusing the hardest one. MCQs: meaning in context, never 'finish the idiom' trivia.",
  register: "Same message, two registers (formal email vs casual chat). Items: pick the sentence that fits the stated situation, or transform casual to formal. Tag each item's situation clearly.",
  articles: "a/an/the/zero article traps for a Farsi speaker: generic nouns, unique nouns, second mention, institutions (school vs the school). At least 3 cloze items.",
  preposition: "Preposition traps where Persian 'dar' maps wrong: in/on/at time and place, depend on, arrive in/at, good at, interested in. At least 4 cloze items.",
  tense: "Present perfect vs past simple, present simple vs continuous, future forms. Sentences with time markers that decide the tense. At least 3 transform items (rewrite with 'yesterday' / 'already' etc).",
  paraphrase: "One idea, three natural renditions. Items give a sentence and ask to rewrite using a prompt word (use 'despite', rewrite in passive, make it formal). Answers accept several wordings: fill acceptable.",
};

export function drillSystem(topic: string, level: string, p: ProfileJson): string {
  const brief = TOPIC_BRIEFS[topic] ?? TOPIC_BRIEFS.vocab;
  return `You build micro-drills inside Rah, an English app for Farsi speakers targeting ${level}. Topic brief: ${brief}

Profile signals: weak skills ${JSON.stringify(p.weakSkills)}, recent traps ${JSON.stringify(p.recentTraps)}, due cards ${p.due}.

Rules:
- ${DRILL_SIZE} items. Mix: at least 2 mcq (4 choices) and 2 cloze (learner types the missing word; put ___ in the sentence). transform = rewrite task with a prompt like "use 'despite'". short = one-word/short-phrase answer.
- acceptable: for every typed item list 2 to 6 valid alternative wordings or synonyms a competent speaker might produce (e.g. for 'address an issue' also accept 'raise an issue', 'tackle an issue'). Never leave acceptable empty for typed answers unless the answer is a fixed idiom.
- Every item: one-line why (simple English) and one-line fa (Farsi hint that nudges, never gives the answer away).
- Answers must be single words or very short phrases. cloze answers lowercase.
- Difficulty: B2 to C1. No trick questions, no trivia.

Output ONE JSON object, nothing else:
{"title": "short English title", "title_fa": "عنوان کوتاه فارسی", "intro": "one short English line setting the task", "items": [{"type": "mcq", "q": "", "choices": ["", "", "", ""], "answer": "exact correct choice", "why": "", "fa": ""}, {"type": "cloze", "q": "sentence with ___", "answer": "missing word", "why": "", "fa": ""}]}
Never use the em dash character anywhere in your output.`;
}

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[.!?,;:"'`]/g, "").replace(/\s+/g, " ");
}

export function checkDrillItem(item: DrillItem, given: string): boolean {
  const tier = fuzzyMatch(given ?? "", item.answer, item.acceptable ?? []);
  // "near" stays false locally: the item's acceptable list plus typo tolerance
  // already cover legitimate variants; anything else is genuinely off.
  return tier === "exact" || tier === "typo" || tier === "accepted";
}

// Validation + repair: drop broken items, fix mcq choices that miss the answer.
export function validateDrill(d: unknown): Drill | null {
  const raw = d as Partial<Drill>;
  if (!raw || !Array.isArray(raw.items)) return null;
  const items: DrillItem[] = [];
  for (const it of raw.items as DrillItem[]) {
    if (!it || typeof it.q !== "string" || typeof it.answer !== "string" || !it.q.trim() || !it.answer.trim()) continue;
    const item: DrillItem = {
      type: ["mcq", "cloze", "transform", "short"].includes(it.type) ? it.type : "short",
      q: it.q.trim(),
      answer: it.answer.trim(),
      acceptable: Array.isArray(it.acceptable) ? it.acceptable.filter((a) => typeof a === "string").slice(0, 6) : [],
      why: typeof it.why === "string" ? it.why.slice(0, 200) : "",
      fa: typeof it.fa === "string" ? it.fa.slice(0, 200) : "",
    };
    if (item.type === "mcq") {
      const choices = (it.choices ?? []).filter((c) => typeof c === "string" && c.trim()).slice(0, 4);
      if (choices.length >= 3) {
        if (!choices.some((c) => norm(c) === norm(item.answer))) choices[0] = item.answer;
        while (choices.length < 4) choices.push(`${choices.length + 1}.`);
        item.choices = choices;
      } else {
        item.type = "short";
      }
    }
    items.push(item);
  }
  if (items.length < 3) return null;
  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.slice(0, 80) : "Quick drill",
    title_fa: typeof raw.title_fa === "string" && raw.title_fa.trim() ? raw.title_fa.slice(0, 60) : "تمرین سریع",
    intro: typeof raw.intro === "string" ? raw.intro.slice(0, 160) : "",
    items: items.slice(0, DRILL_SIZE + 2),
  };
}

export async function buildDrill(topic: string, level: string, p: ProfileJson): Promise<{ drill: Drill; source: "ai" | "bank" }> {
  try {
    const out = await aiJson<Drill>(
      drillSystem(topic, level, p),
      [{ role: "user", content: `Build the ${topic} drill now. Profile: ${JSON.stringify(p)}.` }],
      undefined,
      { thinking: true, attempts: 3 },
    );
    const drill = validateDrill(out);
    if (drill) return { drill, source: "ai" };
  } catch {
    // fall through to the bank
  }
  return { drill: bankDrill(topic), source: "bank" };
}

// ---------- static fallback bank: drills always exist ----------
const BANK: Record<string, Drill> = {
  collocation: {
    title: "Collocations that carry weight",
    title_fa: "کلمات همراه پرکاربرد",
    intro: "Type the partnering word. Natural English only.",
    items: [
      { type: "cloze", q: "We need to ___ a decision by Friday.", answer: "make", acceptable: ["reach"], why: "'make a decision' is the fixed pair; 'take' is the common trap.", fa: "در انگلیسی decision با make می‌آید نه take یا do." },
      { type: "cloze", q: "The traffic was so ___ that we missed the flight.", answer: "heavy", acceptable: [], why: "Traffic is heavy or light; never 'crowded'.", fa: "برای ترافیک از heavy استفاده می‌شود؛ dense هم در C1 قابل قبول است." },
      { type: "mcq", q: "Which verb collocates with 'a deadline'?", choices: ["reach", "meet", "win", "gain"], answer: "meet", why: "meet a deadline = finish on time.", fa: "ددلاین را meet می‌کنیم؛ reach یعنی رسیدن به مکان یا عدد." },
      { type: "mcq", q: "Choose the natural pair: ___ research", choices: ["make", "do", "work", "perform"], answer: "do", why: "do research, carry out research; never make research.", fa: "research با do می‌آید؛ make برای ساختن و تصمیم است." },
      { type: "cloze", q: "She ___ a speech at the conference.", answer: "gave", acceptable: ["made", "delivered"], why: "give/deliver a speech; make is the trap.", fa: "سخنرانی را give یا deliver می‌کنیم." },
      { type: "cloze", q: "I completely ___ with your point.", answer: "agree", why: "agree takes no preposition after 'completely' here; 'completely agree' is the strong form.", fa: "agree خودش فعل است؛ کاملاً موافقم = completely agree." },
    ],
  },
  articles: {
    title: "a, an, the, or nothing",
    title_fa: "حرف تعریف، تله شماره یک",
    intro: "Farsi has no articles, so type the article or '-' for nothing.",
    items: [
      { type: "cloze", q: "___ honesty is the best policy.", answer: "-", acceptable: ["nothing", "zero"], why: "Abstract uncountable nouns take no article in generic use.", fa: "اسم‌های انتزاعی مثل honesty حرف تعریف نمی‌گیرند." },
      { type: "cloze", q: "She works as ___ engineer at a startup.", answer: "an", why: "Singular countable noun + profession needs an article.", fa: "شغل مفرد حتماً حرف تعریف می‌خواهد: an engineer." },
      { type: "mcq", q: "I go to ___ university twice a week. (as a student)", choices: ["the", "a", "-", "an"], answer: "-", why: "Institutions used for their purpose take zero article.", fa: "وقتی university برای درس خواندن است، حرف تعریف نمی‌گیرد." },
      { type: "cloze", q: "I saw a film last night. ___ film was brilliant.", answer: "the", acceptable: ["The"], why: "Second mention takes 'the'.", fa: "بار دوم که از چیزی حرف می‌زنیم، the می‌آید." },
      { type: "mcq", q: "Which is correct?", choices: ["The life is hard", "Life is hard", "A life is hard", "Life is the hard"], answer: "Life is hard", why: "Generic 'life' takes no article.", fa: "معنای کلی life بدون حرف تعریف می‌آید." },
      { type: "cloze", q: "He is ___ most talented developer on the team.", answer: "the", why: "Superlatives take 'the'.", fa: "صفت عالی همیشه the می‌گیرد." },
    ],
  },
  preposition: {
    title: "Prepositions: where 'dar' lies to you",
    title_fa: "حروف اضافه، جایی که dar فریبتان می‌دهد",
    intro: "Type the missing preposition.",
    items: [
      { type: "cloze", q: "The meeting is ___ Monday morning.", answer: "on", why: "Days take 'on'.", fa: "روزهای هفته با on می‌آیند؛ dar فارسی این تفاوت را ندارد." },
      { type: "cloze", q: "I'll arrive ___ Tehran at noon.", answer: "in", acceptable: ["at"], why: "Cities take 'in'; 'arrive to' does not exist.", fa: "برای شهرها arrive in؛ arrive to غلط است." },
      { type: "cloze", q: "She is very good ___ solving conflicts.", answer: "at", why: "good AT a skill.", fa: "بعد از good برای مهارت، at می‌آید." },
      { type: "cloze", q: "It depends ___ the budget.", answer: "on", why: "depend ON, never 'depend to' or 'depend from'.", fa: "depend همیشه با on می‌آید." },
      { type: "mcq", q: "I'm interested ___ machine learning.", choices: ["about", "on", "in", "for"], answer: "in", why: "interested IN.", fa: "interested با in می‌آید؛ interested about غلط رایج است." },
      { type: "cloze", q: "See you ___ the airport.", answer: "at", why: "Specific point = at; 'in the airport' would mean inside the building as a place.", fa: "برای نقطه مشخص مثل فرودگاه، at درست است." },
    ],
  },
  tense: {
    title: "Tenses Farsi doesn't have",
    title_fa: "زمان‌هایی که فارسی ندارند",
    intro: "Write the correct form of the verb in brackets.",
    items: [
      { type: "cloze", q: "I ___ (see) that movie three times.", answer: "have seen", acceptable: ["i have seen", "'ve seen"], why: "'three times' = experience = present perfect.", fa: "تجربه بدون زمان مشخص در انگلیسی present perfect است." },
      { type: "cloze", q: "I ___ (see) him yesterday at the office.", answer: "saw", why: "'yesterday' is finished time = past simple, never present perfect.", fa: "با yesterday نمی‌توان present perfect به کار برد؛ گذشته ساده لازم است." },
      { type: "cloze", q: "Right now she ___ (prepare) the report.", answer: "is preparing", acceptable: ["she is preparing", "'s preparing"], why: "'right now' = present continuous.", fa: "برای عمل در حال وقوع، حال استمراری لازم است." },
      { type: "cloze", q: "If it ___ (rain) tomorrow, we'll move the event inside.", answer: "rains", why: "First conditional: present simple in the if-clause, never 'will'.", fa: "در شرط نوع اول، بعد از if حال ساده می‌آید نه will." },
      { type: "mcq", q: "Choose the correct sentence:", choices: ["I am knowing the answer", "I know the answer", "I am know the answer", "I have knowing the answer"], answer: "I know the answer", why: "Stative verbs like 'know' resist continuous forms.", fa: "فعل‌های حالتی مثل know استمراری نمی‌شوند؛ daram midunam به انگلیسی نمی‌رود." },
      { type: "cloze", q: "By 2030 he ___ (lead) the team for a decade.", answer: "will have led", acceptable: ["he will have led", "'ll have led"], why: "Duration up to a future point = future perfect.", fa: "برای مدت زمان تا نقطه‌ای در آینده، future perfect به کار می‌رود." },
    ],
  },
  vocab: {
    title: "Words worth keeping",
    title_fa: "واژه‌هایی که ارزش نگه‌داشتن دارند",
    intro: "Pick or type the precise word.",
    items: [
      { type: "mcq", q: "The data ___ that remote work is here to stay.", choices: ["imply", "suggest", "indicate", "suppose"], answer: "indicate", why: "indicate = show clearly; suggest/imply leave room for doubt.", fa: "indicate یعنی به‌روشنی نشان می‌دهد؛ imply یعنی در لایه‌ی معنا پنهان است." },
      { type: "cloze", q: "The startup managed to ___ a crisis into an opportunity.", answer: "turn", why: "turn X into Y is the fixed frame.", fa: "قالب ثابت: turn something into something." },
      { type: "mcq", q: "Her explanation was ___ : everyone finally got it.", choices: ["ambiguous", "lucid", "vague", "obscure"], answer: "lucid", why: "lucid = clear, positive; the others mean unclear.", fa: "lucid یعنی شفاف و روشن؛ سه گزینه دیگر یعنی مبهم." },
      { type: "cloze", q: "We must ___ (think about) all the options before deciding. s_ _ _ _ _ _ _", answer: "consider", acceptable: ["weigh"], why: "consider/weigh options, not 'check' options.", fa: "برای سنجیدن گزینه‌ها consider یا weigh درست است." },
      { type: "mcq", q: "Prices have ___ sharply this quarter.", choices: ["raised", "risen", "arised", "arose"], answer: "risen", why: "rise/rose/risen (no object); raise needs an object.", fa: "rise خودش بالا می‌رود؛ raise نیاز به مفعول دارد." },
      { type: "cloze", q: "The report ___ light on the real cause of the outage.", answer: "shed", acceptable: ["throws", "cast"], why: "shed/throw light on = clarify.", fa: "اصطلاح ثابت: shed light on یعنی روشن کردن مطلب." },
    ],
  },
  synonym: {
    title: "Near-synonyms, real differences",
    title_fa: "مترادف‌های فریبنده",
    intro: "The nuance decides, not the dictionary.",
    items: [
      { type: "mcq", q: "I ___ your name. Can you repeat it?", choices: ["missed", "lost", "forgot", "dropped"], answer: "missed", why: "miss = fail to catch (a moment); lose = no longer possess.", fa: "حیف شد نشنوم = I missed your name؛ lose یعنی دیگر مالک نیستی." },
      { type: "mcq", q: "Tehran is a ___ city with 2000 years of history.", choices: ["historical", "historic", "history", "historically"], answer: "historic", why: "historic = important in history; historical = related to history.", fa: "historic یعنی مهم و تاریخی؛ historical یعنی مربوط به تاریخ." },
      { type: "cloze", q: "Could you ___ me where the station is? (say/tell)", answer: "tell", acceptable: ["Tell", "please tell"], why: "tell + person; say never takes a person directly.", fa: "tell شنونده می‌گیرد؛ say نمی‌گیرد: say to me غلط رایج است." },
      { type: "mcq", q: "The news had a profound ___ on the market.", choices: ["affect", "effect", "affection", "effective"], answer: "effect", why: "effect = noun; affect = verb.", fa: "effect اسم است، affect فعل؛ این دو را قاطی نکنید." },
      { type: "cloze", q: "Please ___ (raise/rise) your hand if you have a question.", answer: "raise", why: "raise = lift something (transitive).", fa: "raise مفعول می‌خواهد؛ rise خودش بالا می‌رود." },
      { type: "mcq", q: "We need to ___ the deadline by two days.", choices: ["expand", "extend", "extent", "expend"], answer: "extend", why: "extend a deadline = make it later; expand = make bigger.", fa: "تمدید کردن ددلاین extend است؛ expand یعنی بزرگ‌تر کردن." },
    ],
  },
  idiom: {
    title: "Five idioms that earn their place",
    title_fa: "پنج اصطلاح کاربردی",
    intro: "Meaning in context, not trivia.",
    items: [
      { type: "mcq", q: "'The proposal is a non-starter' means:", choices: ["it will succeed fast", "it never had a chance", "it needs a restart", "it starts late"], answer: "it never had a chance", why: "a non-starter = dead on arrival.", fa: "non-starter یعنی از همان ابتدا محکوم به شکست." },
      { type: "mcq", q: "'Let's touch base on Monday' means:", choices: ["play baseball", "briefly reconnect", "sign the contract", "take a break"], answer: "briefly reconnect", why: "touch base = check in briefly (business casual).", fa: "touch base یعنی یک تماس کوتاه برای هماهنگی." },
      { type: "cloze", q: "The two designs are a far ___ from last year's model. (c___)", answer: "cry", why: "a far cry from = completely different from.", fa: "a far cry from یعنی تفاوت بسیار زیاد با." },
      { type: "mcq", q: "'She cut corners on the audit' means she:", choices: ["saved money honestly", "did it cheaply and badly", "took a shortcut home", "finished early"], answer: "did it cheaply and badly", why: "cut corners = skip proper steps, negative.", fa: "cut corners یعنی میان‌بر زدن و کیفیت را پایین آوردن؛ منفی است." },
      { type: "cloze", q: "We're on the same ___ : let's proceed. (page/wave...)", answer: "page", acceptable: ["wavelength"], why: "on the same page = in agreement.", fa: "on the same page یعنی هم‌نظر بودن." },
      { type: "mcq", q: "'The manager gave us the green light' means:", choices: ["approval to proceed", "a jealous warning", "a fresh start", "extra budget"], answer: "approval to proceed", why: "green light = official permission to go ahead.", fa: "green light یعنی تأیید و اجازه شروع." },
    ],
  },
  register: {
    title: "Same message, two registers",
    title_fa: "یک پیام، دو لحن",
    intro: "Pick the version that fits the situation.",
    items: [
      { type: "mcq", q: "Email to a client, opening line:", choices: ["Hey! Quick thing", "Dear Ms. Rahimi, I hope this finds you well", "Yo, it's me again", "Hello there!!"], answer: "Dear Ms. Rahimi, I hope this finds you well", why: "Client email = formal register with a courteous opener.", fa: "ایمیل به مشتری لحن رسمی می‌خواهد؛ Hey و Yo غیرمجاز است." },
      { type: "mcq", q: "Message to your close teammate, 8am:", choices: ["Morning! Got a sec?", "I am writing to inquire whether you might be available", "Dear colleague,", "To whom it may concern"], answer: "Morning! Got a sec?", why: "Close teammate = casual, short, warm.", fa: "با هم‌تیمی نزدیک لحن کوتاه و خودمانی طبیعی است." },
      { type: "transform", q: "Make it formal: 'I can't make it to the meeting.'", answer: "I am unable to attend the meeting", acceptable: ["i won't be able to attend the meeting", "i will not be able to attend the meeting", "i'm afraid i cannot attend the meeting", "i regret that i cannot attend"], why: "Formal: unable to attend replaces can't make it.", fa: "در لحن رسمی، unable to attend جایگزین can't make it می‌شود." },
      { type: "transform", q: "Make it casual: 'I would appreciate your assistance.'", answer: "Can you help me out", acceptable: ["could you help me out", "can you give me a hand", "could you give me a hand", "help me out"], why: "Casual favors use phrasal verbs: help out, give a hand.", fa: "لحن خودمانی از فعل‌های phrasal مثل help out استفاده می‌کند." },
      { type: "mcq", q: "Which fits a CV (most formal)?", choices: ["I was in charge of 5 people", "I led a team of five", "I bossed five people", "Five people were under me"], answer: "I led a team of five", why: "CV register: concise achievement verbs.", fa: "در رزومه فعل‌های قوی و کوتاه مثل led بهترین انتخاب است." },
      { type: "mcq", q: "'Kindly revert to my email' sounds:", choices: ["natural formal", "dated and non-native", "perfectly casual", "friendly"], answer: "dated and non-native", why: "'Revert' meaning 'reply' is regional; native formal is 'reply at your earliest convenience'.", fa: "revert به معنی جواب دادن، غیرناتیو و قدیمی است؛ reply بگویید." },
    ],
  },
  paraphrase: {
    title: "One idea, many shapes",
    title_fa: "یک ایده، چند شکل",
    intro: "Rewrite exactly as instructed. Several answers count.",
    items: [
      { type: "transform", q: "Rewrite with 'despite': 'It was raining, but we continued.'", answer: "despite the rain, we continued", acceptable: ["we continued despite the rain", "despite the rain we continued", "despite the rain, we carried on", "we carried on despite the rain"], why: "despite + noun phrase (never a full clause with 'but').", fa: "بعد از despite اسم می‌آید نه جمله کامل با but." },
      { type: "transform", q: "Rewrite in passive: 'The team completed the audit.'", answer: "the audit was completed by the team", acceptable: ["the audit was completed", "the audit has been completed by the team"], why: "Passive moves the object to subject position.", fa: "در مجهول، مفعول به جای فاعل می‌نشیند." },
      { type: "transform", q: "Rewrite formally: 'Sales went up a lot last year.'", answer: "sales increased significantly last year", acceptable: ["sales rose considerably last year", "sales grew substantially last year", "sales increased considerably last year"], why: "Formal register prefers rose/increased over went up.", fa: "در لحن رسمی، increase/rise جایگزین go up می‌شود." },
      { type: "transform", q: "Rewrite with 'if': 'Without your help, I would have failed.'", answer: "if you hadn't helped me, i would have failed", acceptable: ["if you had not helped me, i would have failed", "if you hadnt helped me, i would have failed"], why: "Third conditional for unreal past.", fa: "شرط سوم برای گذشته‌ی غیرواقعی: had + p.p. در بخش if." },
      { type: "transform", q: "Rewrite with a hedging verb: 'Social media destroys attention spans.' (softer, academic)", answer: "social media may reduce attention spans", acceptable: ["social media can reduce attention spans", "social media might reduce attention spans", "social media may harm attention spans", "social media appears to reduce attention spans"], why: "Academic hedging: may/might/appear to soften claims.", fa: "در نوشتار علمی از may و might برای ملایم کردن ادعا استفاده می‌شود." },
      { type: "transform", q: "Rewrite using 'the more': 'As you practice, you improve.'", answer: "the more you practice, the more you improve", acceptable: ["the more you practice, the better you get", "the more you practice, the better you become"], why: "'the + comparative' pairs for parallel growth.", fa: "قالب the more... the more برای رشد همزمان دو چیز." },
    ],
  },
};

export function bankDrill(topic: string): Drill {
  return BANK[topic] ?? BANK.vocab;
}
