"use client";

// SRS Blitz: the review grind turned into a card game. Tap to flip, swipe to
// grade (left = Again, right = Good, up = Easy), or use arrow keys. After the
// flip a 4-second bar drains - hesitate and the card grades itself Again.
// FSRS previews stay live; the queue and grading reuse the classic endpoints.

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Undo2, XCircle } from "lucide-react";
import { Btn, Card, Chip, FA } from "../ui";
import type { AppState } from "../App";
import { dayIndex, fmtIvl, preview as fsrsPreview, type FsrsState } from "@/lib/fsrs";
import { DECK } from "@/lib/content";
import { submitGrade } from "@/lib/offline";

interface QueueCard {
  card: {
    id: string;
    unit: string;
    skill: string;
    level: string;
    kind: string;
    prompt: string;
    answer: string;
    alt: string[];
    en: string;
    fa: string;
    note: string;
  };
  state: FsrsState;
  dir: string;
}

const DECISION_MS = 4000;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

function acceptable(card: QueueCard["card"], input: string, dir: string): boolean {
  const got = normalize(input);
  if (!got) return false;
  const targets = dir === "fa2en" ? [card.en, ...(card.alt ?? [])] : [card.answer, ...(card.alt ?? [])];
  return targets.some((t) => normalize(t) === got);
}

function mcqChoices(card: QueueCard["card"]): string[] {
  const pool = DECK.filter((c) => c.fa !== card.fa).sort(() => Math.random() - 0.5).slice(0, 3);
  return [card.fa, ...pool.map((c) => c.fa)].sort(() => Math.random() - 0.5);
}

const DIR_LABEL: Record<string, string> = {
  cloze: "Fill the gap",
  reverse: "Spot the phrase",
  fa2en: "Farsi to English",
  mcq_fa: "Meaning check",
  fae: "Produce the English",
  audio: "Listening recall",
};

function say(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  } catch {
    /* no tts; text always visible */
  }
}

export default function BlitzDeck({ state, onChange, onExit }: { state: AppState; onChange: () => void; onExit: () => void }) {
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [session, setSession] = useState({ done: 0, again: 0, fastest: 0 });
  const [drain, setDrain] = useState(1);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const flipAt = useRef(0);
  const drainRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false);

  const q = queue[idx] as QueueCard | undefined;
  const dir = q?.dir ?? "cloze";
  const isMcq = dir === "mcq_fa" || (dir === "audio" && (q?.card.kind === "ef" || q?.card.kind === "fae"));
  const needsTyping = !isMcq && ["cloze", "reverse", "fa2en", "fae"].includes(dir);
  const isAudio = dir === "audio" && !isMcq;
  const choices = isMcq && q ? mcqChoices(q.card) : [];
  const previews = q ? fsrsPreview(q.state, dayIndex(), state.learner.retention ?? 0.9) : null;

  const stopDrain = () => {
    if (drainRef.current) clearInterval(drainRef.current);
    drainRef.current = null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/review/queue", { cache: "no-store" });
    const j = await r.json();
    setQueue(j.batch ?? []);
    setIdx(0);
    setSession({ done: 0, again: 0, fastest: 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    // Deferred one tick so the first paint never waits on the network.
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Not memoized on purpose: the compiler lints manual memoization strictly,
  // and a per-render closure is always consistent with the card it closes over.
  const grade = async (g: number) => {
    if (!q || busy.current) return;
    busy.current = true;
    stopDrain();
    const took = Date.now() - flipAt.current;
    // Offline-safe (Task 68): grades queue on-device and replay idempotently.
    await submitGrade(q.card.id, g, dir);
    setSession((s) => ({ done: s.done + 1, again: s.again + (g === 1 ? 1 : 0), fastest: s.fastest === 0 ? took : Math.min(s.fastest, took) }));
    setDrag({ x: 0, y: 0 });
    setFlipped(false);
    setInput("");
    setChoice(null);
    busy.current = false;
    setIdx((i) => i + 1);
  };

  // The 4-second decision bar: starts on flip, expires into an Again. The
  // drained bar is only rendered while flipped, so no sync reset needed here.
  useEffect(() => {
    stopDrain();
    if (!q || !flipped) return;
    const t0 = Date.now();
    drainRef.current = setInterval(() => {
      const rem = 1 - (Date.now() - t0) / DECISION_MS;
      if (rem <= 0) {
        stopDrain();
        void grade(1);
      } else {
        setDrain(rem);
      }
    }, 80);
    return stopDrain;
  }, [q, flipped]);

  // Flip: judge the input (typed or tapped), remember correctness, start the
  // decision clock. Declared before the effects that use it.
  const flip = () => {
    if (!q) return;
    const right = isMcq ? choice === q.card.fa : needsTyping ? acceptable(q.card, input, dir) : true;
    setWasRight(right);
    setFlipped(true);
    flipAt.current = Date.now();
  };

  // Keyboard grades.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        flip();
        return;
      }
      if (!flipped) return;
      if (e.key === "ArrowLeft") void grade(1);
      if (e.key === "ArrowRight") void grade(3);
      if (e.key === "ArrowUp") void grade(4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
     
  }, [q, flipped]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || !flipped) return;
    setDrag({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onPointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    dragStart.current = null;
    const { x, y } = drag;
    if (!flipped) {
      setDrag({ x: 0, y: 0 });
      return;
    }
    if (y < -90 && Math.abs(x) < 90) void grade(4);
    else if (x > 90) void grade(3);
    else if (x < -90) void grade(1);
    setDrag({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <Card>
        <span className="block h-5 w-5 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
      </Card>
    );
  }

  if (!q) {
    return (
      <Card className="rah-pop py-14 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2fc273]/[0.14]">
          <CheckCircle2 className="h-9 w-9 text-[#2fc273]" />
        </div>
        <div className="mt-5 text-xl font-black tracking-tight text-[#f2f5fa]">Blitz complete.</div>
        <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
          {session.done} cards at blitz pace, {session.again} graded Again. FSRS took every verdict.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Btn variant="soft" onClick={load}>
            <Undo2 className="h-4 w-4" /> Another blitz
          </Btn>
          <Btn variant="ghost" onClick={onExit}>
            Back to classic
          </Btn>
        </div>
      </Card>
    );
  }

  const rot = drag.x / 20;
  const stamp = flipped ? (drag.x > 40 ? "GOOD" : drag.x < -40 ? "AGAIN" : drag.y < -40 ? "EASY" : null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#7d889c]">
        <span>
          Card {idx + 1}/{queue.length} · {session.done} graded
        </span>
        <div className="flex items-center gap-2">
          <Chip tone="blue">{DIR_LABEL[dir] ?? dir}</Chip>
          <Btn variant="ghost" onClick={onExit} className="!min-h-8 !px-3 !py-1 text-xs">
            exit blitz
          </Btn>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#232b3a]">
        <div className="h-full rounded-full bg-gradient-to-r from-[var(--rah-primary)] to-[var(--rah-accent)] transition-all duration-500" style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>

      <div className="relative select-none" style={{ perspective: 900 }}>
        {/* swipe stamps */}
        {stamp && (
          <div
            className={`pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-xl border-2 px-4 py-1.5 text-sm font-black tracking-widest ${
              stamp === "GOOD"
                ? "border-[#2fc273] text-[#2fc273]"
                : stamp === "AGAIN"
                  ? "border-[#ff6b81] text-[#ff6b81]"
                  : "border-[var(--rah-accent)] text-[var(--rah-accent)]"
            }`}
          >
            {stamp}
          </div>
        )}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="touch-pan-y"
          style={{
            transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rot}deg)`,
            transition: dragging ? "none" : "transform .25s ease-out",
            opacity: Math.max(0.4, 1 - (Math.abs(drag.x) + Math.abs(drag.y)) / 400),
          }}
        >
          <Card key={q.card.id} className="rah-pop min-h-72 cursor-grab active:cursor-grabbing">
            <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f8fe8]">
              {flipped ? "Swipe ← Again · → Good · ↑ Easy" : "Answer, then flip (space)"}
            </div>

            {!isMcq && (
              <div className="text-center">
                {dir === "fa2en" || dir === "fae" ? (
                  <FA className="text-[24px] font-bold leading-snug text-[#f2f5fa]">{q.card.fa}</FA>
                ) : dir === "reverse" ? (
                  <div className="text-[24px] font-extrabold leading-snug tracking-tight text-[#f2f5fa]">{q.card.en}</div>
                ) : isAudio ? (
                  <>
                    <button
                      onClick={() => say(q.card.en)}
                      className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-white shadow-[0_10px_24px_-8px_rgba(78,140,255,.6)] transition-transform hover:scale-105"
                      aria-label="Play audio"
                    >
                      ▶
                    </button>
                    <div className="mt-3 text-sm text-[#8b96a9]">Listen, then type what fills the gap.</div>
                  </>
                ) : (
                  <div className="text-[20px] font-semibold leading-loose text-[#e7ecf5]">
                    {q.card.prompt.split("___").map((part, i, arr) => (
                      <span key={i}>
                        {part}
                        {i < arr.length - 1 && (
                          <span className={`mx-1.5 inline-block min-w-16 rounded-xl px-3 py-0.5 ${flipped ? (wasRight ? "bg-[#2fc273]/[0.16] font-black text-[#7fe0ac]" : "bg-[#ff6b81]/[0.14] text-[#ffa3b1] line-through") : "bg-[#232b3a] text-[#6e7a8e]"}`}>
                            {flipped ? q.card.answer : "?"}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {needsTyping && !flipped && (
                  <form
                    className="mt-5 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      flip();
                    }}
                  >
                    <input
                      autoFocus
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your answer"
                      className="min-h-11 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]"
                      dir="ltr"
                      autoComplete="off"
                    />
                  </form>
                )}
                {flipped && !wasRight && needsTyping && (
                  <div className="mt-3 text-sm font-bold text-[#ffa3b1]">
                    You wrote: <span className="text-[#dbe3f0]">{input || "(empty)"}</span> · Answer: {dir === "fa2en" ? q.card.en : q.card.answer}
                  </div>
                )}
              </div>
            )}

            {isMcq && (
              <div className="text-center">
                <div className="text-[24px] font-extrabold leading-snug tracking-tight text-[#f2f5fa]">{q.card.en}</div>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {choices.map((c) => (
                    <button
                      key={c}
                      onClick={() => !flipped && setChoice(c)}
                      className={`rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                        flipped
                          ? c === q.card.fa
                            ? "border-[#2fc273] bg-[#2fc273]/[0.1] text-[#7fe0ac]"
                            : c === choice
                              ? "border-[#ff6b81] bg-[#ff6b81]/[0.1] text-[#ffa3b1] line-through"
                              : "border-[#2a3242] text-[#6e7a8e]"
                          : choice === c
                            ? "border-[var(--rah-primary)] bg-[var(--rah-primary)]/[0.12] text-[#cfe0ff]"
                            : "border-[#2a3242] text-[#b7c1d3] hover:border-[#3f4c63]"
                      }`}
                    >
                      <FA className="text-[#f2f5fa]">{c}</FA>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {flipped && (
              <div className="mt-4 text-center">
                <div className={`flex items-center justify-center gap-1.5 text-sm font-bold ${wasRight ? "text-[#2fc273]" : "text-[#ff8ba0]"}`}>
                  {wasRight ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {wasRight ? "Correct" : "Missed"}
                </div>
                {q.card.note && <div className="mt-2 text-xs text-[#8b96a9]">{q.card.note}</div>}
              </div>
            )}

            {!flipped && (
              <div className="mt-5 text-center">
                <Btn variant="soft" onClick={flip}>
                  Flip card
                </Btn>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* decision bar */}
      {flipped && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-[#232b3a]">
            <div className={`h-full rounded-full ${drain < 0.25 ? "bg-[#ff6b81]" : "bg-[#ffb02e]"}`} style={{ width: `${drain * 100}%` }} />
          </div>
          <div className="mt-2 text-center text-[11px] font-semibold text-[#7d889c]">
            Decide fast · hesitation grades Again · intervals: Again {fmtIvl(previews![0])} / Good {fmtIvl(previews![2])} / Easy {fmtIvl(previews![3])}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Btn variant="danger" onClick={() => grade(1)}>
              Again
            </Btn>
            <Btn variant="go" onClick={() => grade(3)}>
              Good
            </Btn>
            <Btn variant="primary" onClick={() => grade(4)}>
              Easy
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
