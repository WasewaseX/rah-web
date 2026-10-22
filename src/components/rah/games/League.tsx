"use client";

// League: the weekly season. 8 members (you + 7 deterministic ghosts), top 3
// promoted, bottom 3 demoted. Standings bars, promotion/demotion cut lines,
// days-left countdown, and the settled history.

import { useEffect, useState } from "react";
import { Medal, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, Card, Chip, Spinner } from "../ui";

interface Standing {
  name: string;
  xp: number;
  you: boolean;
}

interface LeagueData {
  division: number;
  divisionName: string;
  standings: Standing[];
  place: number;
  daysLeft: number;
  promoteCut: number;
  demoteCut: number;
  history: { week: number; division: number; place: number; promoted: boolean; demoted: boolean }[];
}

const DIVISION_TONES = ["#a3763f", "#c0c8d6", "#9de6fb", "#ffd08a", "#a78bfa", "#ff6b81"];

export default function League() {
  const [data, setData] = useState<LeagueData | null>(null);

  useEffect(() => {
    fetch("/api/arcade/league", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data) return <Spinner label="Reading the table..." />;
  const max = Math.max(...data.standings.map((s) => s.xp), 1);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${DIVISION_TONES[data.division]}22`, color: DIVISION_TONES[data.division] }}>
            <Medal className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-[#f2f5fa]">{data.divisionName} Division</span>
              <span className="rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#cfc3fc]" title="A weekly XP race against practice bots - no other learner is on the other side">practice bots</span>
            </div>
            <div className="text-[11px] text-[#7d889c]">
              Place {data.place} of 8 · {data.daysLeft} day{data.daysLeft === 1 ? "" : "s"} left · top 3 promoted, bottom 3 demoted
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Chip tone={data.place <= 3 ? "emerald" : "slate"}>promotion {data.promoteCut} XP</Chip>
            <Chip tone={data.place >= 6 ? "rose" : "slate"}>demotion {data.demoteCut} XP</Chip>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {data.standings.map((s, i) => {
            const promoted = i < 3;
            const demoted = i >= 5;
            return (
              <div key={s.name + i} className={`rounded-xl border px-3 py-2 ${s.you ? "border-[var(--rah-primary)]/40 bg-[var(--rah-primary)]/[0.08]" : "border-white/[0.05] bg-white/[0.02]"}`}>
                <div className="mb-1 flex items-center gap-2 text-xs font-bold">
                  <span className={promoted ? "text-[#7fe0ac]" : demoted ? "text-[#ffa3b1]" : "text-[#7d889c]"}>#{i + 1}</span>
                  <span className={s.you ? "text-[#9dc0ff]" : "text-[#dbe3f0]"}>{s.name}</span>
                  <span className="ml-auto text-[#8b96a9]">{s.xp} XP</span>
                </div>
                <Bar value={s.xp} max={max} tone={s.you ? "blue" : promoted ? "emerald" : demoted ? "rose" : "cyan"} />
              </div>
            );
          })}
        </div>
      </Card>
      {data.history.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-extrabold text-[#f2f5fa]">Season history</div>
          <div className="flex flex-col gap-1.5 text-xs text-[#8b96a9]">
            {data.history.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                {h.promoted ? <TrendingUp className="h-3.5 w-3.5 text-[#7fe0ac]" /> : h.demoted ? <TrendingDown className="h-3.5 w-3.5 text-[#ffa3b1]" /> : <span className="h-3.5 w-3.5" />}
                <span>Week {h.week}: place {h.place} in {["Wood", "Bronze", "Silver", "Gold", "Platinum", "Rahiator"][h.division]}</span>
                {h.promoted && <Chip tone="emerald">promoted +150 XP</Chip>}
                {h.demoted && <Chip tone="rose">demoted</Chip>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
