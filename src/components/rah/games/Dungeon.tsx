"use client";

// Daily Dungeon: 3 floors x 4 items, seeded by the day so every attempt today
// walks the same rooms. Server-graded (keys never ship), three hearts, a miss
// costs one. Clear all 12 with hearts intact for the perfect bonus.

import { useCallback, useEffect, useState } from "react";
import { Castle, Heart, HeartCrack, Play } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "../ui";

interface PubItem {
  id: string;
  kind: "cloze" | "mcq";
  q: string;
  choices?: string[];
  note?: string;
  tag?: string;
}

interface RunView {
  floors: { n: number; name: string; items: PubItem[] }[];
  answers: (string | null)[];
  hearts: number;
  maxHearts: number;
  done: boolean;
  cleared: number;
  isNew?: boolean;
  best?: number;
}

interface GradeOut {
  correct: boolean;
  key?: string;
  hearts: number;
  done: boolean;
  cleared: number;
  perfect: boolean;
  xp?: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

export default function Dungeon({ onChange }: { onChange: () => void }) {
  const [run, setRun] = useState<RunView | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; key?: string } | null>(null);
  const [out, setOut] = useState<GradeOut | null>(null);
  const [input, setInput] = useState("");

  const load = useCallback(() => {
    fetch("/api/arcade/dungeon", { cache: "no-store" })
      .then((r) => r.json())
      .then(setRun)
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const current = run && !run.done ? run.floors.flatMap((f) => f.items).findIndex((_, i) => run.answers[i] === null) : -1;

  const answer = async (pick: string) => {
    if (!run || current < 0) return;
    const r = await fetch("/api/arcade/dungeon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idx: current, pick }),
    });
    const j = (await r.json()) as GradeOut;
    setFlash({ ok: j.correct, key: j.key });
    setInput("");
    if (!j.correct) setTimeout(() => setFlash(null), 2600);
    if (j.done) {
      setOut(j);
      onChange();
      load();
    } else {
      setRun((prev) => (prev ? { ...prev, answers: prev.answers.map((a, i) => (i === current ? pick : a)), hearts: j.hearts } : prev));
    }
  };

  if (!run) return <Spinner label="Lighting the torches..." />;
  const all = run.floors.flatMap((f) => f.items);
  const item = current >= 0 ? all[current] : null;
  const floorOf = (i: number) => run.floors[Math.floor(i / 4)];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#a78bfa]/[0.14] text-[#cfc3fc]">
            <Castle className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-[#f2f5fa]">Today&apos;s Dungeon</div>
            <div className="text-[11px] text-[#7d889c]">One run a day. Floors: {run.floors.map((f) => f.name).join(" → ")}. Best: {run.best ?? 0} floors.</div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {Array.from({ length: run.maxHearts }, (_, i) =>
              i < run.hearts ? <Heart key={i} className="h-4 w-4 fill-[#ff6b81] text-[#ff6b81]" /> : <HeartCrack key={i} className="h-4 w-4 text-[#4a5364]" />,
            )}
          </div>
        </div>

        {run.done ? (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-extrabold text-[#f2f5fa]">
              {out?.perfect ? "Flawless vault run — every heart intact!" : run.cleared >= 3 ? "Dungeon cleared!" : `The dungeon keeps ${3 - run.cleared} floor${3 - run.cleared === 1 ? "" : "s"}.`}
            </div>
            {out && out.xp ? <Chip tone="violet">+{out.xp} XP{out.perfect ? " (perfect bonus)" : ""}</Chip> : <Chip tone="slate">No XP this time — return tomorrow.</Chip>}
            {out && out.perfect && <div className="text-xs text-[#7d889c]">Dungeon Master territory. The Examiner felt that one.</div>}
          </div>
        ) : item ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7d889c]">
              Floor {floorOf(current).n} · {floorOf(current).name} · item {all.findIndex((_, i) => i === current) + 1}/12
            </div>
            <div className="whitespace-pre-line text-[15px] font-semibold leading-relaxed text-[#e7ecf5]">{item.q}</div>
            {item.choices ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {item.choices.map((c) => (
                  <Btn key={c} variant="soft" onClick={() => answer(c)} disabled={flash !== null}>
                    {c}
                  </Btn>
                ))}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) answer(input);
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write your answer..."
                  className="min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50"
                  autoFocus
                />
                <Btn type="submit" disabled={!input.trim() || flash !== null}>
                  Enter
                </Btn>
              </form>
            )}
            {flash && (
              <Note tone={flash.ok ? "emerald" : "rose"}>
                {flash.ok ? "Hit. The door opens." : `A heart shatters. The key was: ${flash.key}`}
              </Note>
            )}
          </div>
        ) : (
          <Btn variant="go" onClick={load}>
            <Play className="h-4 w-4" /> Re-enter
          </Btn>
        )}
      </Card>
      <Card className="text-xs text-[#7d889c]">
        The dungeon is server-graded: answers are checked on the server, keys never reach your browser before you commit. Clear floors for 40/90/160 XP, keep every heart for +50.
      </Card>
    </div>
  );
}
