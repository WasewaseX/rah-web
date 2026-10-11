"use client";

// Placement: adaptive MCQ ladder across four sections, then one writing
// sample graded by the built-in AI. Result tunes every schedule.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, ArrowRight, Target } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "./ui";
import { handCoach } from "@/lib/bus";
import type { AppState } from "./App";

interface Item {
  id: string;
  q: string;
  choices: string[];
}
interface QuizQ {
  phase: "quiz";
  sec: string;
  secIndex: number;
  sections: number;
  idx: number;
  rung: string;
  item: Item;
}
type GetRes = QuizQ | { phase: "writing" } | { phase: "done"; level: string; writingLevel: string };
interface AnswerRes {
  correct: boolean;
  key?: string;
  trapLabel?: string;
  phase: string;
  sec?: string;
  secIndex?: number;
  idx?: number;
  rung?: string;
  item?: Item | null;
}
interface DoneRes {
  phase: "done";
  level: string;
  writingLevel: string;
  mcq: string;
  reasons: string;
  traps?: { tag: string; label: string; count: number }[];
}

const SEC_LABEL: Record<string, string> = {
  grammar: "Grammar",
  vocab: "Vocabulary",
  collocation: "Collocation",
  reading: "Reading",
};

const WRITING_PROMPT =
  "Some people say money cannot buy happiness, others say poverty guarantees misery. Write 120 to 180 words giving your view with one example from life.";

export default function PlacementView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [q, setQ] = useState<QuizQ | null>(null);
  const [phase, setPhase] = useState<"intro" | "quiz" | "writing" | "done">("intro");
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; trap: string } | null>(null);
  const [writing, setWriting] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<DoneRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQ = useCallback(async () => {
    const r = await fetch("/api/placement", { cache: "no-store" });
    const j: GetRes = await r.json();
    if (j.phase === "quiz") {
      setQ(j as QuizQ);
      setPhase("quiz");
    } else if (j.phase === "writing") {
      setPhase("writing");
    } else if (j.phase === "done") {
      setPhase("done");
    }
  }, []);

  useEffect(() => {
    if (phase === "done") return; // keep the fresh result on screen
    if (state.learner.placementPhase === "done") {
      setPhase("done");
      setDone({
        phase: "done",
        level: state.learner.level,
        writingLevel: state.learner.level,
        mcq: state.learner.level,
        reasons: "You already measured yourself. Retake only if your level changed.",
      });
    } else if (state.learner.placementPhase === "writing") {
      setPhase("writing");
    }
  }, [state.learner.placementPhase, state.learner.level, phase]);

  const start = async () => {
    setBusy(true);
    const r = await fetch("/api/placement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const j = await r.json();
    setQ(j);
    setPhase("quiz");
    setBusy(false);
  };

  const answer = async (c: string) => {
    if (!q || chosen) return;
    setChosen(c);
    setBusy(true);
    const r = await fetch("/api/placement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", itemId: q.item.id, choice: c }),
    });
    const j: AnswerRes = await r.json();
    setCorrect(j.correct);
    setFeedback(j.correct ? null : { key: j.key ?? "", trap: j.trapLabel ?? "" });
    setBusy(false);
    // A miss is a teaching moment: hold the explanation on screen long enough
    // to actually read it, then move on.
    setTimeout(async () => {
      setChosen(null);
      setCorrect(null);
      setFeedback(null);
      if (j.phase === "writing") {
        setPhase("writing");
        return;
      }
      if (j.item) setQ({ ...q, item: j.item, idx: j.idx ?? q.idx, rung: j.rung ?? q.rung, sec: j.sec ?? q.sec, secIndex: j.secIndex ?? q.secIndex });
    }, j.correct ? 900 : 4200);
  };

  const submitWriting = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "writing", text: writing }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Grading failed.");
      setDone(j);
      setPhase("done");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (phase === "intro") {
    return (
      <Card className="rah-pop py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-white shadow-[0_16px_36px_-12px_rgba(78,140,255,.6)]">
          <Target className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-2xl font-black tracking-tight text-[#f2f5fa]">Find your level</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#a9b4c6]">
          Four adaptive sections: grammar, vocabulary, collocation, reading. Two right in a row moves you up, one miss moves you down. Then one short
          writing sample the AI grades against CEFR descriptors. About ten minutes, and every schedule after this is tuned to the result.
        </p>
        <Btn onClick={start} disabled={busy} className="mt-7">
          {busy ? "Starting" : "Start placement"} <ArrowRight className="h-4 w-4" />
        </Btn>
      </Card>
    );
  }

  if (phase === "quiz" && q) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs font-semibold text-[#7d889c]">
          <span>
            {SEC_LABEL[q.sec]} · question {q.idx + 1}
          </span>
          <Chip tone="blue">
            Section {(q.secIndex ?? 0) + 1} of {q.sections}
          </Chip>
        </div>
        <Card key={q.item.id} className="rah-pop">
          <p className="whitespace-pre-line text-lg font-bold leading-relaxed tracking-tight text-[#e7ecf5]">{q.item.q}</p>
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {q.item.choices.map((c) => {
              const isChosen = chosen === c;
              const showRight = chosen && correct !== null && c === q.item.choices.find((x) => x === c) && isChosen;
              return (
                <button
                  key={c}
                  onClick={() => answer(c)}
                  disabled={!!chosen || busy}
                  className={`min-h-12 rounded-2xl border-2 px-4 py-3.5 text-sm font-semibold transition-all active:scale-[.99] ${
                    showRight
                      ? "border-[#2fc273] bg-[#2fc273]/[0.12] text-[#c4f2d8]"
                      : isChosen
                        ? "border-[#ff6b81] bg-[#ff6b81]/[0.1] text-[#ffc9d2]"
                        : chosen
                          ? "border-[#232b3a] text-[#5c6678]"
                          : "border-[#2a3242] text-[#b7c1d3] hover:border-[var(--rah-primary)]/60 hover:bg-[var(--rah-primary)]/[0.07]"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
          {chosen && correct !== null && (
            <div className="rah-pop mt-5">
              <div className={`flex items-center justify-center gap-2 text-sm font-black ${correct ? "text-[#2fc273]" : "text-[#ff8ba0]"}`}>
                {correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {correct ? "Right." : "Missed."}
              </div>
              {!correct && feedback && (
                <div className="mt-3 rounded-2xl border border-[#3a3242] bg-[#1a1620] px-4 py-3 text-center">
                  <p className="text-sm font-bold text-[#e7ecf5]">
                    Correct answer: <span className="text-[#2fc273]">{feedback.key}</span>
                  </p>
                  {feedback.trap && <p className="mt-1 text-xs font-semibold text-[#b8a8d8]">The trap: {feedback.trap}</p>}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (phase === "writing") {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <Chip tone="blue">Final step</Chip>
          <p className="mt-4 text-lg font-bold leading-relaxed tracking-tight text-[#e7ecf5]">{WRITING_PROMPT}</p>
          <textarea
            value={writing}
            onChange={(e) => setWriting(e.target.value)}
            rows={8}
            placeholder="Write here. Natural mistakes are useful; perfect sentences copied from elsewhere are not."
            className="mt-5 w-full resize-none rounded-2xl border-2 border-[#2a3242] bg-[#141924] p-4 text-sm leading-relaxed text-[#e7ecf5] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]"
          />
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7d889c]">{writing.trim().split(/\s+/).filter(Boolean).length} words</span>
            <Btn onClick={submitWriting} disabled={busy || writing.trim().length < 40}>
              {busy ? "Grading" : "Submit for grading"}
            </Btn>
          </div>
        </Card>
        {busy && (
          <Card>
            <Spinner label="The built-in AI is reading your sample against CEFR descriptors" />
          </Card>
        )}
        {error && <Note tone="rose">{error}</Note>}
      </div>
    );
  }

  if (phase === "done" && done) {
    const traps = done.traps ?? [];
    const huntTraps = () => {
      // Orchestration: hand the coach the next move. The examiner's weakness
      // quota already knows these families from the fold.
      handCoach("Make me an exam that hunts my weak spots and recurring mistakes");
    };
    return (
      <Card className="rah-pop py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2fc273]/[0.14]">
          <CheckCircle2 className="h-9 w-9 text-[#2fc273]" />
        </div>
        <div className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[#5f8fe8]">Your measured level</div>
        <div className="mt-2 text-5xl font-black tracking-tight text-[var(--rah-primary)]">{done.level}</div>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#a9b4c6]">{done.reasons}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {done.writingLevel && done.writingLevel !== done.level && <Chip tone="amber">Writing sample: {done.writingLevel}</Chip>}
        </div>
        {traps.length > 0 && (
          <div className="mx-auto mt-6 max-w-md rounded-3xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.05] px-5 py-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#ffb02e]">Traps to watch</div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#a9b4c6]">
              These leaked in your placement. The coach already remembers them - every exam will hunt them until two clean hits retire each one.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {traps.map((t) => (
                <span key={t.tag} className="rounded-full border border-[#ffb02e]/30 bg-[#ffb02e]/10 px-3 py-1 text-xs font-bold text-[#ffd88f]">
                  {t.label}
                  {t.count > 1 && <span className="ml-1 text-[#b8a8d8]">×{t.count}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
        {traps.length > 0 ? (
          <Btn onClick={huntTraps} className="mt-6">
            Hunt these traps now <ArrowRight className="h-4 w-4" />
          </Btn>
        ) : null}
        <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-[#7d889c]">
          Schedules, card order, and coach prompts now target this level. Retake every few weeks as a real measurement.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <Spinner />
    </Card>
  );
}
