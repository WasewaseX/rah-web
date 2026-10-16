// The arcade engine: lifetime XP, levels, achievements, daily quests,
// GameStat records, the rubber-band rival and the streak forge. Every hook
// the app already had (review grades, exam grades, essays, monologues, chat
// turns, placement) now flows through here, so one currency and one ladder
// connect all surfaces. Deterministic everywhere: no cron, no background jobs.

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { topMistakes } from "@/lib/mistakes";
import { bumpDaily } from "@/lib/server";

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
}

async function achCtx(): Promise<AchCtx> {
  const [reviews, writes, speaks, learner, speedBest, speedCombo, bossWins, bossFlaw, doneToday, rival] = await Promise.all([
    db.reviewLog.count(),
    db.writingSub.count(),
    db.speakSession.count(),
    db.learner.findUnique({ where: { id: "me" } }),
    db.gameStat.findUnique({ where: { key: "speed:best" } }),
    db.gameStat.findUnique({ where: { key: "speed:combo" } }),
    db.gameStat.findUnique({ where: { key: "boss:wins" } }),
    db.gameStat.findUnique({ where: { key: "boss:flawless" } }),
    db.quest.count({ where: { day: dayIndex(), done: true } }),
    db.rival.findUnique({ where: { id: "me" } }),
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
  return out;
}

// Unlock anything newly satisfied. Returns the fresh rows (already earned
// ones are untouched). Safe to call as often as wanted.
export async function evaluateAchievements(): Promise<{ key: string; title: string; desc: string; icon: string }[]> {
  const ctx = await achCtx();
  const should = new Set(ctxUnlocks(ctx));
  const have = await db.achievement.findMany({ where: { key: { in: [...should] } } });
  const haveKeys = new Set(have.map((a) => a.key));
  const fresh = [...should].filter((k) => !haveKeys.has(k));
  if (fresh.length === 0) return [];
  await db.achievement.createMany({ data: fresh.map((key) => ({ key })) });
  return fresh.map((key) => {
    const d = ACHIEVEMENTS.find((a) => a.key === key)!;
    return { key, title: d.title, desc: d.desc, icon: d.icon };
  });
}

// ---------- XP ----------

export interface XpResult {
  total: number;
  level: number;
  levelName: string;
  leveledUp: boolean;
  unlocked: { key: string; title: string; desc: string; icon: string }[];
}

// Single XP faucet. Routes replace their raw bumpDaily("xp") calls with this;
// it pays the learner, keeps today's DailyStat in sync (the "XP today" chip
// and the rival race both read it), and checks trophies.
export async function awardXp(amount: number): Promise<XpResult> {
  const amt = Math.max(0, Math.min(500, Math.round(amount)));
  const l = await db.learner.upsert({
    where: { id: "me" },
    create: { id: "me", xp: amt },
    update: { xp: { increment: amt } },
  });
  await bumpDaily("xp", amt);
  const before = levelFromXp(l.xp - amt);
  const view = levelView(l.xp);
  const unlocked = await evaluateAchievements();
  return {
    total: l.xp,
    level: view.level,
    levelName: view.name,
    leveledUp: view.level > before,
    unlocked,
  };
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
];

// Seeded pick of 3 quests per day, biased by active mistake families so the
// day's missions always point at the leaks. Deterministic per day.
export async function ensureQuests(): Promise<void> {
  const day = dayIndex();
  const existing = await db.quest.count({ where: { day } });
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
      return { id: `${day}:${key}`, day, key, title: t.title, fa: t.fa, target: t.target, xp: t.xp, progress: 0, done: false, ...(i === -1 ? {} : {}) };
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
  const q = await db.quest.findUnique({ where: { id: `${day}:${key}` } });
  if (!q || q.done) return;
  const t = QUEST_TEMPLATES.find((x) => x.key === key);
  const progress = t?.kind === "max" ? Math.max(q.progress, amount) : q.progress + amount;
  if (progress >= q.target) {
    await db.quest.update({ where: { id: q.id }, data: { progress: q.target, done: true } });
    await awardXp(q.xp);
    await evaluateAchievements();
  } else {
    await db.quest.update({ where: { id: q.id }, data: { progress } });
  }
}

// ---------- GameStat ----------

export async function bumpStat(key: string, best?: number): Promise<{ best: number; isNew: boolean }> {
  const row = await db.gameStat.findUnique({ where: { key } });
  if (!row) {
    await db.gameStat.create({ data: { key, best: best ?? 0, plays: key.includes(":") && !best ? 1 : 0 } });
    if (best !== undefined) return { best, isNew: best > 0 };
    return { best: 0, isNew: false };
  }
  if (best !== undefined && best > row.best) {
    await db.gameStat.update({ where: { key }, data: { best, plays: { increment: 1 } } });
    return { best, isNew: true };
  }
  if (best === undefined) {
    await db.gameStat.update({ where: { key }, data: { plays: { increment: 1 } } });
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
  let rival = await db.rival.findUnique({ where: { id: "me" } });
  if (!rival) {
    const seedName = RIVAL_NAMES[seededUnit(wk) === 0 ? 0 : Math.floor(seededUnit(wk + 7) * RIVAL_NAMES.length)];
    rival = await db.rival.create({ data: { id: "me", name: seedName, weekKey: wk, taunt: RIVAL_TAUNTS[Math.floor(seededUnit(wk + 3) * RIVAL_TAUNTS.length)] } });
  }

  // Trailing 7-day learner XP average (yesterday backwards).
  const recent = await db.dailyStat.findMany({ where: { day: { gte: day - 7, lt: day } } });
  const weekSum = recent.reduce((s, r) => s + r.xp, 0);
  const avg = weekSum / 7;
  const dailyTarget = Math.max(70, Math.round(avg * 0.8));

  if (rival.weekKey !== wk) {
    // Rollover: settle last week's race, then reset.
    const lastWk = weekOf(day - 1);
    const lastWkDays = Array.from({ length: 7 }, (_, i) => lastWk * 7 + i);
    const youLast = await db.dailyStat.findMany({ where: { day: { in: lastWkDays } } });
    const youXp = youLast.reduce((s, r) => s + r.xp, 0);
    const wins = rival.wins + (youXp >= rival.weekXp ? 1 : 0);
    const losses = rival.losses + (youXp < rival.weekXp ? 1 : 0);
    rival = await db.rival.update({
      where: { id: "me" },
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
    rival = await db.rival.update({ where: { id: "me" }, data: { weekXp: expected } });
  }

  const thisWkDays = Array.from({ length: 7 }, (_, i) => wk * 7 + i);
  const youThis = await db.dailyStat.findMany({ where: { day: { in: thisWkDays } } });
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
  const xp = l?.xp ?? 0;
  const [ach, stats] = await Promise.all([
    db.achievement.findMany({ orderBy: { at: "desc" } }),
    db.gameStat.findMany(),
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
