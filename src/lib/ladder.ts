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

export type Band = "A2" | "B1" | "B2" | "C1";

export interface Ladder {
  band: Band;
  monologueWords: [number, number]; // listen text length band
  sentenceWords: [number, number]; // typical sentence length band
  idiomDensity: "plain" | "moderate" | "rich";
  ttsRate: number; // spoken material playback rate
  speakStrictness: "gentle" | "standard" | "strict";
  quizLevels: Band[]; // bands quiz material may draw from
  readOrder: "short-first" | "balanced" | "long-first";
}

const LADDERS: Record<Band, Ladder> = {
  A2: {
    band: "A2",
    monologueWords: [110, 150],
    sentenceWords: [8, 12],
    idiomDensity: "plain",
    ttsRate: 0.82,
    speakStrictness: "gentle",
    quizLevels: ["A2", "B1"],
    readOrder: "short-first",
  },
  B1: {
    band: "B1",
    monologueWords: [140, 190],
    sentenceWords: [10, 16],
    idiomDensity: "plain",
    ttsRate: 0.86,
    speakStrictness: "gentle",
    quizLevels: ["A2", "B1", "B2"],
    readOrder: "short-first",
  },
  B2: {
    band: "B2",
    monologueWords: [160, 220],
    sentenceWords: [12, 20],
    idiomDensity: "moderate",
    ttsRate: 0.92,
    speakStrictness: "standard",
    quizLevels: ["B1", "B2", "C1"],
    readOrder: "balanced",
  },
  C1: {
    band: "C1",
    monologueWords: [220, 280],
    sentenceWords: [16, 28],
    idiomDensity: "rich",
    ttsRate: 0.98,
    speakStrictness: "strict",
    quizLevels: ["B2", "C1"],
    readOrder: "long-first",
  },
};

export function ladderFor(level: string): Ladder {
  const key = String(level ?? "?").toUpperCase();
  return LADDERS[(["A2", "B1", "B2", "C1"].includes(key) ? key : "B2") as Band];
}

// The instruction block injected into generator prompts. Deterministic
// wording per band so the drive can assert the material actually shifts.
export function ladderBrief(l: Ladder, what: "listen" | "speak" | "quiz"): string {
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
const BAND_ORDER: Record<Band, string[]> = {
  A2: ["A2", "B1", "B2", "C1"],
  B1: ["B1", "A2", "B2", "C1"],
  B2: ["B2", "B1", "C1", "A2"],
  C1: ["C1", "B2", "B1", "A2"],
};

export function orderReadings<T extends { level: string; minutes: number }>(readings: T[], band: Band): T[] {
  const pref = BAND_ORDER[band];
  const rank = (r: { level: string }) => {
    const i = pref.indexOf(String(r.level).toUpperCase());
    return i === -1 ? pref.length : i;
  };
  const longFirst = ladderFor(band).readOrder === "long-first";
  const byMinutes = (a: T, b: T) => (longFirst ? b.minutes - a.minutes : a.minutes - b.minutes);
  return [...readings].sort((a, b) => rank(a) - rank(b) || byMinutes(a, b));
}
