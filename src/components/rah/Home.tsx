"use client";

import { useState } from "react";
import { Flame, Sparkles, Target, RotateCcw, MessagesSquare, PenLine, Mic, Headphones, BookOpen, ArrowRight, Stethoscope, CheckCircle2, ScrollText, Swords, Snowflake, Zap, Gem } from "lucide-react";
import { Btn, Card, Chip, FA, Note, Ring } from "./ui";
import { handCoach } from "@/lib/bus";
import Briefing from "./Briefing";
import type { AppState, ViewId } from "./App";

const TILES: {
  id: ViewId | "coach";
  title: string;
  desc: string;
  icon: typeof Mic;
  tint: string;
  glow: string;
  stat: (s: AppState) => string | null;
}[] = [
  {
    id: "coach",
    title: "Coach agent",
    desc: "The sidebar agent: reads your state, writes files, runs code, acts on any tab.",
    icon: MessagesSquare,
    tint: "bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]",
    glow: "group-hover:shadow-[0_16px_40px_-20px_rgba(78,140,255,.5)]",
    stat: (s) => (s.chatCount > 0 ? `${s.chatCount} turns so far` : null),
  },
  {
    id: "write",
    title: "Writing lab",
    desc: "CEFR grading on four dimensions, C1 upgrades.",
    icon: PenLine,
    tint: "bg-[var(--rah-accent)]/[0.14] text-[#9de6fb]",
    glow: "group-hover:shadow-[0_16px_40px_-20px_rgba(76,201,240,.45)]",
    stat: (s) => (s.writes > 0 ? `${s.writes} graded` : null),
  },
  {
    id: "speak",
    title: "Speaking loop",
    desc: "Two minutes out loud, diagnosis, repeat harder.",
    icon: Mic,
    tint: "bg-[#ffb02e]/[0.14] text-[#ffd08a]",
    glow: "group-hover:shadow-[0_16px_40px_-20px_rgba(255,176,46,.4)]",
    stat: (s) => (s.speaks > 0 ? `${s.speaks} monologues` : null),
  },
  {
    id: "listen",
    title: "Listening decoder",
    desc: "Five passes, speed control, real comprehension checks.",
    icon: Headphones,
    tint: "bg-[#a78bfa]/[0.14] text-[#cfc3fc]",
    glow: "group-hover:shadow-[0_16px_40px_-20px_rgba(167,139,250,.45)]",
    stat: (s) => (s.today.listened > 0 ? `${s.today.listened} today` : null),
  },
  {
    id: "read",
    title: "Graded readings",
    desc: "Six texts built on the science behind this app.",
    icon: BookOpen,
    tint: "bg-[#ff6b81]/[0.12] text-[#ffa3b1]",
    glow: "group-hover:shadow-[0_16px_40px_-20px_rgba(255,107,129,.4)]",
    stat: () => null,
  },
];

// The shop strip: spend earned gems on streak freezes and XP boosts.
// Items and costs mirror the Duolingo store loop (reverse-engineered slice):
// currency comes from level-ups and quests, sinks are insurance + amplifiers.
function ShopStrip({
  gems,
  freezes,
  boostActive,
  onChange,
  toast,
}: {
  gems: number;
  freezes: number;
  boostActive: boolean;
  onChange?: () => void;
  toast?: (t: { title: string; desc: string }) => void;
}) {
  const [busy, setBusy] = useState("");

  const buy = async (item: string) => {
    setBusy(item);
    try {
      const r = await fetch("/api/shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; title?: string; desc?: string };
      if (data.ok) {
        toast?.({ title: data.title ?? "Purchased", desc: data.desc ?? "" });
        onChange?.();
      } else {
        toast?.({ title: "Shop said no", desc: data.error ?? "Try again." });
      }
    } catch {
      toast?.({ title: "Shop unreachable", desc: "Check the connection and retry." });
    } finally {
      setBusy("");
    }
  };

  return (
    <Card className="rah-rise-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4ade80]/[0.12] text-[#7ff0a8]">
            <Gem className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black text-[#f2f5fa]">Shop</div>
            <div className="text-[11px] font-semibold text-[#7d889c]">
              <span className="text-[#7ff0a8]">{gems} gems</span> · level up and finish quests to earn
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {boostActive && (
            <Chip tone="violet">
              <Zap className="h-3 w-3" /> 2x XP running
            </Chip>
          )}
          <Chip tone="cyan">
            <Snowflake className="h-3 w-3" /> {freezes} banked
          </Chip>
          <Btn onClick={() => void buy("streak_freeze")} disabled={busy !== ""} className="!min-h-9 !px-3 text-xs" title="Streak Freeze: automatically protects your streak for one missed day">
            {busy === "streak_freeze" ? "…" : "Freeze · 100"}
          </Btn>
          <Btn onClick={() => void buy("xp_boost")} disabled={busy !== "" || boostActive} className="!min-h-9 !px-3 text-xs" title="XP Boost: every action earns double XP while active">
            {busy === "xp_boost" ? "…" : "Boost 2x · 150"}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

export default function HomeView({
  state,
  go,
  openCoach,
  onChange,
  toast,
}: {
  state: AppState;
  go: (v: ViewId) => void;
  openCoach?: () => void;
  onChange?: () => void;
  toast?: (t: { title: string; desc: string }) => void;
}) {
  const goal = state.learner.dailyGoal;
  const done = state.today.reviews;
  const accuracy = state.today.reviews > 0 ? Math.round((state.today.correct / state.today.reviews) * 100) : 0;
  const needPlacement = state.learner.placementPhase !== "done";

  return (
    <div className="flex flex-col gap-5">
      {/* Hero: today's road */}
      <div className="rah-rise-1 relative overflow-hidden rounded-3xl border border-[var(--rah-primary)]/20 bg-gradient-to-br from-[#16233e] via-[#141c30] to-[#121724] p-7 shadow-[0_1px_2px_rgba(0,0,0,.4),0_24px_60px_-30px_rgba(30,80,180,.45)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--rah-primary)]/[0.09] blur-2xl" />
        <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-6">
            <Ring value={done} max={goal} size={104} label={`${done}/${goal}`} sub="today" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f8fe8]">Daily goal</div>
              <div className="mt-1 text-xl font-black tracking-tight text-[#f2f5fa]">
                {done >= goal ? "Goal cleared. Memory is compounding." : `${goal - done} reviews to go.`}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Chip tone="amber">
                  <Flame className="h-3 w-3" /> {state.learner.streak} day streak
                </Chip>
                {state.learner.freezes > 0 && (
                  <Chip tone="cyan">
                    <Snowflake className="h-3 w-3" /> {state.learner.freezes} freeze{state.learner.freezes > 1 ? "s" : ""} banked
                  </Chip>
                )}
                <Chip tone="cyan">
                  <Sparkles className="h-3 w-3" /> {state.today.xp} XP
                </Chip>
                {state.chain && state.chain.chain > 0 && (
                  <Chip tone="amber">
                    <Flame className="h-3 w-3" /> {state.chain.chain}-chain · {state.chain.mult}x heat
                  </Chip>
                )}
                {state.today.reviews > 0 && (
                  <Chip tone={accuracy >= 80 ? "emerald" : "rose"}>{accuracy}% recall</Chip>
                )}
              </div>
              {state.game && (
                <div className="mt-3 w-full max-w-xs">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-[#cfc3fc]">Lv {state.game.level.level} · {state.game.level.name}</span>
                    <span className="text-[#7d889c]">
                      {state.game.level.nextAt ? `${state.game.level.intoLevel}/${state.game.level.levelSpan} XP` : "MAX"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#232b3a]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#7fdcf7] transition-all duration-700"
                      style={{ width: `${state.game.level.pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <Btn variant="go" onClick={() => go("review")} className="w-full shrink-0 sm:w-auto">
            <RotateCcw className="h-4 w-4" />
            {state.due > 0 ? `Review ${state.due} due` : "Start a round"}
          </Btn>
        </div>
      </div>

      {/* Daily quests */}
      {state.quests && state.quests.length > 0 && (
        <div className="rah-rise-2">
          <Card>
            <div className="mb-1 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3ccb7f]/[0.12] text-[#7fe0ac]">
                <ScrollText className="h-4 w-4" />
              </div>
              <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Today's missions</span>
              {state.quests.every((q) => q.done) && <Chip tone="emerald">all cleared</Chip>}
            </div>
            <div className="mb-4 text-xs font-medium text-[#7d889c]">
              Three missions, rerolled at midnight, aimed at your leaks. Finishing one pays its XP instantly.
            </div>
            <div className="flex flex-col gap-3">
              {state.quests.map((q) => {
                const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
                return (
                  <div key={q.id} className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${q.done ? "bg-[#3ccb7f]/[0.07]" : "bg-[#171c28]"}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${q.done ? "bg-[#3ccb7f]/[0.14] text-[#7fe0ac]" : "bg-white/[0.05] text-[#6e7a8e]"}`}>
                      <CheckCircle2 className={`h-4 w-4 ${q.done ? "text-[#7fe0ac]" : "opacity-40"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm font-bold ${q.done ? "text-[#c3f0d8]" : "text-[#dbe3f0]"}`}>{q.title}</span>
                        <span className="shrink-0 text-[11px] font-bold text-[#7d889c]">
                          {Math.min(q.progress, q.target)}/{q.target}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#232b3a]">
                        <div className={`h-full rounded-full transition-all duration-700 ${q.done ? "bg-[#3ccb7f]" : "bg-gradient-to-r from-[var(--rah-primary)] to-[#6aa6ff]"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <Chip tone={q.done ? "emerald" : "slate"}>{q.done ? "paid" : `+${q.xp} XP`}</Chip>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* AI Director's daily briefing */}
      <div className="rah-rise-2">
        <Briefing />
      </div>

      {/* Rival race */}
      {state.rival && (
        <div className="rah-rise-2">
          <Card className="border-[#a78bfa]/20">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#a78bfa]/[0.14] text-[#cfc3fc]">
                  <Swords className="h-4 w-4" />
                </div>
                <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Weekly race</span>
              </div>
              <span className="text-[11px] font-bold text-[#7d889c]">
                record {state.rival.wins}W · {state.rival.losses}L
              </span>
            </div>
            {(() => {
              const total = Math.max(1, state.rival.you + state.rival.weekXp);
              const youPct = Math.round((state.rival.you / total) * 100);
              const winning = state.rival.you >= state.rival.weekXp;
              return (
                <>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-black">
                    <span className={winning ? "text-[#7fe0ac]" : "text-[#b7c1d3]"}>YOU · {state.rival.you} XP</span>
                    <span className={`inline-flex items-center gap-1.5 ${!winning ? "text-[#ffa3b1]" : "text-[#b7c1d3]"}`}>
                      {state.rival.name}
                      <span className="rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#cfc3fc]">practice bot</span>
                      · {state.rival.weekXp} XP
                    </span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-[#232b3a]">
                    <div className="h-full bg-gradient-to-r from-[#2fc273] to-[#55d98f] transition-all duration-700" style={{ width: `${youPct}%` }} />
                    <div className="h-full flex-1 bg-gradient-to-r from-[#ff6b81] to-[#ff8ba0]" />
                  </div>
                  <p className="mt-3 text-xs italic leading-relaxed text-[#8b96a9]">
                    "{state.rival.taunt}"
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#5c6678]">
                    Out-gain the rival by Sunday night to take the week. The rival trains at ~80% of your pace - fall behind and it pulls away.
                  </p>
                  {!winning && (
                    <Btn
                      variant="soft"
                      className="mt-3 !min-h-10 text-xs"
                      onClick={() =>
                        handCoach(
                          `My rival ${state.rival.name} is beating me ${state.rival.weekXp} to ${state.rival.you} XP this week. Give me a tight day-by-day plan to flip the race before Sunday, built around my weakest skills.`,
                        )
                      }
                    >
                      <Zap className="h-3.5 w-3.5" /> Get a revenge plan from the coach
                    </Btn>
                  )}
                </>
              );
            })()}
          </Card>
        </div>
      )}

      {/* Placement CTA */}
      {needPlacement && (
        <div className="rah-rise-2">
          <Card className="border-[#ffb02e]/25 bg-gradient-to-br from-[#221c10] to-[var(--rah-surface)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ffb02e]/[0.15] text-[#ffd08a]">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold tracking-tight text-[#f2f5fa]">Find your level first</div>
                  <div className="mt-1 text-sm leading-relaxed text-[#a9b4c6]">
                    Twenty adaptive questions and one short writing sample. Ten minutes. Every schedule after that is tuned to the result.
                  </div>
                </div>
              </div>
              <Btn variant="warm" onClick={() => go("placement")} className="shrink-0">
                Start placement <ArrowRight className="h-4 w-4" />
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Coach diagnosis */}
      {state.diagnosis.advice.length > 0 && (
        <div className="rah-rise-2">
          <Card>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]">
                <Stethoscope className="h-4 w-4" />
              </div>
              <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">What the coach notices</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {state.diagnosis.advice.map((a, i) => (
                <p key={i} className="text-sm leading-relaxed text-[#a9b4c6]">
                  {a}
                </p>
              ))}
              {state.profile.recentTraps.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#7d889c]">Recurring Farsi interference:</span>
                  {state.profile.recentTraps.map((t) => (
                    <Chip key={t} tone="rose">
                      {t.replace("_", " ")}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Shop: gems wallet (Duolingo RE) - freezes and XP boosts, bought with earned gems */}
      <ShopStrip
        gems={state.learner.gems ?? 0}
        freezes={state.learner.freezes}
        boostActive={Boolean(state.learner.boostActive)}
        onChange={onChange}
        toast={toast}
      />

      {/* Feature tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TILES.map((t, i) => {
          const Icon = t.icon;
          const stat = t.stat(state);
          return (
            <button
              key={t.id}
              onClick={() => (t.id === "coach" ? openCoach?.() : go(t.id as ViewId))}
              className={`group rah-rise-${Math.min(3, i + 1)} text-left`}
            >
              <Card
                className={`h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:border-white/[0.14] ${t.glow}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${t.tint}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-extrabold tracking-tight text-[#f2f5fa]">
                      {t.title}
                      <ArrowRight className="h-4 w-4 text-[#3a4356] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--rah-primary)]" />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#a9b4c6]">{t.desc}</p>
                    {stat && <div className="mt-2 text-xs font-bold text-[#7fa8f5]">{stat}</div>}
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Method note */}
      <div className="rah-rise-3">
        <Note tone="blue">
          Everything here runs on four evidence-backed habits: retrieval before re-reading, spacing that widens as memory holds, one focus per turn, and
          honest measurement every couple of weeks. <FA>بازیابی، فاصله‌گذاری، تمرکز، اندازه‌گیری.</FA>
        </Note>
      </div>
    </div>
  );
}
