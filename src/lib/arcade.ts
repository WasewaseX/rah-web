// The arcade engine: lifetime XP, levels, achievements, daily quests,
// GameStat records, the rubber-band rival and the streak forge. Every hook
// the app already had (review grades, exam grades, essays, monologues, chat
// turns, placement) now flows through here, so one currency and one ladder
// connect all surfaces. Deterministic everywhere: no cron, no background jobs.

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { topMistakes } from "@/lib/mistakes";
import { contentUserId } from "@/lib/scope";
import { bumpDaily, getLearner } from "@/lib/server";
import { GEMS, awardGems, boostActive } from "@/lib/shop";

// Per-user isolation (Task 67, the recorded residual): every arcade table -
// the FSRS deck queue, trophies, game records, quests, rival, league, runs,
// skill bands, placement - is keyed by the session user now. Functions keep
// their shapes: the user resolves from the request context (cookie ladder)
// and degrades to the singleton "me" under the deployment lock.
async function uid(): Promise<string> {
  return contentUserId().catch(() => "me");
}

// ---------- Momentum (cross-surface combo chains) ----------

// Every correct answer on any surface extends today's chain; any miss halves
// it (the chain_shield talent absorbs the first miss of the day), and a new
// day resets it. Heat tiers turn the chain into an XP multiplier, so a hot
// streak anywhere - reviews, exams, speed rounds, duels - pays everywhere.

export const HEAT_TIERS = [
  { min: 0, mult: 1, label: "cold" },
  { min: 5, mult: 1.05, label: "warming" },
  { min: 10, mult: 1.1, label: "warm" },
  { min: 15, mult: 1.2, label: "hot" },
  { min: 25, mult: 1.3, label: "blazing" },
] as const;

export function heatOf(chain: number): { min: number; mult: number; label: string } {
  let t: { min: number; mult: number; label: string } = HEAT_TIERS[0];
  for (const tier of HEAT_TIERS) if (chain >= tier.min) t = tier;
  return { min: t.min, mult: t.mult, label: t.label };
}

async function freshChain(l: { chain: number; chainDay: number }): Promise<number> {
  const today = dayIndex();
  return l.chainDay === today ? l.chain : 0;
}

export async function getChain(): Promise<{ chain: number; mult: number; label: string }> {
  const l = await getLearner();
  const chain = await freshChain(l);
  const heat = heatOf(chain);
  return { chain, ...heat };
}

export async function registerHit(): Promise<{ chain: number; mult: number; label: string }> {
  const l = await getLearner();
  const today = dayIndex();
  const base = await freshChain(l);
  const chain = base + 1;
  await db.learner.update({ where: { id: "me" }, data: { chain, chainDay: today } });
  await bumpStat("chain:best", chain);
  const heat = heatOf(chain);
  await progressQuest("heat_15", chain);
  return { chain, ...heat };
}

export async function registerMiss(): Promise<void> {
  const l = await getLearner();
  const today = dayIndex();
  const u = await uid();
  const base = await freshChain(l);
  if (base === 0) return;
  const shielded = hasPerk(l.perks, "chain_shield");
  if (shielded) {
    const key = `shield:${today}`;
    const used = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key } } });
    if (!used) {
      await db.gameStat.create({ data: { userId: u, key, best: 1, plays: 0 } });
      return; // shield ate the miss; chain keeps running
    }
  }
  const chain = Math.floor(base / 2);
  await db.learner.update({ where: { id: "me" }, data: { chain, chainDay: today } });
}

// ---------- Talents (perk tree) ----------

export interface PerkDef {
  key: string;
  branch: string; // SkillLevel skill the branch hangs from
  tier: number; // 1..4, bought in order, tier N requires SP N
  title: string;
  desc: string;
}

export const PERKS: PerkDef[] = [
  { key: "xp_review", branch: "reading", tier: 1, title: "Fast Reader", desc: "+15% XP from every review grade." },
  { key: "chain_shield", branch: "vocabulary", tier: 2, title: "Chain Shield", desc: "The first miss each day no longer halves your momentum chain." },
  { key: "duel_time", branch: "writing", tier: 1, title: "Cool Head", desc: "+10 seconds on every Rival Duel timer." },
  { key: "dungeon_heart", branch: "listening", tier: 2, title: "Iron Lungs", desc: "Enter the Daily Dungeon with 4 hearts instead of 3." },
  { key: "freeze_cap", branch: "speaking", tier: 3, title: "Deep Freezer", desc: "Streak freeze bank grows to 3 (from 2)." },
  { key: "quest_boost", branch: "grammar", tier: 2, title: "Overachiever", desc: "Quest payouts pay +15% XP." },
] as const;

export function hasPerk(perksJson: string, key: string): boolean {
  if (!perksJson) return false;
  try {
    return (JSON.parse(perksJson) as string[]).includes(key);
  } catch {
    return false;
  }
}

export async function learnerPerks(): Promise<string[]> {
  const l = await getLearner();
  if (!l.perks) return [];
  try {
    return JSON.parse(l.perks) as string[];
  } catch {
    return [];
  }
}

export interface PerksView {
  sp: number;
  owned: string[];
  perks: PerkDef[];
  skills: { skill: string; score: number }[];
  leveled: boolean;
}

export async function getPerksView(): Promise<PerksView> {
  const l = await getLearner();
  const u = await uid();
  // Retroactive catch-up: the tree arrives when the learner is already deep
  // in the ladder, so their earned SP is granted once on first open.
  const init = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "talents:init" } } });
  let sp = l.sp;
  let leveled = false;
  if (!init) {
    const level = levelFromXp(l.xp);
    sp += Math.max(0, level - 1);
    await db.learner.update({ where: { id: "me" }, data: { sp } });
    await db.gameStat.create({ data: { userId: u, key: "talents:init", best: level, plays: 0 } });
    leveled = true;
  }
  const skills = await db.skillLevel.findMany({ where: { userId: u } });
  return {
    sp,
    owned: learnerPerksFrom(l.perks),
    perks: PERKS,
    skills: skills.map((s) => ({ skill: s.skill, score: s.score })),
    leveled,
  };
}

function learnerPerksFrom(json: string): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

export async function buyPerk(key: string): Promise<{ ok: boolean; error?: string; sp: number; owned: string[] }> {
  const def = PERKS.find((p) => p.key === key);
  if (!def) return { ok: false, error: "Unknown perk", sp: 0, owned: [] };
  const l = await getLearner();
  const owned = learnerPerksFrom(l.perks);
  if (owned.includes(key)) return { ok: false, error: "Already unlocked", sp: l.sp, owned };
  // Tier N needs N-1 perks owned anywhere: every branch holds a single perk,
  // so the gate counts global progress, not same-branch purchases.
  if (owned.length < def.tier - 1) return { ok: false, error: `Unlock ${def.tier - 1} perk${def.tier - 1 === 1 ? "" : "s"} first`, sp: l.sp, owned };
  if (l.sp < def.tier) return { ok: false, error: `Needs ${def.tier} SP (you have ${l.sp})`, sp: l.sp, owned };
  const sp = l.sp - def.tier;
  const perks = JSON.stringify([...owned, key]);
  await db.learner.update({ where: { id: "me" }, data: { sp, perks } });
  return { ok: true, sp, owned: [...owned, key] };
}

// ---------- Levels ----------

// Cumulative XP needed to reach level L: 50 * (L-1)^1.45. L2=50, L3=146,
// L5=390, L10=1120, L20=3100, L40=8550. Slow start, long runway.
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 1.45));
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < 40 && xp >= xpToReach(lvl + 1)) lvl++;
  return lvl;
}

const LEVEL_NAMES = [
  "Rookie", "Apprentice", "Wordsmith", "Sharpshooter", "Gladiator",
  "Duelist", "Sage", "Mythic", "Legend",
] as const;

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((level - 1) / 5))];
}

export interface LevelView {
  level: number;
  name: string;
  xp: number;
  intoLevel: number;
  levelSpan: number;
  nextAt: number | null;
  pct: number;
}

export function levelView(xp: number): LevelView {
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
    pct: nextAt === null ? 100 : Math.min(100, Math.round((into / span) * 100)),
  };
}

// ---------- Achievements ----------

export interface AchievementDef {
  key: string;
  title: string;
  desc: string;
  icon: string; // lucide name rendered client-side
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_words", title: "First Words", desc: "Grade your very first review.", icon: "Sparkles" },
  { key: "century", title: "Century", desc: "100 lifetime reviews.", icon: "Hash" },
  { key: "millennium", title: "Millennium", desc: "1000 lifetime reviews.", icon: "Hash" },
  { key: "week_warrior", title: "Week Warrior", desc: "Hold a 7-day streak.", icon: "Flame" },
  { key: "month_monk", title: "Month Monk", desc: "Hold a 30-day streak.", icon: "Flame" },
  { key: "speed_demon", title: "Speed Demon", desc: "Score 300+ in a Speed Round.", icon: "Zap" },
  { key: "combo_10", title: "Tenfold", desc: "Hit a 10x combo in a Speed Round.", icon: "Zap" },
  { key: "boss_slayer", title: "Boss Slayer", desc: "Defeat The Examiner.", icon: "Swords" },
  { key: "boss_flawless", title: "Untouchable", desc: "Defeat The Examiner without losing a heart.", icon: "ShieldCheck" },
  { key: "quest_master", title: "Quest Master", desc: "Clear all three quests in one day.", icon: "Target" },
  { key: "essayist", title: "Essayist", desc: "Five graded essays.", icon: "PenLine" },
  { key: "orator", title: "Orator", desc: "Five diagnosed monologues.", icon: "Mic" },
  { key: "healer", title: "Healer", desc: "Heal your first mistake family.", icon: "HeartPulse" },
  { key: "healer_5", title: "Wound Closer", desc: "Heal five mistake families.", icon: "HeartPulse" },
  { key: "rival_slayer", title: "Rival Slayer", desc: "Out-gain your rival for a full week.", icon: "Trophy" },
  { key: "level_10", title: "Double Digits", desc: "Reach level 10.", icon: "Star" },
  { key: "level_20", title: "Gladiator", desc: "Reach level 20.", icon: "Star" },
  { key: "chain_25", title: "Blaze", desc: "Hold a 25-answer momentum chain.", icon: "Flame" },
  { key: "league_gold", title: "Promoted", desc: "Win promotion in a League season.", icon: "Medal" },
  { key: "dungeon_perfect", title: "Dungeon Master", desc: "Clear the Daily Dungeon without losing a heart.", icon: "Castle" },
  { key: "duel_win", title: "Duelist", desc: "Beat your rival in a Duel.", icon: "Swords" },
  { key: "gauntlet_25", title: "Deathless", desc: "Survive 25 Gauntlet items in one run.", icon: "Skull" },
  { key: "flow_5", title: "In the Zone", desc: "Finish Focus Flows 5 days in a row.", icon: "Timer" },
  { key: "anthology", title: "Anthology", desc: "Bank three graded essays in the Portfolio.", icon: "Library" },
];

interface AchCtx {
  reviews: number;
  streak: number;
  writes: number;
  speaks: number;
  healed: number;
  level: number;
  speedBest: number;
  speedCombo: number;
  bossWins: number;
  bossFlawless: number;
  questsDoneToday: number;
  rivalWins: number;
  chainBest: number;
  leaguePromotions: number;
  dungeonBest: number;
  dungeonPerfect: number;
  duelWins: number;
  gauntletBest: number;
  flowStreak: number;
}

async function achCtx(): Promise<AchCtx> {
  const u = await uid();
  const [reviews, writes, speaks, learner, speedBest, speedCombo, bossWins, bossFlaw, doneToday, rival, chainBest, leagueProm, dungeonBest, dungeonPerfect, duelWins, gauntletBest, flowStreak] = await Promise.all([
    db.reviewLog.count({ where: { userId: u } }),
    db.writingSub.count({ where: { userId: u } }),
    db.speakSession.count({ where: { userId: u } }),
    db.learner.findUnique({ where: { id: "me" } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "speed:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "speed:combo" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "boss:wins" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "boss:flawless" } } }),
    db.quest.count({ where: { userId: u, day: dayIndex(), done: true } }),
    db.rival.findUnique({ where: { userId_id: { userId: u, id: "me" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "chain:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "league:promotions" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "dungeon:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "dungeon:perfect" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "duel:wins" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "gauntlet:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "flow:streak" } } }),
  ]);
  const fams = await topMistakes(200).catch(() => []);
  return {
    reviews,
    writes,
    speaks,
    healed: fams.filter((f) => f.resolvedAt).length,
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
    flowStreak: flowStreak?.best ?? 0,
  };
}

function ctxUnlocks(c: AchCtx): string[] {
  const out: string[] = [];
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

// Unlock anything newly satisfied. Returns the fresh rows (already earned
// ones are untouched). Safe to call as often as wanted.
//
// 2026-10-21 hardening: two concurrent graders can both pass the have/fresh
// check and race the createMany. key is @id, so the loser used to throw
// P2002 and 500 a legit grade route. A unique violation now means "another
// request already awarded it" - swallowed; any other error still throws.
export async function evaluateAchievements(): Promise<{ key: string; title: string; desc: string; icon: string }[]> {
  const ctx = await achCtx();
  const should = new Set(ctxUnlocks(ctx));
  const u = await uid();
  const have = await db.achievement.findMany({ where: { userId: u, key: { in: [...should] } } });
  const haveKeys = new Set(have.map((a) => a.key));
  const fresh = [...should].filter((k) => !haveKeys.has(k));
  if (fresh.length === 0) return [];
  try {
    await db.achievement.createMany({ data: fresh.map((key) => ({ userId: u, key })) });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== "P2002") throw e;
    return [];
  }
  return fresh.map((key) => {
    const d = ACHIEVEMENTS.find((a) => a.key === key)!;
    return { key, title: d.title, desc: d.desc, icon: d.icon };
  });
}

// ---------- XP ----------

export interface XpResult {
  total: number;
  base: number; // pre-multiplier amount, for honest UI reporting
  mult: number; // momentum multiplier that was applied
  chain: number; // chain AFTER the hit that came with this award
  level: number;
  levelName: string;
  leveledUp: boolean;
  unlocked: { key: string; title: string; desc: string; icon: string }[];
}

// Single XP faucet. Routes replace their raw bumpDaily("xp") calls with this;
// it pays the learner, keeps today's DailyStat in sync (the "XP today" chip
// and the rival race both read it), and checks trophies. When opts.chainHit
// is true the award extends today's momentum chain and the chain's heat
// multiplier applies to THIS award; perk multipliers (Fast Reader, quest
// boost) stack after heat.
export async function awardXp(amount: number, opts?: { chainHit?: boolean; perkXp?: "review" | "quest" }): Promise<XpResult> {
  const chainInfo = opts?.chainHit ? await registerHit() : await getChain();
  let mult = chainInfo.mult;
  const l0 = await getLearner();
  if (opts?.perkXp === "review" && hasPerk(l0.perks, "xp_review")) mult *= 1.15;
  if (opts?.perkXp === "quest" && hasPerk(l0.perks, "quest_boost")) mult *= 1.15;
  // Shop XP boost (Duolingo RE): 2x every payout while active. Stacks after heat + talents.
  if (boostActive(l0.boostUntil)) mult *= 2;
  const base = Math.max(0, Math.min(500, Math.round(amount)));
  const amt = Math.min(500, Math.round(base * mult));
  const l = await db.learner.upsert({
    where: { id: "me" },
    create: { id: "me", xp: amt },
    update: { xp: { increment: amt } },
  });
  // Level-ups bank talent points for the tree (1 SP per level gained) and mint gems (Duolingo RE).
  const before = levelFromXp(l.xp - amt);
  const view = levelView(l.xp);
  if (view.level > before) {
    const gained = view.level - before;
    await db.learner.update({ where: { id: "me" }, data: { sp: { increment: gained }, gems: { increment: GEMS.levelUp * gained } } });
  }
  await bumpDaily("xp", amt);
  const unlocked = await evaluateAchievements();
  return {
    total: l.xp,
    base,
    mult: Math.round(mult * 100) / 100,
    chain: chainInfo.chain,
    level: view.level,
    levelName: view.name,
    leveledUp: view.level > before,
    unlocked,
  };
}

// ---------- Anti-farming: daily XP caps per game mode ----------

// The audit's polish row: "anti-farming pass". Game modes are replayable by
// design (a Speed Round is a game), so a determined player could sit on one
// mode all day minting XP. Reviews and exams stay uncapped - they ARE the
// learning work; the games are seasoning. Each mode gets a daily BASE-XP
// budget: full payout until the cap, then 25% (engagement still pays, farming
// stops paying). Heat/talent/shop multipliers still apply AFTER the cap on
// the allowed amount, exactly as before. Quest payouts are untouched (they
// are one-shot rewards, not loops).
export const GAME_XP_CAPS: Record<string, number> = {
  speed: 150,
  duel: 120,
  dungeon: 160,
  gauntlet: 120,
  boss: 120,
  flow: 100,
  pairs: 80,
};

async function addGameXpEarned(mode: string, amount: number): Promise<number> {
  const u = await uid();
  const key = `xpdaily:${mode}:${dayIndex()}`;
  const row = await db.gameStat.upsert({
    where: { userId_key: { userId: u, key } },
    create: { userId: u, key, best: amount, plays: 0 },
    update: { best: { increment: amount } },
  });
  return row.best;
}

export async function gameXpEarnedToday(mode: string): Promise<number> {
  const u = await uid();
  const row = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: `xpdaily:${mode}:${dayIndex()}` } } });
  return row?.best ?? 0;
}

export interface GameXpResult extends XpResult {
  paid: number; // base amount actually paid (after the cap, before multipliers)
  capped: boolean; // true when the daily budget for this mode was already spent
  cap: number;
}

export async function awardGameXp(mode: string, base: number, opts?: { chainHit?: boolean }): Promise<GameXpResult> {
  const cap = GAME_XP_CAPS[mode] ?? 100;
  const earned = await gameXpEarnedToday(mode);
  const safeBase = Math.max(0, Math.round(base));
  const paid = earned >= cap ? Math.round(safeBase * 0.25) : Math.min(safeBase, cap - earned);
  const res = await awardXp(paid, opts);
  if (paid > 0) await addGameXpEarned(mode, paid);
  return { ...res, paid, capped: paid < safeBase, cap };
}

// ---------- Daily quests ----------

interface QuestTemplate {
  key: string;
  title: string;
  fa: string;
  target: number;
  xp: number;
  kind: "sum" | "max"; // sum: progress accumulates; max: progress is a best (combo, phase)
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { key: "reviews_20", title: "Clear 20 reviews", fa: "۲۰ مرور را تمام کن", target: 20, xp: 60, kind: "sum" },
  { key: "reviews_35", title: "Clear 35 reviews", fa: "۳۵ مرور را تمام کن", target: 35, xp: 95, kind: "sum" },
  { key: "correct_15", title: "15 good recalls", fa: "۱۵ یادآوری درست", target: 15, xp: 70, kind: "sum" },
  { key: "chat_10", title: "10 turns with the coach", fa: "۱۰ نوبت با مربی", target: 10, xp: 50, kind: "sum" },
  { key: "write_1", title: "Grade one essay", fa: "یک بنویس و بگیر نمره", target: 1, xp: 60, kind: "sum" },
  { key: "speak_1", title: "One speaking monologue", fa: "یک مونولوگ بگو", target: 1, xp: 60, kind: "sum" },
  { key: "exam_1", title: "Take a coach exam", fa: "یک امتحان بده", target: 1, xp: 80, kind: "sum" },
  { key: "speed_play", title: "Finish a Speed Round", fa: "یک دور سرعتی بازی کن", target: 1, xp: 40, kind: "sum" },
  { key: "speed_combo_8", title: "Reach an 8x combo", fa: "کمبو ۸ برسانی", target: 8, xp: 80, kind: "max" },
  { key: "boss_phase", title: "Survive 2 boss phases", fa: "۲ فاز رئیس زنده بمان", target: 2, xp: 60, kind: "max" },
  { key: "boss_win", title: "Slay The Examiner", fa: "امتحان‌دهنده را بکش", target: 1, xp: 120, kind: "sum" },
  { key: "arena_5", title: "5 Voice Arena reps", fa: "۵ تمرین میکروفونی", target: 5, xp: 70, kind: "sum" },
  { key: "heat_15", title: "Reach a 15-chain", fa: "زنجیره ۱۵ بساز", target: 15, xp: 90, kind: "max" },
  { key: "dungeon_1", title: "Clear the Daily Dungeon", fa: "سیاهچال امروز را بزن", target: 1, xp: 80, kind: "sum" },
  { key: "duel_1", title: "Win a Rival Duel", fa: "یک دوئل را ببر", target: 1, xp: 80, kind: "sum" },
  { key: "gauntlet_10", title: "Survive 10 Gauntlet items", fa: "۱۰ آیتم گانتلت زنده بمان", target: 10, xp: 90, kind: "max" },
  { key: "flow_1", title: "Finish a Focus Flow", fa: "یک جریان تمرکز تمام کن", target: 1, xp: 70, kind: "sum" },
];

// Seeded pick of 3 quests per day, biased by active mistake families so the
// day's missions always point at the leaks. Deterministic per day.
export async function ensureQuests(): Promise<void> {
  const day = dayIndex();
  const u = await uid();
  const existing = await db.quest.count({ where: { userId: u, day } });
  if (existing > 0) return;
  let famTags: string[] = [];
  try {
    famTags = (await topMistakes(10)).filter((f) => !f.resolvedAt).map((f) => f.tag);
  } catch {
    // fresh db
  }
  const pick = seededPick(QUEST_TEMPLATES.map((t) => t.key), 3, day);
  await db.quest.createMany({
    data: pick.map((key, i) => {
      const t = QUEST_TEMPLATES.find((q) => q.key === key)!;
      return { userId: u, id: `${day}:${key}`, day, key, title: t.title, fa: t.fa, target: t.target, xp: t.xp, progress: 0, done: false, ...(i === -1 ? {} : {}) };
    }),
  });
  void famTags; // biasing hook reserved: templates already cover every surface
}

function seededPick<T>(arr: T[], n: number, seed: number): T[] {
  const a = [...arr];
  let s = seed * 2654435761 % 4294967296;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Progress a quest by key. kind "sum" accumulates, "max" keeps the best.
// Finishing pays the quest XP through the same awardXp faucet.
export async function progressQuest(key: string, amount: number): Promise<void> {
  const day = dayIndex();
  const u = await uid();
  const q = await db.quest.findUnique({ where: { userId_id: { userId: u, id: `${day}:${key}` } } });
  if (!q || q.done) return;
  const t = QUEST_TEMPLATES.find((x) => x.key === key);
  const progress = t?.kind === "max" ? Math.max(q.progress, amount) : q.progress + amount;
  if (progress >= q.target) {
    await db.quest.update({ where: { userId_id: { userId: u, id: q.id } }, data: { progress: q.target, done: true } });
    await awardXp(q.xp, { perkXp: "quest" });
    await awardGems(GEMS.questDone).catch(() => undefined);
    await evaluateAchievements();
  } else {
    await db.quest.update({ where: { userId_id: { userId: u, id: q.id } }, data: { progress } });
  }
}

// ---------- League (weekly divisions with ghost standings) ----------

export const DIVISIONS = ["Wood", "Bronze", "Silver", "Gold", "Platinum", "Rahiator"] as const;
const LEAGUE_SIZE = 8; // you + 7 ghosts
const PROMOTE_PLACES = 3; // top 3 climb
const DEMOTE_PLACES = 3; // bottom 3 drop

export interface LeagueStanding {
  name: string;
  xp: number;
  you: boolean;
}

export interface LeagueView {
  division: number;
  divisionName: string;
  standings: LeagueStanding[];
  place: number;
  daysLeft: number;
  promoteCut: number; // xp of the last promoted slot
  demoteCut: number; // xp above the demotion zone
  history: { week: number; division: number; place: number; promoted: boolean; demoted: boolean }[];
}

function ghostXp(week: number, slot: number, dailyTarget: number, dayOfWeek: number): number {
  // Deterministic ghost accumulation, slot 0..6, mirrors the rival's rubber
  // band so every league feels alive but beatable.
  let sum = 0;
  for (let d = 0; d <= dayOfWeek; d++) {
    const jitter = 0.55 + seededUnit(week * 977 + slot * 61 + d) * 0.95;
    sum += Math.round(dailyTarget * jitter);
  }
  return sum;
}

export async function getLeagueView(): Promise<LeagueView> {
  const day = dayIndex();
  const wk = weekOf(day);
  const dayOfWeek = day - wk * 7;
  const u = await contentUserId().catch(() => "me");
  const recent = await db.dailyStat.findMany({ where: { userId: u, day: { gte: day - 7, lt: day } } });
  const avg = recent.reduce((s, r) => s + r.xp, 0) / 7;
  const dailyTarget = Math.max(70, Math.round(avg * 0.8));

  let row = await db.league.findUnique({ where: { userId_id: { userId: u, id: "me" } } });
  if (!row) {
    const l = await getLearner();
    const lvl = levelFromXp(l.xp);
    const startDivision = lvl >= 25 ? 3 : lvl >= 15 ? 2 : lvl >= 8 ? 1 : 0;
    row = await db.league.create({ data: { userId: u, id: "me", weekKey: wk, division: startDivision } });
  }

  if (row.weekKey !== wk) {
    // Settle last week: compute final place, apply promotion/demotion.
    const settled = row;
    const lastDow = 6;
    const thisWkDays = Array.from({ length: 7 }, (_, i) => settled.weekKey * 7 + i);
    const youRows = await db.dailyStat.findMany({ where: { userId: u, day: { in: thisWkDays } } });
    const youXp = youRows.reduce((s, r) => s + r.xp, 0);
    const lastAvg = Math.max(70, Math.round(avg * 0.8));
    const ghosts = Array.from({ length: LEAGUE_SIZE - 1 }, (_, i) => ghostXp(settled.weekKey, i, lastAvg, lastDow));
    const place = 1 + ghosts.filter((g) => g > youXp).length;
    const promoted = place <= PROMOTE_PLACES && settled.division < DIVISIONS.length - 1;
    const demoted = place > LEAGUE_SIZE - DEMOTE_PLACES && settled.division > 0;
    const division = Math.max(0, Math.min(DIVISIONS.length - 1, settled.division + (promoted ? 1 : demoted ? -1 : 0)));
    const history = JSON.parse(settled.history || "[]") as LeagueView["history"];
    history.push({ week: settled.weekKey, division: settled.division, place, promoted, demoted });
    if (promoted) {
      const prev = (await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "league:promotions" } } }))?.best ?? 0;
      await bumpStat("league:promotions", prev + 1);
      await awardXp(150);
    }
    row = await db.league.update({ where: { userId_id: { userId: u, id: "me" } }, data: { weekKey: wk, division, history: JSON.stringify(history.slice(-12)) } });
  }

  const thisWkDays = Array.from({ length: 7 }, (_, i) => wk * 7 + i);
  const youRows = await db.dailyStat.findMany({ where: { userId: u, day: { in: thisWkDays } } });
  const youXp = youRows.reduce((s, r) => s + r.xp, 0);
  const standings: LeagueStanding[] = [
    { name: "You", xp: youXp, you: true },
    ...Array.from({ length: LEAGUE_SIZE - 1 }, (_, i) => ({
      name: RIVAL_NAMES[(wk * 13 + i * 5) % RIVAL_NAMES.length],
      xp: ghostXp(wk, i, dailyTarget, dayOfWeek),
      you: false,
    })),
  ].sort((a, b) => b.xp - a.xp);
  const place = 1 + standings.findIndex((s) => s.you);
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
    history: JSON.parse(row.history || "[]") as LeagueView["history"],
  };
}

// ---------- GameStat ----------

export async function bumpStat(key: string, best?: number): Promise<{ best: number; isNew: boolean }> {
  const u = await uid();
  const row = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key } } });
  if (!row) {
    await db.gameStat.create({ data: { userId: u, key, best: best ?? 0, plays: key.includes(":") && !best ? 1 : 0 } });
    if (best !== undefined) return { best, isNew: best > 0 };
    return { best: 0, isNew: false };
  }
  if (best !== undefined && best > row.best) {
    await db.gameStat.update({ where: { userId_key: { userId: u, key } }, data: { best, plays: { increment: 1 } } });
    return { best, isNew: true };
  }
  if (best === undefined) {
    await db.gameStat.update({ where: { userId_key: { userId: u, key } }, data: { plays: { increment: 1 } } });
  }
  return { best: row.best, isNew: false };
}

// ---------- Rival ----------

const RIVAL_NAMES = [
  "Vahid the Verbose", "Sahar Silver-tongue", "Arman Atrox", "Parham the Pitiless",
  "Neda Nine-lives", "Kian Kill-switch", "Roya Razor-tongue", "Behnam Blackout",
] as const;

const RIVAL_TAUNTS = [
  "I graded three essays before breakfast. Did you?",
  "My streak is architectural at this point.",
  "The Examiner and I play cards on Sundays. You weren't invited.",
  "I review at 5 a.m. Because standards.",
  "Your XP graph looks like a flatline, friend.",
  "Catch up. I will wait. Briefly.",
] as const;

function weekOf(day: number): number {
  return Math.floor(day / 7);
}

function seededUnit(day: number): number {
  // Deterministic 0..1 jitter per calendar day.
  let s = (day * 2654435761) % 4294967296;
  s = (s * 1103515245 + 12345) % 2147483648;
  return s / 2147483648;
}

export interface RivalView {
  name: string;
  weekXp: number;
  you: number;
  lastWeekYou: number;
  lastWeekRival: number;
  wins: number;
  losses: number;
  taunt: string;
  dailyTarget: number;
}

// Lazily advances the rival to the current week. rivalWeekXp grows
// deterministically day by day from a rubber-banded daily target (80% of the
// learner's trailing 7-day average, clamped), so the race is tense but fair.
export async function getRivalView(): Promise<RivalView> {
  const day = dayIndex();
  const wk = weekOf(day);
  const u = await uid();
  let rival = await db.rival.findUnique({ where: { userId_id: { userId: u, id: "me" } } });
  if (!rival) {
    const seedName = RIVAL_NAMES[seededUnit(wk) === 0 ? 0 : Math.floor(seededUnit(wk + 7) * RIVAL_NAMES.length)];
    rival = await db.rival.create({ data: { userId: u, id: "me", name: seedName, weekKey: wk, taunt: RIVAL_TAUNTS[Math.floor(seededUnit(wk + 3) * RIVAL_TAUNTS.length)] } });
  }

  // Trailing 7-day learner XP average (yesterday backwards).
  const recent = await db.dailyStat.findMany({ where: { userId: u, day: { gte: day - 7, lt: day } } });
  const weekSum = recent.reduce((s, r) => s + r.xp, 0);
  const avg = weekSum / 7;
  const dailyTarget = Math.max(70, Math.round(avg * 0.8));

  if (rival.weekKey !== wk) {
    // Rollover: settle last week's race, then reset.
    const lastWk = weekOf(day - 1);
    const lastWkDays = Array.from({ length: 7 }, (_, i) => lastWk * 7 + i);
    const youLast = await db.dailyStat.findMany({ where: { userId: u, day: { in: lastWkDays } } });
    const youXp = youLast.reduce((s, r) => s + r.xp, 0);
    const wins = rival.wins + (youXp >= rival.weekXp ? 1 : 0);
    const losses = rival.losses + (youXp < rival.weekXp ? 1 : 0);
    rival = await db.rival.update({
      where: { userId_id: { userId: u, id: "me" } },
      data: {
        lastWeekXp: rival.weekXp,
        weekXp: 0,
        weekKey: wk,
        wins,
        losses,
        name: RIVAL_NAMES[Math.floor(seededUnit(wk + 11) * RIVAL_NAMES.length)],
        taunt: RIVAL_TAUNTS[Math.floor(seededUnit(wk + 5) * RIVAL_TAUNTS.length)],
      },
    });
  }

  // Bring the rival's week up to its deterministic schedule for today.
  const dayOfWeek = day - wk * 7; // 0..6
  let expected = 0;
  for (let d = 0; d <= dayOfWeek; d++) {
    const jitter = 0.75 + seededUnit(wk * 7 + d) * 0.55;
    expected += Math.round(dailyTarget * jitter);
  }
  if (rival.weekXp < expected) {
    rival = await db.rival.update({ where: { userId_id: { userId: u, id: "me" } }, data: { weekXp: expected } });
  }

  const thisWkDays = Array.from({ length: 7 }, (_, i) => wk * 7 + i);
  const youThis = await db.dailyStat.findMany({ where: { userId: u, day: { in: thisWkDays } } });
  const youWeek = youThis.reduce((s, r) => s + r.xp, 0);

  return {
    name: rival.name,
    weekXp: rival.weekXp,
    you: youWeek,
    lastWeekYou: 0, // filled at rollover comparison time; shown via wins/losses
    lastWeekRival: rival.lastWeekXp,
    wins: rival.wins,
    losses: rival.losses,
    taunt: rival.taunt,
    dailyTarget,
  };
}

// ---------- Arcade state view (what /api/state embeds) ----------

export interface GameView {
  level: LevelView;
  unlocked: string[];
  all: AchievementDef[];
  recent: { key: string; title: string; desc: string; icon: string }[]; // unlocked in the last 90s, for toasts
  stats: { key: string; best: number; plays: number }[];
  freezes: number;
}

export async function getGameView(): Promise<GameView> {
  const l = await db.learner.findUnique({ where: { id: "me" } });
  const u = await uid();
  const xp = l?.xp ?? 0;
  const [ach, stats] = await Promise.all([
    db.achievement.findMany({ where: { userId: u }, orderBy: { at: "desc" } }),
    db.gameStat.findMany({ where: { userId: u } }),
  ]);
  const cutoff = new Date(Date.now() - 90_000);
  const recent = ach
    .filter((a) => a.at >= cutoff)
    .map((a) => {
      const d = ACHIEVEMENTS.find((x) => x.key === a.key);
      return d ? { key: a.key, title: d.title, desc: d.desc, icon: d.icon } : null;
    })
    .filter((x): x is { key: string; title: string; desc: string; icon: string } => x !== null);
  return {
    level: levelView(xp),
    unlocked: ach.map((a) => a.key),
    all: ACHIEVEMENTS,
    recent,
    stats: stats.map((s) => ({ key: s.key, best: s.best, plays: s.plays })),
    freezes: l?.freezes ?? 0,
  };
}
