"use client";

// Arcade: the games floor. Speed Round for the clock, Boss Battle for the
// ego, and the trophy cabinet for the long game. Quests and the rival race
// live on Home; this floor is pure play.

import { useState } from "react";
import { Swords, Zap, Trophy, Medal, Mic, Flame, Castle, Skull, Timer, Sparkles } from "lucide-react";
import { Card, Chip } from "./ui";
import SpeedRound from "./games/SpeedRound";
import BossBattle from "./games/BossBattle";
import VoiceArena from "./games/VoiceArena";
import Dungeon from "./games/Dungeon";
import Duel from "./games/Duel";
import Gauntlet from "./games/Gauntlet";
import League from "./games/League";
import Talents from "./games/Talents";
import Flow from "./games/Flow";
import BattleCardButton from "./BattleCardButton";
import type { AppState } from "./App";
import { NAMING } from "@/lib/naming";

// Task 82 (naming audit): every tab carries its plain-language gloss from the
// canonical registry - a coined name never ships unexplained.
const TABS = [
  { id: "speed", label: "Speed", gloss: NAMING.speed.gloss, icon: Zap },
  { id: "boss", label: "Boss", gloss: NAMING.boss.gloss, icon: Swords },
  { id: "voice", label: "Voice", gloss: NAMING.voice.gloss, icon: Mic },
  { id: "dungeon", label: "Dungeon", gloss: NAMING.dungeon.gloss, icon: Castle },
  { id: "duel", label: "Duel", gloss: NAMING.duel.gloss, icon: Swords },
  { id: "gauntlet", label: "Gauntlet", gloss: NAMING.gauntlet.gloss, icon: Skull },
  { id: "league", label: "League", gloss: NAMING.league.gloss, icon: Medal },
  { id: "flow", label: "Flow", gloss: NAMING.flow.gloss, icon: Timer },
  { id: "talents", label: "Talents", gloss: NAMING.talents.gloss, icon: Sparkles },
  { id: "trophies", label: "Trophies", gloss: NAMING.trophies.gloss, icon: Trophy },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ArcadeView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [tab, setTab] = useState<TabId>("speed");
  const unlockedSet = new Set(state.game?.unlocked ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
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
              <span className="sr-only"> - {t.gloss}</span>
            </button>
          );
        })}
        {(() => {
          const active = TABS.find((t) => t.id === tab);
          return active ? (
            <div className="w-full pb-1 text-[11px] text-[#7d889c]">
              <span className="font-bold">{NAMING[active.id].name}</span> — {active.gloss}
            </div>
          ) : null;
        })()}
        {state.game && (
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Chip tone="violet">Lv {state.game.level.level} · {state.game.level.name}</Chip>
            <Chip tone="cyan">{state.game.level.xp} XP</Chip>
            {state.chain && state.chain.chain > 0 && (
              <Chip tone="amber">
                <Flame className="h-3 w-3" /> ×{state.chain.chain} · {state.chain.mult}x
              </Chip>
            )}
          </div>
        )}
      </div>

      <div key={tab} className="rah-rise">
        {tab === "speed" && <SpeedRound onChange={onChange} />}
        {tab === "boss" && <BossBattle onChange={onChange} />}
        {tab === "voice" && <VoiceArena onChange={onChange} />}
        {tab === "dungeon" && <Dungeon onChange={onChange} />}
        {tab === "duel" && <Duel onChange={onChange} />}
        {tab === "gauntlet" && <Gauntlet onChange={onChange} />}
        {tab === "league" && <League />}
        {tab === "flow" && <Flow onChange={onChange} />}
        {tab === "talents" && <Talents onChange={onChange} />}
        {tab === "trophies" && (
          <Card>
            <div className="mb-1 flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
              <Medal className="h-4 w-4 text-[#ffd08a]" /> Trophy cabinet
            </div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-[#7d889c]">
                {unlockedSet.size} of {state.game?.all?.length ?? 0} earned. Trophies read your real numbers - streaks, heals, boss kills, combos.
              </div>
              <BattleCardButton />
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Chip tone="amber">
                <Flame className="h-3 w-3" /> {state.learner.streak} day streak
              </Chip>
              {state.game?.stats?.find((s) => s.key === "speed:best")?.best ? (
                <Chip tone="violet">speed best {state.game.stats.find((s) => s.key === "speed:best")?.best}</Chip>
              ) : null}
              {state.game?.stats?.find((s) => s.key === "boss:wins")?.best ? (
                <Chip tone="rose">boss wins {state.game.stats.find((s) => s.key === "boss:wins")?.best}</Chip>
              ) : null}
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
