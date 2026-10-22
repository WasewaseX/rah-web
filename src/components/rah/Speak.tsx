"use client";

// Speaking loop: two forced minutes, transcript diagnosis on four aspects,
// then a harder repeat with a real constraint. Output is the workout.

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Clock, Volume2 } from "lucide-react";
import { Btn, Card, Chip, FA, Note, ScoreRow, Spinner } from "./ui";
import ReadAloud from "./ReadAloud";
import type { AppState } from "./App";

interface Result {
  scores: { fluency: number; range: number; accuracy: number; delivery: number };
  errors: { bad: string; good: string; fa: string; trap: string }[];
  upgrades: { plain: string; better: string; fa: string }[];
  round2: { constraint: string; same_prompt: boolean };
  verdict: string;
  fa_note: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// SPEAK RE: measured improvement between attempts, straight from the engine's
// own rows. No AI in this panel - every number is a stored fact.
interface Analytics {
  trend: { at: string; round: number; accuracy: number; fluency: number; range: number; delivery: number }[];
  deltas: { prompt: string; r1: number; r2: number; overallDelta: number; accuracyDelta: number }[];
  traps: { tag: string; label: string; count: number; evidence: string; resolved: boolean }[];
  totals: { sessions: number; avgAccuracy: number; bestAccuracy: number; retried: number; improved: number };
}

function ImprovementPanel({ tick }: { tick: number }) {
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => {
    fetch("/api/speak/analytics", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setA(j.trend ? j : null))
      .catch(() => setA(null));
  }, [tick]);
  if (!a || a.totals.sessions === 0) return null;
  return (
    <div className="rah-rise">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Improvement ledger</div>
          <Chip tone="cyan">every number is a stored session</Chip>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { k: "Sessions", v: a.totals.sessions },
            { k: "Avg accuracy", v: a.totals.avgAccuracy },
            { k: "Best", v: a.totals.bestAccuracy },
            { k: "Retries beaten", v: `${a.totals.improved}/${a.totals.retried}` },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-[#2a3242] bg-[#141924] p-3">
              <div className="text-lg font-black tabular-nums text-[#f2f5fa]">{s.v}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d889c]">{s.k}</div>
            </div>
          ))}
        </div>
        {a.trend.length >= 2 && (
          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d889c]">Accuracy per session</div>
            <div className="mt-2 flex h-16 items-end gap-1.5">
              {a.trend.map((t, i) => (
                <div
                  key={i}
                  title={`R${t.round}: accuracy ${t.accuracy}`}
                  style={{ height: `${Math.max(6, (t.accuracy / 10) * 100)}%` }}
                  className={`min-w-[10px] flex-1 rounded-t-md ${t.round === 2 ? "bg-[#ffb02e]/70" : "bg-[#7fe0ac]/60"}`}
                />
              ))}
            </div>
          </div>
        )}
        {a.deltas.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {a.deltas.slice(0, 4).map((d, i) => (
              <span
                key={i}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  d.overallDelta > 0
                    ? "border-[#7fe0ac]/30 bg-[#7fe0ac]/[0.08] text-[#7fe0ac]"
                    : "border-[#2a3242] text-[#8b96a9]"
                }`}
              >
                round 1 &rarr; 2: {d.overallDelta > 0 ? "+" : ""}
                {d.overallDelta} overall
              </span>
            ))}
          </div>
        )}
        {a.traps.filter((t) => !t.resolved).length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d889c]">Recurring spoken traps</div>
            <div className="mt-2 flex flex-col gap-2">
              {a.traps
                .filter((t) => !t.resolved)
                .slice(0, 3)
                .map((t) => (
                  <div key={t.tag} className="rounded-xl border border-[#2a3242] bg-[#141924] p-2.5 text-xs text-[#a9b4c6]">
                    <span className="font-bold text-[#f2f5fa]">{t.label}</span>
                    <span className="text-[#7d889c]"> ({t.count}x)</span>
                    {t.evidence ? <span className="block truncate text-[#7d889c]">{t.evidence}</span> : null}
                  </div>
                ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// SPEAK RE part 2: free spoken conversation. Scenario pick -> speak back and
// forth (browser ASR in, speechSynthesis out) -> deterministic report. The
// spoken sibling of VoiceArena's fixed shadowing.
interface Scenario {
  id: string;
  title: string;
  scene: string;
  goal: string;
  opening: string;
}
interface Corr {
  wrong: string;
  right: string;
  fa: string;
  trap: string;
}
interface Turn {
  you: string;
  coach: string;
  corrections: Corr[];
}

function say(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* no tts; the line is always visible */
  }
}

function ConversationDrill({ onChange }: { onChange: () => void }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scen, setScen] = useState<Scenario | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiDown, setAiDown] = useState(false); // degraded honesty (audit P1-7)
  const [report, setReport] = useState<{ scores: Record<string, number>; turns: number; corrections: number } | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const hasSpeech = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    fetch("/api/speak/conversation", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setScenarios(j.scenarios ?? []))
      .catch(() => setScenarios([]));
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* */
      }
    };
  }, []);

  const pick = (s: Scenario) => {
    setScen(s);
    setTurns([{ you: "", coach: s.opening, corrections: [] }]);
    setTranscript("");
    setReport(null);
    setError("");
    setAiDown(false);
    say(s.opening);
  };

  const record = () => {
    setError("");
    if (!hasSpeech) return;
    const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ?? (
      window as unknown as { SpeechRecognition: new () => SpeechRecognitionLike }
    ).SpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) add += e.results[i][0].transcript + " ";
      }
      setTranscript((t) => (t + " " + add).trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* */
    }
  };

  const sendTurn = useCallback(
    async (end: boolean) => {
      const you = transcript.trim();
      if (!scen || (!you && !end)) return;
      setBusy(true);
      setError("");
      try {
        const history = turns.filter((t) => t.you).map((t) => ({ you: t.you, coach: t.coach }));
        const trapCount = turns.reduce((a, t) => a + t.corrections.length, 0);
        const r = await fetch("/api/speak/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId: scen.id, turns: [...history, { you, coach: turns[turns.length - 1]?.coach ?? "" }].slice(-6), end, trapCount }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "The coach lost the scene.");
        if (end) {
          setReport(j.report ?? { scores: {}, turns: turns.length, corrections: trapCount });
          setTranscript("");
          onChange();
          return;
        }
        setAiDown(Boolean(j.degraded));
        setTurns((t) => [...t, { you, coach: j.coachLine ?? "...", corrections: j.corrections ?? [] }]);
        setTranscript("");
        say(String(j.coachLine ?? ""));
        onChange();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [scen, transcript, turns, onChange],
  );

  if (!scen) {
    return (
      <Card>
        <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Talk: free conversation</div>
        <p className="mt-1 text-sm leading-relaxed text-[#a9b4c6]">
          Pick a scene. The coach speaks first, you answer out loud, and the scene moves. Up to 6 turns, trap-tagged corrections as you go, a report at the end.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s)}
              className="rounded-2xl border border-[#2a3242] bg-[#141924] p-3.5 text-left transition-colors hover:border-[var(--rah-primary)]/40"
            >
              <div className="text-sm font-extrabold text-[#f2f5fa]">{s.title}</div>
              <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#7d889c]">{s.scene}</div>
            </button>
          ))}
          {scenarios.length === 0 && <p className="text-sm text-[#7d889c]">Scenarios are loading...</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Talk: {scen.title}</div>
        <div className="flex items-center gap-2">
          <Chip tone="cyan">
            turn {Math.max(1, turns.filter((t) => t.you).length + 1)} / 6
          </Chip>
          <button onClick={() => { setScen(null); setTurns([]); setReport(null); }} className="text-xs font-bold text-[#7d889c] hover:text-[#dbe3f0]">
            leave scene
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {aiDown && (
          <Note tone="amber">
            The AI scene partner dropped mid-scene, so its last reply is a placeholder. Send your next line and it tries again - nothing about your progress is fake.
          </Note>
        )}
        {turns.map((t, i) => (
          <div key={i} className="flex flex-col gap-2">
            {t.coach && (
              <div className="max-w-[85%] self-start rounded-2xl rounded-bl-sm border border-[#2a3242] bg-[#141924] px-3.5 py-2.5 text-sm leading-relaxed text-[#dbe3f0]">
                {t.coach}
                <button onClick={() => say(t.coach)} className="ml-2 align-middle text-[#7d889c] hover:text-[#f2f5fa]" aria-label="Replay the line">
                  <Volume2 className="inline h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {t.you && (
              <div className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-[var(--rah-primary)]/[0.14] px-3.5 py-2.5 text-sm leading-relaxed text-[#cfe0ff]">{t.you}</div>
            )}
            {t.corrections.map((c, k) =>
              c.wrong ? (
                <div key={k} className="self-start rounded-xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] px-3 py-2 text-xs">
                  <span className="text-[#ff8ba0] line-through">{c.wrong}</span> <span className="font-black text-[#7fe0ac]">{c.right}</span>
                  <FA className="mt-1 block">{c.fa}</FA>
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>

      {report ? (
        <div className="mt-5 rounded-2xl border border-[#7fe0ac]/25 bg-[#7fe0ac]/[0.05] p-4">
          <div className="text-sm font-extrabold text-[#7fe0ac]">Scene report</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(report.scores).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[#2a3242] bg-[#141924] p-2.5">
                <div className="text-base font-black tabular-nums text-[#f2f5fa]">{v}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#7d889c]">{k}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#a9b4c6]">
            {report.turns} turn{report.turns === 1 ? "" : "s"}, {report.corrections} correction{report.corrections === 1 ? "" : "s"}. Scores are computed from what happened in the scene, not an opinion. The conversation lands in your Improvement ledger.
          </p>
          <Btn variant="warm" className="mt-3" onClick={() => { setScen(null); setTurns([]); setReport(null); }}>
            <RotateCcw className="h-4 w-4" /> Another scene
          </Btn>
        </div>
      ) : (
        <>
          <input
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={hasSpeech ? "Your recognized words land here - edit anything the recognizer got wrong, then send." : "No speech recognition here - type your line instead, the scene runs the same."}
            className="mt-4 w-full rounded-xl border border-[#2a3242] bg-[#141924] px-3.5 py-2.5 text-sm text-[#e7ecf5] outline-none placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]/50"
          />
          {error && <Note tone="rose">{error}</Note>}
          <div className="mt-4 flex items-center gap-2.5">
            <Btn onClick={listening ? () => { try { recRef.current?.stop(); } catch { /* */ } } : record} variant={listening ? "danger" : "primary"} className={listening ? "rah-pulse" : ""} disabled={busy}>
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {listening ? "Stop" : busy ? "Thinking" : "Speak"}
            </Btn>
            <Btn onClick={() => void sendTurn(false)} disabled={busy || transcript.trim().length < 2} variant="warm">
              {busy ? "Coach is replying" : "Send the turn"}
            </Btn>
            <button onClick={() => void sendTurn(true)} disabled={busy} className="text-xs font-bold text-[#7d889c] hover:text-[#dbe3f0]">
              end the scene
            </button>
          </div>
          {!hasSpeech && (
            <p className="mt-3 text-xs leading-relaxed text-[#7d889c]">
              This browser cannot transcribe speech. Type your lines in the monologue box below and run the scene from there.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

export default function SpeakView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [mode, setMode] = useState<"mono" | "talk" | "read">("mono");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(120);
  const [transcript, setTranscript] = useState("");
  const [round, setRound] = useState(1);
  const [constraint, setConstraint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ledgerTick, setLedgerTick] = useState(0);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSpeech = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    fetch("/api/speak", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setPrompts(j.prompts ?? []))
      .catch(() => setPrompts([]));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopEverything = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setRecording(false);
  }, []);

  const tick = useCallback(() => {
    setSeconds((s) => {
      if (s <= 1) {
        stopEverything();
        return 0;
      }
      return s - 1;
    });
  }, [stopEverything]);

  const start = () => {
    setError(null);
    setResult(null);
    setTranscript("");
    setSeconds(120);
    setRecording(true);
    if (hasSpeech) {
      const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition: new () => SpeechRecognitionLike }).SpeechRecognition;
      if (Ctor) {
        const rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (e) => {
          let add = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) add += e.results[i][0].transcript + " ";
          }
          setTranscript((t) => (t + " " + add).trim());
        };
        rec.onend = () => setRecording(false);
        recRef.current = rec;
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    }
    timerRef.current = setInterval(tick, 1000);
  };

  const stop = () => {
    stopEverything();
  };

  const submit = useCallback(async () => {
    if (transcript.trim().length < 30) {
      setError("The transcript is too short. Speak the full two minutes, or type what you said if your browser cannot listen.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[prompt] ?? "", transcript, round }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Diagnosis failed.");
      setResult(j);
      setLedgerTick((t) => t + 1);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [prompts, prompt, transcript, round, onChange]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("mono")}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
            mode === "mono" ? "border-[#ffb02e]/60 bg-[#ffb02e]/[0.12] text-[#ffd08a]" : "border-[#2a3242] text-[#8b96a9] hover:text-[#dbe3f0]"
          }`}
        >
          Monologue drill
        </button>
        <button
          onClick={() => setMode("talk")}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
            mode === "talk" ? "border-[#ffb02e]/60 bg-[#ffb02e]/[0.12] text-[#ffd08a]" : "border-[#2a3242] text-[#8b96a9] hover:text-[#dbe3f0]"
          }`}
        >
          Talk: conversation
        </button>
        <button
          onClick={() => setMode("read")}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
            mode === "read" ? "border-[#ffb02e]/60 bg-[#ffb02e]/[0.12] text-[#ffd08a]" : "border-[#2a3242] text-[#8b96a9] hover:text-[#dbe3f0]"
          }`}
        >
          Read aloud
        </button>
      </div>

      {mode === "talk" ? (
        <ConversationDrill onChange={onChange} />
      ) : mode === "read" ? (
        <ReadAloud onChange={onChange} />
      ) : (
      <>
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Round {round}</span>
          {round === 2 && constraint && <Chip tone="amber">constraint active</Chip>}
        </div>
        <p className="mt-4 text-lg font-bold leading-relaxed tracking-tight text-[#e7ecf5]">
          {constraint ?? prompts[prompt] ?? "Talk for 2 minutes on anything that matters to you."}
        </p>
        {!constraint && prompts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(i);
                  setResult(null);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
                  prompt === i
                    ? "border-[#ffb02e]/60 bg-[#ffb02e]/[0.12] text-[#ffd08a]"
                    : "border-[#2a3242] text-[#8b96a9] hover:border-[#3f4c63] hover:text-[#dbe3f0]"
                }`}
              >
                Prompt {i + 1}
              </button>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-col items-center gap-5">
          <div className={`flex items-center gap-2.5 font-mono text-[40px] font-black tabular-nums tracking-tight ${recording ? "text-[#ff6b81]" : "text-[#f2f5fa]"}`}>
            <Clock className="h-7 w-7" /> {mm}:{ss}
          </div>
          {!recording ? (
            <Btn onClick={start} variant={round === 2 ? "warm" : "primary"} className="px-10">
              <Mic className="h-4 w-4" /> {transcript ? "Record again" : "Start speaking"}
            </Btn>
          ) : (
            <Btn onClick={stop} variant="danger" className="rah-pulse px-10">
              <Square className="h-4 w-4" /> Stop
            </Btn>
          )}
          {!hasSpeech && (
            <p className="max-w-sm text-center text-xs leading-relaxed text-[#7d889c]">
              This browser cannot transcribe speech. Record yourself elsewhere, then paste or type what you said below. The diagnosis works the same.
            </p>
          )}
        </div>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={5}
          placeholder="Your words land here while you speak. Edit anything the recognizer got wrong before submitting."
          className="mt-7 w-full resize-none rounded-2xl border-2 border-[#2a3242] bg-[#141924] p-4 text-sm leading-relaxed text-[#e7ecf5] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[#ffb02e]/70"
        />
        <div className="mt-4 flex justify-end">
          <Btn onClick={submit} disabled={busy || transcript.trim().length < 30} variant="warm">
            {busy ? "Diagnosing" : "Diagnose this round"}
          </Btn>
        </div>
      </Card>

      {busy && (
        <Card>
          <Spinner label="Scoring fluency, range, accuracy, delivery" />
        </Card>
      )}
      {error && <Note tone="rose">{error}</Note>}

      {result && (
        <>
          <div className="rah-rise">
            <Card>
              <div className="mb-5 text-sm font-extrabold tracking-tight text-[#f2f5fa]">Four aspect diagnosis</div>
              <div className="flex flex-col gap-3.5">
                <ScoreRow name="Fluency" value={result.scores.fluency} />
                <ScoreRow name="Range" value={result.scores.range} tone="cyan" />
                <ScoreRow name="Accuracy" value={result.scores.accuracy} tone={result.scores.accuracy < 6 ? "rose" : "emerald"} />
                <ScoreRow name="Delivery" value={result.scores.delivery} tone="amber" />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-[#a9b4c6]">{result.verdict}</p>
              <FA className="mt-2.5 block text-sm">{result.fa_note}</FA>
            </Card>
          </div>

          {result.errors.length > 0 && (
            <div className="rah-rise">
              <Card>
                <div className="mb-4 text-sm font-extrabold tracking-tight text-[#f2f5fa]">What to fix</div>
                <div className="flex flex-col gap-3">
                  {result.errors.map((e, i) => (
                    <div key={i} className="rounded-2xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] p-3.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[#ff8ba0] line-through">{e.bad}</span>
                        <span className="font-black text-[#7fe0ac]">{e.good}</span>
                      </div>
                      <FA className="mt-1.5 block text-xs leading-loose">{e.fa}</FA>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div className="rah-rise">
            <Card className="border-[#ffb02e]/25 bg-gradient-to-br from-[#221c10] to-[var(--rah-surface)]">
              <div className="text-sm font-extrabold tracking-tight text-[#ffd08a]">Round 2 constraint</div>
              <p className="mt-2 text-sm leading-relaxed text-[#dbe3f0]">{result.round2.constraint}</p>
              <Btn
                variant="warm"
                className="mt-5"
                onClick={() => {
                  setRound(2);
                  setConstraint(result.round2.constraint);
                  setResult(null);
                  setTranscript("");
                  setSeconds(120);
                  onChange();
                }}
              >
                <RotateCcw className="h-4 w-4" /> Repeat the task, harder
              </Btn>
            </Card>
          </div>
        </>
      )}
      </>
      )}

      <ImprovementPanel tick={ledgerTick} />
    </div>
  );
}
