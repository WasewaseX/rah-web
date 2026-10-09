"use client";

import { Flame, Sparkles, Target, RotateCcw, MessagesSquare, PenLine, Mic, Headphones, BookOpen, ArrowRight, Stethoscope, CheckCircle2 } from "lucide-react";
import { Btn, Card, Chip, FA, Note, Ring } from "./ui";
import type { AppState, ViewId } from "./App";

const TILES: {
  id: ViewId;
  title: string;
  desc: string;
  icon: typeof Mic;
  tint: string;
  glow: string;
  stat: (s: AppState) => string | null;
}[] = [
  {
    id: "chat",
    title: "Coach chat",
    desc: "Socratic turns, corrections with the Farsi why.",
    icon: MessagesSquare,
    tint: "bg-[#4e8cff]/[0.14] text-[#9dc0ff]",
    glow: "group-hover:shadow-[0_16px_40px_-20px_rgba(78,140,255,.5)]",
    stat: (s) => (s.chatCount > 0 ? `${s.chatCount} turns so far` : null),
  },
  {
    id: "write",
    title: "Writing lab",
    desc: "CEFR grading on four dimensions, C1 upgrades.",
    icon: PenLine,
    tint: "bg-[#4cc9f0]/[0.14] text-[#9de6fb]",
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

export default function HomeView({ state, go }: { state: AppState; go: (v: ViewId) => void }) {
  const goal = state.learner.dailyGoal;
  const done = state.today.reviews;
  const accuracy = state.today.reviews > 0 ? Math.round((state.today.correct / state.today.reviews) * 100) : 0;
  const needPlacement = state.learner.placementPhase !== "done";

  return (
    <div className="flex flex-col gap-5">
      {/* Hero: today's road */}
      <div className="rah-rise-1 relative overflow-hidden rounded-3xl border border-[#4e8cff]/20 bg-gradient-to-br from-[#16233e] via-[#141c30] to-[#121724] p-7 shadow-[0_1px_2px_rgba(0,0,0,.4),0_24px_60px_-30px_rgba(30,80,180,.45)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#4e8cff]/[0.09] blur-2xl" />
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
                <Chip tone="cyan">
                  <Sparkles className="h-3 w-3" /> {state.today.xp} XP
                </Chip>
                {state.today.reviews > 0 && (
                  <Chip tone={accuracy >= 80 ? "emerald" : "rose"}>{accuracy}% recall</Chip>
                )}
              </div>
            </div>
          </div>
          <Btn variant="go" onClick={() => go("review")} className="w-full shrink-0 sm:w-auto">
            <RotateCcw className="h-4 w-4" />
            {state.due > 0 ? `Review ${state.due} due` : "Start a round"}
          </Btn>
        </div>
      </div>

      {/* Placement CTA */}
      {needPlacement && (
        <div className="rah-rise-2">
          <Card className="border-[#ffb02e]/25 bg-gradient-to-br from-[#221c10] to-[#1a1f2b]">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#4e8cff]/[0.14] text-[#9dc0ff]">
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

      {/* Feature tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TILES.map((t, i) => {
          const Icon = t.icon;
          const stat = t.stat(state);
          return (
            <button key={t.id} onClick={() => go(t.id)} className={`group rah-rise-${Math.min(3, i + 1)} text-left`}>
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
                      <ArrowRight className="h-4 w-4 text-[#3a4356] transition-all group-hover:translate-x-0.5 group-hover:text-[#4e8cff]" />
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
