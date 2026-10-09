"use client";

// Graded readings: the texts double as quiz sources. One tap sends a
// reading to the built-in AI and a retrieval quiz comes back.

import { useCallback, useMemo, useState } from "react";
import { BookOpen, Clock, Sparkles, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "./ui";
import { READINGS } from "@/lib/content";
import type { AppState } from "./App";

interface Quiz {
  title: string;
  items: { type: string; q: string; choices?: string[]; a: string; why: string; fa: string }[];
}

export default function ReadView({ state }: { state: AppState }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Record<string, Quiz>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const reading = useMemo(() => READINGS.find((r) => r.id === openId), [openId]);

  const makeQuiz = useCallback(async (id: string) => {
    const r0 = READINGS.find((x) => x.id === id);
    if (!r0) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: r0.text, source: `reading:${id}` }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Quiz generation failed.");
      setQuiz((q) => ({ ...q, [id]: j }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }, []);

  if (!reading) {
    return (
      <div className="flex flex-col gap-4">
        {state.learner.level !== "?" && (
          <p className="text-sm leading-relaxed text-[#a9b4c6]">
            Six texts, all written around the science this app runs on. Read once for meaning, then quiz yourself. Level {state.learner.level}.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {READINGS.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="group text-left">
              <Card className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:border-white/[0.14] group-hover:shadow-[0_16px_40px_-20px_rgba(78,140,255,.35)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ff6b81]/[0.12] text-[#ffa3b1]">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-extrabold tracking-tight text-[#f2f5fa]">{r.title}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Chip tone="blue">{r.level}</Chip>
                      <span className="flex items-center gap-1 text-xs font-semibold text-[#7d889c]">
                        <Clock className="h-3 w-3" /> {r.minutes} min
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const q = quiz[reading.id];
  const rightCount = q ? q.items.filter((it, i) => checked[reading.id] && answers[`${reading.id}:${i}`] === it.a).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Btn variant="ghost" onClick={() => setOpenId(null)}>
          <ArrowLeft className="h-4 w-4" /> All readings
        </Btn>
        <div className="flex items-center gap-2">
          <Chip tone="blue">{reading.level}</Chip>
          <Chip>{reading.minutes} min</Chip>
        </div>
      </div>

      <Card>
        <h2 className="text-2xl font-black tracking-tight text-[#f2f5fa]">{reading.title}</h2>
        <div className="mt-5 flex flex-col gap-4 border-l-2 border-[var(--rah-primary)]/25 pl-5 text-[15px] leading-loose text-[#c3cddd]">
          {reading.text.split("\n").filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </Card>

      {!q && (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rah-primary)]/[0.12]">
            <Sparkles className="h-6 w-6 text-[#9dc0ff]" />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
            Read it once for meaning. Then have the built-in AI turn this text into a retrieval quiz: collocations, phrasal verbs, inference.
          </p>
          <Btn onClick={() => makeQuiz(reading.id)} disabled={busyId === reading.id}>
            {busyId === reading.id ? "Building" : "Quiz me on this text"}
          </Btn>
          {busyId === reading.id && <Spinner />}
          {error && <Note tone="rose">{error}</Note>}
        </Card>
      )}

      {q && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">{q.title}</span>
            {checked[reading.id] && (
              <Chip tone="emerald">
                {rightCount} / {q.items.length}
              </Chip>
            )}
          </div>
          <div className="mt-5 flex flex-col gap-6">
            {q.items.map((it, i) => {
              const key = `${reading.id}:${i}`;
              return (
                <div key={i}>
                  <p className="text-sm font-bold leading-relaxed text-[#e7ecf5]">
                    {i + 1}. {it.q}
                  </p>
                  {it.choices ? (
                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {it.choices.map((c) => {
                        const picked = answers[key] === c;
                        const right = checked[reading.id] && c === it.a;
                        const wrong = checked[reading.id] && picked && c !== it.a;
                        return (
                          <button
                            key={c}
                            onClick={() => !checked[reading.id] && setAnswers((a) => ({ ...a, [key]: c }))}
                            className={`min-h-12 rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm transition-all active:scale-[.99] ${
                              right
                                ? "border-[#2fc273] bg-[#2fc273]/[0.12] font-bold text-[#c4f2d8]"
                                : wrong
                                  ? "border-[#ff6b81] bg-[#ff6b81]/[0.1] text-[#ffc9d2]"
                                  : picked
                                    ? "border-[var(--rah-primary)] bg-[var(--rah-primary)]/[0.1] font-bold text-[#e7ecf5]"
                                    : "border-[#2a3242] text-[#b7c1d3] hover:border-[#3f4c63] hover:bg-white/[0.03]"
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      value={answers[key] ?? ""}
                      onChange={(e) => !checked[reading.id] && setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                      disabled={checked[reading.id]}
                      placeholder="Type the missing words"
                      className="mt-2.5 min-h-12 w-full rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-3.5 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[var(--rah-primary)] disabled:opacity-60"
                    />
                  )}
                  {checked[reading.id] && (
                    <div className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-[#8b96a9]">
                      {answers[key] === it.a ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2fc273]" />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff6b81]" />
                      )}
                      <span>
                        <b className="text-[#c3cddd]">{it.a}</b> · {it.why}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!checked[reading.id] ? (
            <Btn className="mt-6" onClick={() => setChecked((c) => ({ ...c, [reading.id]: true }))}>
              Check answers
            </Btn>
          ) : (
            <div className="mt-6 flex gap-3">
              <Btn
                variant="soft"
                onClick={() => {
                  setAnswers({});
                  setChecked((c) => ({ ...c, [reading.id]: false }));
                }}
              >
                Retry
              </Btn>
              <Btn variant="soft" onClick={() => setOpenId(null)}>
                Back to readings
              </Btn>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
