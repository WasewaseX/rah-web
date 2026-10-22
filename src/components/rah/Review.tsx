"use client";

// Review: the multi-direction retrieval loop. One item, many roads in:
// gap-fill, meaning to English, English to meaning, listening. FSRS-5
// schedules what comes back and when.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, Volume2, Undo2, Sparkles, Zap, Grid2x2Check, RotateCcw as RotateCcwIcon, Flag } from "lucide-react";
import { Btn, Card, Chip, FA, Spinner } from "./ui";
import type { AppState } from "./App";
import { preview as fsrsPreview, dayIndex, fmtIvl, defaultState, type FsrsState } from "@/lib/fsrs";
import { DECK } from "@/lib/content";
import { setCoachActivity } from "@/lib/activity-store";
import { submitGrade, count as outboxCount } from "@/lib/offline";
import BlitzDeck from "./games/BlitzDeck";
import PairsGame from "./games/PairsGame";
import { provenanceOf } from "@/lib/provenance";

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
  tiles?: string[];
  ahead?: boolean;
}

interface QueueCounts {
  due: number;
  newLeft: number;
  reviewedToday: number;
  seen: number;
  unseen: number;
  nextDue: number | null;
  dueTomorrow: number;
  due3days: number;
  newPerDay: number;
}

const DIR_LABEL: Record<string, string> = {
  cloze: "Fill the gap",
  reverse: "Spot the phrase",
  fa2en: "Farsi to English",
  mcq_fa: "Meaning check",
  fae: "Produce the English",
  audio: "Listening recall",
  bank: "Build the sentence",
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
        {revealed && (
          <>
            <div className="mt-4 text-sm text-[#8b96a9]">{card.note}</div>
            <div className="mt-1 text-[11px] text-white/30">
              {provenanceOf(card.id).label} — {provenanceOf(card.id).detail}
            </div>
          </>
        )}
      </div>
    );
  }
  if (dir === "bank") {
    return (
      <div className="text-center">
        <FA className="text-[26px] font-bold leading-snug text-[#f2f5fa]">{card.fa}</FA>
        <div className="mt-3 text-sm text-[#8b96a9]">Build the English sentence from the tiles below.</div>
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
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-white shadow-[0_10px_24px_-8px_rgba(78,140,255,.6)] transition-transform hover:scale-105 active:scale-95"
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
  const [mode, setMode] = useState<"classic" | "blitz" | "pairs">("classic");
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refilling, setRefilling] = useState(false);
  const [aheadMode, setAheadMode] = useState(false);
  const [aheadEmpty, setAheadEmpty] = useState(false);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(0);
  const [session, setSession] = useState({ done: 0, again: 0 });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/review/queue", { cache: "no-store" });
    const j = await r.json();
    setQueue(j.batch ?? []);
    setCounts(j.counts ?? null);
    setAheadMode(false);
    setAheadEmpty(false);
    setIdx(0);
    setSession({ done: 0, again: 0 });
    setLoading(false);
  }, []);

  // Pull the next round without tearing down the session stats. Used by the
  // auto-continue after the last card (Again cards come straight back) and by
  // Keep practicing (extra rounds on cards scheduled for later days).
  const refreshCounts = useCallback(async () => {
    const r = await fetch("/api/review/queue", { cache: "no-store" });
    const j = await r.json();
    setCounts(j.counts ?? null);
  }, []);

  const nextRound = useCallback(async (ahead: boolean) => {
    setRefilling(true);
    try {
      const r = await fetch(`/api/review/queue${ahead ? "?ahead=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      setCounts(j.counts ?? null);
      if ((j.batch ?? []).length > 0) {
        setQueue(j.batch);
        setAheadMode(ahead && j.mode === "ahead");
        setAheadEmpty(false);
        setIdx(0);
      } else {
        setQueue([]);
        setAheadMode(false);
        if (ahead) setAheadEmpty(true);
      }
    } finally {
      setRefilling(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const q = queue[idx] as QueueCard | undefined;
  const dir = q?.dir ?? "cloze";
  const needsTyping = ["cloze", "reverse", "fa2en", "fae", "audio"].includes(dir) && !(dir === "audio" && (q?.card.kind === "ef" || q?.card.kind === "fae"));
  const isBank = dir === "bank";
  const tiles = isBank && q?.tiles ? q.tiles : [];
  const choices = useMemo(() => (q && (dir === "mcq_fa" || (dir === "audio" && (q.card.kind === "ef" || q.card.kind === "fae"))) ? mcqChoices(q.card) : []), [q, dir]);

  const current = q ? q.state : defaultState();
  const previews = fsrsPreview(current, dayIndex(), state.learner.retention ?? 0.9);

  // The coach reads this store when the learner asks about "this question":
  // the exact prompt, the answer for the current direction, and what the
  // learner has already typed/picked. Cleared on unmount so it can go stale.
  useEffect(() => {
    if (!q) {
      setCoachActivity(null);
      return;
    }
    const c = q.card;
    const answerFor =
      dir === "fa2en" || dir === "bank"
        ? c.en
        : dir === "mcq_fa" || (dir === "audio" && (c.kind === "ef" || c.kind === "fae"))
          ? c.fa
          : c.answer;
    setCoachActivity({
      surface: "review",
      dir,
      prompt: dir === "cloze" ? c.prompt : dir === "mcq_fa" ? c.en : c.fa,
      answer: answerFor,
      en: c.en,
      fa: c.fa,
      note: c.note,
      choices: choices.length ? choices : undefined,
      tiles: tiles.length ? tiles : undefined,
      typed: isBank
        ? picked.map((i) => tiles[i]).join(" ")
        : choice ?? input,
      revealed,
    });
    return () => setCoachActivity(null);
  }, [q, dir, choices, tiles, picked, choice, input, revealed, isBank]);

  const reveal = (right: boolean) => {
    setWasRight(right);
    setRevealed(true);
  };

  // Review feature #17 (the 7.4/10 wave): flag this item for human review.
  // The flag lands in a queue the coach sees in read_state - never a black hole.
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagKind, setFlagKind] = useState("wrong_answer");
  const [flagNote, setFlagNote] = useState("");
  const [flagMsg, setFlagMsg] = useState("");
  useEffect(() => {
    setFlagOpen(false);
    setFlagMsg("");
    setFlagNote("");
  }, [idx]);
  const FLAG_KINDS = [
    { k: "wrong_answer", label: "Wrong answer" },
    { k: "bad_explanation", label: "Bad explanation" },
    { k: "bad_farsi", label: "Wrong Farsi" },
    { k: "typo", label: "Typo" },
    { k: "other", label: "Other" },
  ];
  const submitFlag = async () => {
    setFlagMsg("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: q?.card.id ?? "", kind: flagKind, note: flagNote }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not send the flag.");
      setFlagMsg(j.duplicate ? "Already in the queue - thanks for the double check." : "Flagged. The coach sees it on the next state read and it goes to the review queue.");
      setFlagOpen(false);
      setFlagNote("");
    } catch (e) {
      setFlagMsg((e as Error).message);
    }
  };

  const check = () => {
    if (!q) return;
    if (isBank) {
      if (picked.length === 0) return;
      reveal(acceptable(q.card, picked.map((i) => tiles[i]).join(" "), "fa2en"));
      return;
    }
    if (dir === "mcq_fa" || (dir === "audio" && (q.card.kind === "ef" || q.card.kind === "fae"))) {
      if (!choice) return;
      reveal(choice === q.card.fa);
      return;
    }
    reveal(acceptable(q.card, input, dir));
  };

  // Suspend: the learner's escape hatch from a card that keeps hurting. The
  // card leaves every queue immediately; FSRS state is kept for unsuspend.
  const suspendCard = async () => {
    if (!q || busy) return;
    setBusy(true);
    await fetch("/api/review/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: q.card.id, suspended: true }),
    });
    setBusy(false);
    setInput("");
    setChoice(null);
    setPicked([]);
    setRevealed(false);
    setIdx((i) => i + 1);
    onChange();
  };

  const grade = async (g: number) => {
    if (!q || busy) return;
    setBusy(true);
    // Real offline sync (Task 68): the POST carries a gid idempotency key; if
    // the network is gone the grade lands in the local outbox and the
    // reconnect flush replays it - the server answers replays with the
    // original response, so nothing double-counts. The session counter still
    // advances (the attempt was real); the badge announces the queue.
    const res = await submitGrade(q.card.id, g, dir);
    if (!res.online) setOfflineQueued(outboxCount());
    setSession((s) => ({ done: s.done + 1, again: s.again + (g === 1 ? 1 : 0) }));
    setBusy(false);
    setInput("");
    setChoice(null);
    setPicked([]);
    setRevealed(false);
    const wasLast = idx + 1 >= queue.length;
    setIdx((i) => i + 1);
    // Auto-continue: when the round runs dry, silently pull the next one (same
    // mode). Today's Again cards roll straight back in; if the day's honest
    // budget is spent, the finished screen takes over with a schedule outlook.
    if (wasLast) void nextRound(aheadMode);
    onChange();
  };

  if (mode === "blitz") {
    return <BlitzDeck state={state} onChange={onChange} onExit={() => setMode("classic")} />;
  }
  if (mode === "pairs") {
    return (
      <div className="flex flex-col gap-4">
        <PairsGame onExit={() => {
          setMode("classic");
          onChange();
          void load();
        }} />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <Spinner label="Building your queue" />
      </Card>
    );
  }

  if (!q) {
    if (refilling) {
      return (
        <Card>
          <Spinner label="Checking for more…" />
        </Card>
      );
    }
    const empty = (counts?.due ?? 0) === 0;
    const forecast: string[] = [];
    if (counts?.nextDue != null) {
      const gap = counts.nextDue - dayIndex();
      forecast.push(gap <= 0 ? "next card back today" : gap === 1 ? "next card back tomorrow" : `next card back in ${gap} days`);
    }
    if ((counts?.dueTomorrow ?? 0) > 0) forecast.push(`${counts!.dueTomorrow} due tomorrow`);
    if ((counts?.newLeft ?? 0) > 0) forecast.push(`${counts!.newLeft} new left today`);
    const budgetSpent =
      (counts?.newLeft ?? 0) === 0 && (counts?.reviewedToday ?? 0) >= (counts?.newPerDay ?? 10) && (counts?.unseen ?? 0) > 0;
    const canPracticeAhead = (counts?.seen ?? 0) > 0;
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
        {offlineQueued > 0 && (
          <p className="mx-auto mt-2 max-w-sm text-xs font-semibold text-[#f0dcae]" data-testid="review-offline-note">
            {offlineQueued} of those grade{offlineQueued === 1 ? " was" : "s were"} made offline and will sync automatically when the connection returns - nothing is lost, nothing is double-counted.
          </p>
        )}
        {forecast.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {forecast.map((f) => (
              <Chip key={f} tone="blue">
                {f}
              </Chip>
            ))}
          </div>
        )}
        {budgetSpent && (
          <div className="mx-auto mt-3 max-w-sm">
            <p className="text-xs leading-relaxed text-[#7d889c]">
              You met today's {counts!.newPerDay} new cards - that pace is what keeps future reviews small. Fresh items open tomorrow.
            </p>
            <DailyPaceStepper
              current={counts!.newPerDay}
              onChanged={() => {
                void refreshCounts();
                onChange();
              }}
            />
          </div>
        )}
        {aheadEmpty && (
          <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-[#7d889c]">
            Every card you know is already in today's round - nothing to pull forward.
          </p>
        )}
        {canPracticeAhead && (
          <>
            <div className="mt-7 flex justify-center gap-3">
              <Btn
                variant="go"
                onClick={() => void nextRound(true)}
              >
                <Zap className="h-4 w-4" /> Keep practicing
              </Btn>
            </div>
            <p className="mx-auto mt-2.5 max-w-xs text-[11px] leading-relaxed text-[#5c6678]">
              Pulls cards scheduled for later days. Early practice is safe - Rah folds it into your schedule.
            </p>
          </>
        )}
        {!canPracticeAhead && (
          <div className="mt-7 flex justify-center gap-3">
            <Btn variant="soft" onClick={load}>
              <Undo2 className="h-4 w-4" /> Refresh
            </Btn>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle: classic FSRS flow vs the swipe blitz vs the pairs sprint */}
      <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/[0.06] bg-[#141924] p-1.5">
        {(
          [
            ["classic", "Classic", RotateCcwIcon],
            ["blitz", "Blitz", Zap],
            ["pairs", "Pairs", Grid2x2Check],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              mode === id ? "bg-[var(--rah-primary)]/[0.16] text-[#9dc0ff]" : "text-[#8b96a9] hover:text-[#dbe3f0]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {/* Progress strip */}
      <div className="flex items-center justify-between text-xs font-semibold text-[#7d889c]">
        <span>
          Card {idx + 1} of {queue.length}
        </span>
        <div className="flex items-center gap-2">
          <Chip tone="blue">{DIR_LABEL[dir] ?? dir}</Chip>
          <Chip tone="emerald">{q.card.level}</Chip>
          <Chip>{q.card.skill}</Chip>
          {q.ahead && <Chip tone="amber">Extra practice</Chip>}
          <button
            onClick={() => setFlagOpen((o) => !o)}
            className={`rounded-full border p-2 transition-colors ${
              flagOpen ? "border-[#ff6b81]/50 bg-[#ff6b81]/[0.12] text-[#ff8ba0]" : "border-[#2a3242] text-[#7d889c] hover:border-[#3f4c63] hover:text-[#b7c1d3]"
            }`}
            aria-label="Report a problem with this item"
          >
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </div>
      {flagOpen && (
        <div className="rounded-2xl border border-[#ff6b81]/25 bg-[#ff6b81]/[0.05] p-3.5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#ff8ba0]">Report this item</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FLAG_KINDS.map((f) => (
              <button
                key={f.k}
                onClick={() => setFlagKind(f.k)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  flagKind === f.k ? "border-[#ff6b81]/60 bg-[#ff6b81]/[0.12] text-[#ff8ba0]" : "border-[#2a3242] text-[#8b96a9] hover:text-[#dbe3f0]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
            placeholder="What is wrong? (optional)"
            className="mt-2.5 w-full rounded-xl border border-[#2a3242] bg-[#141924] px-3 py-2 text-[13px] text-[#e7ecf5] outline-none placeholder:text-[#5c6678] focus:border-[#ff6b81]/50"
          />
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-xs text-[#a9b4c6]">{flagMsg}</span>
            <Btn variant="danger" onClick={() => void submitFlag()} className="!py-1.5 !text-xs">
              Send flag
            </Btn>
          </div>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#232b3a]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--rah-primary)] to-[var(--rah-accent)] transition-all duration-500"
          style={{ width: `${(idx / queue.length) * 100}%` }}
        />
      </div>

      {/* FSRS visibility: what the scheduler knows about this exact card. */}
      {q.state.reps > 0 ? (
        <div className="text-center text-[11px] font-medium text-[#5c6678]">
          {dayIndex() - q.state.last <= 0 ? "Reviewed today" : `Last seen ${dayIndex() - q.state.last}d ago`} · {q.state.reps} review{q.state.reps === 1 ? "" : "s"} ·{" "}
          {q.state.lastivl > 0 ? `normally returns every ${fmtIvl(q.state.lastivl)}` : "relearning - comes back within today's round"}
        </div>
      ) : (
        <div className="text-center text-[11px] font-medium text-[#5c6678]">First meeting. Rah schedules it from here.</div>
      )}

      {/* pb clears the mobile bottom nav (fixed, 62px): the 2x2 grade grid
          wraps on phones and its second row must be scrollable ABOVE the nav,
          never trapped underneath (Task 69 mobile audit finding). */}
      <Card key={idx} className="rah-pop min-h-72 pb-24 md:pb-5">
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
                    ? "border-[var(--rah-primary)] bg-[var(--rah-primary)]/[0.12] text-[#cfe0ff]"
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

        {/* word-bank tiles: tap to build, tap a built word to return it */}
        {isBank && !revealed && (
          <div className="mt-8">
            <div className="min-h-14 rounded-2xl border-2 border-dashed border-[#2a3242] bg-[#10141d] p-2.5">
              {picked.length === 0 ? (
                <div className="py-1.5 text-center text-sm text-[#5c6678]">Tap the words in order…</div>
              ) : (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {picked.map((i) => (
                    <button
                      key={`${i}-built`}
                      onClick={() => setPicked((p) => p.filter((x) => x !== i))}
                      className="rah-3d rounded-xl bg-[var(--rah-primary)] px-3 py-2 text-sm font-bold text-white [--rah-edge:var(--rah-primary-deep)] transition-transform active:scale-95"
                    >
                      {tiles[i]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {tiles.map((t, i) =>
                picked.includes(i) ? null : (
                  <button
                    key={`${i}-tile`}
                    onClick={() => setPicked((p) => [...p, i])}
                    className="rah-3d rounded-xl bg-[#232b3a] px-3 py-2 text-sm font-bold text-[#dbe3f0] [--rah-edge:#171d29] transition-transform hover:bg-[#2a3242] active:scale-95"
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            <div className="mt-4 flex justify-center">
              <Btn variant="go" disabled={picked.length === 0} onClick={check}>
                Check
              </Btn>
            </div>
          </div>
        )}

        {isBank && revealed && (
          <div className="rah-pop mt-7">
            <div className={`flex items-center justify-center gap-2 text-sm font-bold ${wasRight ? "text-[#2fc273]" : "text-[#ff8ba0]"}`}>
              {wasRight ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              {wasRight ? "Correct." : "The sentence builds as:"}
            </div>
            {!wasRight && (
              <div className="mt-3 rounded-2xl border border-white/[0.06] bg-[#141924] p-4 text-sm leading-relaxed">
                <div className="font-bold text-[#7fe0ac]">{q.card.en}</div>
                {q.card.note && <div className="mt-1 text-[#8b96a9]">{q.card.note}</div>}
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
              className="min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]"
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
                  ["Easy", 4, "bg-[var(--rah-primary)] hover:bg-[#66a0ff] text-white [--rah-edge:var(--rah-primary-deep)]", previews[3]],
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

        {!revealed && (choices.length > 0 || isBank) && (
          <div className="mt-5 text-center">
            <Btn variant="soft" onClick={() => reveal(false)}>
              I do not know
            </Btn>
          </div>
        )}

        <div className="mt-4 text-center">
          <button
            onClick={() => void suspendCard()}
            disabled={busy}
            title="Stops this card coming back - it keeps its schedule if you change your mind"
            className="min-h-[36px] px-2 py-2 text-[11px] font-semibold text-[#5d6879] transition-colors hover:text-[#ff8ba0] disabled:opacity-50"
          >
            Suspend this card
          </button>
        </div>
      </Card>

      {counts && (
        <div className="flex items-center justify-center gap-3 text-xs font-medium text-[#7d889c]">
          <span>{counts.due} due in deck</span>
          <span className="text-[#3a4356]">·</span>
          <span>{counts.newLeft} new left today</span>
          <span className="text-[#3a4356]">·</span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[var(--rah-accent)]" /> intervals target {(state.learner.retention ?? 0.9) * 100}% retention
          </span>
        </div>
      )}
    </div>
  );
}

// The learner's daily pace, in their hands (audit polish #1: configurable
// daily limits). One honest stepper: 3..30, persisted via /api/settings, and
// the badge/queue/forecast all inherit from that single field.
function DailyPaceStepper({ current, onChanged }: { current: number; onChanged: () => void }) {
  const [val, setVal] = useState(current);
  const [saved, setSaved] = useState(current);
  const [saving, setSaving] = useState(false);
  // Track the prop without setState-in-effect: re-sync only when the saved
  // server value actually moves past our optimistic edits.
  if (current !== saved) {
    setSaved(current);
    setVal(current);
  }

  const set = async (n: number) => {
    const clamped = Math.min(30, Math.max(3, n));
    if (clamped === val || saving) return;
    setVal(clamped);
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPerDay: clamped }),
    });
    setSaving(false);
    onChanged();
  };

  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#141924] px-3 py-1.5">
      <span className="text-[11px] font-semibold text-[#7d889c]">new cards / day</span>
      <button
        onClick={() => void set(val - 1)}
        disabled={saving || val <= 3}
        className="h-6 w-6 rounded-lg bg-[#232b3a] text-sm font-black text-[#c4cddc] transition-colors hover:bg-[#2c3547] disabled:opacity-40"
      >
        &minus;
      </button>
      <span className="w-6 text-center text-sm font-black text-[#f2f5fa]">{val}</span>
      <button
        onClick={() => void set(val + 1)}
        disabled={saving || val >= 30}
        className="h-6 w-6 rounded-lg bg-[#232b3a] text-sm font-black text-[#c4cddc] transition-colors hover:bg-[#2c3547] disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
