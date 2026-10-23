"use client";

// Progress: honest numbers only. 5 week activity grid, per unit maturity,
// per skill leak rate, writing and speaking score trends, coach advice.

import { useEffect, useRef, useState } from "react";
import { Flame, TrendingUp, Target, Snowflake, Radar as RadarIcon, LineChart, Scale, Compass, Map } from "lucide-react";
import { Card, Chip, Note, Bar, Btn } from "./ui";
import { handCoach } from "@/lib/bus";
import { Radar, AccuracyTimeline } from "./WarRoom";
import MindReader from "./MindReader";
import GoalPlanner from "./GoalPlanner";
import Replay from "./Replay";
import Portfolio from "./Portfolio";
import BattleCardButton from "./BattleCardButton";
import type { ViewId } from "./App";
import type { AppState } from "./App";

interface UnitRow {
  unit: string;
  total: number;
  started: number;
  mature: number;
  avgS: number;
}
interface SkillRow {
  skill: string;
  lapseRate: number;
  due: number;
  reps: number;
}
interface Data {
  days: { day: number; reviews: number; correct: number; xp: number }[];
  byUnit: UnitRow[];
  bySkill: SkillRow[];
  advice: string[];
  writeTrend: { avg: number }[];
  speakTrend: { avg: number }[];
  skillLevels: { skill: string; level: string; score: number; samples: number }[];
  bands?: { band: string; skills: { skill: string; score: number; samples: number }[]; exams: { graded: number; passed: number; bestPct: number }; proven: boolean }[];
  placementBand?: string;
  volume?: { last7: { reviews: number; written: number; spoken: number; listened: number }; last28: { reviews: number; written: number; spoken: number; listened: number } };
  totals: { reviews: number; lapses: number; cards: number; started: number };
}

export default function ProgressView({ state, go }: { state: AppState; go: (v: ViewId) => void }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/progress", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <Card>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
      </Card>
    );
  }

  const maxDay = Math.max(1, ...data.days.map((d) => d.reviews));
  const recall = data.totals.reviews > 0 ? Math.round(((data.totals.reviews - data.totals.lapses) / data.totals.reviews) * 100) : null;
  const writeAvg = data.writeTrend.length ? data.writeTrend[data.writeTrend.length - 1].avg : null;
  const speakAvg = data.speakTrend.length ? data.speakTrend[data.speakTrend.length - 1].avg : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Totals: big number tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="py-5 text-center">
          <div className="text-[28px] font-black leading-none tracking-tight text-[var(--rah-primary)]">{data.totals.started}</div>
          <div className="mt-2 text-xs font-semibold text-[#7d889c]">of {data.totals.cards} cards started</div>
        </Card>
        <Card className="py-5 text-center">
          <div className="text-[28px] font-black leading-none tracking-tight text-[#f2f5fa]">{data.totals.reviews}</div>
          <div className="mt-2 text-xs font-semibold text-[#7d889c]">total reviews</div>
        </Card>
        <Card className="py-5 text-center">
          <div className={`text-[28px] font-black leading-none tracking-tight ${recall !== null && recall < 75 ? "text-[#ff6b81]" : "text-[#2fc273]"}`}>
            {recall !== null ? `${recall}%` : "-"}
          </div>
          <div className="mt-2 text-xs font-semibold text-[#7d889c]">recall rate</div>
        </Card>
        <Card className="py-5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[28px] font-black leading-none tracking-tight text-[#ffb02e]">
            <Flame className="h-6 w-6" /> {state.learner.streak}
          </div>
          <div className="mt-2 text-xs font-semibold text-[#7d889c]">day streak</div>
        </Card>
      </div>

      {/* Task 89 (review P1-4): the weekly pilot's VOLUME line. The study needs
          writing/speaking/dictation counts per week - not just review first
          attempts - and the learner should see the same numbers the pilot
          reads. Rendered even at all-zeros: an empty week is exactly what the
          learner (and the pilot) needs to SEE. */}
      {data.volume && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Practice volume</span>
            <span className="text-xs font-bold text-[#7d889c]">last 7 days · 28-day total in the tooltip</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {([
              ["essays written", data.volume.last7.written, data.volume.last28.written],
              ["speaking rounds", data.volume.last7.spoken, data.volume.last28.spoken],
              ["dictation items", data.volume.last7.listened, data.volume.last28.listened],
            ] as const).map(([label, v7, v28]) => (
              <div key={label} className="rounded-2xl bg-[#1a2130] px-3 py-3" title={`28-day total: ${v28}`}>
                <div className="text-xl font-black leading-none tracking-tight text-[var(--rah-primary)]">{v7}</div>
                <div className="mt-1.5 text-xs font-semibold text-[#7d889c]">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Streak forge */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Streak forge</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#7d889c]">
            <Snowflake className="h-3.5 w-3.5 text-[var(--rah-accent)]" />
            {state.learner.freezes} freeze{state.learner.freezes === 1 ? "" : "s"} banked
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 rounded-2xl bg-[#ffb02e]/[0.08] px-4 py-3">
            <Flame className="h-7 w-7 text-[#ffb02e]" />
            <div>
              <div className="text-2xl font-black leading-none tracking-tight text-[#ffd08a]">{state.learner.streak}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#7d889c]">day chain</div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-[#a9b4c6]">
              Every 7-day streak mints one freeze (bank caps at two). Miss a single day and a freeze absorbs it automatically - the chain survives.
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border ${i < state.learner.freezes ? "border-[var(--rah-accent)]/40 bg-[var(--rah-accent)]/[0.1]" : "border-white/[0.06] bg-white/[0.02] opacity-40"}`}
                >
                  <Snowflake className={`h-4 w-4 ${i < state.learner.freezes ? "text-[#9de6fb]" : "text-[#5c6678]"}`} />
                </div>
              ))}
              <span className="ml-2 text-xs font-medium text-[#7d889c]">
                {state.learner.streak > 0
                  ? `next freeze in ${7 - (state.learner.streak % 7)} day${7 - (state.learner.streak % 7) === 1 ? "" : "s"}`
                  : "day one starts the chain"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* P5: CEFR band map - proven vs honestly unproven */}
      {data.bands && data.bands.length > 0 && (
        <Card>
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Band map</span>
          </div>
          <div className="mb-3 text-xs font-medium text-[#7d889c]">
            Where the evidence actually sits. Green = measured by skills or exams; dim = no proof yet. The engine rates it, never the AI.
          </div>
          <div className="grid grid-cols-5 gap-2">
            {data.bands.map((b) => {
              const isPlacement = (data.placementBand ?? "?").toUpperCase() === b.band;
              return (
                <div
                  key={b.band}
                  className={`rounded-2xl border p-3 text-center ${
                    b.proven
                      ? "border-[#7ee0b8]/40 bg-[#7ee0b8]/[0.08]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <div className={`text-lg font-black tracking-tight ${b.proven ? "text-[#7ee0b8]" : "text-[#5b6577]"}`}>{b.band}</div>
                  {isPlacement && <div className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-[#ffd08a]">you are here</div>}
                  {b.proven ? (
                    <div className="mt-1.5 space-y-0.5 text-[10px] font-semibold leading-tight text-[#9db3a8]">
                      {b.skills.slice(0, 2).map((s) => (
                        <div key={s.skill}>{s.skill} {Math.round(s.score * 100)}%</div>
                      ))}
                      {b.exams.graded > 0 && (
                        <div>
                          exams {b.exams.passed}/{b.exams.graded}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[10px] font-semibold text-[#5b6577]">unproven</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* War room: mastery radar */}
      <Card>
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]">
            <RadarIcon className="h-4 w-4" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Mastery radar</span>
        </div>
        <div className="mb-3 text-xs font-medium text-[#7d889c]">
          Six measured skills, one honest hexagon. Uneven shapes are normal - the plan feeds the dents.
        </div>
        <Radar skills={data.skillLevels ?? []} />
        {(() => {
          const measured = (data.skillLevels ?? []).filter((s) => s.samples > 0);
          if (measured.length === 0) return null;
          const avg = measured.reduce((s, r) => s + r.score, 0) / measured.length;
          const gap = Math.max(0, 0.85 - avg);
          const lagging = [...measured].sort((a, b) => a.score - b.score).slice(0, 2);
          // Rough items-to-C1: each graded item moves a skill ~ 0.3/(samples+5);
          // sum the per-skill need, then divide by recent daily evidence.
          const itemsNeeded = lagging.reduce((s, r) => s + Math.ceil(((0.85 - r.score) * (r.samples + 5)) / 0.3), 0);
          const recent = data.days.slice(-14).reduce((s, d) => s + d.reviews, 0);
          const perDay = recent / 14;
          const daysOut = perDay > 0.2 ? Math.round((itemsNeeded * 2) / perDay) : null;
          return (
            <div className="mt-3 rounded-2xl bg-[#171c28] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-[#8b96a9]">distance to C1 (0.85 mastery)</span>
                <span className="text-sm font-black text-[#9dc0ff]">{Math.round(gap * 100)} pts</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#7d889c]">
                {lagging.map((s) => `${s.skill} (${Math.round(s.score * 100)}, ${s.samples} graded item${s.samples === 1 ? "" : "s"})`).join(" and ")} drag the average. Close the gap with roughly {itemsNeeded} graded items in those two -
                {daysOut !== null && daysOut < 400 ? ` at your current pace that lands in ~${daysOut} days.` : " keep feeding the coach daily and the estimate sharpens."}
              </p>
              {/* Placement confidence (audit polish #6): bands carry their
                  evidence size. Under 10 samples a band is an estimate, and
                  the UI says so instead of letting it read as a verdict. */}
              {(() => {
                const thin = measured.filter((s) => s.samples < 10);
                if (thin.length === 0) {
                  return (
                    <p className="mt-2 text-[11px] leading-relaxed text-[#5d6879]">
                      All measured bands stand on 10+ graded items - confident estimates, still tightening with every review.
                    </p>
                  );
                }
                return (
                  <p className="mt-2 text-[11px] leading-relaxed text-[#5d6879]">
                    {thin.map((s) => s.skill).join(", ")} {thin.length === 1 ? "is" : "are"} measured on fewer than 10 graded items - treat that band as a rough estimate that firms up with practice, not a verdict.
                  </p>
                );
              })()}
            </div>
          );
        })()}
      </Card>

      {/* War room: mastery ledger - the fine-grained learner model */}
      {state.mastery && state.mastery.tags.length > 0 && (
        <Card>
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ffb02e]/[0.12] text-[#ffd08a]">
              <Scale className="h-4 w-4" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Mastery ledger</span>
          </div>
          <div className="mb-3 text-xs font-medium text-[#7d889c]">{state.mastery.summary}</div>
          <div className="flex flex-col gap-2">
            {state.mastery.tags.slice(0, 8).map((t) => {
              const pct = Math.round(t.wilson * 100);
              const statusTone =
                t.status === "danger" ? "text-[#ff6b81]" : t.status === "fragile" ? "text-[#ffb02e]" : t.status === "rising" ? "text-[#2fc273]" : t.status === "solid" ? "text-[#2fc273]" : "text-[#7d889c]";
              const arrow = t.trend === "rising" ? "\u2197" : t.trend === "falling" ? "\u2198" : "\u2192";
              return (
                <div key={t.tag} className="rounded-2xl bg-[#171c28] px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-bold text-[#e7ecf5]">{t.tag.replace(/[_-]/g, " ")}</span>
                    <span className={`flex shrink-0 items-center gap-2 text-xs font-black ${statusTone}`}>
                      <span className="text-[10px] opacity-80">{arrow}</span>
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${t.status === "danger" ? "bg-[#ff6b81]" : t.status === "fragile" ? "bg-[#ffb02e]" : t.status === "unproven" ? "bg-[#5c6678]" : "bg-[#2fc273]"}`}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-[#7d889c]">
                    {t.status === "unproven"
                      ? `unproven - ${t.ok} right / ${t.no} wrong so far, keep answering`
                      : `${t.ok} right / ${t.no} wrong - ${t.status}`}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* War room: coach's next moves - the deterministic engine decides */}
      {state.nextBest && state.nextBest.length > 0 && (
        <Card>
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9dc0ff]/[0.12] text-[#9dc0ff]">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Coach&apos;s next moves</span>
          </div>
          <div className="mb-3 text-xs font-medium text-[#7d889c]">
            Chosen by your data, not the AI&apos;s mood. One tap hands it to the coach.
          </div>
          <div className="flex flex-col gap-2">
            {state.nextBest.map((a, i) => (
              <div key={`${a.action}-${a.target}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[#171c28] px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Chip tone={a.action === "review" ? "cyan" : a.action === "drill" ? "rose" : a.action === "test" ? "amber" : "emerald"}>{a.action}</Chip>
                    <span className="truncate text-sm font-bold text-[#e7ecf5]">{a.target}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-[#7d889c]">{a.reason}</div>
                </div>
                <Btn onClick={() => handCoach(a.command)} className="shrink-0">
                  Do it
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* War room: accuracy timeline */}
      <Card>
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3ccb7f]/[0.12] text-[#7fe0ac]">
            <LineChart className="h-4 w-4" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Accuracy trail</span>
          {(() => {
            const activeDays = data.days.filter((d) => d.reviews > 0);
            if (activeDays.length < 2) return null;
            const acc = Math.round((activeDays.reduce((s, d) => s + d.correct, 0) / activeDays.reduce((s, d) => s + d.reviews, 0)) * 100);
            return <Chip tone={acc >= 80 ? "emerald" : "amber"}>{acc}% over 35 days</Chip>;
          })()}
        </div>
        <AccuracyTimeline days={data.days} />
      </Card>

      {/* Activity grid */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Last 5 weeks</span>
          <span className="text-xs font-semibold text-[#7d889c]">reviews per day</span>
        </div>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {data.days.map((d) => (
            <div
              key={d.day}
              title={`${d.reviews} reviews`}
              className="flex-1 rounded-t-md transition-all"
              style={{
                height: `${Math.max(4, (d.reviews / maxDay) * 100)}%`,
                backgroundColor:
                  d.reviews === 0 ? "#232b3a" : d.reviews < state.learner.dailyGoal ? "rgba(78,140,255,.4)" : "var(--rah-primary)",
              }}
            />
          ))}
        </div>
      </Card>

      {/* Skill leaks */}
      <Card>
        <div className="mb-4 text-sm font-extrabold tracking-tight text-[#f2f5fa]">Where memory leaks</div>
        {data.bySkill.length === 0 ? (
          <p className="text-sm leading-relaxed text-[#a9b4c6]">No data yet. Review a round and this fills in.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {data.bySkill.map((s) => (
              <div key={s.skill} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium capitalize text-[#a9b4c6]">{s.skill}</span>
                <Bar value={Math.round(s.lapseRate * 100)} max={50} tone={s.lapseRate > 0.2 ? "rose" : "emerald"} />
                <span className="w-16 shrink-0 text-right text-xs font-bold text-[#b7c1d3]">
                  {Math.round(s.lapseRate * 100)}% lapse
                </span>
              </div>
            ))}
          </div>
        )}
        {data.bySkill.some((s) => s.due > 0) && (
          <p className="mt-4 text-xs font-medium text-[#7d889c]">
            {data.bySkill.reduce((a, s) => a + s.due, 0)} cards waiting in the queue right now.
          </p>
        )}
      </Card>

      {/* Skills measured by AI */}
      <Card>
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--rah-accent)]/[0.14] text-[#9de6fb]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">AI graded skills</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--rah-accent)]/20 bg-[var(--rah-accent)]/[0.05] p-5 text-center">
            <div className="text-3xl font-black leading-none tracking-tight text-[#9de6fb]">{writeAvg ?? "-"}</div>
            <div className="mt-2 text-xs font-semibold text-[#8b96a9]">writing, avg of 4 scores / 10</div>
            <div className="mt-1.5 text-[11px] font-medium text-[#5c6678]">{state.writes} essays graded</div>
          </div>
          <div className="rounded-2xl border border-[#ffb02e]/20 bg-[#ffb02e]/[0.05] p-5 text-center">
            <div className="text-3xl font-black leading-none tracking-tight text-[#ffd08a]">{speakAvg ?? "-"}</div>
            <div className="mt-2 text-xs font-semibold text-[#8b96a9]">speaking, avg of 4 scores / 10</div>
            <div className="mt-1.5 text-[11px] font-medium text-[#5c6678]">{state.speaks} monologues diagnosed</div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Chip tone="cyan">every essay and monologue raises the baseline</Chip>
        </div>
      </Card>

      {/* Unit maturity */}
      <Card>
        <div className="mb-4 text-sm font-extrabold tracking-tight text-[#f2f5fa]">Deck maturity by unit</div>
        <div className="flex flex-col gap-3">
          {data.byUnit
            .sort((a, b) => b.started / b.total - a.started / a.total)
            .map((u) => (
              <div key={u.unit}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-[#c3cddd]">{u.unit.replace(/_/g, " ")}</span>
                  <span className="font-medium text-[#7d889c]">
                    {u.started}/{u.total} started · {u.mature} mature
                  </span>
                </div>
                <Bar value={u.started} max={u.total} tone={u.mature > 0 ? "blue" : "amber"} />
              </div>
            ))}
        </div>
      </Card>

      {/* Shareable battle card */}
      <Card className="flex flex-col items-center gap-3 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Your week, framed</div>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-[#a9b4c6]">
            Export a 1080×1350 battle card: level ring, streak, mastery radar, boss record and the rival race - ready for the group chat.
          </p>
        </div>
        <BattleCardButton variant="primary" />
      </Card>

      {/* P5: the learner owns the state - full export / validated restore */}
      <BackupPanel />

      {/* Mind reader: the coach's memory, visible and editable */}
      <GoalPlanner />
      <MindReader onChange={() => undefined} />

      {/* Replay theater: watch graded exams back turn by turn */}
      <Replay />

      {/* Effectiveness: the honest outcome read (review wave 7.4/10) */}
      <EffectivenessPanel />

      {/* CEFR curriculum graph: the road from B2 to C1 with proven-only gates */}
      <CurriculumPanel />

      {/* Writing portfolio: every graded essay + the growth diff */}
      <Portfolio />

      {/* Coach advice */}
      {data.advice.length > 0 && (
        <Note tone="amber">
          <div className="font-black">Coach advice</div>
          <ul className="mt-1.5 list-disc pl-4">
            {data.advice.map((a, i) => (
              <li key={i} className="mt-1">
                {a}
              </li>
            ))}
          </ul>
        </Note>
      )}

      {state.learner.placementPhase !== "done" && (
        <Card className="flex flex-col items-center gap-4 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]">
              <Target className="h-5 w-5" />
            </div>
            <p className="text-sm leading-relaxed text-[#a9b4c6]">No measured level on record. Placement tunes every number on this page.</p>
          </div>
          <Btn onClick={() => go("placement")} className="shrink-0">
            Take placement
          </Btn>
        </Card>
      )}
    </div>
  );
}

// P5: the learner owns the state. Download the hash-sealed bundle, or
// restore from one - dry-run first, real import only after the learner
// confirms the diff. A wrong or edited file is refused before any write.
function BackupPanel() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "emerald" | "rose"; text: string } | null>(null);
  const pending = useRef<{ bundle: unknown; counts: Record<string, number> } | null>(null);

  const pickFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      setMsg(null);
      try {
        const bundle = JSON.parse(await file.text());
        const dry = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bundle, dryRun: true }),
        });
        const dj = await dry.json();
        if (!dry.ok) throw new Error(dj.error ?? "This file cannot be restored.");
        const total = Object.values(dj.counts as Record<string, number>).reduce((a, b) => a + b, 0);
        pending.current = { bundle, counts: dj.counts };
        setMsg({ tone: "emerald", text: `Valid bundle (${total} rows). Press Restore to replace ALL current data with it.` });
      } catch (e) {
        setMsg({ tone: "rose", text: (e as Error).message });
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const restore = async () => {
    if (!pending.current) return;
    setBusy(true);
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle: pending.current.bundle }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Restore failed.");
      setMsg({ tone: "emerald", text: "Restored. Reloading with your imported state." });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setMsg({ tone: "rose", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Your data, portable</div>
      <p className="mt-1 text-sm leading-relaxed text-[#a9b4c6]">
        Download every table as one hash-sealed file, or restore from a previous export. The hash is verified before anything is touched - an edited or corrupt file is refused, never half-applied.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn
          variant="primary"
          disabled={busy}
          onClick={() => {
            window.open("/api/export", "_blank");
          }}
        >
          Download backup
        </Btn>
        <Btn disabled={busy} onClick={pickFile}>
          {busy ? "Working..." : "Choose a backup to restore"}
        </Btn>
        <Btn
          disabled={busy}
          onClick={() => {
            window.open("/api/export/anki", "_blank");
          }}
        >
          Export deck (.tsv for Anki)
        </Btn>
        {pending.current && (
          <Btn variant="primary" disabled={busy} onClick={restore}>
            Restore
          </Btn>
        )}
      </div>
      {msg && (
        <div className="mt-3">
          <Note tone={msg.tone}>{msg.text}</Note>
        </div>
      )}
    </Card>
  );
}

// Effectiveness ledger (the 7.4/10 review's lowest score: "proven learning
// effectiveness"). Every number here is read from the engine's own tables -
// ReviewLog grades, FSRS intervals, mistake-family healing - no AI, no vibes.
// It answers one question honestly: is the memory actually getting stronger?
interface Outcomes {
  retention: { day: number; reviews: number; goodRate: number }[];
  stability: { day: number; medianIvl: number }[];
  memory: { started: number; mature: number; matureShare: number; medianStability: number; lapsingCards: number };
  families: { total: number; active: number; resolved: number; retirementRate: number };
  summary: { days: number; overallGoodRate: number; last7GoodRate: number; ivlTrend: number };
}

function EffectivenessPanel() {
  const [o, setO] = useState<Outcomes | null>(null);
  useEffect(() => {
    fetch("/api/progress/outcomes", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.retention ? setO(j) : setO(null)))
      .catch(() => setO(null));
  }, []);
  if (!o || o.summary.days === 0) return null;
  const maxIvl = Math.max(1, ...o.stability.map((s) => s.medianIvl));
  return (
    <div className="rah-rise">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
            <LineChart className="h-4 w-4 text-[#7fe0ac]" /> Effectiveness ledger
          </div>
          <Chip tone="emerald">measured, not claimed</Chip>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { k: "First-try recall (7d)", v: `${o.summary.last7GoodRate}%`, hot: o.summary.last7GoodRate > 0 && o.summary.last7GoodRate < 70 },
            { k: "First-try recall (30d)", v: `${o.summary.overallGoodRate}%`, hot: o.summary.overallGoodRate > 0 && o.summary.overallGoodRate < 70 },
            { k: "Mature memory", v: `${o.memory.matureShare}%`, hot: false },
            { k: "Families retired", v: `${o.families.resolved}/${o.families.total}`, hot: false },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-[#2a3242] bg-[#141924] p-3">
              <div className={`text-lg font-black tabular-nums ${s.hot ? "text-[#ff6b81]" : "text-[#f2f5fa]"}`}>{s.v}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d889c]">{s.k}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[#a9b4c6]">
          {o.memory.started > 0
            ? `${o.memory.mature} of ${o.memory.started} started cards have crossed the 21-day maturity line (median stability ${o.memory.medianStability}d). Scheduled intervals moved ${o.summary.ivlTrend >= 0 ? "+" : ""}${o.summary.ivlTrend}d across the window - FSRS trusting the memory more is what real progress looks like in the numbers.`
            : "Start reviewing and this panel fills with your real retention curve."}
        </p>
        {o.stability.length >= 2 && (
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d889c]">Median scheduled interval per day</div>
            <div className="mt-2 flex h-14 items-end gap-1.5">
              {o.stability.map((s) => (
                <div
                  key={s.day}
                  title={`day ${s.day}: median ${s.medianIvl}d`}
                  style={{ height: `${Math.max(6, (s.medianIvl / maxIvl) * 100)}%` }}
                  className="min-w-[10px] flex-1 rounded-t-md bg-[#9dc0ff]/50"
                />
              ))}
            </div>
          </div>
        )}
        {(() => {
          // Retention curve (Task 70): the per-day first-attempt recall the
          // outcomes route already measured, now shown. Honesty anchors: the
          // sample count rides on every bar, days with fewer than 5 reviews
          // render dimmed (3 reviews are not a trend), and the caption says
          // what rising/falling actually means in FSRS terms.
          const days = o.retention.filter((r) => r.reviews > 0);
          if (days.length < 2) return null;
          return (
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d889c]">First-try recall per day (30-day window)</div>
              <div className="mt-2 flex h-16 items-end gap-1.5">
                {days.map((r) => {
                  const thin = r.reviews < 5;
                  const hot = r.goodRate < 60;
                  return (
                    <div
                      key={r.day}
                      title={`${r.reviews} reviews, ${r.goodRate}% recalled on the first try${thin ? " (small sample)" : ""}`}
                      style={{ height: `${Math.max(8, r.goodRate)}%` }}
                      className={`min-w-[10px] flex-1 rounded-t-md ${thin ? "bg-[#7d889c]/35" : hot ? "bg-[#ff6b81]/60" : "bg-[#7fe0ac]/60"}`}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#7d889c]">
                <span>
                  {days.length} active days · hover a bar for its exact sample ({days.reduce((s, r) => s + r.reviews, 0)} retrievals total)
                </span>
                <span>dimmed bars: fewer than 5 reviews that day - a real signal, not a trend</span>
              </div>
            </div>
          );
        })()}
        {o.families.total > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-[#a9b4c6]">
            Mistake-memory healing: {o.families.active} active famil{o.families.active === 1 ? "y" : "ies"}, {o.families.resolved} retired by two clean exam hits ({o.families.retirementRate}% retirement rate).
          </p>
        )}
        {/* Proxy-metric caveat (audit polish row: progress reports). The habit
            numbers elsewhere in the app (XP, streaks, gems) prove engagement,
            not learning - the audit said so in exactly those words. This
            panel is the counterweight: only measured memory evidence, and
            spoken-fluency numbers stay proxy-labeled until the acoustic
            assessment tier measures real audio. */}
        <p className="mt-4 rounded-2xl border border-[#2a3242] bg-[#10151f] p-3 text-xs leading-relaxed text-[#7d889c]">
          <span className="font-bold text-[#a9b4c6]">What this panel does not claim:</span> XP, streaks and gems on the other pages are engagement proxies - they prove you showed up, not that the memory held. The recall and interval series above are the learning evidence, read straight from the FSRS schedule. Spoken-fluency numbers remain proxy-labeled until the acoustic assessment tier scores real recordings (the Azure adapter activates with a key; until then nothing here pretends to measure pronunciation).
        </p>
      </Card>
    </div>
  );
}

// CEFR curriculum graph (audit feature #2): the road B2 -> B2+ -> C1 as a
// prerequisite graph with PROVEN-ONLY mastery gates. Every gate reads the
// same numbers the rest of this page shows (Wilson-bound tag ledger, measured
// skill bands) - the graph never says "done" on vibes, and locked nodes say
// exactly which prerequisite is holding them.
interface CurriculumPayload {
  nodes: {
    node: { id: string; band: string; kind: string; title: string; blurb: string };
    status: "locked" | "available" | "in_progress" | "mastered";
    blockers: string[];
    evidence: { label: string; proven: boolean; detail: string }[];
  }[];
  summary: {
    frontier: { node: { id: string; title: string; band: string } } | null;
    mastered: number;
    available: number;
    locked: number;
    line: string;
  };
}

const BAND_LABEL: Record<string, string> = { B2: "B2 - close the interference core", "B2+": "B2+ - integrate it", C1: "C1 - precision" };
const STATUS_STYLE: Record<string, { chip: "emerald" | "blue" | "amber" | "slate"; label: string }> = {
  mastered: { chip: "emerald", label: "proven" },
  in_progress: { chip: "amber", label: "in progress" },
  available: { chip: "blue", label: "open" },
  locked: { chip: "slate", label: "locked" },
};

function CurriculumPanel() {
  const [c, setC] = useState<CurriculumPayload | null>(null);
  useEffect(() => {
    fetch("/api/curriculum", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.nodes ? setC(j) : setC(null)))
      .catch(() => setC(null));
  }, []);
  if (!c || c.nodes.length === 0) return null;
  const bands = ["B2", "B2+", "C1"].filter((b) => c.nodes.some((n) => n.node.band === b));
  return (
    <div className="rah-rise">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
            <Map className="h-4 w-4 text-[#9dc0ff]" /> Curriculum map
          </div>
          <Chip tone="blue">
            {c.summary.mastered}/{c.nodes.length} gates proven
          </Chip>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">{c.summary.line}</p>
        <div className="mt-4 flex flex-col gap-4">
          {bands.map((band) => (
            <div key={band}>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#7d889c]">{BAND_LABEL[band] ?? band}</div>
              <div className="flex flex-col gap-2">
                {c.nodes
                  .filter((n) => n.node.band === band)
                  .map((n) => {
                    const st = STATUS_STYLE[n.status] ?? STATUS_STYLE.available;
                    const isFrontier = c.summary.frontier?.node.id === n.node.id;
                    return (
                      <div
                        key={n.node.id}
                        className={`rounded-2xl px-4 py-3 ${isFrontier ? "border border-[var(--rah-primary)]/45 bg-[var(--rah-primary)]/[0.07]" : "bg-[#171c28]"}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#e7ecf5]">{n.node.title}</span>
                          <Chip tone={st.chip}>{st.label}</Chip>
                          {isFrontier && <Chip tone="violet">next gate</Chip>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[#7d889c]">{n.node.blurb}</p>
                        {n.blockers.length > 0 && (
                          <p className="mt-1.5 text-xs leading-relaxed text-[#8b96a9]">
                            Opens when proven: <span className="font-bold text-[#a9b4c6]">{n.blockers.join(", ")}</span>
                          </p>
                        )}
                        {n.status !== "locked" && n.evidence.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {n.evidence.map((e) => (
                              <div key={e.label} className="flex flex-wrap items-baseline gap-x-2 text-[11px] leading-relaxed">
                                <span className={e.proven ? "font-bold text-[#7fe0ac]" : "font-bold text-[#ffb02e]"}>{e.proven ? "\u2713" : "\u25CB"} {e.label}</span>
                                <span className="text-[#7d889c]">{e.detail}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
