"use client";

// Match Pairs: DUOLINGO-RE.md D3. Tap a Farsi tile, tap its English meaning;
// a correct pair locks in with a pop, a wrong pair shakes and costs the
// clean-board bonus. Each successful match grades the card Good through the
// normal /api/review/grade path (FSRS sees the retrieval); the run aggregate
// goes to /api/arcade/pairs for the sprint bonus. The board is deterministic
// per day, so rematches drill the same set the engine chose.

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Grid2x2Check, Undo2 } from "lucide-react";
import { Btn, Card, Chip, FA, Spinner } from "../ui";
import { submitGameResult } from "@/lib/offline";

interface PairSide {
  id: string;
  text: string;
}

interface Board {
  left: PairSide[];
  right: PairSide[];
  size: number;
  cleanBoards: number;
}

export default function PairsGame({ onExit }: { onExit: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [selRight, setSelRight] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null); // id that just misfired (for the shake)
  const [missteps, setMissteps] = useState(0);
  const [done, setDone] = useState(false);
  const [xpGain, setXpGain] = useState<number | null>(null);
  const startedAt = useRef<number>(Date.now());
  const lockRef = useRef(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/arcade/pairs", { cache: "no-store" });
      const j = (await r.json()) as Board;
      setBoard(j);
      setLoading(false);
      startedAt.current = Date.now();
    })().catch(() => setLoading(false));
  }, []);

  const finish = useCallback(
    async (finalMatched: Set<string>, finalMissteps: number) => {
      setDone(true);
      const ms = Date.now() - startedAt.current;
      const res = await submitGameResult("/api/arcade/pairs", {
        matched: [...finalMatched],
        missteps: finalMissteps,
        ms,
      });
      setXpGain(res.online ? Number((res.data as { xpGain?: number }).xpGain ?? 0) : 0);
    },
    [],
  );

  const attempt = useCallback(
    async (leftId: string, rightId: string) => {
      if (lockRef.current) return;
      if (leftId === rightId) {
        // MATCH: lock the pair, grade Good through the normal review path.
        lockRef.current = true;
        const next = new Set([...matched, leftId]);
        setMatched(next);
        setSelLeft(null);
        setSelRight(null);
        lockRef.current = false;
        try {
          await fetch("/api/review/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId: leftId, grade: 3, dir: "pairs" }),
          });
        } catch {
          // grade route hiccup: the board still completes; state refreshes on exit
        }
        if (next.size === (board?.size ?? 5)) void finish(next, missteps);
      } else {
        setMissteps((m) => m + 1);
        setWrong(rightId);
        setTimeout(() => setWrong(null), 420);
        setSelRight(null);
      }
    },
    [matched, board?.size, missteps, finish],
  );

  const tapLeft = (id: string) => {
    if (matched.has(id) || done) return;
    setSelLeft(id);
    if (selRight) void attempt(id, selRight);
  };

  const tapRight = (id: string) => {
    if (matched.has(id) || done) return;
    setSelRight(id);
    if (selLeft) void attempt(selLeft, id);
  };

  if (loading) {
    return (
      <Card>
        <Spinner label="Laying out the board" />
      </Card>
    );
  }

  if (!board || board.size === 0) {
    return (
      <Card className="rah-pop py-14 text-center">
        <Grid2x2Check className="mx-auto h-9 w-9 text-[#2fc273]" />
        <div className="mt-4 text-xl font-black text-[#f2f5fa]">No cards to pair yet.</div>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[#a9b4c6]">Start the deck first - the sprint builds its board from your schedule.</p>
        <div className="mt-7 flex justify-center">
          <Btn variant="soft" onClick={onExit}>
            <Undo2 className="h-4 w-4" /> Back
          </Btn>
        </div>
      </Card>
    );
  }

  if (done) {
    const clean = missteps === 0;
    return (
      <Card className="rah-pop py-14 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#2fc273]" />
        <div className="mt-4 text-xl font-black tracking-tight text-[#f2f5fa]">
          {board.size} pairs {clean ? "flawless." : "matched."}
        </div>
        <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
          {missteps === 0 ? (
            <>No missteps - every match on the first tap. The clean-board bonus is yours.</>
          ) : (
            <>
              {missteps} misstep{missteps === 1 ? "" : "s"}. Speed comes from meaning the Farsi, not from luck.
            </>
          )}
        </p>
        <div className="mt-4 flex justify-center">
          <Chip tone="amber">+{xpGain ?? 0} XP sprint bonus</Chip>
        </div>
        <div className="mt-7 flex justify-center">
          <Btn variant="go" onClick={onExit}>
            <Undo2 className="h-4 w-4" /> Back to review
          </Btn>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#7d889c]">
        <span>
          {matched.size} / {board.size} paired
        </span>
        <div className="flex items-center gap-2">
          <Chip tone={missteps === 0 ? "emerald" : missteps < 3 ? "blue" : "rose"}>{missteps} missteps</Chip>
          <Chip tone="blue">Match Pairs</Chip>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#232b3a]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--rah-primary)] to-[var(--rah-accent)] transition-all duration-500"
          style={{ width: `${(matched.size / board.size) * 100}%` }}
        />
      </div>

      <Card className="min-h-72">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2.5">
            {board.left.map((l) => {
              const isMatched = matched.has(l.id);
              const isSel = selLeft === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => tapLeft(l.id)}
                  disabled={isMatched}
                  className={`rah-3d w-full rounded-2xl px-3 py-3 text-sm font-bold transition-all active:scale-[.98] disabled:opacity-35 ${
                    isMatched
                      ? "bg-[#2fc273]/[0.14] text-[#7fe0ac] [--rah-edge:#1d8f52]"
                      : isSel
                        ? "bg-[var(--rah-primary)] text-white [--rah-edge:var(--rah-primary-deep)]"
                        : "bg-[#232b3a] text-[#f2f5fa] [--rah-edge:#171d29] hover:bg-[#2a3242]"
                  }`}
                >
                  <FA>{l.text}</FA>
                </button>
              );
            })}
          </div>
          <div className="space-y-2.5">
            {board.right.map((r) => {
              const isMatched = matched.has(r.id);
              const isSel = selRight === r.id;
              const isWrong = wrong === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => tapRight(r.id)}
                  disabled={isMatched}
                  className={`w-full rounded-2xl px-3 py-3 text-sm font-bold transition-all active:scale-[.98] disabled:opacity-35 ${
                    isMatched
                      ? "bg-[#2fc273]/[0.14] text-[#7fe0ac]"
                      : isWrong
                        ? "rah-shake bg-[#ff6b81]/[0.16] text-[#ffa3b1]"
                        : isSel
                          ? "bg-[var(--rah-primary)] text-white"
                          : "bg-[#232b3a] text-[#f2f5fa] hover:bg-[#2a3242]"
                  }`}
                >
                  {r.text}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-5 text-center text-[11px] font-semibold text-[#5d6879]">
          Every correct pair is graded Good - the schedule sees it like any review.
        </div>
      </Card>
    </div>
  );
}
