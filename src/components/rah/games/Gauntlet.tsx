"use client";

// The Gauntlet: endless, escalating, one life. Every hit makes the next item
// harder; the first miss ends the run (the Chain Shield talent saves you
// once). The personal best chases you live at the top of the card.

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Skull, Swords } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "../ui";

interface GItem {
  id: string;
  kind: "cloze" | "mcq";
  q: string;
  choices?: string[];
  note?: string;
  tag?: string;
}

interface GState {
  streak: number;
  shieldUsed: boolean;
  shielded: boolean;
  done: boolean;
  best: number;
}

interface GNext extends GItem {
  streak: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

export default function Gauntlet({ onChange }: { onChange: () => void }) {
  const [state, setState] = useState<GState | null>(null);
  const [next, setNext] = useState<GNext | null>(null);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; saved?: boolean } | null>(null);
  const [end, setEnd] = useState<{ streak: number; xpGain: number } | null>(null);
  const busy = useRef(false);

  const load = useCallback(() => {
    fetch("/api/arcade/gauntlet", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: GState & Partial<GNext>) => {
        setState({ streak: j.streak, shieldUsed: j.shieldUsed, shielded: j.shielded, done: j.done, best: j.best });
        setNext(j.id ? ({ id: j.id, kind: j.kind, q: j.q, choices: j.choices, note: j.note, tag: j.tag, streak: j.streak } as GNext) : null);
        setEnd(null);
        setInput("");
      })
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const submit = async (pick: string) => {
    if (busy.current || !state) return;
    busy.current = true;
    try {
      const r = await fetch("/api/arcade/gauntlet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick }),
      });
      const j = (await r.json()) as { correct: boolean; saved?: boolean; streak: number; next?: GNext; xpGain?: number };
      setFlash({ ok: j.correct, saved: j.saved });
      setTimeout(() => setFlash(null), 1200);
      if (j.saved) {
        setState((s) => (s ? { ...s, shieldUsed: true, streak: j.streak } : s));
        if (j.next) setNext({ ...j.next });
      } else if (j.correct) {
        setState((s) => (s ? { ...s, streak: j.streak } : s));
        if (j.next) setNext({ ...j.next });
        else load();
      } else {
        setEnd({ streak: j.streak, xpGain: j.xpGain ?? 0 });
        onChange();
      }
      setInput("");
    } finally {
      busy.current = false;
    }
  };

  if (!state) return <Spinner label="Sharpening the gauntlet..." />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b81]/[0.14] text-[#ffa3b1]">
            <Skull className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-[#f2f5fa]">The Gauntlet</div>
            <div className="text-[11px] text-[#7d889c]">Endless, escalating, one life. Personal best: {state.best}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Chip tone={state.streak >= state.best && state.streak > 0 ? "amber" : "slate"}>
              <Swords className="h-3 w-3" /> {state.streak} · best {state.best}
            </Chip>
            {state.shielded && !state.shieldUsed && <Chip tone="cyan">shield ready</Chip>}
          </div>
        </div>

        {end ? (
          <div className="flex flex-col gap-2">
            <div className="text-lg font-black text-[#ffa3b1]">The gauntlet ends at {end.streak}.</div>
            <div className="text-sm text-[#a9b4c6]">{end.xpGain > 0 ? `+${end.xpGain} XP for the survivors' fund.` : "Nothing scored - the first item bit."}</div>
            {end.streak >= state.best && end.streak > 0 && <Chip tone="amber">new personal best</Chip>}
            <Btn variant="soft" onClick={load}>
              <Play className="h-4 w-4" /> New run
            </Btn>
          </div>
        ) : state.done || !next ? (
          <Btn variant="go" onClick={load}>
            <Play className="h-4 w-4" /> Enter the gauntlet
          </Btn>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7d889c]">
              Item {state.streak + 1} · {state.streak >= 15 ? "the deep end" : state.streak >= 10 ? "C1 waters" : state.streak >= 5 ? "warming up" : "shallows"}
            </div>
            <div className="whitespace-pre-line text-[15px] font-semibold leading-relaxed text-[#e7ecf5]">{next.q}</div>
            {next.choices ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {next.choices.map((c) => (
                  <Btn key={c} variant="soft" onClick={() => submit(c)}>
                    {c}
                  </Btn>
                ))}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) submit(input);
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="One life. Answer..."
                  className="min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50"
                  autoFocus
                />
                <Btn type="submit" disabled={!input.trim()}>
                  Enter
                </Btn>
              </form>
            )}
            {flash && !flash.ok && <Note tone={flash.saved ? "emerald" : "rose"}>{flash.saved ? "The Chain Shield ate that miss. One save per run." : "Miss."}</Note>}
            {flash?.ok && <div className="text-xs font-bold text-[#7fe0ac]">Hit. It gets harder.</div>}
          </div>
        )}
      </Card>
      <Card className="text-xs text-[#7d889c]">
        Streak 5 moves you out of the shallows, 10 brings C1 cards, 15 floods the pool with your own worst tags. Every hit pays 8 XP when the run ends - if you survive long enough to earn it.
      </Card>
    </div>
  );
}
