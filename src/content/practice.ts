// Deliberate practice content: grammar micro-lessons (notice, retrieve,
// produce), speaking prompts for task repetition, writing prompts with C1
// model answers, and checkpoint texts for real skill measurement.

export interface GrammarLesson {
  id: string;
  trap: string;
  title: string;
  fa: string;
  notice: { bad: string; good: string }[];
  rule: string;
  retrieve: { q: string; a: string }[];
  produce: string[];
}

export const GRAMMAR_LESSONS: GrammarLesson[] = [
  {
    id: "g_articles",
    trap: "articles",
    title: "Articles where Persian has none",
    fa: "فارسی حرف تعریف ندارد، پس ذهن شما آن را حذف می‌کند",
    notice: [
      { bad: "I bought car last week.", good: "I bought a car last week." },
      { bad: "Government announced new policy.", good: "The government announced a new policy." },
      { bad: "Happiness is more important than money.", good: "Happiness is more important than money. (abstract nouns stay bare)" },
    ],
    rule:
      "Singular countable nouns always need a or the. Use a when the listener cannot guess which one, the when you both know. Abstract nouns like happiness, information and advice take nothing. The Persian habit of dropping the article entirely works only for the third group.",
    retrieve: [
      { q: "She is ___ engineer at ___ company I told you about.", a: "an engineer at the company" },
      { q: "___ honesty is ___ best policy, they say.", a: "Honesty is the best policy" },
      { q: "I need ___ advice, not ___ information.", a: "some advice, some information (or no article at all)" },
    ],
    produce: [
      "Describe your workplace or university using a, the and bare plurals correctly, three sentences.",
      "Talk about a piece of news: introduce it with a or the, then refer back with the.",
      "Write one sentence where the article changes the meaning completely.",
    ],
  },
  {
    id: "g_countability",
    trap: "countability",
    title: "Countable in English, uncountable in Persian",
    fa: "در فارسی جمع بستنِ این کلمات رایج است ولی در انگلیسی غلط است",
    notice: [
      { bad: "I have three informations for you.", good: "I have three pieces of information for you." },
      { bad: "These advices helped a lot.", good: "This advice helped a lot." },
      { bad: "How many equipments do we need?", good: "How much equipment do we need?" },
    ],
    rule:
      "Information, advice, equipment, furniture, research, software and homework are uncountable in English. They never take a plural s and never pair with many. Count them with pieces of, items of or bits of, or rephrase: we need two more people, not two more staffs.",
    retrieve: [
      { q: "The lab bought new ___. (equip)", a: "equipment" },
      { q: "She gave me two useful ___. (advice)", a: "pieces of advice" },
      { q: "How much ___ do you have tonight? (homework)", a: "homework" },
    ],
    produce: [
      "Report three facts from your week using pieces of information.",
      "Explain what equipment you would take on a two day trip, with correct quantity words.",
      "Give advice to a friend using this advice or a piece of advice, never advices.",
    ],
  },
  {
    id: "g_copula",
    trap: "copula",
    title: "The verb to be never disappears",
    fa: "در فارسی «است» به اسم می‌چسبد، در انگلیسی باید am/is/are را کامل بگویید",
    notice: [
      { bad: "My brother teacher.", good: "My brother is a teacher." },
      { bad: "The weather today very good.", good: "The weather today is very good." },
      { bad: "Why he angry?", good: "Why is he angry?" },
    ],
    rule:
      "In Persian the present copula is a suffix: ost, am, i. English keeps a full verb, is, am or are, and it moves to the front in questions. In past tense both languages use a separate word, so was and were feel natural. The present tense is where the Persian reflex bites.",
    retrieve: [
      { q: "The doors ___ open until ten.", a: "are" },
      { q: "___ she your oldest friend?", a: "Is" },
      { q: "It ___ not what you think.", a: "is" },
    ],
    produce: [
      "Introduce three people with jobs, using is a or is an every time.",
      "Ask three questions with is or are at the front.",
      "Describe today's weather in two full sentences with the verb be.",
    ],
  },
  {
    id: "g_perfect",
    trap: "perfect",
    title: "Present perfect vs past simple",
    fa: "«رفته‌ام» در فارسی با have gone در انگلیسی یکسان نیست",
    notice: [
      { bad: "I have seen him yesterday.", good: "I saw him yesterday." },
      { bad: "She has arrived an hour ago.", good: "She arrived an hour ago." },
      { bad: "I have never been to Isfahan.", good: "I have never been to Isfahan. (correct: no time point given)" },
    ],
    rule:
      "The Persian rafte-am form looks like the English present perfect but behaves differently. The moment you name a finished time, yesterday, last year, an hour ago, English demands past simple. Present perfect lives in unfinished time: ever, never, already, yet, so far, since 2019.",
    retrieve: [
      { q: "We ___ (finish) the report two days ago.", a: "finished" },
      { q: "I ___ (not talk) to her since March.", a: "have not talked" },
      { q: "___ you ever ___ (try) oysters?", a: "Have you ever tried" },
    ],
    produce: [
      "Say three things you did last week (past simple) and three things you have never done.",
      "Describe your English progress using since and for with present perfect.",
      "Report a past event, then its present result, in two linked sentences.",
    ],
  },
  {
    id: "g_question_order",
    trap: "question_order",
    title: "Embedded questions keep sentence order",
    fa: "در سؤال‌های غیرمستقیم، ترتیب جمله برمی‌گردد و do حذف می‌شود",
    notice: [
      { bad: "Do you know where is the station?", good: "Do you know where the station is?" },
      { bad: "I wonder what does she want.", good: "I wonder what she wants." },
      { bad: "Can you tell me how much it costs? (correct)", good: "Can you tell me how much it costs?" },
    ],
    rule:
      "When a question sits inside another sentence, the fronted verb goes back to normal position. No do, no does, no is before the subject. The main verb carries the question: Do you know..., I wonder..., Can you tell me...",
    retrieve: [
      { q: "Do you know when ___ (the train / leave)?", a: "when the train leaves" },
      { q: "I wonder why ___ (he / be) so quiet today.", a: "why he is so quiet" },
      { q: "Can you tell me where ___ (I / can / buy) a SIM card?", a: "where I can buy" },
    ],
    produce: [
      "Ask a stranger three embedded questions about the neighborhood.",
      "Wonder aloud about two things using I wonder why and I wonder how.",
      "Turn Where does she work? into an embedded question and back again.",
    ],
  },
  {
    id: "g_conditionals",
    trap: "conditionals",
    title: "If I had known, not If I would have known",
    fa: "بعد از if هرگز would نمی‌آید؛ این رایج‌ترین خطای شرطی فارسی‌زبانان است",
    notice: [
      { bad: "If I would have known, I would have come.", good: "If I had known, I would have come." },
      { bad: "If I will see him, I will tell him.", good: "If I see him, I will tell him." },
      { bad: "If I would be you...", good: "If I were you..." },
    ],
    rule:
      "would never appears in the if clause. Third conditional: if plus past perfect, then would have plus participle. Second conditional: if plus simple past, then would plus base form. First conditional: if plus present, then will.",
    retrieve: [
      { q: "If I ___ (study) harder, I would have passed.", a: "had studied" },
      { q: "If I ___ (be) you, I would take the offer.", a: "were" },
      { q: "If it rains, we ___ (stay) in.", a: "will stay" },
    ],
    produce: [
      "Say one regret about your past with the third conditional.",
      "Give a friend advice with If I were you, I would...",
      "Make one realistic prediction with a first conditional.",
    ],
  },
  {
    id: "g_prepositions",
    trap: "prepositions",
    title: "dar is three prepositions in English",
    fa: "«در» فارسی سه حرف اضافهٔ انگلیسی را می‌پوشاند: in, at, on",
    notice: [
      { bad: "I live in Monday? no: I will see you in Monday.", good: "I will see you on Monday." },
      { bad: "She arrived in the airport at 6.", good: "She arrived at the airport at 6." },
      { bad: "We study in the morning (correct), but at night.", good: "We study in the morning, but at night." },
    ],
    rule:
      "in for enclosed spaces and months, years, seasons. at for points: the airport, the door, times of day like at night and at 6. on for surfaces and days: on the table, on Monday, on the bus. Time is the trap zone: in the morning, at noon, on Friday morning.",
    retrieve: [
      { q: "The meeting is ___ Thursday ___ 3 pm.", a: "on Thursday at 3 pm" },
      { q: "I was born ___ 1998 ___ Tabriz.", a: "in 1998 in Tabriz" },
      { q: "She is waiting ___ the bus stop.", a: "at" },
    ],
    produce: [
      "Describe your daily schedule with five different time prepositions.",
      "Say where three objects are in your room using in, on and at.",
      "Explain how you get to work: on the bus, in a taxi, at the station.",
    ],
  },
  {
    id: "g_statives",
    trap: "statives",
    title: "Verbs that refuse the ing",
    fa: "«دارم می‌دانم» ترجمهٔ مستقیمش می‌شود I am knowing که غلط است",
    notice: [
      { bad: "I am knowing the answer.", good: "I know the answer." },
      { bad: "She is having two cars.", good: "She has two cars." },
      { bad: "I am wanting a coffee.", good: "I want a coffee." },
    ],
    rule:
      "Know, want, like, believe, understand, belong and own describe states, not actions, so they reject the progressive. Persian progressive with daram is the reflex here. Some verbs switch meaning: I am having lunch is fine, because that have is an action.",
    retrieve: [
      { q: "Right now I ___ (understand) it better.", a: "understand" },
      { q: "We ___ (have) dinner, call later. (action)", a: "are having" },
      { q: "This bag ___ (belong) to my sister.", a: "belongs" },
    ],
    produce: [
      "Say five things you know and want right now, with no ing anywhere.",
      "Use have twice: once as possession, once as an action.",
      "Describe what you see happening around you, avoiding state verbs in ing.",
    ],
  },
  {
    id: "g_adjectives",
    trap: "adjectives",
    title: "Adjective order: opinion before fact",
    fa: "ترتیب صفت در فارسی برعکس است: «کتاب خوبِ قدیمی» می‌شود the good old book نه برعکس",
    notice: [
      { bad: "She has a leather beautiful bag.", good: "She has a beautiful leather bag." },
      { bad: "We ate a soup delicious hot.", good: "We ate a delicious hot soup." },
      { bad: "It was an experience amazing.", good: "It was an amazing experience." },
    ],
    rule:
      "English order is opinion, size, age, shape, color, origin, material, purpose: a lovely little old round brown Persian wooden jewelry box. Persian flips noun and adjective, so the reflex is to push descriptive words after the noun. They must stay before it.",
    retrieve: [
      { q: "He drives a ___ (red / fast) car.", a: "fast red car" },
      { q: "They live in a ___ (stone / large) house.", a: "large stone house" },
      { q: "I adopted a ___ (Persian / young / beautiful) cat.", a: "beautiful young Persian cat" },
    ],
    produce: [
      "Describe your favorite object with three adjectives in correct order.",
      "Describe a dish with opinion, taste and origin adjectives.",
      "Describe a person's bag or car with two adjectives plus material.",
    ],
  },
  {
    id: "g_that_omission",
    trap: "that_omission",
    title: "It is important THAT...",
    fa: "فارسی بدون «اینکه» هم جمله می‌سازد؛ انگلیسی آن را یا that یا nothing می‌خواهد، ولی is را حذف نمی‌کند",
    notice: [
      { bad: "Is important to sleep well.", good: "It is important to sleep well." },
      { bad: "Is better to leave early.", good: "It is better to leave early." },
      { bad: "I think is a good idea.", good: "I think it is a good idea." },
    ],
    rule:
      "English needs a subject before is. When there is no real subject, it fills the slot: it is important, it seems, it takes time. Persian allows the verb to start the sentence, so this it gets dropped by reflex. I think it is..., not I think is...",
    retrieve: [
      { q: "___ is hard to say goodbye.", a: "It" },
      { q: "I believe ___ is worth the effort.", a: "it" },
      { q: "___ takes about an hour to get there.", a: "It" },
    ],
    produce: [
      "Give three pieces of advice starting with It is important, It is better, It helps.",
      "State two opinions with I think it is and I believe it is.",
      "Say how long three tasks take with It takes... to...",
    ],
  },
];

// ---------------------------------------------------------------- speaking

export interface SpeakPrompt {
  id: string;
  topic: string;
  prompt: string;
  useful: string[];
  level: string;
}

export const SPEAK_PROMPTS: SpeakPrompt[] = [
  { id: "sp1", topic: "AI in education", prompt: "Should universities allow students to use AI tools for coursework? Defend a clear position.", useful: ["raise concerns", "a double-edged sword", "undermine", "at the expense of"], level: "B2+" },
  { id: "sp2", topic: "Brain drain", prompt: "Many skilled people leave their home country for better pay. What would make them stay?", useful: ["reverse the trend", "retain talent", "push and pull factors", "quality of life"], level: "C1" },
  { id: "sp3", topic: "Remote work", prompt: "Your company wants everyone back in the office. Argue for or against, with three reasons.", useful: ["productivity gains", "commute time", "team cohesion", "draw the line between"], level: "B2" },
  { id: "sp4", topic: "Social media", prompt: "Has social media been net positive or net negative for your generation? Take a side.", useful: ["on balance", "attention span", "echo chamber", "come at a cost"], level: "B2+" },
  { id: "sp5", topic: "Cities", prompt: "Design one change to your city that would improve daily life the most. Explain why it beats other options.", useful: ["public transit", "walkability", "green space", "prioritize"], level: "B2" },
  { id: "sp6", topic: "Language loss", prompt: "Half of the world's languages may disappear this century. Does it matter? How much?", useful: ["cultural heritage", "a way of seeing", "irreplaceable", "at stake"], level: "C1" },
  { id: "sp7", topic: "Money and happiness", prompt: "A raise doubles your income but triples your hours. Take it or walk away? Explain your reasoning.", useful: ["trade-off", "diminishing returns", "well-being", "take a toll on"], level: "B2" },
  { id: "sp8", topic: "Free speech online", prompt: "Should platforms remove content that is legal but harmful? Where do you draw the line?", useful: ["slippery slope", "moderation", "set a precedent", "gray area"], level: "C1" },
  { id: "sp9", topic: "Teaching method", prompt: "Exams or projects? What should schools actually grade, and why?", useful: ["assessment", "rote learning", "deep understanding", "reward"], level: "B2" },
  { id: "sp10", topic: "Artificial meat", prompt: "Would you eat lab-grown meat regularly? Would you serve it to guests? Be honest.", useful: ["skeptical about", "carbon footprint", "appeal to", "on ethical grounds"], level: "B2+" },
  { id: "sp11", topic: "Multilingualism", prompt: "Some say learning a third language wastes time better spent elsewhere. Push back or agree.", useful: ["cognitive benefits", "opportunity cost", "open doors", "a marginal gain"], level: "C1" },
  { id: "sp12", topic: "Startups", prompt: "A friend quits a stable job to join a risky startup. What do you say to them?", useful: ["strike out on your own", "safety net", "upside", "worst-case scenario"], level: "B2+" },
  { id: "sp13", topic: "Privacy", prompt: "Would you trade some privacy for noticeably safer streets? How much is too much?", useful: ["surveillance", "a fair bargain", "slippery slope", "consent"], level: "C1" },
  { id: "sp14", topic: "Sports money", prompt: "Athletes earn more than surgeons. Defend or attack this distribution of money.", useful: ["market forces", "entertainment value", "justify", "a fraction of"], level: "B2" },
  { id: "sp15", topic: "Nostalgia", prompt: "Was childhood actually better before smartphones, or does memory flatter the past?", useful: ["rose-tinted", "in retrospect", "misremember", "juggle"], level: "B2+" },
  { id: "sp16", topic: "Automation", prompt: "If a job can be fully automated, should it be? Consider the people, not just the economics.", useful: ["displace workers", "retraining", "short-term pain", "inevitable"], level: "C1" },
];

// ---------------------------------------------------------------- writing

export interface WritePrompt {
  id: string;
  prompt: string;
  minWords: number;
  maxWords: number;
  model: string;
  modelNotes: string[];
}

export const WRITE_PROMPTS: WritePrompt[] = [
  {
    id: "wp1",
    prompt: "Some people believe schools should teach coding the way they teach reading. Others see it as a specialist subject. Give your view with reasons. About 200 words.",
    minWords: 150,
    maxWords: 280,
    model:
      "Reading instruction survived centuries because literacy unlocked everything else. Coding deserves a similar status, and the comparison is less dramatic than it sounds. A student who can script a small automation has learned three things at once: precision, because computers forgive nothing; decomposition, because a big task must become small ones; and debugging, which is the polite name for learning from failure. These transfer well beyond screens. Critics answer that most graduates never program again, so the slot belongs to civics or statistics. I find that argument backwards. Most graduates also never dissect a poem again, yet nobody calls literature wasted. School teaches a small set of tool-shaped subjects and a larger set of thinking-shaped ones, and coding sits firmly in the second group. The practical objection is teacher supply, and it is serious, but it is an argument for pace, not direction. Start in middle school, one hour a week, taught by the math department with a shared curriculum. Where literacy once separated those who could participate in public life from those who could not, a lighter version of that line now runs through computation. Schools that ignore it are not neutral. They are quietly choosing the wrong side of the line.",
    modelNotes: [
      "Opens with an analogy that frames the whole essay, then states the thesis in one line.",
      "Each paragraph carries one argument plus the counterargument it answers.",
      "Uses precise verbs (unlocked, transfer, dissect) instead of very + weak verb.",
      "Concedes the real objection (teacher supply) and answers it without dismissing it.",
    ],
  },
  {
    id: "wp2",
    prompt: "Your company wants to cut meeting time in half. Write a short proposal with your recommendations. About 200 words.",
    minWords: 150,
    maxWords: 280,
    model:
      "We currently spend roughly eleven hours per person per week in meetings, and most of that cost is invisible because calendars hide it. I recommend three changes that together would halve that number without cutting collaboration. First, default to thirty minutes instead of sixty. Most meetings expand to fill their slot, and the agenda of a typical hour-long meeting survives comfortably in half the time when attendance is trimmed to people who make decisions. Second, make the first five minutes a written summary: what is decided, what is open, who owns it. Meetings without a decision are messages, and messages belong in writing where they can be skipped. Third, declare two meeting-free mornings per week. Deep work has a compounding return; fragmented afternoons have a compounding cost. I pilot-tested this structure with our sprint planning for three weeks: the meeting shrank from fifty to twenty-five minutes and every decision it produced survived review. I am not proposing we value collaboration less, but that we price it honestly. A calendar is a budget, and right now we are spending the company's attention like it is free.",
    modelNotes: [
      "Proposal structure: problem with a number, three numbered recommendations, evidence, closing frame.",
      "Quantifies the problem (eleven hours) and the pilot result, which builds trust.",
      "Uses proposal-register phrases: I recommend, I am not proposing, price it honestly.",
      "Ends with a reframe, not a summary of what was already said.",
    ],
  },
  {
    id: "wp3",
    prompt: "Describe a decision you changed your mind about. What convinced you? About 200 words.",
    minWords: 150,
    maxWords: 280,
    model:
      "For three years I refused to learn touch typing, on the grounds that speed was not my bottleneck and the retraining would cost more than it paid. It felt like a principled position. Then last winter a hand injury forced me to slow down anyway, and out of boredom I finished a free typing course in two weeks. The interesting part was not the speed, which improved modestly. It was what disappeared: the tiny friction between thinking a sentence and committing it. Ideas no longer cooled while my hands caught up, so I wrote rougher first drafts and revised more willingly, because revision felt like polishing rather than restarting. What convinced me was not a statistic about words per minute but the quality of the downtime between thoughts. That experience recalibrated how I judge small optimizations. I used to dismiss anything whose benefit sounded marginal. Now I pay attention to frictions I have stopped noticing, on the theory that the costs we stop feeling are the ones we never count. I still think most productivity advice is noise. But the right question, I learned, is not whether a change is big. It is whether something you do a thousand times a day gets quietly easier.",
    modelNotes: [
      "Narrative structure: the old position, the forcing event, the change, the general lesson.",
      "Concrete and sensory (hand injury, drafts cooling) instead of abstract claims.",
      "Ends with a transferable principle rather than a moral cliché.",
      "Hedges honestly (modestly, most advice is noise), which reads as confidence at C1.",
    ],
  },
  {
    id: "wp4",
    prompt: "Should cities ban private cars from their centers? Argue your case with attention to who loses. About 250 words.",
    minWords: 180,
    maxWords: 320,
    model:
      "Car-free centers are usually sold with photographs of Copenhagen and a promise about clean air. The photographs are real, and so is the promise, but the honest argument has to start with who pays in the transition. A ban lands hardest on exactly two groups: tradespeople who move tools for a living, and residents with limited mobility for whom a car door two meters from the entrance is the difference between participating and staying home. Any proposal that ignores them is cosmetic. With that said, I support the restriction, with three design rules. Permits, not bans: trades and accessibility get automatic exemptions, so the rule targets discretionary trips, the majority of center traffic. Staggered rollout: pedestrianize one district per year, evaluate, adjust. Never a single citywide switch. Replacement before removal: every deleted parking lane must be matched by bus frequency on that corridor within the same quarter, because a ban that arrives before the bus does is a tax on the poor. Cities that followed versions of these rules saw retail spending hold or rise; cities that banned first and apologized later fed a backlash that reversed the whole program. The lesson generalizes beyond transport. Restrictive policy is not a statement of values, it is a design problem, and design problems are judged by their exceptions. Get the exceptions right and the public follows. Get them wrong and you have built a campaign ad for your opponents.",
    modelNotes: [
      "Leads with the strongest objection (who loses) instead of hiding it.",
      "Three numbered design rules, each concrete and checkable.",
      "Cites evidence categories without inventing fake statistics.",
      "Closes by generalizing the principle, showing C1-level discourse control.",
    ],
  },
  {
    id: "wp5",
    prompt: "Write a review of a podcast, series or book that changed how you think about something ordinary. About 200 words.",
    minWords: 150,
    maxWords: 280,
    model:
      "I picked up The Design of Everyday Things expecting a book about doorknobs and stayed for a quiet argument that changed how I assign blame. Norman's core claim is that when a user fails, the fault usually sits in the design, not the person. The stove that does not reveal which knob controls which burner is not being used stupidly; it is lying. Once you see the world this way, apologies for everyday clumsiness start to sound wrong. You stop saying sorry at doors that push where they look like they pull. The book generalizes further than its examples, though it never says so directly. I began reading my own software errors, missed appointments and forgotten errands as design failures in my personal systems rather than character flaws, and the reframing was oddly productive: systems can be redesigned, character cannot, at least not by Tuesday. Two criticisms keep it from five stars. The examples age; nobody struggles with VCR clocks now, and younger readers may miss the force of the jokes. And the prose repeats itself after the middle chapters, as if the book were testing its own discovery: identical-looking controls produce identical-looking confusion. Still, it earns its reputation. It takes a subject you never thought about and hands you a permanent new instinct about human error, which is the best bargain nonfiction offers.",
    modelNotes: [
      "Review structure: expectation, core claim, personal consequence, fair criticisms, verdict.",
      "Specific enough to prove the book was read (stove knobs, VCR joke).",
      "Criticisms are real and calm, which raises the reviewer's credibility.",
      "Ends with a general principle about what good nonfiction does.",
    ],
  },
  {
    id: "wp6",
    prompt: "Your city council has budget for either a new metro line or two hundred kilometers of bike lanes. Choose one and defend it against the other. About 250 words.",
    minWords: 180,
    maxWords: 320,
    model:
      "Given a fixed budget, I would fund the bike lanes, and the metro's usual advantages are exactly why. A metro line is the strongest single intervention a big city can make, which is the problem: its strengths show up at volumes and distances that one line, in one corridor, over one decade, cannot reach. Two hundred kilometers of protected lanes touch every district instead of two. They cut trips the metro never sees, the three-kilometer journey that is too long to walk and too short to drive comfortably, which in most cities is a quarter of all car trips. They also build a constituency. Every cyclist today is a transit voter tomorrow; the reverse sequence rarely works, because you cannot cycle on a promise of a train that opens in twelve years. The honest case for the metro is speed over distance and dignity in extreme weather, and I would answer it with sequencing rather than refusal: design the line now, buy the land, and let the lanes carry the interim load so the future metro opens onto a city already used to moving without cars. Cost per kilometer settles what argument leaves. One kilometer of urban metro buys roughly forty of protected lanes. For the price of one flagship, we could rebuild the entire city's short-trip infrastructure and still have change for the line's first feasibility study. That is not a rejection of the metro. It is a bet on compounding.",
    modelNotes: [
      "Directly compares the two options throughout instead of praising one in a vacuum.",
      "Names the mechanism (constituency building, trip-distance band) behind each claim.",
      "Concedes the metro's real strengths and answers with sequencing.",
      "Numbers used for proportion, not decoration.",
    ],
  },
];

// ---------------------------------------------------------------- checkpoints

export interface CheckpointText {
  id: string;
  kind: "listening" | "reading";
  title: string;
  level: string;
  text: string;
  questions: { q: string; choices: string[]; a: number }[];
}

export const CHECKPOINT_TEXTS: CheckpointText[] = [
  {
    id: "ck1",
    kind: "listening",
    title: "Checkpoint listening: the archive",
    level: "C1",
    text:
      "The university archive closes at five, which is why I found myself arguing with a locked door at ten past. The librarian, who had watched me photocopy for two hours straight, offered a compromise I have never forgotten: she would let me back in if I agreed to touch nothing and photograph everything. It sounds like a small kindness. It was not. My thesis had been dead in the water for a month, and the box she unlocked contained letters that settled a question three departments had fought over since the seventies. What struck me later was not the luck. Archives are full of luck. It was that she had noticed something no supervisor, no colleague, no friend had bothered to mention: that I kept returning to the same drawer. Expertise, I have come to believe, is often just attention that has had time to accumulate in one place. The letters made my career for about a season. The librarian's observation made it permanently.",
    questions: [
      { q: "Why was the narrator locked out?", choices: ["The archive had moved", "It was after closing time", "The librarian had forgotten them", "The door was broken"], a: 1 },
      { q: "What was the compromise?", choices: ["Come back tomorrow", "Re-enter but touch nothing, photograph everything", "Take the box home", "Work in the reading room"], a: 1 },
      { q: "What did the box contain?", choices: ["Photographs of the library", "Letters settling an old academic dispute", "The narrator's lost notes", "Records from the seventies about funding"], a: 1 },
      { q: "What is the narrator's final point about expertise?", choices: ["It comes from luck", "It is accumulated attention", "It requires supervisors", "It is mostly persistence"], a: 1 },
    ],
  },
  {
    id: "ck2",
    kind: "reading",
    title: "Checkpoint reading: the crowd predicts",
    level: "C1",
    text:
      "In 1907, Francis Galton visited a country fair where a crowd was guessing the weight of an ox. Nearly eight hundred tickets were sold, and Galton, who doubted the public's judgment, took the tickets home and averaged them. The crowd's mean answer beat every individual guess, including those of butchers and farmers, and landed within one percent of the true weight. Galton expected mediocrity and found, in his own words, the Vox Populi to be accurate to the pound. The episode is cited constantly now, usually as a celebration of crowds. That reading misses the conditions that made it work: each guess was independent, made in private, and made by people with some relevant experience, however humble. Remove any of the three and the average degrades fast. A crowd that talks before it guesses stops being a crowd of guesses and becomes a crowd of one, usually the loudest person in the room. Modern forecasting systems treat Galton's conditions as an engineering checklist rather than a marvel: keep estimates independent, weight track records, and let disagreement stay visible. The ox fair was not magic. It was a well-run process that happened to look like a picnic.",
    questions: [
      { q: "What did Galton expect to find?", choices: ["That butchers would win", "That the average would fail", "That the ox would be heavier than guessed", "That tickets would be too few"], a: 1 },
      { q: "How accurate was the crowd mean?", choices: ["Within one percent", "Exactly right", "Within ten percent", "Better than butchers but not farmers"], a: 0 },
      { q: "Which is NOT one of the working conditions named?", choices: ["Independence of guesses", "Privacy while guessing", "Relevant experience", "Unanimity before averaging"], a: 3 },
      { q: "What happens when a crowd talks before guessing?", choices: ["Accuracy improves", "The average matches experts", "It behaves like one loud voice", "The guesses become independent"], a: 2 },
    ],
  },
];
