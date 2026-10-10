// Listening decoding lab content. Each passage feeds the 5-round cycle:
// blind listen, diagnose misses, transcript reveal, re-listen, reproduce.
// Written as natural speech so reductions and linking actually appear.

export interface ListenPassage {
  id: string;
  title: string;
  level: string;
  seconds: number;
  transcript: string;
  // Words worth catching, glossed in Farsi.
  vocab: { w: string; fa: string }[];
  // Reduction / linking phenomena the learner should notice.
  features: { say: string; sounds: string; note: string }[];
}

export const MISS_TYPES = [
  { id: "vocab", label: "Vocabulary", note: "I did not know or could not recall the word" },
  { id: "sound", label: "Pronunciation", note: "The word exists for me but the sounds fooled me" },
  { id: "link", label: "Connected speech", note: "Linking, reduction or elision broke the words apart" },
  { id: "grammar", label: "Grammar", note: "I lost the structure of the sentence" },
  { id: "speed", label: "Speed", note: "It went by faster than I could process" },
  { id: "focus", label: "Attention", note: "I understood it but my mind drifted" },
] as const;

export const PASSAGES: ListenPassage[] = [
  {
    id: "l1",
    title: "The commute",
    level: "B2",
    seconds: 45,
    transcript:
      "Honestly, I used to dread the commute. Forty minutes on a packed bus, every single morning. But last month I started downloading long-form interviews, and now the trip feels short. What changed is not the traffic. It is what my brain does while I listen. At first I caught maybe half of every sentence. The rest blurred together. I kept going, and somewhere around week two the blur started to split into words. That is the part most learners quit right before.",
    vocab: [
      { w: "dread", fa: "از ترسیدنِ چیزی، دلخراش بودن" },
      { w: "long-form", fa: "طولانی و کامل (محتوا)" },
      { w: "blur", fa: "محو شدن" },
    ],
    features: [
      { say: "used to", sounds: "yoos-tuh", note: "the d disappears before t" },
      { say: "What changed is", sounds: "wuhd-changed-is", note: "t links into the next word" },
    ],
  },
  {
    id: "l2",
    title: "A small repair",
    level: "B2",
    seconds: 45,
    transcript:
      "The tap in the kitchen had been dripping for weeks. A tiny sound, but it follows you. You hear it when you read, when you sleep, when you talk on the phone. So on Friday I turned the water off, took the whole thing apart, and found a washer worn down to nothing. The part cost about a dollar. An hour later the flat was silent. I am not saying plumbing is a life skill everyone needs, but that one hour bought me months of quiet.",
    vocab: [
      { w: "dripping", fa: "چکه کردن" },
      { w: "worn down", fa: "ساییده شده" },
      { w: "washer", fa: "واشر" },
    ],
    features: [
      { say: "it follows you", sounds: "it-folluhzh-you", note: "s links into you" },
      { say: "took the whole thing apart", sounds: "took-thuh-hole-thing-uh-part", note: "thing links into apart" },
    ],
  },
  {
    id: "l3",
    title: "Night shifts",
    level: "B2+",
    seconds: 50,
    transcript:
      "My mother worked night shifts at a hospital for eleven years. She came home at dawn, slept till noon, and still showed up to every school meeting with the same calm face. For a long time I thought she simply did not get tired. Now I understand it differently. She was tired all the time. She just decided, quietly and repeatedly, that certain things would not be skipped. There is a word for that kind of strength, and it is not talent.",
    vocab: [
      { w: "night shifts", fa: "شیفت شب" },
      { w: "at dawn", fa: "سپیده دم" },
      { w: "skipped", fa: "از قلم انداخته، رد شده" },
    ],
    features: [
      { say: "slept till noon", sounds: "slept-till-noon", note: "clean linking, no reduction here" },
      { say: "There is a word", sounds: "therez-uh-word", note: "there is contracts to there's" },
    ],
  },
  {
    id: "l4",
    title: "Why we misremember",
    level: "B2+",
    seconds: 55,
    transcript:
      "Here is a slightly uncomfortable finding from memory research. Every time you recall an event, you do not replay a recording. You rebuild it. And the rebuilding is influenced by what has happened since. Two people who lived through the same argument will remember two different arguments a year later, and neither of them is lying. Memory is less like a photograph and more like a story your brain keeps editing. Which raises a fair question: how much of your own past do you actually remember, and how much have you rewritten without noticing?",
    vocab: [
      { w: "recall", fa: "به یاد آوردن" },
      { w: "rebuild", fa: "بازسازی کردن" },
      { w: "rewritten", fa: "بازنویسی شده" },
    ],
    features: [
      { say: "less like a photograph", sounds: "less-like-uh-photuhgraph", note: "a reduces to uh" },
      { say: "raises a fair question", sounds: "ray-ziz-uh-fair", note: "raises links into a" },
    ],
  },
  {
    id: "l5",
    title: "The last video store",
    level: "C1",
    seconds: 55,
    transcript:
      "There is a video rental shop two streets from my flat that has somehow outlived the entire streaming era. The owner keeps a handwritten ledger. He says people come in not because the selection is better, it is not, but because choosing a film with someone who has watched two thousand of them beats scrolling alone. I think he has accidentally put his finger on something bigger: abundance did not make choosing easier, it made it lonelier. The shelf with forty titles had a kind of curation we now pay subscriptions to imitate.",
    vocab: [
      { w: "outlived", fa: "از چیزی عمر بیشتری کشیدن" },
      { w: "ledger", fa: "دفتر ثبت حساب" },
      { w: "curation", fa: "گزینش و گردآوری" },
      { w: "put his finger on", fa: "دقیقاً به اصل مطلب پی بردن" },
    ],
    features: [
      { say: "has outlived", sounds: "haz-outlived", note: "s of has links into out" },
      { say: "kind of", sounds: "kinda", note: "casual reduction, common in speech" },
    ],
  },
  {
    id: "l6",
    title: "Sound and memory",
    level: "C1",
    seconds: 60,
    transcript:
      "Ask someone where they were when they heard a piece of life-changing news and they will rarely mention what they saw. They will mention the room, the radio, the voice. Sound is wired into memory differently from sight. It arrives without our consent and leaves the same way. Advertisers figured this out decades ago, which is why a three second jingle can outlive your entire school curriculum. The uncomfortable version of this fact is that what surrounds your ears on repeat becomes part of how you think. Choose your audio the way you would choose your friends.",
    vocab: [
      { w: "consent", fa: "رضایت" },
      { w: "jingle", fa: "آهنگ کوتاه تبلیغاتی" },
      { w: "curriculum", fa: "برنامه درسی" },
    ],
    features: [
      { say: "wired into", sounds: "wired-in-tuh", note: "d links into into" },
      { say: "figured this out", sounds: "fig-yer-this-out", note: "t of out often drops at sentence end" },
    ],
  },
  {
    id: "l7",
    title: "A quiet argument for boredom",
    level: "B2+",
    seconds: 50,
    transcript:
      "I spent last Sunday with nothing scheduled, which for me is close to a medical event. No podcast, no list, no plan. The first hour was genuinely unpleasant. My brain kept reaching for a screen that was not there. By the third hour, though, something shifted. Ideas started arriving uninvited: a solution to a problem at work, an apology I owed someone, a place I had not thought about in years. I am not romantic about boredom, but I now suspect it is the processing time we refuse to give ourselves.",
    vocab: [
      { w: "scheduled", fa: "زمان‌بندی شده" },
      { w: "uninvited", fa: "بدون دعوت، ناگهانی" },
      { w: "apology", fa: "عذرخواهی" },
    ],
    features: [
      { say: "close to a", sounds: "closs-tuh-uh", note: "s links into t across words" },
      { say: "something shifted", sounds: "some-thing-shifted", note: "final th is quiet in fast speech" },
    ],
  },
  {
    id: "l8",
    title: "The second language of food",
    level: "C1",
    seconds: 60,
    transcript:
      "Every immigrant kitchen I have ever eaten in runs on translation. Not the language on the packet, the deeper one: measures that live in the hand rather than the cup, a pinch that means the cook's pinches, not the dictionary's. My grandmother had no recipe written down in her life. She cooked by comparison, by smell, by asking what the weather was doing. When she died we tried to reconstruct her dishes from memory and produced, without exception, food that tasted like an apology. Some knowledge does not survive being written down.",
    vocab: [
      { w: "runs on", fa: "کارش را با چیزی پیش می‌برد" },
      { w: "pinch", fa: "آرد یا نمکی که بین دو انگشت جا می‌شود" },
      { w: "reconstruct", fa: "بازسازی کردن" },
    ],
    features: [
      { say: "rather than", sounds: "ra-ther-than", note: "compare this th with the t many learners hear" },
      { say: "survive being", sounds: "survive-bee-ing", note: "v links into b" },
    ],
  },
  {
    id: "l9",
    title: "What the map got wrong",
    level: "C1",
    seconds: 60,
    transcript:
      "For two centuries the London Underground map has been praised as a triumph of design. What gets forgotten is how angrily it was received at first. Commuters complained that geography had been abandoned, that the distances lied, that a drawing which bent rivers and stretched suburbs was somehow dishonest. It is a useful reminder for anyone who simplifies anything for a living: clarity and accuracy are not the same virtue, and audiences rarely forgive the gap between them on day one. The map won in the end. But it won by being useful, not by being right.",
    vocab: [
      { w: "triumph", fa: "پیروزی بزرگ" },
      { w: "commuters", fa: "رفت‌وآمدکننده‌های روزانه" },
      { w: "abandoned", fa: "رها شده" },
      { w: "virtue", fa: "فضیلت، ارزش" },
    ],
    features: [
      { say: "praised as", sounds: "prays-daz", note: "d links into as" },
      { say: "It is a useful", sounds: "itsu-zuh-useful", note: "triple linking across four words" },
    ],
  },
];

// ---------------------------------------------------------------- minimal pairs

export interface Pair {
  id: string;
  a: string;
  b: string;
  focus: string;
  hint: string;
}

export const PAIR_FOCUS = [
  { id: "i_i", label: "Short i vs long ee", note: "ship / sheep: tongue height, not length alone" },
  { id: "ae_e", label: "ae vs e", note: "bad / bed: jaw drops more for ae" },
  { id: "th", label: "th vs s, t, d, z", note: "think / sink: tongue between teeth" },
  { id: "wv", label: "w vs v", note: "west / vest: lips round for w, teeth touch lip for v" },
  { id: "o_oo", label: "Short o vs long oo", note: "full / fool: lip rounding and length" },
] as const;

export const MINIMAL_PAIRS: Pair[] = [
  { id: "p1", a: "ship", b: "sheep", focus: "i_i", hint: "The first vowel is shorter and more relaxed" },
  { id: "p2", a: "live", b: "leave", focus: "i_i", hint: "Same vowel pair, final consonant changes too" },
  { id: "p3", a: "sit", b: "seat", focus: "i_i", hint: "One is an action, the other furniture" },
  { id: "p4", a: "fill", b: "feel", focus: "i_i", hint: "Both verbs, different vowels" },
  { id: "p5", a: "it", b: "eat", focus: "i_i", hint: "Tiny word vs everyday verb" },
  { id: "p6", a: "still", b: "steal", focus: "i_i", hint: "Adverb or adjective vs a verb" },
  { id: "p7", a: "bad", b: "bed", focus: "ae_e", hint: "Jaw position is the whole difference" },
  { id: "p8", a: "man", b: "men", focus: "ae_e", hint: "Singular vs plural, one vowel apart" },
  { id: "p9", a: "sand", b: "send", focus: "ae_e", hint: "Beach material vs a communication verb" },
  { id: "p10", a: "sad", b: "said", focus: "ae_e", hint: "Feeling vs past of say" },
  { id: "p11", a: "think", b: "sink", focus: "th", hint: "Tongue between teeth vs behind them" },
  { id: "p12", a: "three", b: "free", focus: "th", hint: "Numbers vs a price of zero" },
  { id: "p13", a: "then", b: "den", focus: "th", hint: "Time word vs an animal home" },
  { id: "p14", a: "breathe", b: "breeze", focus: "th", hint: "The verb has a softer ending" },
  { id: "p15", a: "west", b: "vest", focus: "wv", hint: "Lips vs teeth at the start" },
  { id: "p16", a: "wine", b: "vine", focus: "wv", hint: "Both exist on a dinner table" },
  { id: "p17", a: "wet", b: "vet", focus: "wv", hint: "Weather vs a profession" },
  { id: "p18", a: "worse", b: "verse", focus: "wv", hint: "Comparative vs a poetry unit" },
  { id: "p19", a: "full", b: "fool", focus: "o_oo", hint: "Length plus rounding" },
  { id: "p20", a: "pull", b: "pool", focus: "o_oo", hint: "One you do to a door, one you swim in" },
  { id: "p21", a: "cook", b: "kook", focus: "o_oo", hint: "Kitchen verb vs slang for a strange person" },
  { id: "p22", a: "soot", b: "suit", focus: "o_oo", hint: "Chimney dust vs formal clothes" },
];

// ---------------------------------------------------------------- stress items

export interface StressItem {
  id: string;
  word: string;
  syllables: string[];
  stress: number; // index of stressed syllable
  shiftNote: string;
}

export const STRESS_ITEMS: StressItem[] = [
  { id: "s1", word: "photograph", syllables: ["pho", "to", "graph"], stress: 0, shiftNote: "photographer moves the stress to 2" },
  { id: "s2", word: "photographer", syllables: ["pho", "tog", "ra", "pher"], stress: 1, shiftNote: "photograph stresses 1" },
  { id: "s3", word: "record (n)", syllables: ["re", "cord"], stress: 0, shiftNote: "record (v) stresses 1" },
  { id: "s4", word: "record (v)", syllables: ["re", "cord"], stress: 1, shiftNote: "record (n) stresses 0" },
  { id: "s5", word: "present (n)", syllables: ["pre", "sent"], stress: 0, shiftNote: "present (v) stresses 1" },
  { id: "s6", word: "present (v)", syllables: ["pre", "sent"], stress: 1, shiftNote: "present (n) stresses 0" },
  { id: "s7", word: "necessary", syllables: ["ne", "ces", "sa", "ry"], stress: 0, shiftNote: "many learners stress 1, which is wrong" },
  { id: "s8", word: "comfortable", syllables: ["com", "for", "ta", "ble"], stress: 0, shiftNote: "often said with 3 syllables: comf-ter-ble" },
  { id: "s9", word: "development", syllables: ["de", "ve", "lop", "ment"], stress: 1, shiftNote: "develop alone also stresses 1" },
  { id: "s10", word: "opportunity", syllables: ["o", "ppor", "tu", "ni", "ty"], stress: 1, shiftNote: "keep the second syllable long" },
  { id: "s11", word: "influence", syllables: ["in", "flu", "ence"], stress: 0, shiftNote: "influential keeps the same position" },
  { id: "s12", word: "responsible", syllables: ["re", "spon", "si", "ble"], stress: 1, shiftNote: "responsibility stresses 3" },
];

// Linking and reduction awareness: what fast speech actually sounds like.
export interface LinkItem {
  id: string;
  written: string;
  heard: string;
  note: string;
}

export const LINK_ITEMS: LinkItem[] = [
  { id: "k1", written: "What are you going to do?", heard: "Whaddaya gonna do?", note: "are you reduces to addaya, going to to gonna" },
  { id: "k2", written: "I want to know.", heard: "I wanna know.", note: "want to becomes wanna in casual speech" },
  { id: "k3", written: "Did you eat yet?", heard: "Djeet yet?", note: "extreme reduction, still perfectly common" },
  { id: "k4", written: "Let me get that.", heard: "Lemme get that.", note: "let me becomes lemme" },
  { id: "k5", written: "I have to leave.", heard: "I hafta leave.", note: "have to becomes hafta, f sound" },
  { id: "k6", written: "She used to live here.", heard: "She yoostuh live here.", note: "used to reduces, final d is silent" },
  { id: "k7", written: "Give me a call.", heard: "Gimme a call.", note: "give me becomes gimme" },
  { id: "k8", written: "Do you want to come?", heard: "Dya wanna come?", note: "do you compresses into one sound" },
];
