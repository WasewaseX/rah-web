"use client";

// Speed Round: 60 seconds, 40 weakness-biased items, combo multiplier up to
// 5x. The timer is the enemy; your own mistakes reset the multiplier. One
// run is the most XP per minute the app offers - if you can hold the combo.

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Play, Timer, Zap } from "lucide-react";
import { Btn, Card, Chip, FA, Spinner } from "../ui";
import { submitGameResult } from "@/lib/offline";

interface Item {
  id: string;
  kind: "cloze" | "mcq";
  q: string;
  hint?: string;
  choices?: string[];
  key: string;
  accepts: string[];
  note?: string;
  tag?: string;
}

interface Result {
  xpGain: number;
  best: number;
  isNewBest: boolean;
  bestCombo: number;
  leveledUp: boolean;
  level: number;
  queued?: boolean; // offline: the aggregate is queued to sync (Task 78)
}

const ROUND_MS = 60_000;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

export default function SpeedRound({ onChange }: { onChange: () => void }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "done">("idle");
  const [items, setItems] = useState<Item[]>([]);
  const [best, setBest] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"ok" | "miss" | null>(null);
  const [left, setLeft] = useState(ROUND_MS);
  const [combo, setCombo] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0, maxCombo: 0, score: 0 });
  const [finalTally, setFinalTally] = useState({ correct: 0, total: 0, maxCombo: 0, score: 0 });
  // Mirror of the tally for the timer's finish: written only inside event
  // handlers (never read during render), read only inside the interval
  // callback, which runs outside of render.
  const tallyRef = useRef({ correct: 0, total: 0, maxCombo: 0, score: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef(0);
  const locked = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const finish = useCallback(
    async (final: { correct: number; total: number; maxCombo: number; score: number }) => {
      stopTimer();
      setFinalTally(final);
      setPhase("done");
      const res = await submitGameResult("/api/arcade/speed", { ...final, ms: ROUND_MS });
      if (res.online) {
        const j = res.data as { best?: number; bestCombo?: number };
        setResult(res.data as unknown as Result);
        setBest(j.best ?? 0);
        setBestCombo(j.bestCombo ?? 0);
      } else {
        setResult({ xpGain: 0, best: final.score, isNewBest: false, bestCombo: final.maxCombo, leveledUp: false, level: 0, queued: true });
      }
      onChange();
    },
    [onChange],
  );

  const start = async () => {
    setPhase("loading");
    const r = await fetch("/api/arcade/speed", { cache: "no-store" });
    const j = await r.json();
    setItems(j.items ?? []);
    setBest(j.best ?? 0);
    setBestCombo(j.bestCombo ?? 0);
    setIdx(0);
    setCombo(0);
    tallyRef.current = { correct: 0, total: 0, maxCombo: 0, score: 0 };
    setTally(tallyRef.current);
    setResult(null);
    setInput("");
    setFlash(null);
    setLeft(ROUND_MS);
    startedAt.current = Date.now();
    setPhase("running");
    stopTimer();
    timerRef.current = setInterval(() => {
      const rem = ROUND_MS - (Date.now() - startedAt.current);
      setLeft(Math.max(0, rem));
      if (rem <= 0) {
        // Time over: settle with what the run has banked. finish is stable
        // (its only dep is the stable refresh), so this closure stays valid.
        stopTimer();
        void finish(tallyRef.current);
      }
    }, 100);
  };

  useEffect(() => stopTimer, []);

  const item = items[idx] as Item | undefined;

  const answer = (ok: boolean) => {
    if (!item || flash) return;
    let nextCombo = combo;
    if (ok) {
      nextCombo = combo + 1;
      tallyRef.current = {
        correct: tallyRef.current.correct + 1,
        total: tallyRef.current.total + 1,
        maxCombo: Math.max(tallyRef.current.maxCombo, nextCombo),
        score: tallyRef.current.score + 10 * Math.min(5, nextCombo),
      };
    } else {
      nextCombo = 0;
      tallyRef.current = { ...tallyRef.current, total: tallyRef.current.total + 1 };
    }
    setTally(tallyRef.current);
    setCombo(nextCombo);
    setFlash(ok ? "ok" : "miss");
    setTimeout(() => {
      setFlash(null);
      setInput("");
      setIdx((i) => i + 1); // past the pool? keep the timer running; time is the real limit
    }, ok ? 260 : 480);
  };

  const submitCloze = () => {
    if (!item) return;
    const got = normalize(input);
    if (!got) return;
    answer(item.accepts.includes(got));
  };

  if (phase === "idle" || phase === "loading") {
    return (
      <Card className="py-10 text-center">
        {phase === "loading" ? (
          <Spinner label="Loading the blitz" />
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffb02e]/[0.14] text-[#ffd08a]">
              <Zap className="h-8 w-8" />
            </div>
            <div className="mt-4 text-xl font-black tracking-tight text-[#f2f5fa]">Speed Round</div>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
              60 seconds. Chain correct answers to stack a 5x multiplier. One miss and the flame dies. Items lean on your active mistake families.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Chip tone="amber">best {best}</Chip>
              <Chip tone="violet">best combo {bestCombo}x</Chip>
            </div>
            <Btn variant="warm" onClick={start} className="mt-6">
              <Play className="h-4 w-4" /> Start the blitz
            </Btn>
          </>
        )}
      </Card>
    );
  }

  if (phase === "done") {
    const s = finalTally;
    return (
      <Card className="rah-pop py-10 text-center">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ffd08a]">Time</div>
        <div className="mt-1 text-5xl font-black tracking-tight text-[#f2f5fa]">{s.score}</div>
        {result?.isNewBest && <div className="mt-2 text-sm font-black text-[#ffd08a]">NEW PERSONAL BEST</div>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Chip tone="emerald">{s.correct} correct</Chip>
          <Chip tone={s.maxCombo >= 8 ? "amber" : "slate"}>max combo {s.maxCombo}x</Chip>
          <Chip tone="cyan">+{result?.xpGain ?? 0} XP</Chip>
          {result?.queued && <span className="text-[11px] text-amber-300">Offline - the run is queued to sync</span>}
          {result?.leveledUp && <Chip tone="violet">LEVEL UP · Lv {result.level}</Chip>}
        </div>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
          {s.maxCombo >= 10
            ? "That combo was surgical. The Examiner is watching."
            : s.correct >= 25
              ? "Fast and accurate. Push the combo earlier next run."
              : "Speed without the combo is just noise. Accuracy first, the flame follows."}
        </p>
        <Btn variant="warm" onClick={start} className="mt-6">
          <Play className="h-4 w-4" /> Run it again
        </Btn>
      </Card>
    );
  }

  // running
  const secs = Math.ceil(left / 1000);
  const mult = Math.min(5, combo);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Chip tone="amber">
            <Timer className="h-3 w-3" /> {secs}s
          </Chip>
          <Chip tone={mult >= 3 ? "violet" : "slate"}>
            <Flame className={`h-3 w-3 ${mult >= 3 ? "animate-pulse" : ""}`} /> {mult}x
          </Chip>
          <Chip tone="cyan">{tally.score} pts</Chip>
        </div>
        <Btn variant="ghost" onClick={() => {
          stopTimer();
          void finish(tallyRef.current);
        }}>
          End run
        </Btn>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#232b3a]">
        <div
          className={`h-full rounded-full transition-none ${secs <= 10 ? "bg-[#ff6b81]" : "bg-gradient-to-r from-[#ffb02e] to-[#ffcb6b]"}`}
          style={{ width: `${(left / ROUND_MS) * 100}%` }}
        />
      </div>

      {item ? (
        <Card className={`min-h-64 transition-colors ${flash === "ok" ? "border-[#2fc273]/60" : flash === "miss" ? "border-[#ff6b81]/60" : ""}`}>
          <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f8fe8]">
            {item.kind === "mcq" ? "Pick the meaning" : "Type the answer"}
          </div>
          {item.kind === "mcq" ? (
            <>
              <div className="text-center text-[24px] font-extrabold leading-snug tracking-tight text-[#f2f5fa]">{item.q}</div>
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {(item.choices ?? []).map((c) => (
                  <button
                    key={c}
                    onClick={() => answer(c === item.key)}
                    className="rounded-2xl border-2 border-[#2a3242] px-4 py-3.5 text-sm font-semibold text-[#b7c1d3] transition-all hover:border-[#3f4c63] hover:bg-white/[0.03] active:scale-[.99]"
                  >
                    <FA className="text-[#f2f5fa]">{c}</FA>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <FA className="block text-center text-[24px] font-bold leading-snug text-[#f2f5fa]">{item.q.includes("___") ? item.q : item.q}</FA>
              {!item.q.includes("___") && <div className="mt-2 text-center text-xs text-[#8b96a9]">Produce the whole English phrase.</div>}
              <form
                className="mt-6 flex gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCloze();
                }}
              >
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={item.q.includes("___") ? "Fill the blank" : "Type the English"}
                  className="min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]"
                  dir="ltr"
                  autoComplete="off"
                />
                <Btn type="submit" variant="go" disabled={!input.trim()}>
                  Fire
                </Btn>
              </form>
            </>
          )}
          {flash === "miss" && (
            <div className="mt-4 text-center text-sm font-bold text-[#ffa3b1]">
              key: {item.key} {item.hint && item.hint !== item.key ? `· ${item.hint}` : ""}
            </div>
          )}
        </Card>
      ) : (
        <Card className="py-14 text-center">
          <div className="text-lg font-black text-[#f2f5fa]">Pool cleared before the clock. Respect.</div>
          <div className="mt-1 text-sm text-[#a9b4c6]">Riding out the timer…</div>
        </Card>
      )}
    </div>
  );
}
