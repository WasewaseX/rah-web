"use client";

// Rival Duel: 8 items, 40 seconds, and the rival's deterministic par score
// for the exact same run seed. Beat the par, take the win and the streak.

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Swords, Timer } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "../ui";
import { submitGameResult } from "@/lib/offline";

interface Item {
  id: string;
  kind: "cloze" | "mcq";
  q: string;
  choices?: string[];
  key: string;
  accepts: string[];
  note?: string;
}

interface DuelData {
  items: Item[];
  seed: number;
  parHits: number;
  rivalScore: number;
  timer: number;
  wins: number;
  streak: number;
}

interface DuelResult {
  win: boolean;
  youScore: number;
  rivalScore: number;
  xpGain: number;
  leveledUp: boolean;
  queued?: boolean; // offline: the result is queued to sync (Task 78)
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

export default function Duel({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<DuelData | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(0);
  const [left, setLeft] = useState(0);
  const [flash, setFlash] = useState<"ok" | "miss" | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);
  const corRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locked = useRef(false);

  const load = useCallback(() => {
    fetch("/api/arcade/duel", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DuelData) => {
        setData(d);
        setPhase("idle");
      })
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const finish = useCallback(
    async (finalCorrect: number, ms: number) => {
      if (locked.current || !data) return;
      locked.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("done");
      const res = await submitGameResult("/api/arcade/duel", {
        seed: data.seed,
        correct: finalCorrect,
        total: data.items.length,
        ms,
      });
      if (res.online) {
        setResult(res.data as unknown as DuelResult);
      } else {
        setResult({ queued: true, win: false, youScore: 0, rivalScore: 0, xpGain: 0, capped: false, totalXp: 0, leveledUp: false, unlocked: [] } as DuelResult);
      }
      onChange();
    },
    [data, onChange],
  );

  const start = () => {
    if (!data) return;
    locked.current = false;
    corRef.current = 0;
    setCorrect(0);
    setIdx(0);
    setLeft(data.timer * 1000);
    setPhase("running");
    const t0 = Date.now();
    timerRef.current = setInterval(() => {
      const ms = data.timer * 1000 - (Date.now() - t0);
      if (ms <= 0) {
        void finish(corRef.current, data.timer * 1000);
      } else setLeft(ms);
    }, 250);
  };

  const hit = (ok: boolean) => {
    setFlash(ok ? "ok" : "miss");
    setTimeout(() => setFlash(null), 420);
    if (ok) {
      corRef.current += 1;
      setCorrect(corRef.current);
    }
    const next = idx + 1;
    if (next >= (data?.items.length ?? 0)) void finish(corRef.current, (data?.timer ?? 40) * 1000 - left);
    else setIdx(next);
  };

  if (!data) return <Spinner label="The rival limbers up..." />;
  const item = data.items[Math.min(idx, data.items.length - 1)];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b81]/[0.14] text-[#ffa3b1]">
            <Swords className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-[#f2f5fa]">Rival Duel</span>
              <span className="rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#cfc3fc]" title="A simulated opponent - no other learner is on the other side">practice bot</span>
            </div>
            <div className="text-[11px] text-[#7d889c]">
              Wins {data.wins} · streak {data.streak} · the rival parries about {data.parHits}/8
            </div>
          </div>
          {phase === "running" && (
            <Chip tone={left < 10_000 ? "rose" : "blue"}>
              <Timer className="h-3 w-3" /> {(left / 1000).toFixed(1)}s
            </Chip>
          )}
        </div>

        {phase === "idle" && (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-[#a9b4c6]">
              Same eight items, same clock. The rival&apos;s score for this run is already sealed ({data.rivalScore} points of par). You need more than {data.parHits} hits.
            </div>
            <Btn variant="go" onClick={start}>
              <Play className="h-4 w-4" /> Draw
            </Btn>
          </div>
        )}

        {phase === "running" && item && (
          <div className="flex flex-col gap-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[var(--rah-primary)] transition-all" style={{ width: `${(left / (data.timer * 1000)) * 100}%` }} />
            </div>
            <div className="whitespace-pre-line text-[15px] font-semibold leading-relaxed text-[#e7ecf5]">{item.q}</div>
            {item.choices ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {item.choices.map((c) => (
                  <Btn key={c} variant="soft" onClick={() => hit(c === item.key)}>
                    {c}
                  </Btn>
                ))}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) {
                    hit(item.accepts.includes(normalize(input)));
                    setInput("");
                  }
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Fast - type it..."
                  className="min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50"
                  autoFocus
                />
                <Btn type="submit" disabled={!input.trim()}>
                  Enter
                </Btn>
              </form>
            )}
            {flash && <div className={`text-xs font-bold ${flash === "ok" ? "text-[#7fe0ac]" : "text-[#ffa3b1]"}`}>{flash === "ok" ? "Hit!" : "Miss"}</div>}
            <div className="text-xs text-[#7d889c]">
              {correct}/{data.items.length} hits
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div className="flex flex-col gap-2">
            <div className={`text-lg font-black ${result.win ? "text-[#7fe0ac]" : "text-[#ffa3b1]"}`}>{result.win ? "Duel won." : "Duel lost."}</div>
            <div className="text-sm text-[#a9b4c6]">
              You {result.youScore} — rival {result.rivalScore} · {result.xpGain > 0 ? `+${result.xpGain} XP` : "no XP"}
              {result.queued && <span className="ml-2 text-[11px] text-amber-300">Offline - queued to sync</span>}
              {result.leveledUp ? " · LEVEL UP" : ""}
            </div>
            {!result.win && (
              <Note tone="rose">
                The rival takes the round. Hand the coach your revenge plan from Home&apos;s race card.
              </Note>
            )}
            <Btn variant="soft" onClick={load}>
              Rematch
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
