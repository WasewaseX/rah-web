"use client";

// Review: the multi-direction retrieval loop. One item, many roads in:
// gap-fill, meaning to English, English to meaning, listening. FSRS-5
// schedules what comes back and when.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, Volume2, Undo2, Sparkles } from "lucide-react";
import { Btn, Card, Chip, FA, Spinner } from "./ui";
import type { AppState } from "./App";
import { preview as fsrsPreview, dayIndex, fmtIvl, defaultState, type FsrsState } from "@/lib/fsrs";
import { DECK } from "@/lib/content";

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

const DIR_LABEL: Record<string, string> = {
  cloze: "Fill the gap",
  reverse: "Spot the phrase",
  fa2en: "Farsi to English",
  mcq_fa: "Meaning check",
  fae: "Produce the English",
  audio: "Listening recall",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function acceptable(card: QueueCard["card"], input: string, dir: string): boolean {
  const got = normalize(input);
  if (!got) return false;
  const targets =
    dir === "fa2en" ? [card.en, ...(card.alt ?? [])] : [card.answer, ...(card.alt ?? [])];
  return targets.some((t) => normalize(t) === got);
}

function speak(text: string, rate = 0.92) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch {
    // no tts in this browser; the text is always shown as fallback
  }
}

function mcqChoices(card: QueueCard["card"]): string[] {
  const pool = DECK.filter((c) => c.fa !== card.fa).sort(() => Math.random() - 0.5).slice(0, 3);
  return [card.fa, ...pool.map((c) => c.fa)].sort(() => Math.random() - 0.5);
}

function PromptBody({ q, dir, revealed, correct }: { q: QueueCard; dir: string; revealed: boolean; correct: boolean }) {
  const { card } = q;
  if (dir === "mcq_fa") {
    return (
      <div className="text-center">
        <div className="text-[26px] font-extrabold leading-snug tracking-tight text-[#f2f5fa]">{card.en}</div>
        {revealed && <div className="mt-4 text-sm text-[#8b96a9]">{card.note}</div>}
      </div>
    );
  }
  if (dir === "fae" || dir === "fa2en") {
    return (
      <div className="text-center">
        <FA className="text-[26px] font-bold leading-snug text-[#f2f5fa]">{card.fa}</FA>
        {dir === "fa2en" && <div className="mt-3 text-sm text-[#8b96a9]">Type the whole English phrase.</div>}
      </div>
    );
  }
  if (dir === "reverse") {
    return (
      <div className="text-center">
        <div className="text-[26px] font-extrabold leading-snug tracking-tight text-[#f2f5fa]">{card.en}</div>
        <div className="mt-3 text-sm text-[#8b96a9]">Which chunk is the point of this phrase? Type it.</div>
      </div>
    );
  }
  if (dir === "audio") {
    return (
      <div className="text-center">
        <button
          onClick={() => speak(card.kind === "cloze" ? card.en : card.en)}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#4e8cff] to-[#2f62c4] text-white shadow-[0_10px_24px_-8px_rgba(78,140,255,.6)] transition-transform hover:scale-105 active:scale-95"
          aria-label="Play audio"
        >
          <Volume2 className="h-7 w-7" />
        </button>
        <div className="mt-4 text-sm text-[#8b96a9]">Listen, then type what fills the gap.</div>
        {revealed && <div className="mt-4 font-bold text-[#f2f5fa]">{card.en}</div>}
      </div>
    );
  }
  // cloze
  const parts = card.prompt.split("___");
  return (
    <div className="text-center">
      <div className="text-[22px] font-semibold leading-loose text-[#e7ecf5]">
        {parts[0]}
        <span
          className={`mx-1.5 inline-block min-w-20 rounded-xl px-3 py-0.5 ${
            revealed
              ? correct
                ? "bg-[#2fc273]/[0.16] font-black text-[#7fe0ac]"
                : "bg-[#ff6b81]/[0.14] font-bold text-[#ffa3b1] line-through"
              : "bg-[#232b3a] text-[#6e7a8e]"
          }`}
        >
          {revealed ? card.answer : "?"}
        </span>
        {parts[1] ?? ""}
      </div>
      {revealed && (
        <div className="mt-4">
          <div className="font-bold text-[#7fe0ac]">{card.en}</div>
          <FA className="mt-1.5 text-sm">{card.fa}</FA>
        </div>
      )}
    </div>
  );
}

export default function ReviewView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [counts, setCounts] = useState<{ due: number; newLeft: number; reviewedToday: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [session, setSession] = useState({ done: 0, again: 0 });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/review/queue", { cache: "no-store" });
    const j = await r.json();
    setQueue(j.batch ?? []);
    setCounts(j.counts ?? null);
    setIdx(0);
    setSession({ done: 0, again: 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const q = queue[idx] as QueueCard | undefined;
  const dir = q?.dir ?? "cloze";
  const needsTyping = ["cloze", "reverse", "fa2en", "fae", "audio"].includes(dir) && !(dir === "audio" && (q?.card.kind === "ef" || q?.card.kind === "fae"));
  const choices = useMemo(() => (q && (dir === "mcq_fa" || (dir === "audio" && (q.card.kind === "ef" || q.card.kind === "fae"))) ? mcqChoices(q.card) : []), [q, dir]);

  const current = q ? q.state : defaultState();
  const previews = fsrsPreview(current, dayIndex(), state.learner.retention ?? 0.9);

  const reveal = (right: boolean) => {
    setWasRight(right);
    setRevealed(true);
  };

  const check = () => {
    if (!q) return;
    if (dir === "mcq_fa" || (dir === "audio" && (q.card.kind === "ef" || q.card.kind === "fae"))) {
      if (!choice) return;
      reveal(choice === q.card.fa);
      return;
    }
    reveal(acceptable(q.card, input, dir));
  };

  const grade = async (g: number) => {
    if (!q || busy) return;
    setBusy(true);
    await fetch("/api/review/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: q.card.id, grade: g, dir }),
    });
    setSession((s) => ({ done: s.done + 1, again: s.again + (g === 1 ? 1 : 0) }));
    setBusy(false);
    setInput("");
    setChoice(null);
    setRevealed(false);
    setIdx((i) => i + 1);
    onChange();
  };

  if (loading) {
    return (
      <Card>
        <Spinner label="Building your queue" />
      </Card>
    );
  }

  if (!q) {
    const empty = (counts?.due ?? 0) === 0;
    return (
      <Card className="rah-pop py-14 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2fc273]/[0.14]">
          <CheckCircle2 className="h-9 w-9 text-[#2fc273]" />
        </div>
        <div className="mt-5 text-xl font-black tracking-tight text-[#f2f5fa]">
          {empty ? "Nothing is due. Memory is holding." : "Round finished."}
        </div>
        {session.done > 0 && (
          <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
            {session.done} reviewed, {session.again} missed. Missed cards come back today; the rest drift outward.
          </p>
        )}
        <div className="mt-7 flex justify-center gap-3">
          <Btn variant="soft" onClick={load}>
            <Undo2 className="h-4 w-4" /> Load another round
          </Btn>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress strip */}
      <div className="flex items-center justify-between text-xs font-semibold text-[#7d889c]">
        <span>
          Card {idx + 1} of {queue.length}
        </span>
        <div className="flex items-center gap-2">
          <Chip tone="blue">{DIR_LABEL[dir] ?? dir}</Chip>
          <Chip tone="emerald">{q.card.level}</Chip>
          <Chip>{q.card.skill}</Chip>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#232b3a]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#4e8cff] to-[#4cc9f0] transition-all duration-500"
          style={{ width: `${(idx / queue.length) * 100}%` }}
        />
      </div>

      <Card key={idx} className="rah-pop min-h-72">
        <PromptBody q={q} dir={dir} revealed={revealed} correct={wasRight} />

        {/* mcq choices */}
        {choices.length > 0 && !revealed && (
          <div className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {choices.map((c) => (
              <button
                key={c}
                onClick={() => setChoice(c)}
                className={`rounded-2xl border-2 px-4 py-3.5 text-sm font-semibold transition-all active:scale-[.99] ${
                  choice === c
                    ? "border-[#4e8cff] bg-[#4e8cff]/[0.12] text-[#cfe0ff]"
                    : "border-[#2a3242] text-[#b7c1d3] hover:border-[#3f4c63] hover:bg-white/[0.03]"
                }`}
              >
                <FA className="text-[#f2f5fa]">{c}</FA>
              </button>
            ))}
          </div>
        )}

        {choices.length > 0 && revealed && (
          <div className="mt-7 text-center">
            {wasRight ? (
              <div className="rah-pop flex items-center justify-center gap-2 font-bold text-[#2fc273]">
                <CheckCircle2 className="h-5 w-5" /> Correct.
              </div>
            ) : (
              <div className="rah-pop flex flex-col items-center gap-1.5 text-[#ff8ba0]">
                <div className="flex items-center gap-2 font-bold">
                  <XCircle className="h-5 w-5" /> The right meaning:
                </div>
                <FA className="text-base font-bold text-[#f2f5fa]">{q.card.fa}</FA>
              </div>
            )}
          </div>
        )}

        {/* typed input */}
        {needsTyping && !revealed && (
          <form
            className="mt-8 flex gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            <input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer"
              className="min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[#4e8cff]"
              dir="ltr"
              autoComplete="off"
            />
            <Btn type="submit" variant="go" disabled={!input.trim()}>
              Check
            </Btn>
          </form>
        )}

        {needsTyping && revealed && (
          <div className="rah-pop mt-7">
            <div className={`flex items-center gap-2 text-sm font-bold ${wasRight ? "text-[#2fc273]" : "text-[#ff8ba0]"}`}>
              {wasRight ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              {wasRight ? "Correct." : "You wrote:"}
              {!wasRight && <span className="text-[#dbe3f0]">{input || "(empty)"}</span>}
            </div>
            {!wasRight && (
              <div className="mt-3 rounded-2xl border border-white/[0.06] bg-[#141924] p-4 text-sm leading-relaxed">
                <div className="font-bold text-[#7fe0ac]">
                  Answer: {dir === "fa2en" ? q.card.en : q.card.answer}
                </div>
                {dir !== "fa2en" && <div className="mt-1 text-[#b7c1d3]">{q.card.en}</div>}
                {q.card.note && <div className="mt-1 text-[#8b96a9]">{q.card.note}</div>}
              </div>
            )}
          </div>
        )}

        {/* grade buttons: the four keys */}
        {revealed && (
          <div className="mt-8 border-t border-white/[0.06] pt-5">
            <div className="mb-3 text-center text-xs font-semibold text-[#7d889c]">
              How well did it come back? Intervals shown are live.
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(
                [
                  ["Again", 1, "bg-[#ff6b81] hover:bg-[#ff8194] text-white [--rah-edge:#c2475c]", previews[0]],
                  ["Hard", 2, "bg-[#ffb02e] hover:bg-[#ffc055] text-[#221400] [--rah-edge:#b87715]", previews[1]],
                  ["Good", 3, "bg-[#2fc273] hover:bg-[#45d687] text-[#062012] [--rah-edge:#1d8f52]", previews[2]],
                  ["Easy", 4, "bg-[#4e8cff] hover:bg-[#66a0ff] text-white [--rah-edge:#2650a3]", previews[3]],
                ] as const
              ).map(([label, g, cls, ivl]) => (
                <button
                  key={label}
                  onClick={() => grade(g)}
                  disabled={busy}
                  className={`rah-3d rounded-2xl px-3 py-3 text-sm font-black uppercase tracking-wide transition-all active:scale-[.99] disabled:opacity-50 ${cls}`}
                >
                  {label}
                  <span className="ml-1.5 font-bold normal-case opacity-75">{fmtIvl(ivl)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!revealed && choices.length > 0 && (
          <div className="mt-5 text-center">
            <Btn variant="soft" onClick={() => reveal(false)}>
              I do not know
            </Btn>
          </div>
        )}
      </Card>

      {counts && (
        <div className="flex items-center justify-center gap-3 text-xs font-medium text-[#7d889c]">
          <span>{counts.due} due in deck</span>
          <span className="text-[#3a4356]">·</span>
          <span>{counts.newLeft} new left today</span>
          <span className="text-[#3a4356]">·</span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[#4cc9f0]" /> intervals target {(state.learner.retention ?? 0.9) * 100}% retention
          </span>
        </div>
      )}
    </div>
  );
}
