"use client";

// Arcade: the games floor. Speed Round for the clock, Boss Battle for the
// ego, and the trophy cabinet for the long game. Quests and the rival race
// live on Home; this floor is pure play.

import { useState } from "react";
import { Swords, Zap, Trophy, Medal } from "lucide-react";
import { Card, Chip } from "./ui";
import SpeedRound from "./games/SpeedRound";
import BossBattle from "./games/BossBattle";
import type { AppState } from "./App";

const TABS = [
  { id: "speed", label: "Speed Round", icon: Zap },
  { id: "boss", label: "Boss Battle", icon: Swords },
  { id: "trophies", label: "Trophies", icon: Trophy },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ArcadeView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [tab, setTab] = useState<TabId>("speed");
  const unlockedSet = new Set(state.game?.unlocked ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
                active ? "bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]" : "text-[#8b96a9] hover:bg-white/[0.04] hover:text-[#dbe3f0]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
        {state.game && (
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Chip tone="violet">Lv {state.game.level.level} · {state.game.level.name}</Chip>
            <Chip tone="cyan">{state.game.level.xp} XP</Chip>
          </div>
        )}
      </div>

      <div key={tab} className="rah-rise">
        {tab === "speed" && <SpeedRound onChange={onChange} />}
        {tab === "boss" && <BossBattle onChange={onChange} />}
        {tab === "trophies" && (
          <Card>
            <div className="mb-1 flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
              <Medal className="h-4 w-4 text-[#ffd08a]" /> Trophy cabinet
            </div>
            <div className="mb-4 text-xs font-medium text-[#7d889c]">
              {unlockedSet.size} of {state.game?.all?.length ?? 0} earned. Trophies read your real numbers - streaks, heals, boss kills, combos.
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(state.game?.all ?? []).map((a) => {
                const got = unlockedSet.has(a.key);
                return (
                  <div
                    key={a.key}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                      got ? "border-[#ffb02e]/25 bg-[#ffb02e]/[0.06]" : "border-white/[0.05] bg-white/[0.02] opacity-55"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${got ? "bg-[#ffb02e]/[0.16] text-[#ffd08a]" : "bg-white/[0.04] text-[#5c6678]"}`}>
                      <Trophy className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-extrabold ${got ? "text-[#ffe3b3]" : "text-[#8b96a9]"}`}>{a.title}</div>
                      <div className="truncate text-[11px] text-[#7d889c]">{a.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
