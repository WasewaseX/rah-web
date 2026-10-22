"use client";

// Boss Battle vs The Examiner. Three phases, eight weakness-biased items
// each. Every correct answer chips the boss bar; every miss costs a heart.
// Three hearts, no mercy. The boss's items come from your own mistake
// families - you fight your leaks face to face.

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Play, Skull, Swords } from "lucide-react";
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

interface Phase {
  n: number;
  name: string;
  taunt: string;
  items: Item[];
}

interface Result {
  xpGain: number;
  leveledUp: boolean;
  level: number;
  queued?: boolean; // offline: the aggregate is queued to sync (Task 78)
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

export default function BossBattle({ onChange }: { onChange: () => void }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "fight" | "won" | "lost">("idle");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [p, setP] = useState(0); // phase index
  const [i, setI] = useState(0); // item index in phase
  const [hearts, setHearts] = useState(3);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"ok" | "miss" | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const settled = useRef(false);

  const cur = phases[p];
  const item = cur?.items[i];

  const settle = useCallback(
    async (won: boolean, phaseReached: number, heartsLeft: number, t: { correct: number; total: number }) => {
      if (settled.current) return;
      settled.current = true;
      setPhase(won ? "won" : "lost");
      const res = await submitGameResult("/api/arcade/boss", {
        won,
        phaseReached,
        heartsLeft,
        correct: t.correct,
        total: t.total,
      });
      if (res.online) {
        const j = res.data as { xpGain?: number; leveledUp?: boolean; level?: number };
        setResult({ xpGain: j.xpGain ?? 0, leveledUp: j.leveledUp ?? false, level: j.level ?? 0 });
      } else {
        setResult({ xpGain: 0, leveledUp: false, level: 0, queued: true });
      }
      onChange();
    },
    [onChange],
  );

  const start = async () => {
    setPhase("loading");
    settled.current = false;
    const r = await fetch("/api/arcade/boss", { cache: "no-store" });
    const j = await r.json();
    setPhases(j.phases ?? []);
    setP(0);
    setI(0);
    setHearts(3);
    setTally({ correct: 0, total: 0 });
    setResult(null);
    setInput("");
    setFlash(null);
    setBanner(`Phase 1 · ${j.phases?.[0]?.name ?? ""}`);
    setTimeout(() => setBanner(null), 1400);
    setPhase("fight");
  };

  const answer = (ok: boolean) => {
    if (!item || flash) return;
    const nt = { correct: tally.correct + (ok ? 1 : 0), total: tally.total + 1 };
    setTally(nt);
    if (ok) {
      setFlash("ok");
      setTimeout(() => {
        setFlash(null);
        setInput("");
        if (i + 1 >= (cur?.items.length ?? 0)) {
          // Phase cleared.
          if (p + 1 >= phases.length) {
            void settle(true, p + 1, hearts, nt);
          } else {
            setP(p + 1);
            setI(0);
            setBanner(`Phase ${p + 2} · ${phases[p + 1]?.name ?? ""}`);
            setTimeout(() => setBanner(null), 1400);
          }
        } else {
          setI(i + 1);
        }
      }, 300);
    } else {
      const nh = hearts - 1;
      setHearts(nh);
      setFlash("miss");
      setTimeout(() => {
        setFlash(null);
        setInput("");
        if (nh <= 0) {
          void settle(false, p + 1, 0, nt);
        } else if (i + 1 >= (cur?.items.length ?? 0)) {
          // Phase survived on a miss: advance anyway (the boss bar tracks items, misses cost hearts).
          if (p + 1 >= phases.length) {
            void settle(true, p + 1, nh, nt);
          } else {
            setP(p + 1);
            setI(0);
            setBanner(`Phase ${p + 2} · ${phases[p + 1]?.name ?? ""}`);
            setTimeout(() => setBanner(null), 1400);
          }
        } else {
          setI(i + 1);
        }
      }, 650);
    }
  };

  if (phase === "idle" || phase === "loading") {
    return (
      <Card className="py-10 text-center">
        {phase === "loading" ? (
          <Spinner label="The Examiner is assembling your fight" />
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff6b81]/[0.14] text-[#ffa3b1]">
              <Swords className="h-8 w-8" />
            </div>
            <div className="mt-4 text-xl font-black tracking-tight text-[#f2f5fa]">Boss Battle: The Examiner</div>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
              Three phases, eight items each, three hearts. Every weapon is pulled from your own recurring mistakes. Win and the badge is yours.
            </p>
            <Btn variant="danger" onClick={start} className="mt-6">
              <Play className="h-4 w-4" /> Enter the fight
            </Btn>
          </>
        )}
      </Card>
    );
  }

  if (phase === "won" || phase === "lost") {
    const won = phase === "won";
    return (
      <Card className="rah-pop py-10 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${won ? "bg-[#2fc273]/[0.14] text-[#2fc273]" : "bg-[#ff6b81]/[0.14] text-[#ff6b81]"}`}
        >
          {won ? <Swords className="h-8 w-8" /> : <Skull className="h-8 w-8" />}
        </div>
        <div className="mt-4 text-xl font-black tracking-tight text-[#f2f5fa]">
          {won ? "The Examiner falls." : "The Examiner wins this one."}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Chip tone="emerald">{tally.correct} hits landed</Chip>
          <Chip tone="rose">{hearts} heart{hearts === 1 ? "" : "s"} left</Chip>
          <Chip tone="cyan">+{result?.xpGain ?? 0} XP</Chip>
          {result?.queued && <span className="text-[11px] text-amber-300">Offline - the battle is queued to sync</span>}
          {result?.leveledUp && <Chip tone="violet">LEVEL UP · Lv {result.level}</Chip>}
        </div>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
          {won
            ? hearts === 3
              ? "Flawless. Untouchable. The badge cabinet just got heavier."
              : "Won, but bleeding. Flawless runs pay double pride."
            : "The boss fought you with your own leaks. The coach has seen the wounds - hunt those families first, then come back."}
        </p>
        <Btn variant={won ? "go" : "danger"} onClick={start} className="mt-6">
          <Play className="h-4 w-4" /> {won ? "Fight a fresh boss" : "Rematch"}
        </Btn>
      </Card>
    );
  }

  // fighting
  const phaseItems = cur?.items.length ?? 8;
  const bossHp = ((phaseItems - i) / phaseItems) * 100;
  return (
    <div className="flex flex-col gap-4">
      {banner && (
        <div className="rah-pop rounded-2xl border border-[#ff6b81]/30 bg-gradient-to-br from-[#2a1218] to-[#1a1014] px-5 py-4 text-center">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ffa3b1]">{banner}</div>
          <div className="mt-1 text-sm italic text-[#c3cddd]">"{phases[p]?.taunt}"</div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((h) => (
            <Heart key={h} className={`h-5 w-5 ${h < hearts ? "fill-[#ff6b81] text-[#ff6b81]" : "text-[#2a3242]"}`} />
          ))}
        </div>
        <Chip tone="rose">Phase {p + 1}/3</Chip>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
          <span className="text-[#ffa3b1]">THE EXAMINER</span>
          <span className="text-[#7d889c]">{phaseItems - i} HP</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#232b3a]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff6b81] to-[#ff8ba0] transition-all duration-500"
            style={{ width: `${bossHp}%` }}
          />
        </div>
      </div>

      {item && (
        <Card className={`min-h-64 transition-colors ${flash === "ok" ? "border-[#2fc273]/60" : flash === "miss" ? "border-[#ff6b81]/60" : ""}`}>
          <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f8fe8]">
            {item.kind === "mcq" ? "Counter: pick the meaning" : "Counter: type the answer"}
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
              <FA className="block text-center text-[22px] font-bold leading-snug text-[#f2f5fa]">{item.q}</FA>
              <form
                className="mt-6 flex gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const got = normalize(input);
                  if (!got) return;
                  answer(item.accepts.includes(got));
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
                  Strike
                </Btn>
              </form>
            </>
          )}
          {flash === "miss" && (
            <div className="mt-4 text-center text-sm font-bold text-[#ffa3b1]">
              The Examiner strikes: {item.key} {item.hint && item.hint !== item.key ? `· ${item.hint}` : ""}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
