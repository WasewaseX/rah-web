"use client";

// Progress: honest numbers only. 5 week activity grid, per unit maturity,
// per skill leak rate, writing and speaking score trends, coach advice.

import { useEffect, useState } from "react";
import { Flame, TrendingUp, Target, Snowflake, Radar as RadarIcon, LineChart } from "lucide-react";
import { Card, Chip, Note, Bar, Btn } from "./ui";
import { Radar, AccuracyTimeline } from "./WarRoom";
import MindReader from "./MindReader";
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
                {lagging.map((s) => `${s.skill} (${Math.round(s.score * 100)})`).join(" and ")} drag the average. Close the gap with roughly {itemsNeeded} graded items in those two -
                {daysOut !== null && daysOut < 400 ? ` at your current pace that lands in ~${daysOut} days.` : " keep feeding the coach daily and the estimate sharpens."}
              </p>
            </div>
          );
        })()}
      </Card>

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

      {/* Mind reader: the coach's memory, visible and editable */}
      <MindReader onChange={() => undefined} />

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
