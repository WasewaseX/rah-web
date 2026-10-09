"use client";

// Rah shell: hash-routed single page app. One learner, one road to C1.
// Midnight shell: navy rail, glass bars, blue signal color.

import { useCallback, useEffect, useState } from "react";
import {
  Home,
  RotateCcw,
  Target,
  MessagesSquare,
  PenLine,
  Headphones,
  Mic,
  BookOpen,
  BarChart3,
  Flame,
  Sparkles,
} from "lucide-react";
import { Chip } from "./ui";
import HomeView from "./Home";
import ReviewView from "./Review";
import PlacementView from "./Placement";
import ChatView from "./Chat";
import WriteView from "./Write";
import ListenView from "./Listen";
import SpeakView from "./Speak";
import ReadView from "./Read";
import ProgressView from "./Progress";
import { applyTheme } from "@/lib/theme-bus";

export interface AppState {
  learner: {
    level: string;
    streak: number;
    dailyGoal: number;
    retention: number;
    newPerDay: number;
    focusSkill: string;
    placementPhase: string;
  };
  theme: { primary?: string; primaryDeep?: string; bg?: string; surface?: string; accent?: string } | null;
  today: { reviews: number; correct: number; xp: number; spoken: number; written: number; listened: number };
  due: number;
  seen: number;
  chatCount: number;
  writes: number;
  speaks: number;
  deck: { total: number; byLevel: Record<string, number>; byUnit: Record<string, number> };
  diagnosis: { bySkill: { skill: string; lapseRate: number; due: number; reps: number }[]; advice: string[] };
  profile: { level: string; streak: number; focus: string; due: number; recentTraps: string[]; weakSkills: string[]; mistakes?: { tag: string; count: number; label: string }[]; mistakesHealed?: number };
}

export const VIEWS = [
  { id: "home", label: "Home", icon: Home },
  { id: "review", label: "Review", icon: RotateCcw },
  { id: "chat", label: "Coach", icon: MessagesSquare },
  { id: "write", label: "Writing", icon: PenLine },
  { id: "speak", label: "Speaking", icon: Mic },
  { id: "listen", label: "Listening", icon: Headphones },
  { id: "read", label: "Reading", icon: BookOpen },
  { id: "placement", label: "Placement", icon: Target },
  { id: "progress", label: "Progress", icon: BarChart3 },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];

export default function RahApp() {
  const [view, setView] = useState<ViewId>("home");
  const [state, setState] = useState<AppState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.ok) {
        const s: AppState = await r.json();
        setState(s);
        // The theme plugin's choices survive reloads: paint on every state load.
        applyTheme(s.theme ?? null);
      }
    } catch {
      // offline blip; keep last state
    }
  }, []);

  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash.replace("#", "") as ViewId;
      setView(VIEWS.some((v) => v.id === h) ? h : "home");
    };
    const t0 = setTimeout(applyHash, 0);
    const t1 = setTimeout(refresh, 0);
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    const t = setInterval(refresh, 60000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
      clearInterval(t);
    };
  }, [refresh]);

  const go = (id: ViewId) => {
    window.history.pushState(null, "", `#${id}`);
    setView(id);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--rah-bg)] md:flex-row">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-gradient-to-b from-[#0e1421] via-[#101725] to-[#0d1119] px-4 py-6 md:flex">
        <div className="mb-9 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-lg font-black text-white shadow-[0_8px_20px_-6px_rgba(78,140,255,.55)]">
            R
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-[#f2f5fa]">Rah</div>
            <div className="text-[11px] font-semibold text-[#7d889c]">B2 to C1, your road</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => go(v.id)}
                className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all ${
                  active
                    ? "bg-[var(--rah-primary)]/[0.12] text-[#9dc0ff]"
                    : "text-[#8b96a9] hover:bg-white/[0.04] hover:text-[#dbe3f0]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--rah-primary)]" />
                )}
                <Icon className="h-[18px] w-[18px]" />
                {v.label}
                {v.id === "review" && state && state.due > 0 && (
                  <span className="ml-auto rounded-full bg-[var(--rah-primary)] px-2 py-0.5 text-[11px] font-bold text-white shadow-[0_4px_10px_-2px_rgba(78,140,255,.6)]">
                    {state.due}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-[var(--rah-primary)]/20 bg-gradient-to-br from-[#16233e] to-[#131b2c] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#9dc0ff]">
            <Sparkles className="h-3.5 w-3.5" />
            Built-in AI coach
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#8b96a9]">
            No keys, no setup. It already knows your level and your leaks.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[var(--rah-bg)]/85 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-base font-black text-white">
            R
          </div>
          <span className="text-lg font-black tracking-tight">Rah</span>
        </div>
        {state && (
          <div className="flex items-center gap-2">
            {state.learner.level !== "?" && <Chip tone="blue">{state.learner.level}</Chip>}
            <Chip tone="amber">
              <Flame className="h-3 w-3" /> {state.learner.streak}
            </Chip>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-12">
        {/* Desktop header row */}
        {state && (
          <div className="rah-rise mb-7 hidden items-end justify-between md:flex">
            <h1 className="text-[28px] font-black leading-none tracking-tight text-[#f2f5fa]">
              {VIEWS.find((v) => v.id === view)?.label}
            </h1>
            <div className="flex items-center gap-2">
              {state.learner.level !== "?" ? <Chip tone="blue">Level {state.learner.level}</Chip> : <Chip>No level yet</Chip>}
              <Chip tone="amber">
                <Flame className="h-3 w-3" /> {state.learner.streak} day streak
              </Chip>
              <Chip tone="cyan">
                <Sparkles className="h-3 w-3" /> {state.today.xp} XP today
              </Chip>
            </div>
          </div>
        )}

        {!state ? (
          <div className="flex h-64 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
          </div>
        ) : (
          <div key={view} className="rah-rise">
            {view === "home" && <HomeView state={state} go={go} />}
            {view === "review" && <ReviewView state={state} onChange={refresh} />}
            {view === "placement" && <PlacementView state={state} onChange={refresh} />}
            {view === "chat" && <ChatView state={state} onChange={refresh} />}
            {view === "write" && <WriteView state={state} onChange={refresh} />}
            {view === "listen" && <ListenView state={state} />}
            {view === "speak" && <SpeakView state={state} onChange={refresh} />}
            {view === "read" && <ReadView state={state} />}
            {view === "progress" && <ProgressView state={state} go={go} />}
          </div>
        )}
      </main>

      {/* Mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[#12161f]/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex overflow-x-auto px-2 py-1.5">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => go(v.id)}
                className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-bold transition-colors ${
                  active ? "bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]" : "text-[#6e7a8e]"
                }`}
              >
                <Icon className="h-5 w-5" />
                {v.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
