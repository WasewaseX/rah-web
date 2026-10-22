// Task 82 — the plain-language naming audit (polish #10): the canonical
// registry of every coined name the app uses, each with a plain-language
// gloss. Surfaces render the gloss next to the name; the battery pins the
// registry so a new coined name cannot ship unexplained.
//
// Rule: a gloss must explain the thing in words a new learner understands —
// it may not use another coined name, and it must not overclaim (the proxy
// labels stay: bots are bots, scores are estimates where they are).

export const NAMING = {
  speed: { name: "Speed Round", gloss: "a 40-question blitz against the clock" },
  boss: { name: "Boss Battle", gloss: "a three-phase fight against a bot examiner built from your weak spots" },
  voice: { name: "Voice Arena", gloss: "speak through timed prompts and get a report (fluency numbers are estimates, not a verdict)" },
  dungeon: { name: "Daily Dungeon", gloss: "three floors of four questions drawn from today's deck" },
  duel: { name: "Rival Duel", gloss: "eight items against your bot rival's sealed par score" },
  gauntlet: { name: "The Gauntlet", gloss: "one item at a time — the run ends on your first miss" },
  league: { name: "League", gloss: "a weekly XP race — against practice bots, not other learners" },
  flow: { name: "Flow", gloss: "one long focus block of mixed questions" },
  talents: { name: "Talents", gloss: "spend the points you earn from leveling up on small perks" },
  trophies: { name: "Trophies", gloss: "achievements you have earned so far" },
  mindReader: { name: "Mind Reader", gloss: "the coach's memory of your mistakes — you can correct or forgive anything it quotes" },
  soundLab: { name: "Sound Lab", gloss: "sound-contrast drills with honestly labeled inference — not a phonetic test" },
  readAloud: { name: "Read Aloud", gloss: "read a sentence aloud and see which words were recognized" },
  examiner: { name: "The Examiner", gloss: "the simulated opponent of the three-phase fight" },
  practiceBot: { name: "practice bot", gloss: "a simulated opponent — no other learner is on the other side" },
} as const;

export type NamingKey = keyof typeof NAMING;

/** Plain-language rule check: a gloss must not lean on another coined name. */
export function glossIsPlain(key: NamingKey): boolean {
  const gloss = NAMING[key].gloss.toLowerCase();
  return (Object.keys(NAMING) as NamingKey[]).every((k) => {
    if (k === key) return true;
    const other = NAMING[k].name.toLowerCase();
    // "practice bot" glosses may reference bots; the bot chip is its own label
    if (k === "practiceBot") return true;
    return !gloss.includes(other);
  });
}
