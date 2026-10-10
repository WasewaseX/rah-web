// Rah tutor skill registry. The single source of truth for every skill the
// built-in AI coach can execute. Pure data + intent patterns: safe to import
// from client and server. Adding a skill = adding one entry here (+ a prompt
// in the engine files). The router never lets the LLM decide what it can or
// cannot do: code routes, skills execute.

export type SkillCategory = "assess" | "vocab" | "grammar" | "produce" | "strategy" | "app";
export type SkillEngine = "exam" | "drill" | "report" | "chat";

export interface Skill {
  id: string;
  engine: SkillEngine;
  icon: string; // lucide icon name, mapped client-side
  name_en: string;
  name_fa: string;
  desc_fa: string;
  category: SkillCategory;
  /** exam engine: which exam spec to build */
  spec?: "mixed" | "vocabulary" | "grammar" | "collocation" | "reading";
  /** drill engine: drill topic key */
  topic?: string;
  /** report engine: analysis kind */
  kind?: "deep_level" | "error_diagnosis" | "forecast" | "plan";
  /** chat engine: brief appended to the coach system prompt */
  brief?: string;
  /** free-text intent pattern (English + Farsi). Order matters: first hit wins. */
  match?: RegExp;
}

export const SKILLS: Skill[] = [
  // ---------- ASSESS: exams, analysis, assessment ----------
  {
    id: "exam_vocab", engine: "exam", icon: "BookMarked", name_en: "Vocabulary Exam", name_fa: "آزمون واژگان",
    desc_fa: "۱۰ سؤال واژگان سطح B2 به بالا با نمره و تحلیل",
    category: "assess", spec: "vocabulary",
    match: /\b(vocab\w*\s*(exam|test)|word\s+(exam|test))\b|آزمون\s*(واژگ|لغت)|امتحان\s*واژگ/i,
  },
  {
    id: "exam_grammar", engine: "exam", icon: "SpellCheck", name_en: "Grammar Exam", name_fa: "آزمون گرامر",
    desc_fa: "خطایابی، جای خالی و بازنویسی جمله",
    category: "assess", spec: "grammar",
    match: /\bgrammar\s*(exam|test)\b|آزمون\s*گرامر/i,
  },
  {
    id: "exam_collocation", engine: "exam", icon: "Link2", name_en: "Collocation Exam", name_fa: "آزمون کلمات همراه",
    desc_fa: "ده آن که کدام واژه با کدام واژه می‌نشیند",
    category: "assess", spec: "collocation",
    match: /\bcollocations?\s*(exam|test)\b|آزمون\s*کلمات/i,
  },
  {
    id: "exam_reading", engine: "exam", icon: "BookOpen", name_en: "Reading Exam", name_fa: "آزمون خواندن",
    desc_fa: "یک متن در سطح تو + ۶ سؤال درک مطلب",
    category: "assess", spec: "reading",
    match: /\breading\s*(exam|test)\b|آزمون\s*خواندن/i,
  },
  {
    id: "exam_mixed", engine: "exam", icon: "GraduationCap", name_en: "Full Mock Exam", name_fa: "آزمون جامع",
    desc_fa: "واژگان، گرامر، کلمات همراه، خواندن و نگارش در یک آزمون ۱۵ دقیقه‌ای",
    category: "assess", spec: "mixed",
    match: /\b(generate|create|build|give|make|start|take|run|want|need|practice|try|do)\b[^.?!]{0,40}\b(exam|mock|test)\b|\b(exam|mock|test)\b[^.?!]{0,40}\b(generate|create|please|for me|now)\b|^\s*(a|an|the)?\s*(full|mock|new)?\s*(exam|test|mock)[\s.!?!]*$|\btest\s+me\b|\bassess\s+me\b|آزمون|امتحان|تست/i,
  },
  {
    id: "level_deep", engine: "report", icon: "Brain", name_en: "Deep Level Analysis", name_fa: "تحلیل عمیق سطح",
    desc_fa: "سطح واقعی تو در ۶ مهارت، با شواهد داده‌ای از کل اپ",
    category: "assess", kind: "deep_level",
    match: /\b(my|current|what|which)\s+level\b|\blevel\s+(analysis|check|deep)\b|\bhow\s+(good|strong)\s+am\s+i\b|\bwhere\s+am\s+i\b|سطحم|تعیین\s*سطح|چقدر\s*(یاد|پیشرفت)|سطح\s*من/i,
  },
  {
    id: "error_diagnosis", engine: "report", icon: "Stethoscope", name_en: "Error Pattern Diagnosis", name_fa: "تشخیص الگوی خطا",
    desc_fa: "اشتباهات تکراری‌ات را از تاریخچه درمی‌آورد و ریشه‌اش را می‌گوید",
    category: "assess", kind: "error_diagnosis",
    match: /\b(error|mistake)s?\s+(pattern|diagnosis|analysis|history)\b|\bwhy\s+do\s+i\s+(keep|always)\b|\bmy\s+(mistakes|errors|weaknesses)\b|الگوی\s*خطا|اشتباهات/i,
  },
  {
    id: "forecast", engine: "report", icon: "TrendingUp", name_en: "Progress Forecast", name_fa: "پیش‌بینی پیشرفت",
    desc_fa: "با این سرعت، کی به C1 می‌رسی؟ و چه چیزی آن را عوض می‌کند",
    category: "assess", kind: "forecast",
    match: /\bwhen\s+(will|can)\s+i\s+(reach|get|be)\b|\bforecast\b|\bhow\s+long\s+(until|to|till)\b|\bc1\s+when\b|کی\s*(به|تموم)|پیش\s*بینی/i,
  },
  {
    id: "weak_drill", engine: "drill", icon: "Target", name_en: "Weak-Spot Drill", name_fa: "تمرین نقطه ضعف",
    desc_fa: "۶ تمرین دقیقاً روی همان چیزی که الان ضعیفی",
    category: "assess", topic: "auto",
    match: /\bdrill\s+my\s+weak|\bweak\s*(spot|point|area)s?\b|\bmy\s+weakness\b|نقطه\s*ضعف|ضعف/i,
  },

  // ---------- VOCAB ----------
  {
    id: "collocation_drill", engine: "drill", icon: "Link2", name_en: "Collocation Drill", name_fa: "تمرین کلمات همراه",
    desc_fa: "کدام فعل با کدام اسم می‌نشیند؛ جفت‌های طبیعی انگلیسی",
    category: "vocab", topic: "collocation",
    match: /\bcollocations?\b|کلمات\s*همراه/i,
  },
  {
    id: "synonym_drill", engine: "drill", icon: "Shuffle", name_en: "Synonym Nuance Drill", name_fa: "تمرین مترادف‌های ظریف",
    desc_fa: "تفاوت واژه‌های به‌ظاهر هم‌معنی؛ کدام در این جمله درست است؟",
    category: "vocab", topic: "synonym",
    match: /\bsynonyms?\b|\bantonyms?\b|مترادف|متضاد/i,
  },
  {
    id: "idiom_booster", engine: "drill", icon: "Lightbulb", name_en: "Idiom Booster", name_fa: "تقویت اصطلاحات",
    desc_fa: "۵ اصطلاح سطح C1 با مثال و آزمونک",
    category: "vocab", topic: "idiom",
    match: /\bidioms?\b|اصطلاح/i,
  },
  {
    id: "register_coach", engine: "drill", icon: "Repeat2", name_en: "Register Coach", name_fa: "مربی رسمی/غیررسمی",
    desc_fa: "یک جمله را رسمی و غیررسمی بگو؛ کجا کدام؟",
    category: "vocab", topic: "register",
    match: /\bregister\b|\bformal(ity)?\b|\bcasual\s+vs\b|رسمی|غیررسمی/i,
  },
  {
    id: "word_family", engine: "chat", icon: "Network", name_en: "Word Family Builder", name_fa: "خانواده واژه",
    desc_fa: "decide, decision, decisive... یک خانواده را تا ریشه بفهم",
    category: "vocab",
    brief: "The learner wants to build a word family. Pick ONE high-value B2/C1 word family (or use a word they mentioned), map the family (noun/verb/adjective/adverb forms) compactly, then make them USE two members in two sentences. Keep the table to one short line per member.",
    match: /\bword\s+famil(y|ies)\b|خانواده\s*واژ/i,
  },

  // ---------- GRAMMAR ----------
  {
    id: "articles_drill", engine: "drill", icon: "Type", name_en: "Article Drill", name_fa: "تمرین حرف تعریف",
    desc_fa: "a/an/the؛ چون فارسی حرف تعریف ندارد، این تله شماره یک توست",
    category: "grammar", topic: "articles",
    match: /\barticles?\b|\bthe\s+or\s+a\b|حرف\s*تعریف/i,
  },
  {
    id: "preposition_drill", engine: "drill", icon: "Puzzle", name_en: "Preposition Drill", name_fa: "تمرین حروف اضافه",
    desc_fa: "in/on/at و باقی حروف اضافه؛ «dar» فارسی همه‌شان نیست",
    category: "grammar", topic: "preposition",
    match: /\bprepositions?\b|حرف\s*اضافه/i,
  },
  {
    id: "tense_trainer", engine: "drill", icon: "Timer", name_en: "Tense Trainer", name_fa: "تمرین زمان‌ها",
    desc_fa: "present perfect یا past simple؟ زمان‌هایی که فارسی ندارد",
    category: "grammar", topic: "tense",
    match: /\btenses?\b|\bpresent\s+perfect\b|\bpast\s+simple\b|زمان\s*ها/i,
  },
  {
    id: "vocab_quiz", engine: "drill", icon: "Layers", name_en: "Vocabulary Quiz", name_fa: "آزمونک واژگان",
    desc_fa: "۶ سؤال سریع از واژه‌های کاربردی که ارزش نگه‌داشتن دارند",
    category: "vocab", topic: "vocab",
    match: /\b(vocab\w*\s*(quiz|drill|practice|drills)|word\s+quiz)\b|\bquiz\s+me\b|آزمونک\s*واژگ|تمرین\s*لغت/i,
  },
  {
    id: "grammar_doctor", engine: "chat", icon: "Stethoscope", name_en: "Grammar Doctor", name_fa: "دکتر گرامر",
    desc_fa: "یک نقطه گرامری را سقراطی توضیح می‌دهد و همان لحظه می‌آزماید",
    category: "grammar",
    brief: "The learner wants a grammar point explained and drilled. Do it Socratically: first a tiny example pair that makes the rule visible, ask them to generalize, then confirm with the rule in one line and drill with 2 quick items they must produce (not choose). If they named a specific grammar point, use it; otherwise pick from their recent trap tags.",
    match: /\bgrammar\b|\bexplain\s+(the\s+)?(past|present|future|passive|conditional|relative)\b|گرامر|دستور/i,
  },
  {
    id: "sentence_surgery", engine: "chat", icon: "Scissors", name_en: "Sentence Surgery", name_fa: "جراحی جمله",
    desc_fa: "جمله‌ات را بده: جراحی می‌شود، نسخه‌های B2 و C1 تحویل می‌گیری",
    category: "grammar",
    brief: "The learner pasted a sentence (or will) for surgery. Show: (1) the corrected sentence, (2) what was wrong as one correction entry with a Farsi why, (3) a plain-B2 natural version and a sharper C1 version of the same idea. Then have them transform one more sentence themselves to prove transfer.",
    match: /\bfix\s+(this\s+)?sentence\b|\bsentence\s+surgery\b|\bcorrect\s+this\b|این\s*جمله/i,
  },

  // ---------- PRODUCE ----------
  {
    id: "writing_task", engine: "chat", icon: "PenLine", name_en: "Writing Task", name_fa: "موضوع نگارش",
    desc_fa: "یک تسک سبک آیلتس می‌دهد؛ بنویس تا ممتز تحلیلش کند",
    category: "produce",
    brief: "The learner wants a writing task. Give ONE B2/C1 writing task (opinion or problem-solution, 2 parts in the prompt, real-world topic suited to an Iranian professional learner). State the word count (150 to 180) and one constraint. Then stop and wait for their text. Do not write any part of the essay yourself.",
    match: /\bwriting\s*(task|prompt|topic|practice)\b|\bgive\s+me\s+a?\s*writing\b|موضوع\s*(نوشتن|نگارش)/i,
  },
  {
    id: "speaking_prompt", engine: "chat", icon: "Mic", name_en: "Speaking Prompt", name_fa: "موضوع اسپیکینگ",
    desc_fa: "پرت ۱/۲/۳ آیلتس؛ جواب بده تا تحلیل شود",
    category: "produce",
    brief: "The learner wants a speaking prompt. Give ONE IELTS-style prompt: Part 1 warm-up question plus a Part 2 cue card (topic + 4 bullet hints + 1 minute prep note). Tell them to type the answer as if speaking, 2 minutes of speech. Then stop and wait.",
    match: /\bspeaking\s*(prompt|topic|question|practice)\b|\bpart\s*[123]\b|اسپیکینگ/i,
  },
  {
    id: "paraphrase_gym", engine: "drill", icon: "Copy", name_en: "Paraphrase Gym", name_fa: "باشگاه بازنویسی",
    desc_fa: "یک جمله، سه بازنویسی: همین عضله را بساز",
    category: "produce", topic: "paraphrase",
    match: /\bparaphras\w*\b|بازنویسی/i,
  },
  {
    id: "roleplay", engine: "chat", icon: "MessagesSquare", name_en: "Roleplay Scenario", name_fa: "شبیه‌سازی موقعیت",
    desc_fa: "مصاحبه کاری، فرودگاه، دکتر... تو بازیگر، من صحنه",
    category: "produce",
    brief: "The learner wants a roleplay. Set ONE concrete scene in one short line (choose: job interview for a role they'd plausibly want, checking in at a hotel with a booking problem, or a doctor visit; if they named a scenario, use theirs). You play the other party. Start in character with one line, then make them respond in role. Correct as you go, stay in character, never break the scene to teach.",
    match: /\brole\s*-?\s*play\b|\bscenario\b|\binterview\s+practice\b|شبیه\s*سازی|مصاحبه\s*کاری/i,
  },
  {
    id: "translate_fa", engine: "chat", icon: "Languages", name_en: "Translate & Nuance", name_fa: "ترجمه با ظرافت",
    desc_fa: "فارسی بده، انگلیسی طبیعی بگیر؛ با تفاوت‌های ظریف",
    category: "produce",
    brief: "The learner wants Farsi to English translation practice. If they gave a Farsi sentence: do NOT translate it for them yet. Ask what register it is for, make THEM attempt it first, then upgrade their attempt with the natural version and explain the nuance in Farsi. If they had no sentence, give one short natural Farsi sentence for them to translate.",
    match: /\btranslat\w*\b|ترجمه/i,
  },
  {
    id: "reading_coach", engine: "chat", icon: "BookOpenCheck", name_en: "Reading Coach", name_fa: "مربی خواندن",
    desc_fa: "متن کوتاه در سطح تو + سؤال‌های استخراج",
    category: "produce",
    brief: "The learner wants a graded reading. Write ONE short passage (110 to 150 words, their level, concrete topic: tech, work, culture, science). Then 2 retrieval questions they must answer in their own words (no yes/no). Wait for answers, then grade with corrections.",
    match: /\breading\s*(practice|passage|coach)\b|متن\s*(انگلیسی|خواندن)/i,
  },

  // ---------- STRATEGY ----------
  {
    id: "daily_plan", engine: "report", icon: "CalendarDays", name_en: "Today's Plan", name_fa: "برنامه امروز",
    desc_fa: "با داده‌های همین لحظه اپ: امروز دقیقاً چه کنم؟",
    category: "strategy", kind: "plan",
    match: /\bplan\s+(for\s+)?today\b|\bdaily\s+plan\b|\bwhat\s+(should|do)\s+i\s+(do|start)\b|برنامه/i,
  },
  {
    id: "free_talk", engine: "chat", icon: "MessageCircle", name_en: "Free Talk", name_fa: "گفتگوی آزاد",
    desc_fa: "حرف بزن، اشتباه کن؛ من همان‌جا تعمیر می‌کنم",
    category: "strategy",
    brief: "The learner wants free conversation. Chat naturally about whatever they bring up, one short turn at a time, always ending with a question that makes them produce again. Correct their biggest error each turn via the corrections field, keep it light.",
    match: /\bfree\s+(talk|chat)\b|\bjust\s+chat\b|\blet'?s\s+talk\b|گفتگو/i,
  },

  // ---------- APP: the coach restyles and drives the app itself ----------
  {
    id: "ui_theme", engine: "chat", icon: "Palette", name_en: "Theme Studio", name_fa: "استودیو رنگ و تم",
    desc_fa: "رنگ اپ را عوض کن: آبی، زمردی، بنفش، کهربایی یا هر رنگ که بگویی",
    category: "app",
    brief: `The learner wants to change the app's colors. Emit the matching plugin actions: {"type":"preset","id":"emerald"} for named presets, or {"type":"theme","accent":"#2fc273"} for a custom color (map their words to a hex). If they describe a mood rather than a color, pick a fitting hex yourself. Confirm in one short line plus the Farsi fa_note, and ask what they want to adjust next only if they were vague.`,
    match: /\btheme\b|\bcolor\b|\bcolou?r\s+(scheme|of the app)\b|\bdark\s+mode\b|\bgreen\b.*app|\bred\b.*app|تم|رنگ\s*(اپ|برنامه)/i,
  },
  {
    id: "ui_backdrop", engine: "chat", icon: "Sparkles", name_en: "Backdrop Studio", name_fa: "استودیو پس‌زمینه",
    desc_fa: "پس‌زمینه نورانی متحرک: aurora، nebula، waves یا خاموش",
    category: "app",
    brief: `The learner wants to change the animated light backdrop. Emit {"type":"backdrop","enabled":true,"style":"aurora"|"nebula"|"waves"} or {"type":"backdrop","enabled":false} to turn it off. Describe each style in half a line if they are choosing. Confirm with fa_note.`,
    match: /\bbackdrop\b|\bbackground\b|\bwallpaper\b|\bglow\b|\baurora\b|\bnebula\b|\bwaves\b|پس\s*زمینه/i,
  },
  {
    id: "ui_layout", engine: "chat", icon: "LayoutGrid", name_en: "Layout Studio", name_fa: "استودیو چیدمان",
    desc_fa: "فشرده یا راحت، گردی گوشه‌ها، اندازه فونت، حرکت انیمیشن‌ها",
    category: "app",
    brief: `The learner wants to adjust layout or feel. Emit any of: {"type":"density","value":"compact"|"comfortable"}, {"type":"font","scale":0.9 to 1.25}, {"type":"radius","value":8 to 28}, {"type":"motion","enabled":true|false}. Map their words to values ("bigger text" = font scale up, "less rounded" = radius down, "calmer" = motion off). Confirm with fa_note.`,
    match: /\bcompact\b|\bdensity\b|\bfont\s+size\b|\btext\s+size\b|\brounded\b|\bradius\b|\banimation\b|\bmotion\b|فونت|متن\s*بزرگ|فشرده/i,
  },
];

export const CATEGORY_LABELS: { id: SkillCategory; label_fa: string }[] = [
  { id: "assess", label_fa: "سنجش و آزمون" },
  { id: "vocab", label_fa: "واژگان" },
  { id: "grammar", label_fa: "گرامر" },
  { id: "produce", label_fa: "تولید زبان" },
  { id: "strategy", label_fa: "راهبرد" },
  { id: "app", label_fa: "شخصی‌سازی اپ" },
];

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

// Free-text router. Tries every skill's pattern in registry order (specific
// exam specs are declared before the generic one for exactly this reason).
// Returns the skill, or null for plain Socratic tutoring.
export function routeMessage(text: string): Skill | null {
  const t = text.trim();
  if (t.length > 400) return null; // pasted text: treat as material, not intent
  for (const s of SKILLS) {
    if (s.match && s.match.test(t)) return s;
  }
  return null;
}
