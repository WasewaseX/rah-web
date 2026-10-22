/**
 * Task 82 — plain-language naming audit: unit battery.
 * Run: bun scripts/test-naming.ts
 */
import { NAMING, glossIsPlain } from "../src/lib/naming";

let pass = 0, fail = 0;
const check = (ok: boolean, what: string, detail = "") => {
  if (ok) { pass++; console.log(`PASS ${what}`); }
  else { fail++; console.log(`FAIL ${what} -> ${detail}`); }
};

const keys = Object.keys(NAMING) as (keyof typeof NAMING)[];
check(keys.length >= 15, "the registry covers the coined names", String(keys.length));
check(keys.every((k) => NAMING[k].gloss.length >= 15), "every gloss actually explains (>=15 chars)");
check(keys.every(glossIsPlain), "no gloss leans on another coined name (plain-language rule)");
check(NAMING.league.gloss.includes("practice bots"), "League gloss says who the opponents really are");
check(NAMING.voice.gloss.includes("estimates"), "Voice Arena gloss keeps the proxy label");
check(NAMING.soundLab.gloss.includes("not a phonetic test"), "Sound Lab gloss keeps the epistemics boundary");
check(NAMING.practiceBot.name === "practice bot", "the bot label itself is plain language");

// the exact glosses the Arcade floor renders (Task 82 wiring)
check(NAMING.speed.gloss === "a 40-question blitz against the clock", "Speed gloss pinned");
check(NAMING.gauntlet.gloss.includes("first miss"), "Gauntlet gloss pins the miss rule");

console.log(`\n=== NAMING BATTERY: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
