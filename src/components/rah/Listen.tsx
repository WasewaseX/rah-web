"use client";

// Listening decoder: five passes over one monologue. Gist, decode,
// shadow, transcript check, final pass. The AI writes fresh material at
// your level; the browser voices it.

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Eye, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "./ui";
import type { AppState } from "./App";

interface ListenQuiz {
  title: string;
  text: string;
  questions: { q: string; choices: string[]; a: string; why: string }[];
}

const PASSES = [
  { n: 1, name: "Gist", hint: "Play it once at normal speed. Do not write. Just catch what it is about." },
  { n: 2, name: "Decode", hint: "Play it again, slower. Pause wherever a phrase slips past you. Say that phrase out loud." },
  { n: 3, name: "Shadow", hint: "Play sentence by sentence and speak along, copying the rhythm, not the spelling." },
  { n: 4, name: "Transcript", hint: "Reveal the text. Mark the words your ear heard wrong. Those are your targets." },
  { n: 5, name: "Final", hint: "Hide it, play once more. It should sound twice as clear now. That is the learning." },
];

export default function ListenView({ state }: { state: AppState }) {
  const [topics, setTopics] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<ListenQuiz | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [pass, setPass] = useState(1);
  const [showText, setShowText] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    fetch("/api/listen", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setTopics(j.topics ?? []))
      .catch(() => setTopics([]));
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    };
  }, []);

  const generate = useCallback(
    async (topic: string) => {
      setBusy(true);
      setError(null);
      setQuiz(null);
      setShowText(false);
      setChecked(false);
      setAnswers({});
      setPass(1);
      try {
        const r = await fetch("/api/listen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Generation failed.");
        setQuiz(j);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const play = () => {
    if (!quiz) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(quiz.text);
    u.lang = "en-US";
    u.rate = rate;
    u.onend = () => setPlaying(false);
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };

  const score = quiz ? quiz.questions.filter((q, i) => answers[i] === q.a).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Pick a topic, get a fresh monologue at your level</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => generate(t)}
              disabled={busy}
              className="rounded-full border border-[#2a3242] bg-white/[0.03] px-4 py-2 text-xs font-bold text-[#b7c1d3] transition-all hover:border-[var(--rah-primary)]/60 hover:bg-[var(--rah-primary)]/[0.1] hover:text-[#cfe0ff] disabled:opacity-40"
            >
              {t}
            </button>
          ))}
        </div>
        {busy && (
          <div className="mt-5">
            <Spinner label="Writing and voicing a new piece" />
          </div>
        )}
        {error && (
          <div className="mt-5">
            <Note tone="rose">{error}</Note>
          </div>
        )}
      </Card>

      {quiz && (
        <>
          <div className="rah-rise">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold tracking-tight text-[#f2f5fa]">{quiz.title}</span>
                <Chip tone="cyan">Pass {pass} of 5</Chip>
              </div>

              {/* Pass stepper */}
              <div className="mt-5 grid grid-cols-5 gap-1.5">
                {PASSES.map((p) => (
                  <button
                    key={p.n}
                    onClick={() => {
                      setPass(p.n);
                      setShowText(p.n === 4);
                    }}
                    className={`rounded-xl px-1 py-2.5 text-center text-[11px] font-black uppercase tracking-wide transition-all ${
                      pass === p.n
                        ? "bg-gradient-to-br from-[var(--rah-primary)] to-[#3a6fd6] text-white shadow-[0_8px_18px_-8px_rgba(78,140,255,.6)]"
                        : "bg-white/[0.05] text-[#7d889c] hover:bg-white/[0.09] hover:text-[#b7c1d3]"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <Note tone="blue">{PASSES[pass - 1].hint}</Note>
              </div>

              {/* Player */}
              <div className="mt-6 flex flex-wrap items-center gap-3.5">
                <button
                  onClick={play}
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-white shadow-[0_12px_28px_-10px_rgba(78,140,255,.65)] transition-transform hover:scale-105 active:scale-95"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                </button>
                <div className="flex gap-1.5">
                  {[0.75, 1, 1.25].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRate(r)}
                      className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${
                        rate === r
                          ? "bg-[var(--rah-primary)] text-white shadow-[0_6px_14px_-6px_rgba(78,140,255,.6)]"
                          : "bg-white/[0.05] text-[#8b96a9] hover:bg-white/[0.1] hover:text-[#dbe3f0]"
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
                <Btn variant="ghost" className="text-xs" onClick={() => setShowText((s) => !s)}>
                  <Eye className="h-4 w-4" /> {showText ? "Hide transcript" : "Show transcript"}
                </Btn>
                <Btn variant="ghost" className="text-xs" onClick={play}>
                  <RotateCcw className="h-4 w-4" /> Replay
                </Btn>
              </div>

              {/* Transcript */}
              {showText && (
                <p className="mt-5 rounded-2xl border border-white/[0.05] bg-[#141924] p-[18px] text-sm leading-loose text-[#c3cddd]">
                  {quiz.text}
                </p>
              )}
            </Card>
          </div>

          <div className="rah-rise">
            <Card>
              <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Comprehension check</div>
              <div className="mt-5 flex flex-col gap-6">
                {quiz.questions.map((q, i) => (
                  <div key={i}>
                    <p className="text-sm font-bold leading-relaxed text-[#e7ecf5]">
                      {i + 1}. {q.q}
                    </p>
                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {q.choices.map((c) => {
                        const picked = answers[i] === c;
                        const right = checked && c === q.a;
                        const wrong = checked && picked && c !== q.a;
                        return (
                          <button
                            key={c}
                            onClick={() => !checked && setAnswers((a) => ({ ...a, [i]: c }))}
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
                    {checked && (
                      <div className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-[#8b96a9]">
                        {answers[i] === q.a ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2fc273]" />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff6b81]" />
                        )}
                        {q.why}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!checked ? (
                <Btn className="mt-6" onClick={() => setChecked(true)} disabled={Object.keys(answers).length < quiz.questions.length}>
                  Check answers
                </Btn>
              ) : (
                <div className="mt-6">
                  <Note tone={score >= 3 ? "emerald" : "amber"}>
                    {score} of {quiz.questions.length} right. {score < 3 ? "Run pass 2 and 3 again before a new topic." : "Your ear is holding. Try 1.25x next time."}
                  </Note>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
